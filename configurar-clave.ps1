# Configura la API key del asistente en .env y reinicia el backend.
# La clave se pide oculta: no queda en el historial ni se muestra en pantalla.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

Write-Host ""
Write-Host "=== Configurar API key del asistente ===" -ForegroundColor Cyan
Write-Host "Groq: claves que empiezan por gsk_    |    xAI: claves que empiezan por xai-"
Write-Host ""

$segura = Read-Host "Pega la API key (no se vera en pantalla)" -AsSecureString
$puntero = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
    $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto($puntero).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($puntero)
}

if (-not $clave) {
    Write-Host "No se ingreso ninguna clave." -ForegroundColor Red
    Read-Host "Enter para cerrar"
    exit 1
}

$proveedor = $null
if ($clave -like 'gsk_*') {
    $proveedor = 'groq'
} elseif ($clave -like 'xai-*') {
    $proveedor = 'xai'
} else {
    Write-Host ""
    Write-Host "No reconoci el prefijo de la clave." -ForegroundColor Yellow
    $opcion = Read-Host "Es de Groq (1) o de xAI (2)?"
    if ($opcion -eq '2') { $proveedor = 'xai' } else { $proveedor = 'groq' }
}

if ($proveedor -eq 'xai') {
    $linea = 'XAI_API_KEY'
} else {
    $linea = 'GROQ_API_KEY'
}

$ruta = Join-Path $raiz '.env'
$contenido = Get-Content $ruta -Raw
$contenido = [regex]::Replace($contenido, "(?m)^$linea=.*$", { param($m) "$linea=$clave" })
$contenido = [regex]::Replace($contenido, '(?m)^ASSISTANT_PROVIDER=.*$', "ASSISTANT_PROVIDER=$proveedor")
[IO.File]::WriteAllText($ruta, $contenido, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Clave guardada en .env (proveedor: $proveedor)." -ForegroundColor Green
Write-Host "Reiniciando backend..." -ForegroundColor Cyan

# Cerrar cualquier backend anterior, incluidos hijos huerfanos que deja --reload.
$pidsBackend = @()
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match 'backend\.main'
} | ForEach-Object { $pidsBackend += $_.ProcessId }

Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object {
    $_.CommandLine -and
    $_.CommandLine -match 'multiprocessing\.spawn' -and
    -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue)
} | ForEach-Object { $pidsBackend += $_.ProcessId }

foreach ($procId in ($pidsBackend | Select-Object -Unique)) {
    taskkill /PID $procId /T /F 2>$null | Out-Null
}
Start-Sleep -Seconds 2

if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "El puerto 8000 sigue ocupado. Cierra la ventana del backend y vuelve a ejecutar este script." -ForegroundColor Red
    Read-Host "Enter para cerrar"
    exit 1
}

Start-Process -FilePath 'powershell.exe' -WorkingDirectory $raiz -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$host.UI.RawUI.WindowTitle = 'JARVIS - Backend (8000)'; & '.\\.venv\\Scripts\\python.exe' -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
)

$listo = $false
for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 1000
    try {
        Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 | Out-Null
        $listo = $true
        break
    } catch { }
}

if (-not $listo) {
    Write-Host "El backend no respondio. Revisa la ventana 'JARVIS - Backend (8000)'." -ForegroundColor Red
    Read-Host "Enter para cerrar"
    exit 1
}

$login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/auth/login' -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes('{"email":"tomas@personal.io","password":"demo"}'))
$herramientas = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/assistant/tools' -Headers @{ Authorization = "Bearer $($login.token)" }

Write-Host ""
if ($herramientas.provider -eq $proveedor) {
    Write-Host "LISTO: proveedor activo = $($herramientas.provider)" -ForegroundColor Green
} else {
    Write-Host "ATENCION: proveedor activo = $($herramientas.provider) (esperaba $proveedor)" -ForegroundColor Yellow
    Write-Host "Revisa la ventana del backend para ver el error." -ForegroundColor Yellow
}
Read-Host "Enter para cerrar"
