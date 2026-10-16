param([string]$Sheet, [string]$Json, [string]$Tag = 'produkttype-udtraek')
$ErrorActionPreference = 'Stop'
$all = [IO.File]::ReadAllText($Json, [Text.Encoding]::UTF8) | ConvertFrom-Json
$item = $all | Where-Object { $_.sheet -eq $Sheet }
if(-not $item){ throw "ukendt ark $Sheet" }
$path = 'C:\Users\Peter\Desktop\Hello Cal\' + ($item.file -replace '/','\')
# eget Excel-program (rører ikke brugerens åbne Excel-vinduer)
$x = New-Object -ComObject Excel.Application
$x.Visible = $false
$x.DisplayAlerts = $false
$name = [IO.Path]::GetFileName($path)
$bk = 'C:\Users\Peter\Desktop\Hello Cal\Produkter\Backup\' + [IO.Path]::GetFileNameWithoutExtension($name) + '_2026-10-16_foer_' + $Tag + '.xlsx'
if(-not (Test-Path $bk)){ Copy-Item $path $bk -Force }
$w = $null
try {
  $w = $x.Workbooks.Open($path)
  $s = $w.Worksheets.Item(1)
  $last = $s.UsedRange.Rows.Count
  $cols = $s.UsedRange.Columns.Count
  $x.ScreenUpdating = $false; try{ $x.Calculation = -4135 }catch{}
  $hdr = $s.Range($s.Cells(1,1),$s.Cells(1,$cols)).Value2
  $jh = @($item.header)
  for($i=0;$i -lt [math]::Min($cols,$jh.Count);$i++){ if([string]$hdr[1,($i+1)] -ne [string]$jh[$i]){ throw "header afviger ved kolonne $($i+1): '$($hdr[1,($i+1)])' vs '$($jh[$i])'" } }
  $ti = [array]::IndexOf($jh,'Original Title') + 1
  $orig = $s.Range($s.Cells(1,$ti),$s.Cells($last,$ti)).Value2
  $byRow = @{}; $skipped = 0
  foreach($c in $item.changes){
    $r = [int]$c.row
    if($r -le $last -and ([string]$orig[$r,1]) -eq [string]$c.orig){ $byRow[$r] = $c } else { $skipped++ }
  }
  function ColL([int]$n){ $r=''; while($n -gt 0){ $m=($n-1)%26; $r=[char](65+$m)+$r; $n=[int][math]::Floor(($n-1)/26) }; $r }
  $colSet = New-Object System.Collections.Generic.HashSet[int]
  foreach($r in $byRow.Keys){ foreach($p in $byRow[$r].cols.PSObject.Properties){ [void]$colSet.Add([int]$p.Name) } }
  $written = 0
  foreach($c0 in ($colSet | Sort-Object)){
    $ci = $c0 + 1
    $rg = $s.Range($s.Cells(2,$ci),$s.Cells($last,$ci)); $arr = $rg.Value2
    $changed = New-Object System.Collections.Generic.List[int]
    foreach($r in $byRow.Keys){
      $p = $byRow[$r].cols.PSObject.Properties | Where-Object { $_.Name -eq [string]$c0 }
      if($p){
        $v = $p.Value
        if($v -eq $null -or [string]$v -eq ''){ $arr[($r-1),1] = $null } else { $arr[($r-1),1] = $v }
        $changed.Add($r)
      }
    }
    if($changed.Count -gt 0){
      $rg.Value2 = $arr; $written += $changed.Count
      $L = ColL $ci
      $sorted = $changed | Sort-Object
      $start = $sorted[0]; $prev = $start
      $runs = New-Object System.Collections.Generic.List[string]
      foreach($r in ($sorted | Select-Object -Skip 1)){
        if($r -eq $prev+1){ $prev = $r } else { $runs.Add($(if($start -eq $prev){"$L$start"}else{"${L}${start}:${L}${prev}"})); $start=$r; $prev=$r }
      }
      $runs.Add($(if($start -eq $prev){"$L$start"}else{"${L}${start}:${L}${prev}"}))
      foreach($a in $runs){ $s.Range($a).Interior.Color = 65535 }
    }
  }
  $delRows = @($item.delete_rows); $delOrig = @($item.delete_orig)
  $del = New-Object System.Collections.Generic.List[int]
  for($k=0;$k -lt $delRows.Count;$k++){
    $r = [int]$delRows[$k]
    if($r -ge 2 -and $r -le $last){
      $okRow = $true
      if($delOrig.Count -gt $k -and ([string]$orig[$r,1]) -ne [string]$delOrig[$k]){ $okRow = $false; $skipped++ }
      if($okRow){ $del.Add($r) }
    }
  }
  foreach($r in ($del | Sort-Object -Descending)){ $s.Rows($r).Delete() | Out-Null }
  try{ $x.Calculation = -4105 }catch{}; $x.ScreenUpdating = $true
  $w.Save()
  "$Sheet ok: celler=$written raekker_slettet=$($del.Count) sprunget_over=$skipped"
} finally {
  try{ if($w){ $w.Close($false) } }catch{}
  try{ $x.Quit() }catch{}
  try{ [void][Runtime.InteropServices.Marshal]::ReleaseComObject($x) }catch{}
}
