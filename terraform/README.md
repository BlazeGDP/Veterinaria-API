# Terraform — Stable y recursos compartidos

Este stack administra V3.0 Stable y todos los recursos compartidos: VPC, subnets, NAT, security groups, RDS PostgreSQL, Secrets Manager, IAM execution role, ECR, ALB, target group Stable y ECS Cluster Stable.

El estado remoto vive en el bucket indicado en `TF_STATE_BUCKET`, bajo la key `api-restful-veterinaria/v3/terraform.tfstate`.

## Recursos principales

| Archivo | Recursos |
|---|---|
| `vpc.tf` | VPC, subnets, IGW, NAT Gateway y rutas |
| `security_groups.tf` | Security Groups ALB, ECS y RDS |
| `rds.tf` | PostgreSQL 16 en RDS privado |
| `secrets.tf` | Password BD y token de métricas/smoke |
| `iam.tf` | ECS Task Execution Role y lectura de Secrets Manager |
| `ecr.tf` | Repositorio ECR con tags inmutables |
| `alb.tf` | ALB, Target Group Stable, listener y ruta `/metrics/stable` |
| `cloudfront-metrics.tf` | URL HTTPS CloudFront para los jobs de Grafana (sin caché) |
| `ecs.tf` | Cluster, Task Definition y Service Stable |
| `cloudwatch.tf` | Logs de la API Stable |
| `outputs.tf` | Outputs que consume el stack Canary y URL HTTPS de métricas |

## Inicializar y validar

```bash
export AWS_REGION=us-east-2
export TF_STATE_BUCKET=NOMBRE-DEL-BUCKET-EXISTENTE
terraform init -backend-config="bucket=$TF_STATE_BUCKET"
terraform fmt -recursive
terraform validate
STABLE_IMAGE_TAG=$(terraform output -raw stable_image_tag)
terraform plan -var="image_tag=$STABLE_IMAGE_TAG"
```

El despliegue habitual se realiza desde `.github/workflows/deploy.yml`. No destruyas este stack para retirar Canary; usa el workflow `Destroy V3.1 Canary only`.
