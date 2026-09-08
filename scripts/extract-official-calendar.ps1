param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = [System.IO.Path]::GetFullPath($Destination)
# The official publisher distributes binary .doc, not OOXML. Read it without
# executing document macros or saving changes to the source.
$wordAudit = New-Object -ComObject Word.Application
$documentAudit = $null
try {
    $wordAudit.Visible = $false
    $wordAudit.DisplayAlerts = 0
    $wordAudit.AutomationSecurity = 3
    $documentAudit = $wordAudit.Documents.Open($sourcePath, $false, $true, $false)
    $sourceText = $documentAudit.Content.Text
    [System.IO.File]::WriteAllText($outputPath, $sourceText, [System.Text.UTF8Encoding]::new($false))
    $sourceFootnotes = @()
    foreach ($sourceFootnote in $documentAudit.Footnotes) {
        $sourceFootnotes += [PSCustomObject]@{ referenceOffset = $sourceFootnote.Reference.Start; text = $sourceFootnote.Range.Text }
    }
    [System.IO.File]::WriteAllText($outputPath + '.footnotes.json', (ConvertTo-Json -InputObject $sourceFootnotes -Depth 4), [System.Text.UTF8Encoding]::new($false))
    Write-Output "Extracted $($sourceText.Length) characters into $outputPath"
} finally {
    if ($null -ne $documentAudit) {
        $documentAudit.Close(0)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($documentAudit)
    }
    $wordAudit.Quit(0)
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordAudit)
}
