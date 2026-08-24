param(
  [string]$BaseUrl = "https://katalog-hoz.vercel.app",
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"

$resolvedBaseUrl = $BaseUrl.TrimEnd("/")
$productsUrl = "$resolvedBaseUrl/api/products"
$categoriesUrl = "$resolvedBaseUrl/api/categories"

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$imagesDirectory = Join-Path $Destination "images"
New-Item -ItemType Directory -Force -Path $imagesDirectory | Out-Null

$productsPath = Join-Path $Destination "products.json"
$categoriesPath = Join-Path $Destination "categories.json"

# Preserve the exact response bytes first; parsing and re-serializing a top-level
# JSON array is unreliable in older Windows PowerShell versions.
Invoke-WebRequest -Uri $productsUrl -OutFile $productsPath
Invoke-WebRequest -Uri $categoriesUrl -OutFile $categoriesPath

$productsResponse = Get-Content -Raw -Encoding utf8 -Path $productsPath | ConvertFrom-Json
$categoriesResponse = Get-Content -Raw -Encoding utf8 -Path $categoriesPath | ConvertFrom-Json

$products = if ($productsResponse -is [System.Array]) {
  @($productsResponse)
} else {
  @($productsResponse.items)
}

$categories = if ($categoriesResponse -is [System.Array]) {
  @($categoriesResponse)
} else {
  @($categoriesResponse.items)
}

$timestamp = (Get-Date).ToUniversalTime().ToString("o")

$photoUrls = @(
  $products |
    ForEach-Object { $_.photo } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Sort-Object -Unique
)

$manifest = for ($index = 0; $index -lt $photoUrls.Count; $index++) {
  $url = [string]$photoUrls[$index]
  $uri = [Uri]$url
  $leaf = [Uri]::UnescapeDataString([IO.Path]::GetFileName($uri.AbsolutePath))
  if ([string]::IsNullOrWhiteSpace($leaf)) {
    $leaf = "image.bin"
  }

  $safeLeaf = $leaf -replace '[<>:"/\\|?*]', '_'
  $localName = "{0:D4}-{1}" -f ($index + 1), $safeLeaf
  $localPath = Join-Path $imagesDirectory $localName

  try {
    Invoke-WebRequest -Uri $url -OutFile $localPath
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $localPath).Hash.ToLowerInvariant()
    $fileSize = (Get-Item -LiteralPath $localPath).Length

    [pscustomobject]@{
      url = $url
      localFile = "images/$localName"
      status = "downloaded"
      bytes = $fileSize
      sha256 = $hash
      error = ""
    }
  } catch {
    [pscustomobject]@{
      url = $url
      localFile = "images/$localName"
      status = "failed"
      bytes = 0
      sha256 = ""
      error = $_.Exception.Message
    }
  }
}

$manifest | Export-Csv -NoTypeInformation -Encoding utf8 -Path (Join-Path $Destination "images-manifest.csv")

[ordered]@{
  recoveredAtUtc = $timestamp
  baseUrl = $resolvedBaseUrl
  productsSource = $productsUrl
  categoriesSource = $categoriesUrl
  products = $products.Count
  categories = $categories.Count
  referencedImages = $photoUrls.Count
  downloadedImages = @($manifest | Where-Object { $_.status -eq "downloaded" }).Count
  failedImages = @($manifest | Where-Object { $_.status -eq "failed" }).Count
} | ConvertTo-Json | Set-Content -Encoding utf8 -Path (Join-Path $Destination "summary.json")

Get-Content -Raw (Join-Path $Destination "summary.json")
