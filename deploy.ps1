# PowerShell Deployment Script for Windows environment
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   CavaLocal - Despliegue en Kubernetes (k8s)" -ForegroundColor Cyan
Write-Host "   Namespace: guamanmorales" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Evaluar minikube docker-env si existe
if (Get-Command minikube -ErrorAction SilentlyContinue) {
    Write-Host "--> Configurando minikube docker-env..." -ForegroundColor Yellow
    minikube docker-env | Invoke-Expression
}

Write-Host "--> Construyendo imágenes Docker..." -ForegroundColor Yellow
docker build -t guamanmorales-backend:latest ./backend
docker build -t guamanmorales-audit:latest ./audit-service
docker build -t guamanmorales-dashboard:latest ./dashboard
docker build -t guamanmorales-frontend:latest ./web

if (Get-Command minikube -ErrorAction SilentlyContinue) {
    Write-Host "--> Asegurando addon Ingress en Minikube..." -ForegroundColor Yellow
    minikube addons enable ingress
}

Write-Host "--> Aplicando manifiestos de Kubernetes en k8s/..." -ForegroundColor Yellow
kubectl apply -f k8s/

Write-Host "--> Esperando pods..." -ForegroundColor Yellow
kubectl wait --namespace guamanmorales --for=condition=ready pod --all --timeout=300s

$minikubeIp = "127.0.0.1"
if (Get-Command minikube -ErrorAction SilentlyContinue) {
    $minikubeIp = minikube ip
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   Despliegue Finalizado Exitosamente" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Configura en tu archivo C:\Windows\System32\drivers\etc\hosts:" -ForegroundColor White
Write-Host "$minikubeIp  conjunta3p.espe.edu.ec" -ForegroundColor Yellow
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host " - Dashboard SSE: http://conjunta3p.espe.edu.ec/dashboard" -ForegroundColor Cyan
Write-Host " - API Auditoría: http://conjunta3p.espe.edu.ec/api/audit" -ForegroundColor Cyan
Write-Host " - API Backend:   http://conjunta3p.espe.edu.ec/api/docs" -ForegroundColor Cyan
Write-Host " - Frontend Web:  http://conjunta3p.espe.edu.ec/" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
