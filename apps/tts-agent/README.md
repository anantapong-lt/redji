# Readji TTS Agent

Windows application for writers to render their own novel chapters with their GPU.

## Install

Use Python 3.12 with a CUDA-enabled PyTorch installation appropriate for the writer's NVIDIA driver, then install this app from this folder:

```powershell
pip install -e .
readji-tts-agent
```

On first job start, the app checks and downloads FFmpeg for Windows x64 with a
progress dialog, verifies its pinned SHA-256 checksum, and installs it under
`%LOCALAPPDATA%/Readji/TTS Agent/tools/ffmpeg/8.1.2/`. No administrator permission,
WinGet installation, or PATH changes are required. The download comes from
[Gyan's FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/); an interrupted download
can be retried from the dialog. Jobs are not claimed until FFmpeg is ready.

VoxCPM2 downloads `openbmb/VoxCPM2` when its local model cache is missing.

Copy legally usable reference WAVs into `assets/voices/Basic/`:

- `Basic_old_male.wav`
- `Basic_young_male.wav`
- `Basic_female.wav`

The agent never stores the writer's password. It stores only the refresh token in Windows Credential Manager. Development builds connect to `http://localhost:4000`; packaged deployments set `READJI_TTS_API_URL` during launch or packaging.
