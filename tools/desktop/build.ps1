# Bygger de to Windows-programmer "HelloCal Admin.exe" (admin-panelet) og "HelloCal.exe"
# (selve appen) og installerer dem i %LOCALAPPDATA%\HelloCalDesktop. Kraever ingen
# administratorrettigheder. Koer:
#   powershell -ExecutionPolicy Bypass -File tools\desktop\build.ps1
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here "dist"
$installDir = Join-Path $env:LOCALAPPDATA "HelloCalDesktop"
# Foerste version blev installeret her; ryddes op, naar programmet ikke koerer.
$legacyDir = Join-Path $env:LOCALAPPDATA "HelloCalAdmin"
$variants = @(
  @{ Name = "HelloCal Admin"; Folder = "admin"; Badge = "A" },
  @{ Name = "HelloCal"; Folder = "app"; Badge = "" }
)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $env:Path += ";C:\Program Files\nodejs"
}

function New-Ico([string]$pngPath, [string]$icoPath, [string]$badge) {
  Add-Type -AssemblyName System.Drawing
  $source = [System.Drawing.Image]::FromFile($pngPath)
  $entries = New-Object System.Collections.ArrayList
  foreach ($size in 16, 24, 32, 48, 64, 128, 256) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($source, 0, 0, $size, $size)
    if ($badge -ne "") {
      # Lille moerkegroen cirkel med bogstav nederst til hoejre, saa de to programmer kan kendes fra hinanden.
      $d = [int]($size * 0.5)
      $x = $size - $d
      $ring = [System.Drawing.Brushes]::White
      $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 31, 77, 58))
      $g.FillEllipse($ring, $x - 1, $x - 1, $d + 2, $d + 2)
      $g.FillEllipse($fill, $x, $x, $d, $d)
      $font = New-Object System.Drawing.Font "Segoe UI", ([single]($d * 0.62)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
      $fmt = New-Object System.Drawing.StringFormat
      $fmt.Alignment = [System.Drawing.StringAlignment]::Center
      $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
      $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
      $g.DrawString($badge, $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF $x, $x, $d, $d), $fmt)
      $font.Dispose(); $fmt.Dispose(); $fill.Dispose()
    }
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    if ($size -eq 256) {
      # 256 px gemmes som PNG; mindre stoerrelser som klassisk DIB (stoerst kompatibilitet).
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
      $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
      $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $pixels = New-Object byte[] ($size * $size * 4)
      [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
      $bmp.UnlockBits($data)
      $w = New-Object System.IO.BinaryWriter $ms
      $w.Write([int]40); $w.Write([int]$size); $w.Write([int]($size * 2))
      $w.Write([int16]1); $w.Write([int16]32)
      $w.Write([int]0); $w.Write([int]($size * $size * 4)); $w.Write([int]0); $w.Write([int]0); $w.Write([int]0); $w.Write([int]0)
      for ($y = $size - 1; $y -ge 0; $y--) { $w.Write($pixels, $y * $size * 4, $size * 4) }
      $maskBytes = [int]([math]::Ceiling($size / 32.0)) * 4 * $size
      $w.Write((New-Object byte[] $maskBytes))
      $w.Flush()
    }
    $bmp.Dispose()
    [void]$entries.Add(@{ Size = $size; Data = $ms.ToArray() })
  }
  $source.Dispose()

  $file = [System.IO.File]::Create($icoPath)
  $out = New-Object System.IO.BinaryWriter $file
  $out.Write([int16]0); $out.Write([int16]1); $out.Write([int16]$entries.Count)
  $offset = 6 + 16 * $entries.Count
  foreach ($e in $entries) {
    $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
    $out.Write([byte]$dim); $out.Write([byte]$dim); $out.Write([byte]0); $out.Write([byte]0)
    $out.Write([int16]1); $out.Write([int16]32)
    $out.Write([int]$e.Data.Length); $out.Write([int]$offset)
    $offset += $e.Data.Length
  }
  foreach ($e in $entries) { $out.Write($e.Data) }
  $out.Flush(); $out.Dispose(); $file.Dispose()
}

function Stop-ProgramsIn([string]$dir) {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($dir, [System.StringComparison]::OrdinalIgnoreCase) } |
    Stop-Process -Force
  Start-Sleep -Milliseconds 500
}

Push-Location $here
try {
  Write-Host "Installerer afhaengigheder (foerste gang henter den Electron, ca. 100 MB)..."
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install fejlede" }

  New-Item -ItemType Directory -Force $dist | Out-Null
  foreach ($v in $variants) {
    $ico = Join-Path $dist "$($v.Folder).ico"
    New-Ico (Join-Path $here "icon.png") $ico $v.Badge

    Write-Host "Bygger $($v.Name).exe ..."
    $packagerArgs = @(
      "--no-install", "electron-packager", ".", $v.Name,
      "--platform=win32", "--arch=x64", "--out=$(Join-Path $dist $v.Folder)", "--overwrite", "--asar",
      "--icon=$ico",
      "--ignore=^/dist", "--ignore=^/build\.ps1$", "--ignore=^/README\.md$", "--ignore=^/icon\.png$", "--ignore=^/\.gitignore$"
    )
    & npx.cmd @packagerArgs
    if ($LASTEXITCODE -ne 0) { throw "electron-packager fejlede for $($v.Name)" }
  }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force $installDir | Out-Null
foreach ($v in $variants) {
  $target = Join-Path $installDir $v.Folder
  Stop-ProgramsIn $target
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Move-Item (Join-Path (Join-Path $dist $v.Folder) "$($v.Name)-win32-x64") $target
  Write-Host "Installeret: $(Join-Path $target "$($v.Name).exe")"
}

if (Test-Path $legacyDir) {
  Stop-ProgramsIn $legacyDir
  try { Remove-Item -Recurse -Force $legacyDir } catch { Write-Host "Kunne ikke rydde $legacyDir : $($_.Exception.Message)" }
}

# Foerste start opretter genvejene i Startmenuen (se main.js).
foreach ($v in $variants) {
  Start-Process (Join-Path (Join-Path $installDir $v.Folder) "$($v.Name).exe")
}
