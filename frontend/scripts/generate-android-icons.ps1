$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$frontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectRoot = Resolve-Path (Join-Path $frontendRoot "..")
$resourceRoot = Join-Path $frontendRoot "android\app\src\main\res"
$docsRoot = Join-Path $projectRoot "docs"
$appRouteRoot = Join-Path $frontendRoot "app"
$glyphPath = Join-Path $frontendRoot "assets\kana-glyph.png"
$white = [System.Drawing.Color]::White
$border = [System.Drawing.Color]::FromArgb(255, 226, 226, 226)
$paper = [System.Drawing.Color]::FromArgb(255, 247, 244, 237)
$ink = [System.Drawing.Color]::FromArgb(255, 20, 20, 20)
$muted = [System.Drawing.Color]::FromArgb(255, 82, 82, 82)
$red = [System.Drawing.Color]::FromArgb(255, 255, 0, 0)

function ConvertFrom-CodePoints {
    param([int[]]$CodePoints)
    return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$subtitleText = ConvertFrom-CodePoints @(
    0x65E5,
    0x8BED,
    0x6B4C,
    0x8BCD,
    0x667A,
    0x80FD,
    0x6CE8,
    0x97F3
)
$furiganaText = ConvertFrom-CodePoints @(0x5047, 0x540D, 0x6CE8, 0x97F3)
$romajiText = ConvertFrom-CodePoints @(0x9010, 0x884C, 0x7F57, 0x9A6C, 0x97F3)
$translationText = ConvertFrom-CodePoints @(0x5FAE, 0x8F6F, 0x7FFB, 0x8BD1)

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc(
        $X + $Width - $diameter,
        $Y + $Height - $diameter,
        $diameter,
        $diameter,
        0,
        90
    )
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Get-InkBounds {
    param([System.Drawing.Bitmap]$Bitmap)
    $rect = New-Object System.Drawing.Rectangle(
        0,
        0,
        $Bitmap.Width,
        $Bitmap.Height
    )
    $data = $Bitmap.LockBits(
        $rect,
        [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
        $bytes = New-Object byte[] ($data.Stride * $data.Height)
        [System.Runtime.InteropServices.Marshal]::Copy(
            $data.Scan0,
            $bytes,
            0,
            $bytes.Length
        )
    } finally {
        $Bitmap.UnlockBits($data)
    }

    $minX = $Bitmap.Width
    $minY = $Bitmap.Height
    $maxX = -1
    $maxY = -1
    for ($y = 0; $y -lt $Bitmap.Height; $y += 1) {
        $row = $y * $data.Stride
        for ($x = 0; $x -lt $Bitmap.Width; $x += 1) {
            if ($bytes[$row + $x * 4 + 3] -gt 8) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -lt $minX -or $maxY -lt $minY) {
        throw "The kana glyph contains no visible pixels."
    }

    return New-Object System.Drawing.RectangleF(
        $minX,
        $minY,
        ($maxX - $minX + 1),
        ($maxY - $minY + 1)
    )
}

function Draw-CenteredGlyph {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$Bounds,
        [float]$CenterX,
        [float]$CenterY,
        [float]$TargetWidth
    )
    $aspect = $Bounds.Width / $Bounds.Height
    $targetHeight = $TargetWidth / $aspect
    $destination = New-Object System.Drawing.RectangleF(
        ($CenterX - $TargetWidth / 2),
        ($CenterY - $targetHeight / 2),
        $TargetWidth,
        $targetHeight
    )
    $Graphics.DrawImage(
        $Glyph,
        $destination,
        $Bounds,
        [System.Drawing.GraphicsUnit]::Pixel
    )
}

function Draw-IconShape {
    param(
        [System.Drawing.Graphics]$Graphics,
        [int]$Size,
        [ValidateSet("legacy", "round")]
        [string]$Variant
    )
    $borderWidth = [Math]::Max(1, [int]($Size * 0.012))
    $inset = $borderWidth / 2
    $fill = New-Object System.Drawing.SolidBrush($white)
    $stroke = New-Object System.Drawing.Pen($border, $borderWidth)
    $path = $null
    try {
        if ($Variant -eq "legacy") {
            $path = New-RoundedRectPath `
                -X $inset `
                -Y $inset `
                -Width ($Size - $borderWidth) `
                -Height ($Size - $borderWidth) `
                -Radius ([float]($Size * 0.18))
            $Graphics.FillPath($fill, $path)
            $Graphics.DrawPath($stroke, $path)
        } else {
            $diameter = $Size - $borderWidth
            $Graphics.FillEllipse($fill, $inset, $inset, $diameter, $diameter)
            $Graphics.DrawEllipse($stroke, $inset, $inset, $diameter, $diameter)
        }
    } finally {
        if ($path) { $path.Dispose() }
        $stroke.Dispose()
        $fill.Dispose()
    }
}

function New-IconBitmap {
    param(
        [int]$Size,
        [ValidateSet("legacy", "round", "foreground")]
        [string]$Variant,
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$GlyphBounds
    )
    $bitmap = New-Object System.Drawing.Bitmap(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)

        if ($Variant -eq "legacy") {
            Draw-IconShape $graphics $Size "legacy"
            Draw-CenteredGlyph `
                $graphics `
                $Glyph `
                $GlyphBounds `
                ($Size / 2) `
                ($Size / 2) `
                ($Size * 0.78)
        } elseif ($Variant -eq "round") {
            Draw-IconShape $graphics $Size "round"
            Draw-CenteredGlyph `
                $graphics `
                $Glyph `
                $GlyphBounds `
                ($Size / 2) `
                ($Size / 2) `
                ($Size * 0.68)
        } else {
            Draw-CenteredGlyph `
                $graphics `
                $Glyph `
                $GlyphBounds `
                ($Size / 2) `
                ($Size / 2) `
                ($Size * 0.54)
        }
    } finally {
        $graphics.Dispose()
    }
    return $bitmap
}

function Save-Icon {
    param(
        [int]$Size,
        [string]$Variant,
        [string]$RelativePath,
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$GlyphBounds
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-IconBitmap $Size $Variant $Glyph $GlyphBounds
    try {
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function New-SplashBitmap {
    param(
        [int]$Width,
        [int]$Height,
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$GlyphBounds
    )
    $bitmap = New-Object System.Drawing.Bitmap(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear($paper)

        $iconSize = [int]([Math]::Min($Width, $Height) * 0.34)
        $iconX = [int](($Width - $iconSize) / 2)
        $iconY = [int](($Height - $iconSize) / 2)
        $borderWidth = [Math]::Max(1, [int]($iconSize * 0.012))
        $path = New-RoundedRectPath `
            -X ($iconX + $borderWidth / 2) `
            -Y ($iconY + $borderWidth / 2) `
            -Width ($iconSize - $borderWidth) `
            -Height ($iconSize - $borderWidth) `
            -Radius ([float]($iconSize * 0.18))
        $fill = New-Object System.Drawing.SolidBrush($white)
        $stroke = New-Object System.Drawing.Pen($border, $borderWidth)
        try {
            $graphics.FillPath($fill, $path)
            $graphics.DrawPath($stroke, $path)
        } finally {
            $stroke.Dispose()
            $fill.Dispose()
            $path.Dispose()
        }
        Draw-CenteredGlyph `
            $graphics `
            $Glyph `
            $GlyphBounds `
            ($Width / 2) `
            ($Height / 2) `
            ($iconSize * 0.78)
    } finally {
        $graphics.Dispose()
    }
    return $bitmap
}

function Save-Splash {
    param(
        [int]$Width,
        [int]$Height,
        [string]$RelativePath,
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$GlyphBounds
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-SplashBitmap $Width $Height $Glyph $GlyphBounds
    try {
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function Save-BrandAssets {
    param(
        [System.Drawing.Bitmap]$Glyph,
        [System.Drawing.RectangleF]$GlyphBounds
    )
    New-Item -ItemType Directory -Force -Path $docsRoot | Out-Null

    $appIcon = New-IconBitmap 512 "legacy" $Glyph $GlyphBounds
    try {
        $appIcon.Save(
            (Join-Path $docsRoot "app-icon.png"),
            [System.Drawing.Imaging.ImageFormat]::Png
        )
        $appIcon.Save(
            (Join-Path $appRouteRoot "icon.png"),
            [System.Drawing.Imaging.ImageFormat]::Png
        )
    } finally {
        $appIcon.Dispose()
    }

    $card = New-Object System.Drawing.Bitmap(
        1280,
        640,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($card)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.Clear($paper)

        $socialIcon = New-IconBitmap 288 "legacy" $Glyph $GlyphBounds
        try {
            $graphics.DrawImage($socialIcon, 96, 176, 288, 288)
        } finally {
            $socialIcon.Dispose()
        }

        $titleFont = New-Object System.Drawing.Font(
            "Segoe UI",
            92,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $subtitleFont = New-Object System.Drawing.Font(
            "Microsoft YaHei UI",
            38,
            [System.Drawing.FontStyle]::Regular,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $featureFont = New-Object System.Drawing.Font(
            "Microsoft YaHei UI",
            27,
            [System.Drawing.FontStyle]::Regular,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $smallFont = New-Object System.Drawing.Font(
            "Segoe UI",
            21,
            [System.Drawing.FontStyle]::Regular,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $inkBrush = New-Object System.Drawing.SolidBrush($ink)
        $mutedBrush = New-Object System.Drawing.SolidBrush($muted)
        $redBrush = New-Object System.Drawing.SolidBrush($red)
        try {
            $graphics.DrawString("KANA", $titleFont, $inkBrush, 430, 164)
            $graphics.DrawString($subtitleText, $subtitleFont, $inkBrush, 436, 292)
            $graphics.FillRectangle($redBrush, 436, 356, 96, 6)
            $graphics.DrawString(
                "$furiganaText  /  $romajiText  /  $translationText",
                $featureFont,
                $mutedBrush,
                436,
                398
            )
            $graphics.DrawString(
                "Japanese lyrics reader for Android and Web",
                $smallFont,
                $mutedBrush,
                436,
                456
            )
        } finally {
            $smallFont.Dispose()
            $featureFont.Dispose()
            $subtitleFont.Dispose()
            $titleFont.Dispose()
            $redBrush.Dispose()
            $mutedBrush.Dispose()
            $inkBrush.Dispose()
        }
        $card.Save(
            (Join-Path $docsRoot "social-preview.png"),
            [System.Drawing.Imaging.ImageFormat]::Png
        )
    } finally {
        $graphics.Dispose()
        $card.Dispose()
    }
}

$iconSizes = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}
$foregroundSizes = @{
    "mdpi" = 108
    "hdpi" = 162
    "xhdpi" = 216
    "xxhdpi" = 324
    "xxxhdpi" = 432
}

$glyph = [System.Drawing.Bitmap]::FromFile($glyphPath)
try {
    $glyphBounds = Get-InkBounds $glyph

    foreach ($density in $iconSizes.Keys) {
        $size = $iconSizes[$density]
        $foregroundSize = $foregroundSizes[$density]
        Save-Icon $size "legacy" "mipmap-$density\ic_launcher.png" $glyph $glyphBounds
        Save-Icon $size "round" "mipmap-$density\ic_launcher_round.png" $glyph $glyphBounds
        Save-Icon $foregroundSize "foreground" "mipmap-$density\ic_launcher_foreground.png" $glyph $glyphBounds
    }

    Save-Splash 480 320 "drawable\splash.png" $glyph $glyphBounds
    Save-Splash 480 320 "drawable-land-mdpi\splash.png" $glyph $glyphBounds
    Save-Splash 800 480 "drawable-land-hdpi\splash.png" $glyph $glyphBounds
    Save-Splash 1280 720 "drawable-land-xhdpi\splash.png" $glyph $glyphBounds
    Save-Splash 1600 960 "drawable-land-xxhdpi\splash.png" $glyph $glyphBounds
    Save-Splash 1920 1280 "drawable-land-xxxhdpi\splash.png" $glyph $glyphBounds
    Save-Splash 320 480 "drawable-port-mdpi\splash.png" $glyph $glyphBounds
    Save-Splash 480 800 "drawable-port-hdpi\splash.png" $glyph $glyphBounds
    Save-Splash 720 1280 "drawable-port-xhdpi\splash.png" $glyph $glyphBounds
    Save-Splash 960 1600 "drawable-port-xxhdpi\splash.png" $glyph $glyphBounds
    Save-Splash 1280 1920 "drawable-port-xxxhdpi\splash.png" $glyph $glyphBounds
    Save-BrandAssets $glyph $glyphBounds
} finally {
    $glyph.Dispose()
}

Write-Host "Android icons and brand assets generated from the Source Han kana glyph."
