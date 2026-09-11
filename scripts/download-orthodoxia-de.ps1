[CmdletBinding()]
param(
    [string]$OutputDirectory = '',

    [ValidateRange(250, 30000)]
    [int]$DelayMilliseconds = 1200,

    [ValidateRange(1, 10)]
    [int]$Retries = 3,

    [switch]$Force,
    [switch]$AllowPartial
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path (Split-Path -Parent $PSCommandPath) '..\artifacts'
}

# Canonical pages listed in https://orthodoxia.de/gebete/gebetbuch on 2026-09-11.
# The list is deliberately fixed: the script never follows arbitrary third-party links.
$SourceHost = 'orthodoxia.de'
$SourcePrefix = 'https://orthodoxia.de/gebete/gebetbuch/'
$sources = @(
    @{ Slug = 'de-grundgebete'; Title = 'Grundgebete'; Collection = 'prayers'; Path = 'grundgebete' },
    @{ Slug = 'de-morgengebete'; Title = 'Morgengebete'; Collection = 'prayers'; Path = 'morgengebete' },
    @{ Slug = 'de-abendgebete'; Title = 'Abendgebete'; Collection = 'prayers'; Path = 'abendgebete' },
    @{ Slug = 'de-oesterliches-stundengebet'; Title = 'Das österliche Stundengebet'; Collection = 'horologion'; Path = 'das-oesterliche-stundengebet' },
    @{ Slug = 'de-busskanon-jesus-christus'; Title = 'Bußkanon an unseren Herrn Jesus Christus'; Collection = 'canons'; Path = 'busskanon-an-unseren-herrn-jesus-christus' },
    @{ Slug = 'de-trostkanon-gottesgebaererin'; Title = 'Trostkanon an die allheilige Gottesgebärerin'; Collection = 'canons'; Path = 'trostkanon-an-die-allheilige-gottesgebaererin' },
    @{ Slug = 'de-kanon-schutzengel'; Title = 'Kanon an den heiligen Schutzengel'; Collection = 'canons'; Path = 'kanon-an-den-heiligen-schutzengel' },
    @{ Slug = 'de-akathistos-jesus-christus'; Title = 'Akathistos an unseren gütigsten Herrn Jesus Christus'; Collection = 'akathists'; Path = 'akathistos-an-unseren-guetigsten-herrn-jesus-christus' },
    @{ Slug = 'de-akathistos-gottesgebaererin'; Title = 'Akathistos an die allheilige Gottesgebärerin'; Collection = 'akathists'; Path = 'akathistos-an-die-allheilige-gottesgebaererin' },
    @{ Slug = 'de-akathistos-nikolaus'; Title = 'Akathistos an den heiligen Nikolaus'; Collection = 'akathists'; Path = 'akathistos-an-den-heiligen-nikolaus' },
    @{ Slug = 'de-gebete-vor-kommunion'; Title = 'Gebete vor der heiligen Kommunion'; Collection = 'prayers'; Path = 'gebete-vor-der-heiligen-kommunion' },
    @{ Slug = 'de-dankgebete-nach-kommunion'; Title = 'Dankgebete nach der heiligen Kommunion'; Collection = 'prayers'; Path = 'dankgebete-nach-der-heiligen-kommunion-3' },
    @{ Slug = 'de-tischgebete'; Title = 'Tischgebete'; Collection = 'prayers'; Path = 'tischgebete-2' },
    @{ Slug = 'de-gebete-gelegenheiten'; Title = 'Gebete zu verschiedenen Gelegenheiten'; Collection = 'prayers'; Path = 'gebete-zu-verschiedenen-gelegenheiten-2' },
    @{ Slug = 'de-bittkanon-seele'; Title = 'Bittkanon beim Ausscheiden der Seele'; Collection = 'canons'; Path = 'bittkanon-beim-ausscheiden-der-seele' },
    @{ Slug = 'de-troparien-verstorbene'; Title = 'Troparien und Gebet für die Verstorbenen'; Collection = 'hymnography'; Path = 'troparien-und-gebet-fuer-die-verstorbenen' },
    @{ Slug = 'de-troparien-feste'; Title = 'Troparien und Kondakien zu verschiedenen Festen'; Collection = 'hymnography'; Path = 'troparien-und-kondakien-zu-verschiedenen-festen-2' },
    @{ Slug = 'de-sonntagstroparien-kondakien'; Title = 'Sonntagstroparien und -Kondakien'; Collection = 'hymnography'; Path = 'sonntagstroparien-und-kondakien' },
    @{ Slug = 'de-wochentagstroparien-kondakien'; Title = 'Wochentagstroparien und -Kondakien'; Collection = 'hymnography'; Path = 'wochentagstroparien-und-kondakien' }
)

function Write-Utf8File {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Convert-HtmlFragmentToText {
    param([Parameter(Mandatory)][string]$Html)
    $text = $Html -replace '(?is)<br\s*/?>', "`n"
    $text = $text -replace '(?is)</(?:p|div|li|blockquote|h[1-6]|tr)>', "`n"
    $text = $text -replace '(?is)<[^>]+>', ''
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    $text = $text -replace "[\u00A0\t ]+", ' '
    $text = $text -replace "\r?\n\s*\r?\n\s*\r?\n+", "`n`n"
    return $text.Trim()
}

function Get-ArticleBlocks {
    param([Parameter(Mandatory)][string]$Html)
    $withoutNoise = $Html -replace '(?is)<(script|style|noscript|svg|form)\b.*?</\1>', ''
    $article = [regex]::Match($withoutNoise, '(?is)<article\b[^>]*>(?<body>.*?)</article>')
    $body = if ($article.Success) { $article.Groups['body'].Value } else { $withoutNoise }
    $matches = [regex]::Matches($body, '(?is)<(?<tag>h[1-6]|p|li|blockquote)\b[^>]*>(?<body>.*?)</\k<tag>>')
    $blocks = [System.Collections.Generic.List[object]]::new()
    foreach ($match in $matches) {
        $text = Convert-HtmlFragmentToText $match.Groups['body'].Value
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $kind = if ($match.Groups['tag'].Value -match '^h') { 'heading' } else { 'text' }
        $blocks.Add([ordered]@{ id = "b$($blocks.Count + 1)"; kind = $kind; text = $text })
    }
    if ($blocks.Count -eq 0) { throw 'No readable text blocks were found in the article.' }
    return @($blocks)
}

function Invoke-SourceDownload {
    param([Parameter(Mandatory)][uri]$Uri)
    if ($Uri.Scheme -ne 'https' -or $Uri.Host -ne $SourceHost -or -not $Uri.AbsolutePath.StartsWith('/gebete/gebetbuch/')) {
        throw "Rejected non-canonical source URL: $Uri"
    }
    $headers = @{ 'User-Agent' = 'Georg-Kloster-Liturgical-Archive/1.0 (permitted archival import)' }
    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        try {
            return (Invoke-WebRequest -Uri $Uri -Headers $headers -MaximumRedirection 3 -TimeoutSec 90 -UseBasicParsing).Content
        } catch {
            if ($attempt -eq $Retries) { throw }
            Start-Sleep -Milliseconds ($DelayMilliseconds * $attempt)
        }
    }
}

$date = Get-Date -Format 'yyyy-MM-dd'
$root = Join-Path (Resolve-Path $OutputDirectory) "orthodoxia-de-$date"
if ((Test-Path -LiteralPath $root) -and -not $Force) {
    throw "Output already exists: $root. Review it or rerun with -Force."
}
New-Item -ItemType Directory -Force -Path $root | Out-Null
$rawDirectory = Join-Path $root 'raw-html'
New-Item -ItemType Directory -Force -Path $rawDirectory | Out-Null

$works = [System.Collections.Generic.List[object]]::new()
$manifest = [System.Collections.Generic.List[object]]::new()
$errors = [System.Collections.Generic.List[object]]::new()

foreach ($source in $sources) {
    $uri = [uri]($SourcePrefix + $source.Path)
    Write-Host "Downloading $($source.Title)" -ForegroundColor Cyan
    try {
        $html = Invoke-SourceDownload $uri
        $rawPath = Join-Path $rawDirectory ($source.Slug + '.html')
        Write-Utf8File -Path $rawPath -Content $html
        $blocks = Get-ArticleBlocks $html
        $hash = (Get-FileHash -LiteralPath $rawPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $works.Add([ordered]@{
            slug = $source.Slug
            title = $source.Title
            url = $uri.AbsoluteUri
            collections = @($source.Collection)
            versions = [ordered]@{ de = @($blocks) }
            credits = [ordered]@{ de = 'Orthodoxia.de · импорт выполнен с разрешения, предоставленного владельцу проекта.' }
            source_hash = $hash
        })
        $manifest.Add([ordered]@{ slug = $source.Slug; title = $source.Title; url = $uri.AbsoluteUri; sha256 = $hash; blocks = $blocks.Count; status = 'downloaded' })
    } catch {
        $errors.Add([ordered]@{ slug = $source.Slug; url = $uri.AbsoluteUri; error = $_.Exception.Message })
        Write-Warning "Failed: $($source.Title): $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds $DelayMilliseconds
}

$report = [ordered]@{
    source = 'Orthodoxia.de German prayer book'
    retrieved_at = (Get-Date).ToUniversalTime().ToString('o')
    expected_pages = $sources.Count
    downloaded_pages = $works.Count
    manifest = $manifest.ToArray()
    errors = $errors.ToArray()
}
Write-Utf8File -Path (Join-Path $root 'download-report.json') -Content ($report | ConvertTo-Json -Depth 12)

if ($errors.Count -gt 0 -and -not $AllowPartial) {
    throw "Downloaded $($works.Count) of $($sources.Count) pages. Review $root\download-report.json, then rerun without changing the corpus."
}

$corpus = [ordered]@{
    schemaVersion = 1
    source = 'https://orthodoxia.de/gebete/gebetbuch'
    retrieved_at = $report.retrieved_at
    works = $works.ToArray()
}
$corpusPath = Join-Path $root 'orthodoxia-de-corpus.json'
Write-Utf8File -Path $corpusPath -Content ($corpus | ConvertTo-Json -Depth 16)

@"
Orthodoxia.de German corpus
============================

Downloaded: $($works.Count) of $($sources.Count) canonical pages.
Source HTML is in raw-html. The JSON corpus contains only the extracted text blocks
and is ready for Bible Desktop's liturgical:import-library command after review.

Do not use a partial corpus in production unless -AllowPartial was explicitly chosen.
"@ | Set-Content -LiteralPath (Join-Path $root 'README.txt') -Encoding utf8

$archivePath = Join-Path $root 'orthodoxia-de-import.zip'
if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
Compress-Archive -LiteralPath @($corpusPath, (Join-Path $root 'README.txt')) -DestinationPath $archivePath -CompressionLevel Optimal

Write-Host "Completed: $corpusPath" -ForegroundColor Green
Write-Host "Import archive: $archivePath" -ForegroundColor Green
