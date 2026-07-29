Write-Host "==================================================" -ForegroundColor Red
Write-Host "   Eliminando Recursos de Kubernetes" -ForegroundColor Red
Write-Host "   Namespace: guamanmorales" -ForegroundColor Red
Write-Host "==================================================" -ForegroundColor Red

kubectl delete -f k8s/ --ignore-not-found
kubectl delete namespace guamanmorales --ignore-not-found

Write-Host "==================================================" -ForegroundColor Green
Write-Host "   Limpieza Completada" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
