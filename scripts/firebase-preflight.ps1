$ErrorActionPreference = 'Stop'

$projectId = 'explorarte-6335b'
$region = 'us-central1'
$service = 'explorarte-api'

Write-Host "Proyecto esperado: $projectId"

$nodeVersion = node --version
Write-Host "Node: $nodeVersion"

$firebaseVersion = npx -y firebase-tools@latest --version
Write-Host "Firebase CLI: $firebaseVersion"
npx -y firebase-tools@latest hosting:sites:list --project $projectId

$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
    $userInstall = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
    if (Test-Path $userInstall) { $gcloud = Get-Item $userInstall }
}
if (-not $gcloud) {
    Write-Warning 'Google Cloud CLI no está instalado o no está en PATH.'
    Write-Host 'Instálalo desde https://cloud.google.com/sdk/docs/install y vuelve a ejecutar este script.'
    exit 2
}

$gcloudCommand = $gcloud.Source
$activeAccount = & $gcloudCommand auth list --filter=status:ACTIVE --format='value(account)'
if (-not $activeAccount) {
    Write-Warning 'No hay una cuenta activa en gcloud. Ejecuta: gcloud auth login'
    exit 3
}
Write-Host "Cuenta gcloud: $activeAccount"

$activeProject = & $gcloudCommand config get-value project 2>$null
if ($activeProject -ne $projectId) {
    Write-Warning "Proyecto activo '$activeProject'; se esperaba '$projectId'."
    Write-Host "Ejecuta: gcloud config set project $projectId"
    exit 4
}

Write-Host 'Cloud Run:'
& $gcloudCommand run services describe $service --project $projectId --region $region --format='yaml(metadata.name,status.url,status.conditions)' 2>$null
if ($LASTEXITCODE -ne 0) { Write-Warning "Falta Cloud Run '$service' en $region." }

Write-Host 'Cloud SQL:'
& $gcloudCommand sql instances list --project $projectId --format='table(name,region,databaseVersion,state)'

Write-Host 'Buckets:'
& $gcloudCommand storage buckets list --project $projectId --format='table(name,location,storage_class)'

Write-Host 'Secretos esperados:'
foreach ($secret in @('JWT_SECRET', 'DB_PASSWORD')) {
    & $gcloudCommand secrets describe $secret --project $projectId --format='value(name)' 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warning "Falta Secret Manager: $secret" }
}

Write-Host 'Diagnóstico terminado. Revisa cualquier advertencia antes del primer deploy.'
