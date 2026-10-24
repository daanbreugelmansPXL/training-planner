Add-Type -AssemblyName System.Drawing

function Generate-Icon {
    param(
        [int]$size,
        [string]$path,
        [bool]$maskable = $false
    )
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Background: #0A0A0B
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml('#0A0A0B')
    $bgBrush = New-Object System.Drawing.SolidBrush $bgColor
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)
    $bgBrush.Dispose()

    # Scale factor (0.75 for maskable safe-zone, 0.85 for regular)
    $scale = if ($maskable) { $size * 0.70 / 512.0 } else { $size * 0.85 / 512.0 }
    $offsetX = [float](($size - (512.0 * $scale)) / 2.0)
    $offsetY = [float](($size - (512.0 * $scale)) / 2.0)

    # Colors
    $whiteColor = [System.Drawing.ColorTranslator]::FromHtml('#F4F4F5')
    $redColor = [System.Drawing.ColorTranslator]::FromHtml('#E5322D')
    $whiteBrush = New-Object System.Drawing.SolidBrush $whiteColor
    $redBrush = New-Object System.Drawing.SolidBrush $redColor

    # Top horizontal bar of "T" (left portion white: 136..290, right portion red: 290..376)
    $topTLeftX = [float](136 * $scale + $offsetX)
    $topTY = [float](130 * $scale + $offsetY)
    $topTLeftW = [float](154 * $scale)
    $topTH = [float](48 * $scale)
    $g.FillRectangle($whiteBrush, $topTLeftX, $topTY, $topTLeftW, $topTH)

    # Red accent right bar
    $topTRightX = [float](290 * $scale + $offsetX)
    $topTRightW = [float](86 * $scale)
    $g.FillRectangle($redBrush, $topTRightX, $topTY, $topTRightW, $topTH)

    # Vertical stem of "T" (232..280, 178..382)
    $stemX = [float](232 * $scale + $offsetX)
    $stemY = [float](178 * $scale + $offsetY)
    $stemW = [float](48 * $scale)
    $stemH = [float](204 * $scale)
    $g.FillRectangle($whiteBrush, $stemX, $stemY, $stemW, $stemH)

    $whiteBrush.Dispose()
    $redBrush.Dispose()
    $g.Dispose()

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated icon: $path ($size x $size)"
}

$dir = "C:\Users\daanb\.gemini\antigravity\scratch\training-planner-pwa\icons"
Generate-Icon -size 180 -path "$dir\apple-touch-icon.png"
Generate-Icon -size 192 -path "$dir\icon-192.png"
Generate-Icon -size 512 -path "$dir\icon-512.png"
Generate-Icon -size 512 -path "$dir\icon-maskable.png" -maskable $true
