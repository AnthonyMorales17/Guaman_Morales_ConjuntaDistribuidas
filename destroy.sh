#!/bin/bash
echo "=================================================="
echo "   Eliminando Recursos de Kubernetes"
echo "   Namespace: guamanmorales"
echo "=================================================="

kubectl delete -f k8s/ --ignore-not-found

echo "--> Limpiando namespace si no se eliminó..."
kubectl delete namespace guamanmorales --ignore-not-found

echo "=================================================="
echo "   Limpieza Completada"
echo "=================================================="
