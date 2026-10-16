param([string]$Json, [string]$Sheets = 'EDEKA,REWE,DM,Wolt,DRK,Aarstiderne', [string]$Tag = 'produkttype-udtraek')
$s = 'C:\Users\Peter\AppData\Local\Temp\claude\C--Users-Peter-Desktop-Hello-Cal\a9cdef6b-c918-4988-a04f-bce306e12af7\scratchpad'
foreach($sh in $Sheets.Split(',')){
  $done = $false
  for($try=1; $try -le 4 -and -not $done; $try++){
    try {
      $o = & powershell -NoProfile -ExecutionPolicy Bypass -File "$s\apply_mech2.ps1" -Sheet $sh -Json $Json -Tag $Tag 2>&1 | Out-String
      if($o -match "$sh ok:"){ $o.Trim(); $done = $true } else { "$sh forsoeg $try fejl: " + $o.Trim(); Start-Sleep -Seconds 30 }
    } catch { "$sh forsoeg $try undtagelse: $_"; Start-Sleep -Seconds 30 }
  }
  if(-not $done){ "$sh MISLYKKEDES" }
}
'FAERDIG'
