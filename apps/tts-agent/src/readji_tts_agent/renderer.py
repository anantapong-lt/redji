from __future__ import annotations

from pathlib import Path
from enum import Enum
import faulthandler
import json
import os
from queue import Empty, Queue
import re
import subprocess
import sys
import tempfile
from threading import Event, Lock, Thread
import time
from typing import Callable

from .ffmpeg_setup import verify_ffmpeg


VOICE_FILES = {
    "old_male": "Basic_old_male.wav",
    "young_male": "Basic_young_male.wav",
    "female": "Basic_female.wav",
}

MAXIMUM_CHUNK_CHARACTERS = 480
INFERENCE_TIMESTEPS = 6


class RenderError(RuntimeError):
    pass


class WorkerMessage(str, Enum):
    PRELOAD = "preload"
    RENDER = "render"
    PROGRESS = "progress"
    RESULT = "result"
    ERROR = "error"
    STOP = "stop"


class VoxCpmRenderer:
    """Qt-facing proxy. CUDA objects never leave the worker's main thread."""

    def __init__(self, voices_root: Path) -> None:
        self.voices_root = voices_root
        self.compile_enabled = os.environ.get("READJI_TTS_COMPILE", "1") != "0"
        self._process: subprocess.Popen | None = None
        self._reader: Thread | None = None
        self._messages: Queue = Queue()
        self._lock = Lock()
        self._shutdown = Event()
        self.ready = False

    @property
    def is_ready(self) -> bool:
        return self.ready and self._process is not None and self._process.poll() is None

    def _start(self) -> None:
        if self._process is not None and self._process.poll() is None:
            return
        self._dispose()
        self._messages = Queue()
        worker_arguments = ["--worker", str(self.voices_root), "1" if self.compile_enabled else "0"]
        command = (
            [sys.executable, *worker_arguments]
            if getattr(sys, "frozen", False)
            else [sys.executable, "-u", "-m", "readji_tts_agent.renderer", *worker_arguments]
        )
        self._process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            encoding="utf-8", bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        self._reader = Thread(target=self._read_messages, args=(self._process.stdout, self._messages), daemon=True)
        self._reader.start()

    @staticmethod
    def _read_messages(stream, messages: Queue) -> None:
        try:
            for line in stream:
                messages.put(json.loads(line))
        except (OSError, ValueError) as error:
            messages.put({"type": WorkerMessage.ERROR, "message": f"Worker IPC: {error}"})
        finally:
            messages.put(None)

    def _request(self, command: dict, progress=None, check_cancel=None) -> dict:
        with self._lock:
            try:
                if check_cancel is not None:
                    check_cancel()
                if self._shutdown.is_set():
                    raise RenderError("กำลังปิดตัวประมวลผลเสียง")
                self._start()
                self._process.stdin.write(json.dumps(command, ensure_ascii=True) + "\n")
                self._process.stdin.flush()
                while True:
                    if check_cancel is not None:
                        check_cancel()
                    if self._shutdown.is_set():
                        raise RenderError("กำลังปิดตัวประมวลผลเสียง")
                    try:
                        message = self._messages.get(timeout=0.2)
                    except Empty:
                        if self._process.poll() is not None:
                            raise self._exit_error()
                        continue
                    if message is None:
                        raise self._exit_error()
                    kind = message["type"]
                    if kind == WorkerMessage.PROGRESS and progress is not None:
                        progress(message["done"], message["total"])
                    elif kind == WorkerMessage.RESULT:
                        self.ready = True
                        return message
                    elif kind == WorkerMessage.ERROR:
                        raise RenderError(message["message"])
            except (BrokenPipeError, OSError) as error:
                failure = self._exit_error()
                self._dispose()
                raise failure from error
            except BaseException:
                # A cancelled/failed request must never leave a render running.
                self._dispose()
                raise

    def _exit_error(self) -> RenderError:
        code = self._process.poll() if self._process is not None else None
        if code is None and self._process is not None:
            try:
                code = self._process.wait(timeout=0.2)
            except subprocess.TimeoutExpired:
                pass
        detail = f"0x{code & 0xFFFFFFFF:08X}" if code is not None else "IPC disconnected"
        return RenderError(
            f"ตัวประมวลผลเสียงหยุดทำงาน ({detail}) แอปหลักยังทำงานอยู่ "
            "หากเกิดระหว่าง compile ให้เปิดแอปใหม่ด้วย READJI_TTS_COMPILE=0"
        )

    def preload(self) -> None:
        self._request({"type": WorkerMessage.PRELOAD})

    def render(self, text: str, voice_slot: str, progress: Callable[[int, int], None],
               check_cancel: Callable[[], None] | None = None) -> tuple[Path, float]:
        result = self._request({"type": WorkerMessage.RENDER, "text": text, "voice_slot": voice_slot}, progress, check_cancel)
        return Path(result["path"]), float(result["duration"])

    def request_shutdown(self) -> None:
        self._shutdown.set()

    def close(self) -> None:
        self.request_shutdown()
        with self._lock:
            if self._process is not None and self._process.poll() is None:
                try:
                    self._process.stdin.write(json.dumps({"type": WorkerMessage.STOP}) + "\n")
                    self._process.stdin.flush()
                    self._process.wait(timeout=2)
                except (OSError, subprocess.TimeoutExpired):
                    pass
            self._dispose()

    def _dispose(self) -> None:
        self.ready = False
        process = self._process
        if process is None:
            return
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if self._reader is not None:
            self._reader.join()
        try:
            process.stdin.close()
        except OSError:
            pass
        process.stdout.close()
        self._process = None
        self._reader = None


class _LocalVoxCpmRenderer:
    def __init__(self, voices_root: Path, optimize: bool) -> None:
        self.voices_root = voices_root
        self.optimize = optimize
        self.model = None
        self.sample_rate = 48_000

    def _load_model(self) -> None:
        if self.model is not None:
            return
        import torch
        from voxcpm import VoxCPM
        if not torch.cuda.is_available():
            raise RenderError("ไม่พบ NVIDIA CUDA GPU ที่พร้อมใช้งาน")
        self.model = VoxCPM.from_pretrained(
            "openbmb/VoxCPM2",
            device="cuda",
            load_denoiser=False,
            optimize=self.optimize,
        )
        self.sample_rate = int(self.model.tts_model.sample_rate)

    def preload(self) -> None:
        """Download (when needed) and keep VoxCPM2 resident on the local GPU."""
        self._load_model()

    def _reference_voice(self, voice_slot: str) -> Path:
        filename = VOICE_FILES.get(voice_slot)
        path = self.voices_root / "Basic" / (filename or "")
        if not filename or not path.is_file():
            raise RenderError(f"ไม่พบไฟล์เสียงอ้างอิงสำหรับ {voice_slot}: {path}")
        return path

    @staticmethod
    def _chunks(text: str, maximum: int = MAXIMUM_CHUNK_CHARACTERS) -> list[str]:
        sentences = [part.strip() for part in re.split(r"(?<=[.!?…])\s+|\n+", text) if part.strip()]
        chunks: list[str] = []
        current = ""
        for sentence in sentences:
            while len(sentence) > maximum:
                if current:
                    chunks.append(current)
                    current = ""
                split_at = sentence.rfind(" ", 0, maximum + 1)
                split_at = split_at if split_at > maximum // 2 else maximum
                chunks.append(sentence[:split_at].strip())
                sentence = sentence[split_at:].strip()
            next_text = f"{current} {sentence}".strip()
            if current and len(next_text) > maximum:
                chunks.append(current)
                current = sentence
            else:
                current = next_text
        if current:
            chunks.append(current)
        return chunks

    def render(self, text: str, voice_slot: str, progress: Callable[[int, int], None]) -> tuple[Path, float]:
        import soundfile as sf

        ffmpeg = verify_ffmpeg()
        self._load_model()
        reference = self._reference_voice(voice_slot)
        chunks = self._chunks(text)
        if not chunks:
            raise RenderError("ตอนนี้ไม่มีข้อความสำหรับสร้างเสียง")
        workspace = Path(tempfile.mkdtemp(prefix="readji-tts-"))
        wav_paths: list[Path] = []
        total_duration = 0.0
        render_started = time.monotonic()
        prompt_cache = self.model.tts_model.build_prompt_cache(reference_wav_path=str(reference))
        for index, chunk in enumerate(chunks, start=1):
            chunk_started = time.monotonic()
            audio, _, _ = self.model.tts_model.generate_with_prompt_cache(
                target_text=chunk,
                prompt_cache=prompt_cache,
                cfg_value=2.0,
                inference_timesteps=INFERENCE_TIMESTEPS,
                retry_badcase=True,
                retry_badcase_max_times=2,
            )
            audio = audio.squeeze(0).cpu().numpy()
            if audio.size == 0:
                raise RenderError("VoxCPM2 ส่งผลลัพธ์เสียงว่างกลับมา")
            path = workspace / f"{index:05d}.wav"
            sf.write(path, audio, self.sample_rate, subtype="PCM_16")
            wav_paths.append(path)
            total_duration += len(audio) / self.sample_rate
            elapsed = time.monotonic() - chunk_started
            print(f"[TTS] chunk {index}/{len(chunks)}: {elapsed:.2f}s, audio {len(audio) / self.sample_rate:.2f}s, RTF {elapsed / (len(audio) / self.sample_rate):.3f}", flush=True)
            progress(index, len(chunks))
        manifest = workspace / "inputs.txt"
        manifest.write_text("\n".join(f"file '{path.as_posix()}'" for path in wav_paths), encoding="utf-8")
        output = workspace / "full.mp3"
        try:
            subprocess.run([
                str(ffmpeg), "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
                "-ac", "1", "-ar", "32000", "-b:a", "32k", str(output),
            ], check=True, capture_output=True, text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        except FileNotFoundError as error:
            raise RenderError("ไม่พบ FFmpeg ของแอป กรุณากดเริ่มงานเพื่อติดตั้งใหม่") from error
        except subprocess.CalledProcessError as error:
            raise RenderError(error.stderr[-1000:] or "ffmpeg ไม่สามารถรวมไฟล์เสียงได้") from error
        elapsed = time.monotonic() - render_started
        print(f"[TTS] chapter: {elapsed:.2f}s, audio {total_duration:.2f}s, RTF {elapsed / total_duration:.3f} (excludes model preload)", flush=True)
        return output, total_duration


def _worker_main() -> None:
    # Keep the original stdout pipe exclusively for JSON. Redirect even native
    # library stdout to stderr so model logs cannot corrupt the IPC protocol.
    with os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", buffering=1) as protocol:
        os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
        sys.stdout = sys.stderr
        sys.stdin.reconfigure(encoding="utf-8")
        faulthandler.enable()

        def send(message: dict) -> None:
            protocol.write(json.dumps(message, ensure_ascii=True) + "\n")
            protocol.flush()

        renderer = _LocalVoxCpmRenderer(Path(sys.argv[2]), optimize=sys.argv[3] == "1")
        print(f"[TTS worker] PID={os.getpid()}, compile={renderer.optimize}, model execution=main thread", flush=True)
        for line in sys.stdin:
            try:
                command = json.loads(line)
                kind = WorkerMessage(command["type"])
                if kind == WorkerMessage.STOP:
                    return
                if kind == WorkerMessage.PRELOAD:
                    renderer.preload()
                    send({"type": WorkerMessage.RESULT})
                elif kind == WorkerMessage.RENDER:
                    output, duration = renderer.render(
                        command["text"], command["voice_slot"],
                        lambda done, total: send({"type": WorkerMessage.PROGRESS, "done": done, "total": total}),
                    )
                    send({"type": WorkerMessage.RESULT, "path": str(output), "duration": duration})
                else:
                    raise RenderError("คำสั่ง worker ไม่ถูกต้อง")
            except Exception as error:
                send({"type": WorkerMessage.ERROR, "message": f"{type(error).__name__}: {error}"})
                return


if __name__ == "__main__" and len(sys.argv) == 4 and sys.argv[1] == "--worker":
    _worker_main()
