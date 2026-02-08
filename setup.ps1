$env:Path = "C:\Program Files\nodejs;C:\Users\becof\AppData\Roaming\npm;" + $env:Path

Write-Host "Verificando herramientas..." -ForegroundColor Cyan

if (!(Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm no encontrado en PATH, instalando..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "Instalando dependencias (pnpm install)..." -ForegroundColor Cyan
try {
    & pnpm install
    if ($LASTEXITCODE -ne 0) { throw "Error en pnpm install" }
} catch {
    Write-Host "Error instalando dependencias. Reintentando..." -ForegroundColor Red
    & pnpm install
}

Write-Host "Ejecutando migraciones de base de datos..." -ForegroundColor Cyan
& pnpm db:migrate

Write-Host "`n¡Instalación Completa!" -ForegroundColor Green
Write-Host "Ahora puedes correr el proyecto con:" -ForegroundColor White
Write-Host "pnpm dev" -ForegroundColor Green
