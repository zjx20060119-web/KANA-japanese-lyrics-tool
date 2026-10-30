$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$frontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resourceRoot = Join-Path $frontendRoot "android\app\src\main\res"
$glyph = [string][char]0x6B4C
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

function Draw-Glyph {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.RectangleF]$Bounds,
        [float]$FontSize,
        [System.Drawing.Color]$Color
    )
    $font = New-Object System.Drawing.Font(
        "Yu Mincho",
        $FontSize,
        [System.Drawing.FontStyle]::Regular,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoClip
    $brush = New-Object System.Drawing.SolidBrush($Color)
    try {
        $Graphics.DrawString($glyph, $font, $brush, $Bounds, $format)
    } finally {
        $brush.Dispose()
        $format.Dispose()
        $font.Dispose()
    }
}

function New-IconBitmap {
    param(
        [int]$Size,
        [ValidateSet("legacy", "round", "foreground")]
        [string]$Variant
    )
    $bitmap = New-Object System.Drawing.Bitmap(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
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
            Draw-Glyph $graphics (
                New-Object System.Drawing.RectangleF(
                    ($Size * 0.10),
                    ($Size * 0.06),
                    ($Size * 0.80),
                    ($Size * 0.86)
                )
            ) ($Size * 0.62) $white
        } elseif ($Variant -eq "round") {
            $brush = New-Object System.Drawing.SolidBrush($red)
            try {
                $graphics.FillEllipse($brush, 0, 0, $Size, $Size)
            } finally {
                $brush.Dispose()
            }
            Draw-Glyph $graphics (
                New-Object System.Drawing.RectangleF(
                    ($Size * 0.12),
                    ($Size * 0.08),
                    ($Size * 0.76),
                    ($Size * 0.82)
                )
            ) ($Size * 0.58) $white
        } else {
            Draw-Glyph $graphics (
                New-Object System.Drawing.RectangleF(
                    ($Size * 0.20),
                    ($Size * 0.16),
                    ($Size * 0.60),
                    ($Size * 0.68)
                )
            ) ($Size * 0.52) $white
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
        [string]$RelativePath
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-IconBitmap $Size $Variant
    try {
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function New-SplashBitmap {
    param([int]$Width, [int]$Height)
    $bitmap = New-Object System.Drawing.Bitmap(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
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

        Draw-Glyph $graphics (
            New-Object System.Drawing.RectangleF(
                ($iconX + $iconSize * 0.10),
                ($iconY + $iconSize * 0.06),
                ($iconSize * 0.80),
                ($iconSize * 0.86)
            )
        ) ($iconSize * 0.62) $white
    } finally {
        $graphics.Dispose()
    }
    return $bitmap
}

function Save-Splash {
    param(
        [int]$Width,
        [int]$Height,
        [string]$RelativePath
    )
    $path = Join-Path $resourceRoot $RelativePath
    $directory = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap = New-SplashBitmap $Width $Height
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

foreach ($density in $iconSizes.Keys) {
    $size = $iconSizes[$density]
    $foregroundSize = $foregroundSizes[$density]
    Save-Icon $size "legacy" "mipmap-$density\ic_launcher.png"
    Save-Icon $size "round" "mipmap-$density\ic_launcher_round.png"
    Save-Icon $foregroundSize "foreground" "mipmap-$density\ic_launcher_foreground.png"
}

Save-Splash 480 320 "drawable\splash.png"
Save-Splash 480 320 "drawable-land-mdpi\splash.png"
Save-Splash 800 480 "drawable-land-hdpi\splash.png"
Save-Splash 1280 720 "drawable-land-xhdpi\splash.png"
Save-Splash 1600 960 "drawable-land-xxhdpi\splash.png"
Save-Splash 1920 1280 "drawable-land-xxxhdpi\splash.png"
Save-Splash 320 480 "drawable-port-mdpi\splash.png"
Save-Splash 480 800 "drawable-port-hdpi\splash.png"
Save-Splash 720 1280 "drawable-port-xhdpi\splash.png"
Save-Splash 960 1600 "drawable-port-xxhdpi\splash.png"
Save-Splash 1280 1920 "drawable-port-xxxhdpi\splash.png"

Write-Host "Android icons and splash screens generated."
