Set-Location 'C:\Users\88903\Desktop\v-poker-uni-app\pages'
$files = @('promotion\promotion.vue', 'customer-service\customer-service.vue', 'admin\admin.vue', 'register\register.vue')
foreach ($f in $files) {
    $content = Get-Content $f -Raw -Encoding UTF8
    $content = $content -replace ':size="2"', ':size="3"'
    $content = $content -replace ':size="2.2"', ':size="3.3"'
    $content = $content -replace ':size="1.8"', ':size="2.7"'
    $content = $content -replace ':size="1.6"', ':size="2.4"'
    $content = $content -replace ':size="2.5"', ':size="3.8"'
    Set-Content $f -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $f"
}
Write-Host "Done!"
