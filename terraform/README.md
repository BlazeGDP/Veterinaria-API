# Infraestructura como código — API RESTful Veterinaria (V3)

Despliegue en **AWS** con **Terraform**: la API NestJS corre en contenedores (ECS Fargate) detrás de un
Application Load Balancer y usa PostgreSQL en RDS dentro de subnets privadas.

## Arquitectura

```text
Internet ──> ALB (subnets públicas) ──> ECS Fargate (subnets privadas) ──> RDS PostgreSQL (privado)
                                              │  └─ imagen desde ECR
                                              ├─ credenciales desde Secrets Manager
                                              └─ logs en CloudWatch
```

## Un archivo `.tf` por servicio

| Archivo | Servicio / contenido |
|---|---|
| `versions.tf`, `provider.tf`, `backend.tf` | Versiones, proveedor AWS y state remoto en S3 |
| `variables.tf`, `outputs.tf` | Variables de entrada y salidas (URL de la API, etc.) |
| `vpc.tf` | **VPC**, subnets públicas/privadas, Internet Gateway, NAT Gateway, rutas |
| `security_groups.tf` | Security Groups de ALB, ECS y RDS |
| `rds.tf` | **RDS PostgreSQL 16** (base de datos, privada) |
| `secrets.tf` | **Secrets Manager** + contraseña aleatoria de la BD |
| `iam.tf` | Rol de ejecución de las tareas ECS |
| `ecr.tf` | **ECR** (repositorio de la imagen Docker) |
| `alb.tf` | **Application Load Balancer**, target group, listener |
| `ecs.tf` | **ECS Fargate** (cluster, task definition, service) |
| `cloudwatch.tf` | **CloudWatch Logs** |

## Requisitos previos

- Cuenta de AWS y AWS CLI (o AWS CloudShell).
- Terraform >= 1.11.
- Repositorio en GitHub con los secrets de AWS (ver sección 1).

## 1. Preparación (una sola vez)

```bash
bash scripts/bootstrap-aws.sh <github-owner> <github-repo>
```

Crea el bucket S3 del state (`api-restful-veterinaria-tf-state-<ACCOUNT_ID>`). Si la cuenta lo permite también crea
el proveedor OIDC de GitHub y un rol; si una política de la organización (SCP) lo bloquea, lo omite.

### Autenticación del pipeline

El pipeline usa tres secrets de GitHub (Settings > Secrets and variables > Actions):
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN`.
Con credenciales temporales (cuentas de organización) se obtienen desde CloudShell con:

```bash
aws configure export-credentials --format env
```

Son temporales: se renuevan y se actualizan los tres secrets antes de cada despliegue o destroy
(la fecha de vencimiento aparece en `AWS_CREDENTIAL_EXPIRATION`). Nunca se suben al repositorio.
Si la cuenta permitiera OIDC, esa sería la opción más segura (sin claves guardadas).

## 2. Despliegue con el pipeline (recomendado)

Cada `push` a `main` ejecuta `.github/workflows/deploy.yml`, que:

1. valida formato y sintaxis de Terraform,
2. crea el repositorio ECR,
3. construye y sube la imagen Docker,
4. aplica toda la infraestructura (`terraform apply`),
5. espera a que ECS esté estable,
6. crea las tablas en PostgreSQL,
7. hace una prueba a `/health` e imprime la URL pública.

También se puede lanzar a mano desde **Actions > Deploy V3 to AWS > Run workflow**.

## 3. Despliegue manual con Terraform (opcional)

```bash
cd terraform
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

terraform init -backend-config="bucket=api-restful-veterinaria-tf-state-${ACCOUNT_ID}"
terraform fmt -check -recursive
terraform validate

# El repositorio ECR debe existir antes de que ECS pida la imagen
terraform apply -target=aws_ecr_repository.api -target=aws_ecr_lifecycle_policy.api

# ... construir y subir la imagen a ECR (lo hace el pipeline) ...

terraform apply
terraform output api_url
```

## 4. Probar la API

```bash
URL=$(terraform output -raw api_url)
curl "$URL/health"          # {"status":"ok"}
```

## 5. Eliminar toda la infraestructura (al terminar la sustentación)

**Opción A — pipeline:** GitHub > Actions > **Destroy V3 from AWS** > Run workflow > escribir `DESTROY`.

**Opción B — manual:**

```bash
cd terraform
terraform destroy
```

Los recursos están configurados para borrarse limpiamente (ECR con `force_delete`, RDS sin snapshot final ni
protección, secreto sin ventana de recuperación). El bucket S3 del state y el rol de GitHub los crea el bootstrap
y **no** los elimina Terraform; son gratuitos/insignificantes, pero pueden borrarse a mano si se desea.

## Costos

Mientras la infraestructura esté arriba se cobra principalmente NAT Gateway, ALB, RDS y Fargate (del orden de
décimas de dólar por hora en conjunto). **Ejecutar el destroy al terminar.**
