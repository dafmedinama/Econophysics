# Stage normal dashboard source files in the parent, preserving its Sites checkout.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteRoot = Join-Path $projectRoot 'dashboard'
if (-not (Test-Path -LiteralPath (Join-Path $siteRoot '.git'))) {
    & git -C $projectRoot add -- dashboard
    if ($LASTEXITCODE -ne 0) { throw 'Unable to stage dashboard source.' }
    return
}
$sourceFiles = @(& git -C $siteRoot ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate dashboard source.' }
$sourceFiles = $sourceFiles | Where-Object { $_ -notmatch '(^|/)(node_modules|dist|\.git|\.next|\.vinext|\.wrangler|test-results)/|\.tsbuildinfo$' }
foreach ($sourceFile in $sourceFiles) {
    $relativeFile = "dashboard/$sourceFile"
    # git add skips paths inside an embedded repository. Write ordinary blobs to
    # the parent's object database and index instead; never stage a gitlink.
    $blobId = & git -C $projectRoot hash-object -w --path=$relativeFile -- $relativeFile
    if ($LASTEXITCODE -ne 0) { throw "Unable to hash $relativeFile" }
    & git -C $projectRoot update-index --add --cacheinfo "100644,$blobId,$relativeFile"
    if ($LASTEXITCODE -ne 0) { throw "Unable to stage $relativeFile" }
}
