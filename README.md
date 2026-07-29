# CavaLocal — Sistema de Auditoría y Dashboard en Tiempo Real (Kubernetes)

**Evaluación Conjunta de Sistemas Distribuidos**  
**Estudiantes:** Guamán & Morales  
**Namespace Kubernetes:** `guamanmorales`  
**Dominio Local:** `conjunta3p.espe.edu.ec`  

---

## 1. Arquitectura del Sistema

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               NGINX Ingress Controller                 │
                                    │                conjunta3p.espe.edu.ec                  │
                                    └───┬────────────────┬─────────────────┬───────────────┬─┘
                                        │                │                 │               │
                                        │ /              │ /api/           │ /api/audit/   │ /dashboard/
                                        ▼                ▼                 ▼               ▼
                              ┌──────────────────┐┌─────────────┐   ┌─────────────┐ ┌─────────────┐
                              │ guamanmorales-   ││guamanmorales│   │guamanmorales│ │guamanmorales│
                              │ frontend         ││backend      │   │audit-service│ │dashboard    │
                              │ (Nginx :80)      ││(NestJS :3001│   │(Express:3002│ │(Nginx :80)  │
                              └──────────────────┘└──────┬──────┘   └──┬────────┬─┘ └─────────────┘
                                                         │             │        │
                                                Publica  │             │        │ Transmite SSE
                                                Eventos  ▼             │        ▼ (Tiempo Real)
                                                  ┌────────────┐       │   ┌───────────────┐
                                                  │RabbitMQ    │◄──────┘   │ Dashboard Web │
                                                  │:5672       │ Consume   └───────────────┘
                                                  └────────────┘ ACK Manual
                                                         │
                                               ┌─────────┴──────────┐
                                               ▼                    ▼
                                      ┌────────────────┐   ┌────────────────┐
                                      │ PostgreSQL     │   │ PostgreSQL     │
                                      │ (cavalocal)    │   │ (audit_db)     │
                                      └────────────────┘   └────────────────┘
```

### Componentes Contenedorizados

| Componente | Imagen Docker | Réplicas | Descripción |
|---|---|---|---|
| **Backend API** | `guamanmorales-backend:latest` | 1 | NestJS REST API. Publica eventos de escrituras en las 5 entidades en RabbitMQ. |
| **Audit Service** | `guamanmorales-audit:latest` | **2** | Microservicio Node.js/Express. Consume RabbitMQ con ACK manual, almacena en DB y transmite vía SSE. |
| **Dashboard SSE** | `guamanmorales-dashboard:latest` | 1 | SPA con Nginx. Visualización y monitoreo en tiempo real de eventos auditados con reconexión automática. |
| **Frontend Web** | `guamanmorales-frontend:latest` | 1 | E-commerce CavaLocal en vanilla JS servido por Nginx. |
| **RabbitMQ** | `rabbitmq:3-management-alpine` | 1 | Broker de mensajería con el exchange `audit.events` (topic). |
| **DB Principal** | `postgres:15-alpine` | 1 | Base de datos PostgreSQL para CavaLocal (`cavalocal`). |
| **DB Auditoría** | `postgres:15-alpine` | 1 | Base de datos PostgreSQL aislada para auditoría (`audit_db`). |

---

## 2. Requisitos Previos

1. **Docker Desktop** o **Docker Engine**.
2. **Minikube** (o **Kind**) instalado y funcionando.
3. **kubectl** instalado.

---

## 3. Guía de Despliegue Rápido (En 1 Solo Paso)

### En Linux / macOS / Git Bash:

```bash
chmod +x deploy.sh
./deploy.sh
```

### En Windows (PowerShell):

```powershell
.\deploy.ps1
```

---

## 4. Pasos Manuales de Despliegue

Si prefieres ejecutar los comandos manualmente paso a paso:

### Paso 1: Iniciar Minikube y configurar el entorno Docker

```bash
minikube start
eval $(minikube docker-env)
```

### Paso 2: Habilitar el Addon de Ingress en Minikube

```bash
minikube addons enable ingress
```

### Paso 3: Construir las imágenes Docker locales

```bash
docker build -t guamanmorales-backend:latest ./backend
docker build -t guamanmorales-audit:latest ./audit-service
docker build -t guamanmorales-dashboard:latest ./dashboard
docker build -t guamanmorales-frontend:latest ./web
```

### Paso 4: Desplegar todos los Manifiestos de Kubernetes

```bash
kubectl apply -f k8s/
```

### Paso 5: Verificar que todos los Pods estén en estado `Running`

```bash
kubectl get pods -n guamanmorales
```

---

## 5. Configuración del Archivo `hosts`

Obtén la IP de tu clúster de Minikube:

```bash
minikube ip
```

Agrega la siguiente línea en tu archivo de hosts (`/etc/hosts` en Linux/macOS o `C:\Windows\System32\drivers\etc\hosts` en Windows):

```text
<MINIKUBE_IP>   conjunta3p.espe.edu.ec
```

*(Ejemplo: `192.168.49.2   conjunta3p.espe.edu.ec`)*

---

## 6. Endpoints y Verificación del Sistema

Una vez configurado el archivo `hosts`, accede desde el navegador:

- 📊 **Dashboard SSE en Tiempo Real:** [http://conjunta3p.espe.edu.ec/dashboard](http://conjunta3p.espe.edu.ec/dashboard)
- 🔍 **API de Auditoría (REST):** [http://conjunta3p.espe.edu.ec/api/audit](http://conjunta3p.espe.edu.ec/api/audit)
- 📖 **Backend Swagger Docs:** [http://conjunta3p.espe.edu.ec/api/docs](http://conjunta3p.espe.edu.ec/api/docs)
- 🍷 **Frontend CavaLocal:** [http://conjunta3p.espe.edu.ec/](http://conjunta3p.espe.edu.ec/)

---

## 7. Pruebas de Auditoría y Tiempo Real (SSE)

Para verificar el flujo completo de eventos en tiempo real:

1. Abre el **Dashboard** en [http://conjunta3p.espe.edu.ec/dashboard](http://conjunta3p.espe.edu.ec/dashboard). Verás el indicador verde `🟢 Conectado`.
2. Realiza operaciones de escritura sobre las 5 entidades en la API del Backend ([http://conjunta3p.espe.edu.ec/api/docs](http://conjunta3p.espe.edu.ec/api/docs)):
   - **User:** Registra un nuevo usuario (`POST /api/auth/register`).
   - **Reservation:** Crea o paga una reserva (`POST /api/reservations`).
   - **Review:** Publica o actualiza una reseña de vino (`POST /api/reviews`).
   - **Wine:** Crea, edita o elimina un vino (`POST/PUT/DELETE /api/wines`).
   - **Establishment:** Crea, edita o elimina una tienda (`POST/PUT/DELETE /api/establishments`).
3. El **Dashboard** reflejará automáticamente cada evento en **≤ 2 segundos** vía SSE sin necesidad de recargar la página.
4. Haz clic en cualquier fila de la tabla para abrir el modal con el detalle completo del JSON (`before` / `after`).

---

## 8. Verificación de Escalabilidad (Competing Consumers)

El microservicio de auditoría está configurado con **2 réplicas**:

```bash
kubectl get deployments -n guamanmorales guamanmorales-audit
```

Gracias a la configuración de `prefetch=1` en RabbitMQ y a la confirmación explícita mediante ACK manual, las 2 réplicas consumen los mensajes de la cola de forma competitiva y equilibrada **sin duplicar eventos**.

---

## 9. Limpieza del Entorno

Para desinstalar todos los recursos del clúster:

```bash
./destroy.sh
# o en PowerShell:
# .\destroy.ps1
```

---

## Estructura del Repositorio

```
.
├── audit-service/           # Microservicio de Auditoría (Node.js/Express + RabbitMQ + SSE)
├── backend/                 # Backend NestJS (API REST, Prisma, RabbitMQ publisher)
├── dashboard/               # Dashboard Web SSE en tiempo real (Nginx)
├── web/                     # Frontend e-commerce vanilla JS (Nginx)
├── k8s/                     # Manifiestos de Kubernetes (Namespace guamanmorales)
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-configmaps.yaml
│   ├── 10-12 postgres principal
│   ├── 15-17 postgres auditoría
│   ├── 20-22 rabbitmq
│   ├── 30-31 backend
│   ├── 40-41 audit-service (2 réplicas)
│   ├── 50-51 dashboard
│   ├── 60-61 frontend
│   └── 90-ingress.yaml
├── deploy.sh / deploy.ps1   # Scripts de automatización de despliegue
├── destroy.sh / destroy.ps1 # Scripts de limpieza
└── README.md
```
