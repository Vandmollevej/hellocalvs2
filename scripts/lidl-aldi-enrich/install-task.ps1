# Opretter den natlige opgave i Windows Opgavestyring for den aktuelle bruger
# (kræver IKKE administrator). Kør én gang:
#   powershell -ExecutionPolicy Bypass -File install-task.ps1
# Valgfrit starttidspunkt: -At 02:30. Fjern opgaven: Unregister-ScheduledTask HelloCalLidlAldiEnrich
param([string]$At = "02:00")
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f (Join-Path $here "run-nightly.ps1"))
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable: er pc'en slukket kl. 02:00, kører opgaven, når den tændes igen.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 8) -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "HelloCalLidlAldiEnrich" -Action $action -Trigger $trigger -Settings $settings `
  -Description "Hello Cal: Lidl/Aldi-varer - find flere detaljer (Open Food Facts, Google Vision ved 0 resultater)" -Force
Write-Host "Opgaven HelloCalLidlAldiEnrich er oprettet (dagligt kl. $At)."
