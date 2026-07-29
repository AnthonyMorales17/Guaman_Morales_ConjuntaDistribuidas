#!/bin/bash
set -e

echo "=================================================="
echo "   CavaLocal - Despliegue en Kubernetes (k8s)"
echo "   Namespace: guamanmorales"
echo "=================================================="

# Configurar entorno docker de Minikube si está disponible
if command -v minikube &> /dev/null; then
    echo "--> Evaluando docker-env de Minikube..."
    eval $(minikube docker-env 2>/dev/null || true)
fi

echo "--> Construyendo imágenes Docker..."
docker build -t guamanmorales-backend:latest ./backend
docker build -t guamanmorales-audit:latest ./audit-service
docker build -t guamanmorales-dashboard:latest ./dashboard
docker build -t guamanmorales-frontend:latest ./web

# Habilitar Ingress addon en Minikube si aplica
if command -v minikube &> /dev/null; then
    echo "--> Asegurando addon Ingress en Minikube..."
    minikube addons enable ingress || true
fi

echo "--> Aplicando manifiestos de Kubernetes en k8s/..."
kubectl apply -f k8s/

echo "--> Esperando a que los pods estén listos (Ready)..."
kubectl wait --namespace guamanmorales --for=condition=ready pod --all --timeout=300s || true

echo ""
echo "=================================================="
echo "   Despliegue Finalizado"
echo "=================================================="
echo "Agrega la IP del clúster a tu archivo /etc/hosts (o C:\Windows\System32\drivers\etc\hosts):"
if command -v minikube &> /dev/null; then
    echo "$(minikube ip 2>/dev/null || echo '<MINIKUBE_IP>')  conjunta3p.espe.edu.ec"
else
    echo "<IP_CLUSTER_K8S>  conjunta3p.espe.edu.ec"
fi
echo ""
echo "URLs de acceso:"
echo " - Dashboard SSE: http://conjunta3p.espe.edu.ec/dashboard"
echo " - API Auditoría: http://conjunta3p.espe.edu.ec/api/audit"
echo " - API Backend:   http://conjunta3p.espe.edu.ec/api/docs"
echo " - Frontend Web:  http://conjunta3p.espe.edu.ec/"
echo "=================================================="
