Add-Type -AssemblyName System.Drawing

function Resize-Png([string]$srcPath, [string]$dstPath, [int]$w, [int]$h) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    $src.Dispose()
    $dest.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
}

$rootLogo = "D:\PROJETOS\iptv\logo.png"

# 1. Icons for webOS
Resize-Png $rootLogo "D:\PROJETOS\iptv\apps\webos-tv\icon.png" 80 80
Resize-Png $rootLogo "D:\PROJETOS\iptv\apps\webos-tv\largeIcon.png" 130 130

# 2. Assets for TV app
if (-not (Test-Path "D:\PROJETOS\iptv\apps\webos-tv\assets")) {
    New-Item -ItemType Directory -Path "D:\PROJETOS\iptv\apps\webos-tv\assets" | Out-Null
}
Copy-Item $rootLogo "D:\PROJETOS\iptv\apps\webos-tv\assets\logo.png" -Force

# 3. Manager web app
Copy-Item $rootLogo "D:\PROJETOS\iptv\apps\manager\logo.png" -Force

Write-Output "Successfully generated webOS icons and copied logos!"
