param(
    [string]$Source = 'tmp/xml-independent-audit/trapeza_2026.doc',
    [string]$Destination = 'tmp/xml-independent-audit/trapeza_2026.cells.json'
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = [System.IO.Path]::GetFullPath($Destination)
$wordAudit = New-Object -ComObject Word.Application
$documentAudit = $null
try {
    $wordAudit.Visible = $false
    $wordAudit.DisplayAlerts = 0
    $wordAudit.AutomationSecurity = 3
    $documentAudit = $wordAudit.Documents.Open($sourcePath, $false, $true, $false)
    $tables = @()
    $tableIndex = 0
    foreach ($table in $documentAudit.Tables) {
        $tableIndex++
        $cells = @()
        foreach ($cell in $table.Range.Cells) {
            $cells += [PSCustomObject]@{
                row = $cell.RowIndex
                column = $cell.ColumnIndex
                text = $cell.Range.Text.Trim([char]13, [char]7, [char]32)
                backgroundColor = $cell.Shading.BackgroundPatternColor
                foregroundColor = $cell.Shading.ForegroundPatternColor
                texture = $cell.Shading.Texture
                fontColor = $cell.Range.Font.Color
            }
        }
        $before = $documentAudit.Range([Math]::Max(0, $table.Range.Start - 160), $table.Range.Start).Text
        $tables += [PSCustomObject]@{ table = $tableIndex; contextBefore = $before; cells = $cells }
    }
    $result = [PSCustomObject]@{
        source = 'https://rop.ru/d/3000/d/trapeza_2026.doc'
        sha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        extractedUtc = [DateTime]::UtcNow.ToString('o')
        tables = $tables
    }
    [System.IO.File]::WriteAllText($outputPath, (ConvertTo-Json -InputObject $result -Depth 8), [System.Text.UTF8Encoding]::new($false))
    Write-Output "Extracted $tableIndex tables (text, shading and legend) into $outputPath"
} finally {
    if ($null -ne $documentAudit) {
        $documentAudit.Close(0)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($documentAudit)
    }
    $wordAudit.Quit()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordAudit)
}
