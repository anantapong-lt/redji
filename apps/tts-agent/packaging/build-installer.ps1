[CmdletBinding()]
param(
    [string]$PythonCommand = "python",
    [string[]]$PythonArguments = @()
)

$ErrorActionPreference = "Stop"
$pythonVersion = & $PythonCommand $PythonArguments -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($LASTEXITCODE -ne 0 -or $pythonVersion -notmatch '^3\.(10|11|12)$') {
    throw "Python 3.10, 3.11, or 3.12 is required. Pass -PythonCommand and -PythonArguments when Python is installed elsewhere."
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsRoot = Join-Path $projectRoot "assets"
$requiredVoices = @(
    "voices/Basic/Basic_old_male.wav",
    "voices/Basic/Basic_young_male.wav",
    "voices/Basic/Basic_female.wav"
)

foreach ($voice in $requiredVoices) {
    if (-not (Test-Path -LiteralPath (Join-Path $assetsRoot $voice) -PathType Leaf)) {
        throw "Missing required reference voice: assets/$voice"
    }
}

$pyproject = Get-Content -LiteralPath (Join-Path $projectRoot "pyproject.toml") -Raw
if ($pyproject -notmatch '(?m)^version\s*=\s*"([^"]+)"') {
    throw "Could not read the application version from pyproject.toml."
}
$version = $Matches[1]
$entrypoint = Join-Path $PSScriptRoot "entrypoint.py"
$distPath = Join-Path $projectRoot "dist"
$workPath = Join-Path $projectRoot "build"

Push-Location $projectRoot
try {
    & $PythonCommand $PythonArguments -m PyInstaller --noconfirm --clean --windowed `
        --name "Readji TTS Agent" `
        --paths "src" `
        --add-data "$assetsRoot;assets" `
        --collect-all qfluentwidgets `
        --collect-all voxcpm `
        --collect-all soundfile `
        --collect-submodules keyring `
        --distpath $distPath `
        --workpath $workPath `
        $entrypoint

    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }

    $iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($null -eq $iscc) {
        throw "Inno Setup 6 is required. Install it, then run this script again."
    }
    & $iscc.Source "/DMyAppVersion=$version" (Join-Path $PSScriptRoot "installer.iss")
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
