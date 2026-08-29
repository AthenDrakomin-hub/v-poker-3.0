Set-Location 'C:\Users\88903\Desktop\v-poker-uni-app'
New-Item -ItemType Directory -Force -Path screenshots | Out-Null
$urls = @(
    'https://aka.doubaocdn.com/s/dW1jq6SY3q',
    'https://aka.doubaocdn.com/s/VsJD875Xtq',
    'https://aka.doubaocdn.com/s/dMtJts4XuL',
    'https://aka.doubaocdn.com/s/ahkscvFRXq',
    'https://aka.doubaocdn.com/s/ZTJbs7FSL2',
    'https://aka.doubaocdn.com/s/Luzxek9Njf',
    'https://aka.doubaocdn.com/s/HbVgjKTBIQ',
    'https://aka.doubaocdn.com/s/YW8x88sJyj'
)
for ($i = 0; $i -lt $urls.Count; $i++) {
    $outFile = "screenshots/$($i + 1).png"
    Invoke-WebRequest -Uri $urls[$i] -OutFile $outFile -UseBasicParsing
    Write-Host "Downloaded: $outFile"
}
Get-ChildItem screenshots | Select-Object Name, Length
