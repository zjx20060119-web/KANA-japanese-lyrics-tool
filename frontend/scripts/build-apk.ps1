$ErrorActionPreference = "Stop"

$frontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectRoot = Resolve-Path (Join-Path $frontendRoot "..")

$jdkCandidates = @(
    (Join-Path $projectRoot ".tools\jdk21\jdk-21.0.13.0.2+1"),
    $env:JAVA_HOME
) | Where-Object {
    $_ -and (Test-Path -LiteralPath (Join-Path $_ "bin\java.exe"))
}
$jdkRoot = $jdkCandidates | Select-Object -First 1
if (-not $jdkRoot) {
    throw "JDK 21 was not found. Set JAVA_HOME or install JDK 21."
}

$sdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "C:\Android\Sdk"
) | Where-Object {
    $_ -and (Test-Path -LiteralPath (Join-Path $_ "platform-tools\adb.exe"))
}
$sdkRoot = $sdkCandidates | Select-Object -First 1
if (-not $sdkRoot) {
    throw "Android SDK was not found. Set ANDROID_HOME or install it at C:\Android\Sdk."
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$jdkRoot\bin;$sdkRoot\platform-tools;$sdkRoot\build-tools\36.0.0;$env:PATH"

$npmCommand = Get-Command "npm.cmd" -ErrorAction Stop
$npxCommand = Get-Command "npx.cmd" -ErrorAction Stop

Push-Location $frontendRoot
try {
    & $npmCommand.Source run build:web
    if ($LASTEXITCODE -ne 0) {
        throw "Static web build failed."
    }

    & $npxCommand.Source cap sync android
    if ($LASTEXITCODE -ne 0) {
        throw "Capacitor sync failed."
    }

    $gradlePath = Join-Path $projectRoot ".tools\gradle-8.14.3\gradle-8.14.3\bin\gradle.bat"
    if (-not (Test-Path -LiteralPath $gradlePath)) {
        $gradlePath = Join-Path $frontendRoot "android\gradlew.bat"
    }

    Push-Location (Join-Path $frontendRoot "android")
    try {
        & $gradlePath assembleDebug --console=plain
        if ($LASTEXITCODE -ne 0) {
            throw "Android APK build failed."
        }
    } finally {
        Pop-Location
    }

    $sourceApk = Join-Path $frontendRoot "android\app\build\outputs\apk\debug\app-debug.apk"
    $targetApk = Join-Path $projectRoot "KANA-debug.apk"
    Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($targetApk)
    try {
        $hash = [System.BitConverter]::ToString(
            $sha256.ComputeHash($stream)
        ).Replace("-", "")
    } finally {
        $stream.Dispose()
        $sha256.Dispose()
    }

    Write-Host ""
    Write-Host "APK built successfully: $targetApk"
    Write-Host "SHA256: $hash"
} finally {
    Pop-Location
}
