$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$frontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resourceRoot = Join-Path $frontendRoot "android\app\src\main\res"
$glyphText = [string][char]0x6B4C
$red = [System.Drawing.Color]::FromArgb(255, 255, 0, 0)
$white = [System.Drawing.Color]::White

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
        throw "The glyph bitmap contains no visible pixels."
    }

    return New-Object System.Drawing.RectangleF(
        $minX,
        $minY,
        ($maxX - $minX + 1),
        ($maxY - $minY + 1)
    )
}

function New-GlyphArtwork {
    $canvasSize = 1024
    $bitmap = New-Object System.Drawing.Bitmap(
        $canvasSize,
        $canvasSize,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.Clear([System.Drawing.Color]::Transparent)

        $font = New-Object System.Drawing.Font(
            "Yu Mincho",
            720,
            [System.Drawing.FontStyle]::Regular,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $brush = New-Object System.Drawing.SolidBrush($white)
        try {
            $graphics.DrawString(
                $glyphText,
                $font,
                $brush,
                (New-Object System.Drawing.RectangleF(
                    0,
                    0,
                    $canvasSize,
                    $canvasSize
                )),
                $format
            )
        } finally {
            $brush.Dispose()
            $format.Dispose()
            $font.Dispose()
        }
    } finally {
        $graphics.Dispose()
    }

    return [pscustomobject]@{
        Bitmap = $bitmap
        Bounds = Get-InkBounds $bitmap
    }
}

function Draw-CenteredGlyph {
    param(
        [System.Drawing.Graphics]$Graphics,
        $Glyph,
        [float]$CenterX,
        [float]$CenterY,
        [float]$TargetInkHeight
    )
    $sourceBounds = $Glyph.Bounds
    $aspect = $sourceBounds.Width / $sourceBounds.Height
    $targetWidth = $TargetInkHeight * $aspect
    $destination = New-Object System.Drawing.RectangleF(
        ($CenterX - $targetWidth / 2),
        ($CenterY - $TargetInkHeight / 2),
        $targetWidth,
        $TargetInkHeight
    )
    $Graphics.DrawImage(
        $Glyph.Bitmap,
        $destination,
        $sourceBounds,
        [System.Drawing.GraphicsUnit]::Pixel
    )
}

function New-IconBitmap {
    param(
        [int]$Size,
        [ValidateSet("legacy", "round", "foreground")]
        [string]$Variant,
        $Glyph
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
            $radius = [float]($Size * 0.18)
            $path = New-RoundedRectPath 0 0 $Size $Size $radius
            $brush = New-Object System.Drawing.SolidBrush($red)
            try {
                $graphics.FillPath($brush, $path)
            } finally {
                $brush.Dispose()
                $path.Dispose()
            }
            Draw-CenteredGlyph $graphics $Glyph ($Size / 2) ($Size / 2) ($Size * 0.46)
        } elseif ($Variant -eq "round") {
            $brush = New-Object System.Drawing.SolidBrush($red)
            try {
                $graphics.FillEllipse($brush, 0, 0, $Size, $Size)
            } finally {
                $brush.Dispose()
            }
            Draw-CenteredGlyph $graphics $Glyph ($Size / 2) ($Size / 2) ($Size * 0.44)
        } else {
            Draw-CenteredGlyph $graphics $Glyph ($Size / 2) ($Size / 2) ($Size * 0.40)
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
        $Glyph
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-IconBitmap $Size $Variant $Glyph
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
        $Glyph
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
        $graphics.Clear($white)

        $iconSize = [int]([Math]::Min($Width, $Height) * 0.30)
        $iconX = [int](($Width - $iconSize) / 2)
        $iconY = [int](($Height - $iconSize) / 2)
        $radius = [float]($iconSize * 0.18)
        $path = New-RoundedRectPath $iconX $iconY $iconSize $iconSize $radius
        $brush = New-Object System.Drawing.SolidBrush($red)
        try {
            $graphics.FillPath($brush, $path)
        } finally {
            $brush.Dispose()
            $path.Dispose()
        }

        Draw-CenteredGlyph $graphics $Glyph ($Width / 2) ($Height / 2) ($iconSize * 0.46)
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
        $Glyph
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-SplashBitmap $Width $Height $Glyph
    try {
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
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

$glyph = New-GlyphArtwork
try {
    foreach ($density in $iconSizes.Keys) {
        $size = $iconSizes[$density]
        $foregroundSize = $foregroundSizes[$density]
        Save-Icon $size "legacy" "mipmap-$density\ic_launcher.png" $glyph
        Save-Icon $size "round" "mipmap-$density\ic_launcher_round.png" $glyph
        Save-Icon $foregroundSize "foreground" "mipmap-$density\ic_launcher_foreground.png" $glyph
    }

    Save-Splash 480 320 "drawable\splash.png" $glyph
    Save-Splash 480 320 "drawable-land-mdpi\splash.png" $glyph
    Save-Splash 800 480 "drawable-land-hdpi\splash.png" $glyph
    Save-Splash 1280 720 "drawable-land-xhdpi\splash.png" $glyph
    Save-Splash 1600 960 "drawable-land-xxhdpi\splash.png" $glyph
    Save-Splash 1920 1280 "drawable-land-xxxhdpi\splash.png" $glyph
    Save-Splash 320 480 "drawable-port-mdpi\splash.png" $glyph
    Save-Splash 480 800 "drawable-port-hdpi\splash.png" $glyph
    Save-Splash 720 1280 "drawable-port-xhdpi\splash.png" $glyph
    Save-Splash 960 1600 "drawable-port-xxhdpi\splash.png" $glyph
    Save-Splash 1280 1920 "drawable-port-xxxhdpi\splash.png" $glyph
} finally {
    $glyph.Bitmap.Dispose()
}

Write-Host "Android icons and splash screens generated with ink-centered glyphs."
