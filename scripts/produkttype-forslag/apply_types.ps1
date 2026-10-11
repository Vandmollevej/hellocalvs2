param([string]$Sheet)
$ErrorActionPreference = 'Stop'
$base = 'C:\Users\Peter\AppData\Local\Temp\claude\C--Users-Peter-Desktop-Hello-Cal\a9cdef6b-c918-4988-a04f-bce306e12af7\scratchpad'
$all = [IO.File]::ReadAllText("$base\type_changes.json", [Text.Encoding]::UTF8) | ConvertFrom-Json
$item = $all | Where-Object { $_.sheet -eq $Sheet }
if(-not $item){ throw "ukendt ark $Sheet" }
$path = 'C:\Users\Peter\Desktop\Hello Cal\' + ($item.file -replace '/','\')
try{ $x = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application') }catch{ $x = New-Object -ComObject Excel.Application; $x.Visible = $true }
$name = [IO.Path]::GetFileName($path)
$w = $null; foreach($b in @($x.Workbooks)){ if($b.Name -eq $name){ $w = $b } }
if(-not $w){ $w = $x.Workbooks.Open($path) }
$s = $w.Worksheets.Item(1)
try{ Copy-Item $path ('C:\Users\Peter\Desktop\Hello Cal\Backup\' + [IO.Path]::GetFileNameWithoutExtension($name) + '_2026-10-11_foer_produkttype.xlsx') -Force }catch{ "backup: $($_.Exception.Message)" }
$last = $s.UsedRange.Rows.Count
$cols = $s.UsedRange.Columns.Count
$hdr = $s.Range($s.Cells(1,1),$s.Cells(1,$cols)).Value2
$idx = @{}
for($i=1;$i -le $cols;$i++){ $t=[string]$hdr[1,$i]; if($t -and -not $idx.ContainsKey($t)){ $idx[$t]=$i } }
function ColL([int]$n){ $r=''; while($n -gt 0){ $m=($n-1)%26; $r=[char](65+$m)+$r; $n=[int][math]::Floor(($n-1)/26) }; $r }
$x.ScreenUpdating = $false; $x.Calculation = -4135
$titleCol = $idx['Original Title']
$orig = $s.Range($s.Cells(1,$titleCol),$s.Cells($last,$titleCol)).Value2
# verificér rækkejustering
$byRow = @{}; $skipped = 0
foreach($c in $item.changes){
  $r = [int]$c.row
  if($r -le $last -and ([string]$orig[$r,1]) -eq [string]$c.orig){ $byRow[$r] = $c } else { $skipped++ }
}
$report = @{}
foreach($name2 in 'Brand','Product Type','Variation','Product type plural'){
  if(-not $idx.ContainsKey($name2)){ continue }
  $ci = $idx[$name2]
  $rg = $s.Range($s.Cells(2,$ci),$s.Cells($last,$ci))
  $arr = $rg.Value2
  $changed = New-Object System.Collections.Generic.List[int]
  foreach($r in $byRow.Keys){
    $c = $byRow[$r]
    if($c.PSObject.Properties.Name -contains $name2){
      $arr[($r-1),1] = [string]$c.$name2
      $changed.Add($r)
    }
  }
  if($changed.Count -gt 0){
    $rg.Value2 = $arr
    $L = ColL $ci
    $sorted = $changed | Sort-Object
    $runs = New-Object System.Collections.Generic.List[string]
    $start = $sorted[0]; $prev = $start
    foreach($r in ($sorted | Select-Object -Skip 1)){
      if($r -eq $prev+1){ $prev = $r } else { $runs.Add($(if($start -eq $prev){"$L$start"}else{"${L}${start}:${L}${prev}"})); $start=$r; $prev=$r }
    }
    $runs.Add($(if($start -eq $prev){"$L$start"}else{"${L}${start}:${L}${prev}"}))
    foreach($a in $runs){ $s.Range($a).Interior.Color = 65535 }
  }
  $report[$name2] = $changed.Count
}
# noter (ord der ikke kunne fordeles): orange + kommentar på Product Type
$notes = 0
if($idx.ContainsKey('Product Type')){
  $pt = $idx['Product Type']
  foreach($r in $byRow.Keys){
    $c = $byRow[$r]
    if($c.PSObject.Properties.Name -contains '_note'){
      $cell = $s.Cells($r,$pt)
      $cell.Interior.Color = 42495
      try{ $cell.ClearComments() | Out-Null; $null = $cell.AddComment([string]$c._note) }catch{}
      $notes++
    }
  }
}
$x.Calculation = -4105; $x.ScreenUpdating = $true
$w.Save()
"$Sheet ok: " + (($report.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', ') + " noter=$notes sprunget_over=$skipped"
