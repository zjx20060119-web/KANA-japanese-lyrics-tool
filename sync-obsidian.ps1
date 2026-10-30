$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$configPath = Join-Path $projectRoot "obsidian-sync-config.json"

function Get-SafeFileName {
    param([string]$Name)
    $safe = $Name -replace '[\\/:*?"<>|]', '-'
    $safe = $safe.Trim().TrimEnd('.')
    if ([string]::IsNullOrWhiteSpace($safe)) {
        return "Untitled"
    }
    if ($safe.Length -gt 100) {
        $safe = $safe.Substring(0, 100).Trim()
    }
    return $safe
}

function Format-YamlString {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return '""'
    }
    return ($Value | ConvertTo-Json -Compress)
}

function HtmlEncodeText {
    param([string]$Text)
    if ($null -eq $Text) {
        return ""
    }
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Test-Kanji {
    param([string]$Text)
    return [regex]::IsMatch(
        $Text,
        '[\u4E00-\u9FFF\u3005\u3006\u30F6]'
    )
}

function Test-HiraganaChar {
    param([char]$Char)
    $code = [int]$Char
    return (($code -ge 0x3040 -and $code -le 0x309F) -or $code -eq 0x30FC)
}

function Split-TrailingKana {
    param([string]$Surface, [string]$Reading)

    $surfaceChars = $Surface.ToCharArray()
    $readingChars = $Reading.ToCharArray()
    $suffixLength = 0

    while (
        $suffixLength -lt $surfaceChars.Length -and
        $suffixLength -lt $readingChars.Length
    ) {
        $surfaceChar = $surfaceChars[$surfaceChars.Length - 1 - $suffixLength]
        $readingChar = $readingChars[$readingChars.Length - 1 - $suffixLength]
        if (
            $surfaceChar -ne $readingChar -or
            -not (Test-HiraganaChar $surfaceChar)
        ) {
            break
        }
        $suffixLength += 1
    }

    $surfaceCount = $surfaceChars.Length - $suffixLength
    $readingCount = $readingChars.Length - $suffixLength
    $baseSurface = if ($surfaceCount -gt 0) {
        -join $surfaceChars[0..($surfaceCount - 1)]
    } else {
        ""
    }
    $baseReading = if ($readingCount -gt 0) {
        -join $readingChars[0..($readingCount - 1)]
    } else {
        ""
    }
    $suffix = if ($suffixLength -gt 0) {
        -join $surfaceChars[$surfaceCount..($surfaceChars.Length - 1)]
    } else {
        ""
    }

    return [pscustomobject]@{
        Surface = $baseSurface
        Reading = $baseReading
        Suffix = $suffix
    }
}

function Get-FuriganaHtml {
    param($Segment)

    $surface = [string]$Segment.surface
    if ([string]::IsNullOrEmpty($surface)) {
        return ""
    }

    $reading = [string]$Segment.effective_reading
    if ([string]::IsNullOrEmpty($reading)) {
        $reading = [string]$Segment.confirmed_reading
    }
    if ([string]::IsNullOrEmpty($reading)) {
        $reading = [string]$Segment.detected_reading
    }

    if ([string]::IsNullOrEmpty($reading) -or -not (Test-Kanji $surface)) {
        return HtmlEncodeText $surface
    }

    $parts = Split-TrailingKana $surface $reading
    if (
        [string]::IsNullOrEmpty($parts.Surface) -or
        [string]::IsNullOrEmpty($parts.Reading)
    ) {
        return HtmlEncodeText $surface
    }

    return (
        "<ruby>" +
        (HtmlEncodeText $parts.Surface) +
        '<rt style="color:#ff0000;font-size:0.48em;">' +
        (HtmlEncodeText $parts.Reading) +
        "</rt></ruby>" +
        (HtmlEncodeText $parts.Suffix)
    )
}

function Invoke-LibraryRequest {
    param([string]$Uri)
    $tempPath = Join-Path $env:TEMP (
        "kana-obsidian-" + [guid]::NewGuid().ToString("N") + ".json"
    )
    try {
        Invoke-WebRequest `
            -Uri $Uri `
            -UseBasicParsing `
            -TimeoutSec 60 `
            -OutFile $tempPath
        return (
            Get-Content -LiteralPath $tempPath -Raw -Encoding UTF8 |
                ConvertFrom-Json
        )
    } finally {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Host "Missing config: $configPath"
    exit 1
}

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$vaultPath = [string]$config.vaultPath
if ([string]::IsNullOrWhiteSpace($vaultPath)) {
    Write-Host "vaultPath is empty in $configPath"
    exit 1
}

if (-not (Test-Path -LiteralPath $vaultPath)) {
    New-Item -ItemType Directory -Force -Path $vaultPath | Out-Null
}

try {
    $library = Invoke-LibraryRequest "http://localhost:3000/api/library"
} catch {
    Write-Host "Lyrics tool is not running. Starting it..."
    & (Join-Path $projectRoot "start-app.ps1")
    Start-Sleep -Seconds 2
    $library = Invoke-LibraryRequest "http://localhost:3000/api/library"
}

$indexPath = Join-Path $vaultPath ".kana-sync-index.json"
$fileMap = @{}
$updatedMap = @{}

if (Test-Path -LiteralPath $indexPath) {
    try {
        $index = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8 |
            ConvertFrom-Json
        foreach ($property in $index.files.PSObject.Properties) {
            $fileMap[$property.Name] = [string]$property.Value
        }
        foreach ($property in $index.updatedAt.PSObject.Properties) {
            $updatedMap[$property.Name] = [string]$property.Value
        }
    } catch {
        Write-Host "Could not read the sync index; rebuilding it."
    }
}

$written = 0
$skipped = 0
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($item in @($library.documents)) {
    $id = [string]$item.id
    $updatedAt = if ($item.updated_at -is [datetime]) {
        $item.updated_at.ToString("o")
    } else {
        [string]$item.updated_at
    }

    if (-not $fileMap.ContainsKey($id)) {
        $baseName = Get-SafeFileName ([string]$item.title)
        $fileName = "$baseName.md"
        $counter = 1
        while (
            (Test-Path -LiteralPath (Join-Path $vaultPath $fileName)) -or
            ($fileMap.Values -contains $fileName)
        ) {
            $fileName = "$baseName ($counter).md"
            $counter += 1
        }
        $fileMap[$id] = $fileName
    }

    $targetPath = Join-Path $vaultPath $fileMap[$id]
    if (
        $updatedMap.ContainsKey($id) -and
        $updatedMap[$id] -eq $updatedAt -and
        (Test-Path -LiteralPath $targetPath)
    ) {
        $skipped += 1
        continue
    }

    $detail = Invoke-LibraryRequest (
        "http://localhost:3000/api/library/" + [uri]::EscapeDataString($id)
    )
    $document = $detail.document
    $summary = $detail.summary
    $title = if ([string]::IsNullOrWhiteSpace([string]$document.title)) {
        "Untitled"
    } else {
        [string]$document.title
    }
    $artist = [string]$document.artist
    $album = [string]$document.album
    $sourceUrl = [string]$document.source_url
    $bylineParts = @($artist, $album) | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    }
    $byline = $bylineParts -join " - "

    $markdown = New-Object System.Collections.Generic.List[string]
    $markdown.Add("---")
    $markdown.Add("kana_id: " + (Format-YamlString $id))
    $markdown.Add("title: " + (Format-YamlString $title))
    $markdown.Add("artist: " + (Format-YamlString $artist))
    $markdown.Add("album: " + (Format-YamlString $album))
    $markdown.Add("source_url: " + (Format-YamlString $sourceUrl))
    $markdown.Add("updated_at: " + (Format-YamlString $updatedAt))
    $markdown.Add("tags:")
    $markdown.Add("  - japanese-lyrics")
    $markdown.Add("  - KANA")
    $markdown.Add("---")
    $markdown.Add("")
    $markdown.Add("# " + $title)
    $markdown.Add("")
    if (-not [string]::IsNullOrWhiteSpace($byline)) {
        $markdown.Add((HtmlEncodeText $byline))
        $markdown.Add("")
    }
    $markdown.Add('<div class="kana-lyrics">')

    foreach ($line in @($document.lines)) {
        if ($line.is_blank) {
            $markdown.Add('<div style="height:20px;"></div>')
            continue
        }

        $segmentsHtml = (
            @($line.segments) |
                ForEach-Object { Get-FuriganaHtml $_ }
        ) -join ""
        $romaji = HtmlEncodeText ([string]$line.romaji)

        $markdown.Add('<div style="margin:10px 0;">')
        $markdown.Add(
            '<div style="font-family:''Yu Mincho'',''YuMincho'',serif;' +
            'font-size:25px;line-height:1.75;">' +
            $segmentsHtml +
            "</div>"
        )
        $markdown.Add(
            '<div style="font-family:''Calisto MT'',Georgia,serif;' +
            'font-size:13px;line-height:1.7;color:#606060;' +
            'margin-top:-8px;">' +
            $romaji +
            "</div>"
        )
        $markdown.Add("</div>")
    }

    $markdown.Add("</div>")
    $content = $markdown -join "`r`n"
    [System.IO.File]::WriteAllText($targetPath, $content, $utf8NoBom)

    $updatedMap[$id] = $updatedAt
    $written += 1
    Write-Host "Wrote: $($fileMap[$id])"
}

$indexObject = [pscustomobject]@{
    version = 1
    files = $fileMap
    updatedAt = $updatedMap
}
$indexObject |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $indexPath -Encoding UTF8

Write-Host ""
Write-Host "Sync complete: $written written, $skipped unchanged."
Write-Host "Vault: $vaultPath"
