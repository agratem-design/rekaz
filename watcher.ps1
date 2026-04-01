while ($true) {

    Write-Host "Running sync..."

    .\sync.ps1

    Write-Host "Sleeping 120 seconds..."

    Start-Sleep -Seconds 120

}