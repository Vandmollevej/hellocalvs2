param([string]$Path)
$ErrorActionPreference = 'Stop'
$sp = 'C:\Users\Peter\AppData\Local\Temp\claude\C--Users-Peter-Desktop-Hello-Cal\a9cdef6b-c918-4988-a04f-bce306e12af7\scratchpad'
function ColLetter([int]$n){ $s=''; while($n -gt 0){ $m=($n-1)%26; $s=[char](65+$m)+$s; $n=[int][math]::Floor(($n-1)/26) }; $s }

$x = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$name = [IO.Path]::GetFileName($Path)
$w = $null; foreach($b in $x.Workbooks){ if($b.Name -eq $name){ $w = $b } }
$opened = $false
if(-not $w){ $w = $x.Workbooks.Open($Path); $opened = $true }
$s = $w.Worksheets.Item(1)
$last = $s.UsedRange.Rows.Count
Copy-Item $Path ("C:\Users\Peter\Desktop\Hello Cal\Backup\" + [IO.Path]::GetFileNameWithoutExtension($name) + "_2026-10-10_foer_nye-regler.xlsx") -Force
$x.ScreenUpdating = $false; $x.Calculation = -4135

function Headers(){ $c=$s.UsedRange.Columns.Count; $h=$s.Range($s.Cells(1,1),$s.Cells(1,$c)).Value2; $out=@{}; $list=@(); for($i=1;$i -le $c;$i++){ $t=[string]$h[1,$i]; $list+=$t; if($t -and -not $out.ContainsKey($t)){ $out[$t]=$i } }; return @{map=$out;list=$list;count=$c} }

# 1) Layout: HelloCal_Title -> Product title singular + Product title plural (kolonne B)
$h = Headers
if($h.map.ContainsKey('HelloCal_Title') -and -not $h.map.ContainsKey('Product title singular')){
  $s.Cells(1,1).Value2 = 'Product title singular'
  $s.Columns(2).Insert() | Out-Null
  $s.Cells(1,2).Value2 = 'Product title plural'
  $h = Headers
}
foreach($need in '_is_decaf','_is_alcohol_free','Product type plural'){
  if(-not $h.map.ContainsKey($need)){ $c = $h.count + 1; $s.Cells(1,$c).Value2 = $need; $h = Headers }
}
function Pick([string[]]$names){ foreach($n in $names){ if($h.map.ContainsKey($n)){ return ColLetter $h.map[$n] } }; return $null }
$kw = @(); foreach($i in 1..5){ $l = Pick @("Keyword $i","keyword$i"); if($l){ $kw += $l } }
$m = [ordered]@{
  type = (Pick @('Product Type','productType')); type_plural = (Pick @('Product type plural'));
  variant = (Pick @('Variation','variant')); raw = (Pick @('_is_raw')); cooked = (Pick @('_is_cooked'));
  frozen = (Pick @('_is_frozen')); kw = $kw; decaf = (Pick @('_is_decaf')); sugar_free = (Pick @('_is_sugar_free'));
  glutenfree = (Pick @('_is_glutenfree')); lactose = (Pick @('_is_lactose_free')); alcohol_free = (Pick @('_is_alcohol_free'));
  vegan = (Pick @('_is_vegan')); alcohol = (Pick @('_is_alcohol')); title_singular = 'A' }
$json = $m | ConvertTo-Json -Compress
[IO.File]::WriteAllText("$sp\map_tmp.json", $json, (New-Object Text.UTF8Encoding($false)))
py "$sp\gen_generic.py" "$sp\map_tmp.json" "$sp\FT"
$fS = (Get-Content "$sp\FT_sing.txt" -Raw -Encoding UTF8).Trim(); $fP = (Get-Content "$sp\FT_plur.txt" -Raw -Encoding UTF8).Trim()

# 2) Små begyndelsesbogstaver i nøgleord og _is_-kolonner
$n = 0
for($c=1;$c -le $h.count;$c++){
  $t = [string]$h.list[$c-1]
  if($t -like '_is_*' -and $t -ne '_is_fat' -or $t -like 'Keyword *' -or $t -like 'keyword*'){
    $rg = $s.Range($s.Cells(2,$c),$s.Cells($last,$c)); $v = $rg.Value2
    for($r=1;$r -le $last-1;$r++){ $e=$v[$r,1]; if($e -is [string] -and $e.Length -gt 0 -and [char]::IsUpper($e[0]) -and -not ($e.Length -ge 2 -and [char]::IsUpper($e[1]))){ $v[$r,1]=$e.Substring(0,1).ToLower()+$e.Substring(1); $n++ } }
    $rg.Value2 = $v
  }
}
# 3) Titelformler
$s.Range("A2:A$last").Formula2 = $fS
$s.Range("B2:B$last").Formula2 = $fP
$x.Calculation = -4105; $x.ScreenUpdating = $true
$x.Calculate()
$w.Save()
$v = $s.Range("A2:B$last").Value2; $bad = 0
for($r=1;$r -le $last-1;$r++){ if(([string]$v[$r,1]).StartsWith('#') -or ([string]$v[$r,2]).StartsWith('#')){ $bad++ } }
"$name rows=$($last-1) lowercased=$n errors=$bad"
2,3 | % { "  $($s.Cells($_,1).Text) || $($s.Cells($_,2).Text)" }
if($opened){ $w.Close($true) }
