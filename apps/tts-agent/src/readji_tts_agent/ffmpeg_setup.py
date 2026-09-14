from __future__ import annotations

import hashlib
import os
from pathlib import Path
import platform
import subprocess
import tempfile
from threading import Event
from typing import Callable
from zipfile import ZipFile

import httpx


FFMPEG_VERSION = "8.1.2"
FFMPEG_ARCHIVE_ROOT = f"ffmpeg-{FFMPEG_VERSION}-essentials_build"
FFMPEG_DOWNLOAD_URL = f"https://www.gyan.dev/ffmpeg/builds/packages/{FFMPEG_ARCHIVE_ROOT}.zip"
# Published at the same URL with the .sha256 suffix. Pin both release and digest.
FFMPEG_SHA256 = "db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec"
MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024
MAX_EXECUTABLE_BYTES = 512 * 1024 * 1024


class FFmpegSetupError(RuntimeError):
    pass


class FFmpegSetupCancelled(FFmpegSetupError):
    pass


def ffmpeg_path() -> Path:
    local_data = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    return local_data / "Readji" / "TTS Agent" / "tools" / "ffmpeg" / FFMPEG_VERSION / "ffmpeg.exe"


def verify_ffmpeg(path: Path | None = None) -> Path:
    executable = path or ffmpeg_path()
    if not executable.is_file():
        raise FFmpegSetupError("ยังไม่ได้ติดตั้ง FFmpeg สำหรับแอป กรุณากดเริ่มงานเพื่อติดตั้ง")
    try:
        result = subprocess.run(
            [str(executable), "-version"], capture_output=True, timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise FFmpegSetupError("ไม่สามารถเปิด FFmpeg ของแอปได้ กรุณาติดตั้งใหม่") from error
    if result.returncode != 0 or not result.stdout.startswith(b"ffmpeg version"):
        raise FFmpegSetupError("FFmpeg ของแอปไม่พร้อมใช้งาน กรุณาติดตั้งใหม่")
    return executable


def install_ffmpeg(progress: Callable[[int, int, str], None], cancelled: Event) -> Path:
    def check_cancelled() -> None:
        if cancelled.is_set():
            raise FFmpegSetupCancelled("ยกเลิกการติดตั้ง FFmpeg แล้ว")

    if os.name != "nt" or platform.machine().lower() not in ("amd64", "x86_64"):
        raise FFmpegSetupError("ตัวติดตั้ง FFmpeg นี้รองรับ Windows x64 เท่านั้น")
    check_cancelled()
    progress(0, 0, "กำลังตรวจสอบ FFmpeg ของแอป...")
    try:
        return verify_ffmpeg()
    except FFmpegSetupError:
        pass

    destination = ffmpeg_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Staging stays on the same volume for atomic publication; interrupted files
    # never appear at the final executable path. No archive paths are extracted.
    with tempfile.TemporaryDirectory(prefix="download-", dir=destination.parent) as staging:
        archive = Path(staging) / "ffmpeg.zip"
        digest = hashlib.sha256()
        downloaded = 0
        with httpx.stream("GET", FFMPEG_DOWNLOAD_URL, follow_redirects=True, timeout=15) as response:
            response.raise_for_status()
            if response.url.scheme != "https":
                raise FFmpegSetupError("ปฏิเสธการดาวน์โหลดที่ไม่ได้ใช้ HTTPS")
            total = int(response.headers.get("content-length", "0"))
            if total > MAX_DOWNLOAD_BYTES:
                raise FFmpegSetupError("ขนาดไฟล์ FFmpeg เกินขีดจำกัด")
            with archive.open("wb") as output:
                for chunk in response.iter_bytes(chunk_size=256 * 1024):
                    check_cancelled()
                    downloaded += len(chunk)
                    if downloaded > MAX_DOWNLOAD_BYTES:
                        raise FFmpegSetupError("ขนาดไฟล์ FFmpeg เกินขีดจำกัด")
                    output.write(chunk)
                    digest.update(chunk)
                    progress(downloaded, total, "กำลังดาวน์โหลด FFmpeg...")
        check_cancelled()
        progress(0, 0, "กำลังตรวจสอบ SHA-256 และเตรียมไฟล์...")
        if digest.hexdigest() != FFMPEG_SHA256:
            raise FFmpegSetupError("Checksum ของ FFmpeg ไม่ตรง ไฟล์อาจไม่สมบูรณ์ กรุณาลองใหม่")
        executable = Path(staging) / "ffmpeg.exe"
        with ZipFile(archive) as package:
            member = package.getinfo(f"{FFMPEG_ARCHIVE_ROOT}/bin/ffmpeg.exe")
            if member.file_size > MAX_EXECUTABLE_BYTES:
                raise FFmpegSetupError("ขนาดโปรแกรม FFmpeg เกินขีดจำกัด")
            with package.open(member) as source, executable.open("wb") as output:
                while chunk := source.read(256 * 1024):
                    check_cancelled()
                    output.write(chunk)
            # Preserve the publisher's accompanying licensing/readme material.
            for name in ("LICENSE", "README.txt"):
                member_name = f"{FFMPEG_ARCHIVE_ROOT}/{name}"
                if member_name in package.namelist():
                    info = package.getinfo(member_name)
                    if info.file_size <= 1024 * 1024:
                        (destination.parent / name).write_bytes(package.read(info))
        progress(0, 0, "กำลังตรวจสอบว่า FFmpeg เปิดใช้งานได้...")
        verify_ffmpeg(executable)
        check_cancelled()
        (destination.parent / "SOURCE.txt").write_text(
            f"Download: {FFMPEG_DOWNLOAD_URL}\nSHA256: {FFMPEG_SHA256}\n"
            "Build information and source links: https://www.gyan.dev/ffmpeg/builds/\n",
            encoding="utf-8",
        )
        os.replace(executable, destination)
    progress(1, 1, "FFmpeg พร้อมใช้งานแล้ว")
    return destination
