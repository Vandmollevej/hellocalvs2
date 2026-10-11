param([string]$Path)
$ErrorActionPreference = 'Stop'
$canon = @('Product title singular','Product title plural','Quantity','Brand','Subbrand','EAN','Pack Count','Product Type','Variation','Category','Packaging',
 '_is_alcohol','_is_country_of_origen','_is_organic','_is_glutenfree','_is_lactose_free','Keyword 1','Keyword 2','Keyword 3','Keyword 4','Keyword 5',
 '_is_sweeteners','_is_meat','_is_vegan','_is_allergy','_is_sugar_free','_is_fat','_is_alcohol','Clean Subtitle','_is_whole_grain','_is_animal_welfare',
 '_is_frozen','_is_raw','_is_cooked','_is_decaf','_is_alcohol_free','Product type plural','Original Title','Product Name','Subtitle','Source URL','Manufacturer','Image File','Parse Status','Servings')
$alias = @{ 'HelloCal_Title'='Product title singular'; 'Key'='Product title singular'; 'packageSizeText'='Quantity'; 'barcode'='EAN'; 'packCount'='Pack Count';
  'productType'='Product Type'; 'Product type'='Product Type'; 'variant'='Variation'; 'brand'='Brand'; 'subbrand'='Subbrand';
  'category'='Category'; 'packaging'='Packaging'; 'keyword1'='Keyword 1'; 'keyword2'='Keyword 2'; 'keyword3'='Keyword 3'; 'keyword4'='Keyword 4'; 'keyword5'='Keyword 5' }
$x = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$name = [IO.Path]::GetFileName($Path)
$w = $null; foreach($b in $x.Workbooks){ if($b.Name -eq $name){ $w = $b } }
$opened = $false
if(-not $w){ $w = $x.Workbooks.Open($Path); $opened = $true }
$s = $w.Worksheets.Item(1)
$x.ScreenUpdating = $false
Copy-Item $Path ("C:\Users\Peter\Desktop\Hello Cal\Backup\" + [IO.Path]::GetFileNameWithoutExtension($name) + "_2026-10-10_foer_kolonner2.xlsx") -Force

function Cols(){ $c=$s.UsedRange.Columns.Count; $v=$s.Range($s.Cells(1,1),$s.Cells(1,$c)).Value2; $l=@(); for($i=1;$i -le $c;$i++){ $l+=[string]$v[1,$i] }; return ,$l }

# 1) Alias-omdøbning
$list = Cols
$hasTitle = $list -contains 'Product title singular'
for($i=0;$i -lt $list.Count;$i++){
  $t = $list[$i]
  if($alias.ContainsKey($t)){
    $new = $alias[$t]
    if($new -eq 'Product title singular' -and $hasTitle){ continue }
    if($list -contains $new){ continue }
    $s.Cells(1,$i+1).Value2 = $new; $list[$i] = $new
    if($new -eq 'Product title singular'){ $hasTitle = $true }
  }
}
# 2) Placér kanoniske kolonner i rækkefølge
for($k=1;$k -le $canon.Count;$k++){
  $nm = $canon[$k-1]; $list = Cols; $j = 0
  for($i=$k;$i -le $list.Count;$i++){ if($list[$i-1] -eq $nm){ $j = $i; break } }
  if($j -eq 0){
    $s.Columns($k).Insert() | Out-Null
    $s.Cells(1,$k).Value2 = $nm
  } elseif($j -ne $k){
    $s.Columns($j).Cut() | Out-Null
    $s.Columns($k).Insert() | Out-Null
    $x.CutCopyMode = 0
  }
}
# 3) EAN: vis som helt tal (ikke 5,7E+12)
$last = $s.UsedRange.Rows.Count
$s.Range($s.Cells(2,6),$s.Cells($last,6)).NumberFormat = '0'
$x.ScreenUpdating = $true
$w.Save()
$list = Cols
"$name kolonner=$($list.Count) første: " + (($list | Select-Object -First 12) -join ' | ')
if($opened){ $w.Close($true) }
