<#
  Abre en el firewall de Windows los puertos que el backend en Docker usa
  (8000 API, 5173 web), para que un telefono en la misma red Wi-Fi pueda
  conectarse a "docker compose up" corriendo en esta maquina.

  Seguro de correr varias veces: si una regla ya existe, no la duplica.
  Pide permisos de administrador automaticamente si no los tiene (abre una
  ventana nueva con UAC) -- no hace falta abrir PowerShell como admin a mano.
#>

$ports = @(
  @{ Port = 8000; Name = "ExplorArte API dev (8000)" },
  @{ Port = 5173; Name = "ExplorArte Web dev (5173)" }
)

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Este paso necesita permisos de administrador -- se abrira una ventana nueva (UAC)." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "Configurando el firewall de Windows para el proyecto ExplorArte..." -ForegroundColor Cyan
Write-Host ""

foreach ($p in $ports) {
    $existing = Get-NetFirewallRule -DisplayName $p.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Puerto $($p.Port): la regla ya existia, no se toco." -ForegroundColor Yellow
    } else {
        New-NetFirewallRule -DisplayName $p.Name -Direction Inbound -LocalPort $p.Port -Protocol TCP -Action Allow -Profile Any | Out-Null
        Write-Host "  Puerto $($p.Port): regla creada." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Listo. Con 'docker compose up --build' corriendo, tu telefono (en la misma" -ForegroundColor Cyan
Write-Host "red Wi-Fi) ya puede llegar a:"
Write-Host "  - API:  http://<tu-IP-local>:8000"
Write-Host "  - Web:  http://<tu-IP-local>:5173"
Write-Host ""
Write-Host "Para encontrar tu IP local: abre otra terminal y corre 'ipconfig' (busca 'Direccion IPv4')."
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..."
[void][System.Console]::ReadKey($true)
