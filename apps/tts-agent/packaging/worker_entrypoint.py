import sys

from readji_tts_agent.renderer import _worker_main


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] != "--worker":
        print("Readji TTS Agent Worker is an internal component. Start Readji TTS Agent.exe instead.")
        raise SystemExit(1)
    _worker_main()
