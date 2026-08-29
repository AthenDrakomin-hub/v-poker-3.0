Add-Type -AssemblyName System.Drawing
$proj = "C:\Users\88903\Desktop\v-poker-uni-app"
$staticDir = "$proj\static"
$config = @{
    "images\game-scenes" = @{ maxWidth = 1280; quality = 72 }
    "images\themes"      = @{ maxWidth = 1600; quality = 70 }
    "images\banners"     = @{ maxWidth = 1200; quality = 72 }
    "images\cards"       = @{ maxWidth = 800;  quality = 75 }
    "images\chips"       = @{ maxWidth = 800;  quality = 75 }
    "images\game-icons"  = @{ maxWidth = 600;  quality = 78 }
    "images\ui"          = @{ maxWidth = 1600; quality = 70 }
    "avatars"            = @{ maxWidth = 300;  quality = 80 }
}
$rootConfig = @{
    "logo.png"            = @{ maxWidth = 400; quality = 85 }
    "logo-horizontal.png" = @{ maxWidth = 600; quality = 85 }
    "splash.png"          = @{ maxWidth = 1600; quality = 72 }
}
function Get-Codec($mime) { return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq $mime } }
function Compress($path, $maxW, $q) {
    $orig = (Get-Item $path).Length
    if ($orig -lt 80KB) { return }
    try {
        $img = [System.Drawing.Image]::FromFile($path)
        $ow = $img.Width; $oh = $img.Height
        if ($ow -gt $maxW) { $nw = $maxW; $nh = [int]($oh * ($maxW / $ow)) } else { $nw = $ow; $nh = $oh }
        $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $nw, $nh)
        $g.Dispose(); $img.Dispose()
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $q)
        if ($ext -in ".jpg",".jpeg") { $bmp.Save($path, (Get-Codec "image/jpeg"), $ep) }
        elseif ($ext -eq ".png") { $bmp.Save($path, (Get-Codec "image/png"), $null) }
        $bmp.Dispose()
        $ns = (Get-Item $path).Length
        $rel = $path.Replace("$proj\", "")
        Write-Output ("  {0,-48} {1,5}KB->{2,4}KB -{3}%" -f $rel, [math]::Round($orig/1KB), [math]::Round($ns/1KB), [math]::Round((1-$ns/$orig)*100,1))
    } catch { Write-Output ("  FAIL: {0}" -f $path) }
}
Write-Output "=== 开始压缩 ==="
$to = 0; $tn = 0; $c = 0
foreach ($d in $config.Keys) {
    $fd = "$staticDir\$d"; if (!(Test-Path $fd)) { continue }
    $cfg = $config[$d]
    Get-ChildItem $fd -Recurse -Include "*.jpg","*.jpeg","*.png" | % {
        $o = $_.Length; Compress $_.FullName $cfg.maxWidth $cfg.quality
        if (Test-Path $_.FullName) { $to += $o; $tn += (Get-Item $_.FullName).Length; $c++ }
    }
}
foreach ($fn in $rootConfig.Keys) {
    $fp = "$staticDir\$fn"; if (!(Test-Path $fp)) { continue }
    $cfg = $rootConfig[$fn]; $o = (Get-Item $fp).Length
    Compress $fp $cfg.maxWidth $cfg.quality
    if (Test-Path $fp) { $to += $o; $tn += (Get-Item $fp).Length; $c++ }
}
Write-Output ""
Write-Output "=== 完成: $c 个文件, $([math]::Round($to/1MB,1))MB -> $([math]::Round($tn/1MB,1))MB, 节省 $([math]::Round(($to-$tn)/1MB,1))MB ($([math]::Round((1-$tn/$to)*100,1))%) ==="
