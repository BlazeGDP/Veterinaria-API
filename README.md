# API Restfull Veterinaria — V2

## Resumen

En la **segunda versión** del proyecto se llevó la API veterinaria a una arquitectura **multicloud**, incorporando despliegue en Kubernetes, servicios administrados de nube, mensajería asíncrona y observabilidad.

### Nubes utilizadas

- **AWS:** nube principal para la API veterinaria.
- **GCP:** API externa de juegos.
- **Azure:** API externa de tareas.
- **Grafana Cloud:** monitoreo y observabilidad de los servicios.

### Servicios principales

**AWS**
- Amazon EKS para ejecutar la API mediante contenedores Kubernetes.
- Amazon RDS PostgreSQL para la base de datos.
- Amazon ECR para almacenar la imagen Docker.
- Amazon SQS para mensajería asíncrona.
- Amazon SQS DLQ para mensajes que fallan después de varios intentos.
- AWS Secrets Manager para credenciales de la base de datos.
- Network Load Balancer para exponer la API.
- IAM para gestionar los permisos de los recursos.

**Observabilidad**
- Prometheus para métricas.
- Grafana Cloud para dashboards y visualización.
- OpenTelemetry para trazas distribuidas.
- Identificación mediante `X-Trace-ID` para seguir las solicitudes entre servicios.

### Arquitectura

```text
                         Cliente
                            |
                            v
                  +-------------------+
                  | Orquestador       |
                  +---------+---------+
                            |
                +-----------+-----------+
                |                       |
                v                       v
        +---------------+       +---------------+
        | AWS - EKS     |       | GCP / Azure   |
        | API Veterinaria|      | APIs externas |
        +-------+-------+       +---------------+
                |
        +-------+-------+------------------+
        |               |                  |
        v               v                  v
      RDS              SQS                ECR
   PostgreSQL          + DLQ           Docker images
                         |
                         v
                  Procesamiento
                   asíncrono

                Observabilidad
        +-----------------------------+
        | Prometheus + Grafana Cloud  |
        | OpenTelemetry + Trace ID    |
        +-----------------------------+
```

La API de AWS mantiene la información veterinaria en PostgreSQL y se comunica con las APIs de GCP y Azure para enriquecer las respuestas. El orquestador centraliza el acceso a los servicios. Kubernetes administra el despliegue de la API en EKS, mientras SQS y su DLQ permiten manejar procesos asíncronos y fallos mediante reintentos.

## Versión

**V2.0.0 — API Restfull Veterinaria**
