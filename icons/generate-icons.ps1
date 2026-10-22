Add-Type -AssemblyName System.Drawing

function Generate-Icon {
    param([int]$size, [string]$path, [bool]$maskable = $false)
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.ColorTranslator]::FromHtml('#1e2430')), ([System.Drawing.ColorTranslator]::FromHtml('#0e1117')), 45.0
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    if (-not $maskable) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#2a3243')), ([float]($size * 0.015))
        $g.DrawRectangle($pen, 0, 0, $size - 1, $size - 1)
        $pen.Dispose()
    }

    $scale = if ($maskable) { $size * 0.70 / 512.0 } else { $size * 0.85 / 512.0 }
    $offsetX = [float](($size - (512.0 * $scale)) / 2.0)
    $offsetY = [float](($size - (512.0 * $scale)) / 2.0)

    $rawPoints = @(
        [System.Drawing.PointF]::new([float](285 * $scale + $offsetX), [float](70 * $scale + $offsetY)),
        [System.Drawing.PointF]::new([float](165 * $scale + $offsetX), [float](265 * $scale + $offsetY)),
        [System.Drawing.PointF]::new([float](255 * $scale + $offsetX), [float](265 * $scale + $offsetY)),
        [System.Drawing.PointF]::new([float](220 * $scale + $offsetX), [float](442 * $scale + $offsetY)),
        [System.Drawing.PointF]::new([float](360 * $scale + $offsetX), [float](230 * $scale + $offsetY)),
        [System.Drawing.PointF]::new([float](270 * $scale + $offsetX), [float](230 * $scale + $offsetY))
    )

    # Glow shadow
    $glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 245, 158, 11)), ([float]($size * 0.08))
    $glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPolygon($glowPen, $rawPoints)
    $glowPen.Dispose()

    # Bolt Fill
    $pt1 = [System.Drawing.PointF]::new(0.0, [float]$offsetY)
    $pt2 = [System.Drawing.PointF]::new(0.0, [float]($offsetY + 512.0 * $scale))
    $boltBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $pt1, $pt2, ([System.Drawing.ColorTranslator]::FromHtml('#fbbf24')), ([System.Drawing.ColorTranslator]::FromHtml('#ea580c'))
    $g.FillPolygon($boltBrush, $rawPoints)
    $boltBrush.Dispose()

    # Crisp highlight outline
    $outlineWidth = [float]([Math]::Max(1.5, $size * 0.012))
    $outlinePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#fffbeb')), $outlineWidth
    $outlinePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPolygon($outlinePen, $rawPoints)
    $outlinePen.Dispose()

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Successfully generated: $path"
}

$dir = "C:\Users\daanb\.gemini\antigravity\scratch\training-planner-pwa\icons"
Generate-Icon -size 180 -path "$dir\apple-touch-icon.png"
Generate-Icon -size 192 -path "$dir\icon-192.png"
Generate-Icon -size 512 -path "$dir\icon-512.png"
Generate-Icon -size 512 -path "$dir\icon-maskable.png" -maskable $true
