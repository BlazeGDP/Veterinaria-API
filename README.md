# API RESTful Veterinaria — V3.0 Stable + V3.1 Canary

Proyecto NestJS + Fastify + TypeORM + PostgreSQL, desplegado en AWS con Terraform, ECS Fargate, ECR y Application Load Balancer (ALB). La evolución V3.1 añade una funcionalidad de consulta de citas y se libera gradualmente mediante Canary Deployment.

## 1. Arquitectura

```text
                         Internet / prueba concurrente
                                      |
                                      v
                            Application Load Balancer
                         /             |               \
       x-canary:true + token     rutas /metrics/*      tráfico público
                   |                    |                 ponderado
                   v                    v                    |
          ECS Cluster Canary    Stable / Canary metrics     |
             V3.1 Canary                                   |
          1 ECS Service / Task                              |
          Target Group Canary                               |
                   |                                        |
                   +---------------------+------------------+
                                         |
                             PostgreSQL RDS compartido
                                         |
                               misma VPC / subnets privadas

  V3.0 Stable: ECS Cluster original + ECS Service + Target Group Stable
  Observabilidad: métricas Prometheus scrapeadas por Grafana Cloud
  Infraestructura: Terraform / estados S3 independientes para Stable y Canary
```

**Separación de despliegues:**

- `terraform/`: infraestructura compartida y API V3.0 Stable (VPC, subnets, NAT, security groups, ALB, RDS, Secrets Manager, ECR y clúster Stable).
- `terraform-canary/`: exclusivamente los recursos de V3.1 Canary (clúster, servicio, task definition, target group y reglas ALB). Su estado remoto es independiente.
- `destroy-canary.yml`: elimina V3.1 sin destruir V3.0, ALB, RDS ni VPC.
- `destroy.yml`: elimina primero Canary y luego toda la infraestructura Stable/compartida.

Los dos clústeres se ejecutan dentro de la misma VPC y comparten la base de datos y el ALB. La base de datos no se duplica; se evita que las dos versiones tengan datos distintos durante la comparación.

## 2. Versiones y cambio funcional

| Track | Versión | Clúster ECS | Feature nueva | Uso |
|---|---|---|---|---|
| Stable | `3.0.0` | `api-restful-veterinaria-cluster` | Desactivada | Línea base |
| Canary | `3.1.0` | `api-restful-veterinaria-canary-cluster` | Activada | Evaluación progresiva |

Las dos versiones exponen en cada respuesta los headers:

- `X-App-Version`: `3.0.0` o `3.1.0`.
- `X-App-Track`: `stable` o `canary`.

El body de `/health` también informa `version` y `track`.

### Endpoint nuevo de V3.1

`GET /appointments/summary?desde=2026-01-01&hasta=2026-12-31`

Ejemplo de respuesta:

```json
{
  "version": "3.1.0",
  "track": "canary",
  "desde": "2026-01-01",
  "hasta": "2026-12-31",
  "total": 18,
  "porEstado": {
    "scheduled": 7,
    "completed": 9,
    "cancelled": 2
  },
  "generadoEn": "2026-10-31T15:00:00.000Z"
}
```

En Stable la ruta responde `404`, mientras que en Canary está habilitada. Las rutas existentes (`/owners`, `/pets`, `/appointments`, `/health`) conservan su comportamiento.

### Expand/Contract y compatibilidad

No se agregan, eliminan ni renombran columnas. El endpoint nuevo ejecuta una consulta `SELECT` agrupada por estado sobre `appointments`; no ejecuta migraciones ni escribe datos. Ambas versiones usan el mismo esquema `owners`, `pets` y `appointments`. Por tanto, el rollback a Stable no requiere revertir cambios de base de datos.

## 3. Preparar AWS desde CloudShell

La región configurada por el proyecto es `us-east-2`. En AWS CloudShell descarga el mismo repositorio y verifica la cuenta:

```bash
git clone https://github.com/BlazeGDP/Veterinaria-API.git
cd Veterinaria-API
export AWS_REGION=us-east-2
aws sts get-caller-identity
aws s3api list-buckets --query 'Buckets[].Name' --output table
```

Reutiliza el bucket S3 de estado que ya creaste para la V3. Escribe su nombre exacto en esta variable (no crees un bucket nuevo si ya existe el state):

```bash
export TF_STATE_BUCKET="NOMBRE-DEL-BUCKET-EXISTENTE"
aws s3api head-bucket --bucket "$TF_STATE_BUCKET"
aws s3api get-bucket-versioning --bucket "$TF_STATE_BUCKET"
aws s3api get-bucket-encryption --bucket "$TF_STATE_BUCKET"
aws s3api list-objects-v2 --bucket "$TF_STATE_BUCKET" \
  --prefix api-restful-veterinaria/v3/ --query 'Contents[].Key' --output table
aws s3api head-object --bucket "$TF_STATE_BUCKET" \
  --key api-restful-veterinaria/v3/terraform.tfstate
```

**No ejecutes `terraform apply` hasta confirmar que existe el state de V3.** Si `head-object` falla, no crees un state vacío encima de recursos que ya existen: primero localiza el bucket/key que usó el despliegue original o recupera/migra el state. Solo cuando confirmes que la infraestructura no existe y el state debe inicializarse, crea un bucket con:

```bash
bash scripts/bootstrap-aws.sh
```

El script usa por defecto `tfstate-api-restful-veterinaria-<ACCOUNT_ID>`, activa versionado, cifrado AES256 y bloqueo de acceso público. Para usar otro bucket ya existente:

```bash
export TF_STATE_BUCKET=nombre-real-del-bucket
bash scripts/bootstrap-aws.sh
```

No crea un usuario IAM ni modifica OIDC. El pipeline reutiliza las credenciales IAM que ya tienes configuradas en GitHub.

### GitHub Repository Variables y Secrets

En el repositorio `BlazeGDP/Veterinaria-API`, entra a **Settings → Secrets and variables → Actions**.

Crea esta Repository Variable:

| Variable | Valor |
|---|---|
| `TF_STATE_BUCKET` | El nombre exacto del bucket S3 verificado en CloudShell |

Conserva los secrets AWS que ya usa V3:

| Secret | Uso |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key del usuario IAM existente |
| `AWS_SECRET_ACCESS_KEY` | Secret key del mismo usuario IAM |
| `AWS_SESSION_TOKEN` | Solo si las credenciales AWS son temporales; omitir para claves permanentes |

No pegues las credenciales en archivos del repositorio, terminales compartidas ni README. La automatización reutiliza las claves IAM existentes: no crea usuarios, claves nuevas ni un proveedor OIDC.

## 4. Publicar V3.0 Stable

1. Copia los archivos de esta evolución al repositorio.
2. Haz commit con GitMoji y SemVer, por ejemplo:

```bash
git add .
git commit -m ":sparkles: add canary deployment foundation and v3.1 appointment summary"
git push origin main
```

3. El push a `main` ejecuta `.github/workflows/deploy.yml`. Este flujo construye una imagen con tag único e inmutable, publica la V3.0 Stable, aplica Terraform, inicializa el esquema PostgreSQL de forma idempotente y verifica `/health`.
4. Comprueba el resultado en GitHub → Actions → **Deploy V3.0 Stable to AWS**.

El estado estable usa la key S3 `api-restful-veterinaria/v3/terraform.tfstate`.

## 5. Preparar Grafana Cloud

Usamos Grafana Cloud como SaaS para evitar mantener otro clúster Prometheus/Grafana en AWS. La modalidad Free publica los servicios con límites de uso, incluye 14 días de retención y tiene un cupo de 10.000 series activas para Metrics. Revisa el plan vigente antes de una prueba grande.

1. Crea/inicia sesión en Grafana Cloud y crea un Stack.
2. Despliega V3.0 Stable (sección anterior) y copia la URL del ALB:

```bash
terraform -chdir=terraform output -raw api_url
```

3. Obtén el token que Terraform generó y guardó en Secrets Manager:

```bash
terraform -chdir=terraform init -backend-config="bucket=$TF_STATE_BUCKET"
terraform -chdir=terraform output -raw metrics_bearer_token
```

Trátalo como contraseña. No lo guardes en Git. El mismo token se usa para autenticar las rutas de métricas y proteger la ruta de smoke-test Canary.

4. En Grafana Cloud, abre **Connections → Add connection → Metrics Endpoint** y crea dos scrape jobs autenticados con **Bearer Token**:

| Job | URL | Autenticación |
|---|---|---|
| `veterinaria-stable` | `http://<ALB_DNS>/metrics/stable` | Bearer + token anterior |
| `veterinaria-canary` | `http://<ALB_DNS>/metrics/canary` | Bearer + token anterior |

El primer endpoint siempre va al Target Group Stable y el segundo al Target Group Canary. Usa el intervalo recomendado de 60 segundos. Las rutas no mezclan las métricas de los tracks.

5. En la tarjeta Prometheus de tu Stack, abre **Details** y copia el endpoint de consulta y el username. Crea un token de lectura con alcance `metrics:read`.
6. Guarda estos tres valores en GitHub Actions Secrets:

| Secret | Contenido |
|---|---|
| `GRAFANA_PROMETHEUS_URL` | URL base de consulta del servicio Prometheus, normalmente termina en `/api/prom` |
| `GRAFANA_PROMETHEUS_USER` | Username/instance ID numérico de Prometheus |
| `GRAFANA_PROMETHEUS_READ_TOKEN` | Token Grafana Cloud con alcance `metrics:read` |

7. Importa el dashboard: Grafana → **Dashboards → New → Import** → carga `observability/grafana-dashboard.json` → selecciona el datasource Prometheus del Stack.

El dashboard presenta tráfico, 4xx/5xx, p50/p95/p99, saturación de CPU/memoria, lecturas/listados de citas por track y consultas del endpoint nuevo. El endpoint de métricas queda publicado por el ALB con autenticación Bearer. Este proyecto conserva el listener HTTP de la V3: úsalo solo para la práctica con un token aleatorio y temporal; en un despliegue real añade HTTPS con dominio y certificado ACM antes de enviar tokens por Internet.

## 6. Publicar V3.1 Canary

Cuando Stable esté desplegada y Grafana esté configurado:

1. Ve a GitHub → Actions → **Deploy V3.1 Canary to AWS**.
2. Selecciona **Run workflow**.
3. Espera a que termine y comprueba la URL de salida.

Este flujo construye `3.1.0`, crea un segundo clúster ECS, servicio y Target Group; comparte la base de datos y el ECR de Stable, y no cambia el porcentaje público. La distribución inicial sigue siendo `100% Stable / 0% Canary`.

Canary se puede probar al 0% público mediante los dos headers:

```bash
URL=$(terraform -chdir=terraform output -raw api_url)
TOKEN=$(terraform -chdir=terraform output -raw metrics_bearer_token)

curl -i -H 'x-canary: true' -H "x-canary-token: $TOKEN" "$URL/health"
curl -i -H 'x-canary: true' -H "x-canary-token: $TOKEN" \
  "$URL/appointments/summary?desde=2026-01-01&hasta=2026-12-31"
```

El header `x-canary: true` hace que el ALB envíe la petición a Canary aunque su peso público sea 0. El segundo header es un token secreto para que la ruta no sea una puerta pública de acceso a la versión de prueba.

## 7. Traffic splitting, carga y estrategia estadística

La ruta pública normal se distribuye en el ALB. El script `scripts/set-canary-traffic.sh` modifica los pesos del listener; no despliega contenedores ni modifica los datos. Antes de iniciar cada rollout se comprueba que haya al menos un target healthy en Stable y Canary. AWS advierte que un ALB con target groups ponderados no hace failover automático si un grupo queda sin targets saludables; por eso el quality gate debe ejecutar el rollback explícito a Stable.

```bash
./scripts/set-canary-traffic.sh 0
./scripts/set-canary-traffic.sh 5
./scripts/set-canary-traffic.sh 10
./scripts/set-canary-traffic.sh 25
./scripts/set-canary-traffic.sh 50
./scripts/set-canary-traffic.sh 100
```

Plan de etapas y horneado configurado inicialmente:

| Etapa | Stable | Canary | Bake time | Qué se valida |
|---|---:|---:|---:|---|
| 0 | 100% | 0% público | Smoke interno | `x-canary: true` + token válido; endpoint nuevo |
| 1 | 95% | 5% | 5 min de carga | Errores, latencia y primera muestra |
| 1b | 90% | 10% | 5 min de carga | Calidad sostenida |
| 2 | 75% | 25% | 5 min de carga | Comparación con baseline |
| 2b | 50% | 50% | 5 min de carga | Muestra ampliada |
| 3 | 0% | 100% | Confirmación | Todas las nuevas peticiones a Canary |

En cada etapa el generador mantiene 30 solicitudes concurrentes durante 5 minutos y después espera 70 segundos para permitir el siguiente scrape de Grafana Cloud (intervalo 60 s). El script exige 200 peticiones por track en la ventana Prometheus de 5 minutos antes de decidir. La etapa 100% solo se ejecuta cuando todas las puertas de calidad han pasado.

La ejecución guiada está en GitHub Actions → **Canary rollout with statistical quality gate**. En condiciones normales selecciona `none`. El parámetro `stage_duration_seconds` viene en 300 segundos y puede aumentarse si la muestra no alcanza 200 solicitudes por track. También se puede ejecutar desde CloudShell con las variables `GRAFANA_PROMETHEUS_URL`, `GRAFANA_PROMETHEUS_USER` y `GRAFANA_PROMETHEUS_READ_TOKEN` exportadas.

El rollout automatiza estas acciones por etapa:

1. Cambiar el porcentaje del listener ALB.
2. Generar carga concurrente continua a `GET /appointments` durante cinco minutos con `scripts/load-test.py`; ambas versiones consultan el mismo RDS y se comparan bajo la misma carga.
3. Esperar 70 segundos para permitir al scrape de Grafana Cloud recoger los contadores e histogramas.
4. Comparar las métricas Stable/Canary mediante `scripts/canary-analysis.py`.
5. Avanzar solo si pasa el quality gate. Ante una regresión, modifica inmediatamente el listener a 100% Stable / 0% Canary. Si falta muestra, pausa sin promocionar.

### Umbrales versionados

Los criterios se guardan en `config/canary-slo.json` antes del despliegue:

| Señal | Criterio de promoción |
|---|---|
| Tamaño de muestra | Al menos 200 solicitudes por track en la ventana analizada |
| Errores 5xx Canary | Tasa observada ≤ 1% |
| Incertidumbre estadística | Límite superior de Wilson al 95% ≤ 5% |
| Comparación de errores | Cota superior Canary no más de 3 puntos porcentuales sobre Stable |
| Latencia p95 | ≤ max(50 ms, 1,5 × p95 Stable) y ≤ 1.000 ms |
| Latencia p99 | ≤ 2.500 ms |
| Saturación CPU | Máximo de la ventana de 5 min ≤ 85% |
| Saturación memoria | Máximo de la ventana de 5 min ≤ 85% |

El análisis calcula el intervalo de confianza Wilson al 95% para la proporción de 5xx y exige una muestra mínima de ambos tracks. También informa 4xx, aunque los 4xx no disparan el aborto por sí solos porque suelen representar solicitudes inválidas del cliente. La latencia se compara por histogramas Prometheus con `histogram_quantile`. Los umbrales no deben cambiarse después de observar resultados para forzar una promoción.

Para revisar estados Terraform manualmente desde CloudShell:

```bash
export TF_STATE_BUCKET="NOMBRE-DEL-BUCKET-EXISTENTE"
terraform -chdir=terraform init -input=false -backend-config="bucket=$TF_STATE_BUCKET"
STABLE_IMAGE_TAG=$(terraform -chdir=terraform output -raw stable_image_tag)
terraform -chdir=terraform plan -var="image_tag=$STABLE_IMAGE_TAG"
terraform -chdir=terraform-canary init -input=false -backend-config="bucket=$TF_STATE_BUCKET"
terraform -chdir=terraform-canary plan \
  -var="tf_state_bucket=$TF_STATE_BUCKET" \
  -var="image_tag=TAG_CANARY_YA_PUBLICADO"
```

El `TAG_CANARY_YA_PUBLICADO` debe ser una imagen ya subida a ECR por el workflow **Deploy V3.1 Canary to AWS**. Los comandos `plan` no modifican infraestructura.

La métrica de negocio `appointments_list_queries_total` cuenta lecturas del listado de citas por track; el dashboard también muestra `appointments_created_total` y `appointment_summary_queries_total`. Las métricas `process_cpu_saturation_ratio` y `process_memory_saturation_ratio` miden el proceso Node.js en relación con los límites asignados a la tarea Fargate; son una aproximación de saturación de la API, no sustituyen las métricas de infraestructura de CloudWatch Container Insights.

Para una demostración de carga independiente:

```bash
URL=$(terraform -chdir=terraform output -raw api_url)
python3 scripts/load-test.py --url "$URL" --path /appointments --duration-seconds 300 --concurrency 30
```

El resumen impreso indica cuántas respuestas atendió Stable y cuántas Canary, el porcentaje observado de cada track, las versiones y los códigos HTTP. Los porcentajes pueden variar alrededor de los pesos configurados porque el balanceo es probabilístico.

## 8. Inyección de fallos y rollback

La inyección solo se activa en el proceso Canary (`CANARY_FAILURE_ENABLED=true`) y requiere el token privado `x-canary-token`. Stable la ignora incluso si recibe esa cabecera. La cabecera `x-canary-failure` admite:

- `500`: lanza un HTTP 500.
- `latency`: agrega 1.500 ms de latencia.

Para probarlo directamente contra Canary al 0% público:

```bash
URL=$(terraform -chdir=terraform output -raw api_url)
TOKEN=$(terraform -chdir=terraform output -raw metrics_bearer_token)

curl -i -H 'x-canary: true' -H "x-canary-token: $TOKEN" \
  -H 'x-canary-failure: 500' "$URL/health"
```

Para demostrar el quality gate y rollback automático, ejecuta **Canary rollout with statistical quality gate** con `failure_mode=500`. La prueba envía tráfico normal ponderado; Stable sigue respondiendo correctamente y Canary registra 5xx. Al superar el umbral, el pipeline vuelve al 0% Canary / 100% Stable.

También puedes hacerlo con `failure_mode=latency`, que degrada el p95/p99 de Canary. La salida del pipeline incluye la razón del aborto y los pesos resultantes.

## 9. Destruir V3.1 sin apagar Stable

Cuando hayas probado promoción y rollback, elimina solamente Canary:

1. GitHub → Actions → **Destroy V3.1 Canary only**.
2. Run workflow y escribe exactamente `DESTROY-CANARY`.
3. El flujo deja el listener apuntando solo a Stable (no deja una referencia al Target Group Canary), destruye el clúster/servicio/Target Group/reglas/logs Canary y elimina su imagen del ECR compartido.
4. V3.0 Stable, RDS, VPC, ALB, ECR y Secrets Manager continúan activos.

**Importante sobre costos:** destruir Canary elimina el cómputo de sus tareas, pero Stable, RDS, ALB y NAT Gateway siguen existiendo y pueden generar cargos. Para apagar todo entre prácticas, ejecuta **Destroy all Veterinaria API AWS infrastructure** y confirma con `DESTROY-ALL`. Antes de la sustentación tendrás que desplegar Stable y luego Canary nuevamente. Como ALB y Secrets Manager se recrean, vuelve a registrar en Grafana Cloud las dos URLs `/metrics/stable` y `/metrics/canary` con el nuevo DNS del ALB y el nuevo Bearer token que generará Terraform.

## 10. Commits, tags y release SemVer

Usa GitMoji en los commits y crea el tag del release cuando termines y verifiques la entrega:

```bash
git add .
git commit -m ":sparkles: add v3.1 canary appointment summary"
git tag -a v3.1.0 -m "Veterinaria API v3.1.0 - Canary Deployment"
git push origin main --tags
```

El repositorio contiene el SLO, los scripts de rollout, el dashboard y la documentación que respaldan el tag.

## 11. Matriz de cumplimiento de la rúbrica

| Punto de la rúbrica | Evidencia en el repositorio |
|---|---|
| Stable y Canary en paralelo | `terraform/` + `terraform-canary/`, dos clusters ECS |
| Cambio funcional V3.1 | `GET /appointments/summary` activado por feature flag |
| Expand/Contract | Sin migraciones ni modificación de esquema; endpoint read-only |
| Identificación de versión y track | `X-App-Version`, `X-App-Track`, body de `/health` |
| Acceso de prueba al 0% | Regla ALB `x-canary:true` + `x-canary-token` |
| Reparto progresivo | `scripts/set-canary-traffic.sh`, `scripts/canary-rollout.sh` |
| Artefacto inmutable | Tags ECR únicos con `IMMUTABLE`, imagen con label SemVer |
| Tráfico, errores 4xx/5xx, latencia | `http_requests_total` y `http_request_duration_seconds` |
| CPU/memoria y negocio | `process_cpu_saturation_ratio`, `process_memory_saturation_ratio`, `appointments_list_queries_total`, `appointments_created_total` |
| Comparación estadística | `scripts/canary-analysis.py`, Wilson 95%, muestra mínima y comparación p95 |
| Umbrales SLO previos | `config/canary-slo.json` |
| Inyección de degradación | `x-canary-failure: 500` o `latency`, autenticada con `x-canary-token` |
| Quality gate y rollback | `rollout-canary.yml` + `canary-rollout.sh` |
| Dashboard lado a lado | `observability/grafana-dashboard.json` |
| Destroy Canary independiente | `destroy-canary.yml` y estado S3 separado |
| Release SemVer | tag `v3.1.0` |

## 12. Límites que deben considerarse

- La rúbrica adjunta indica revisión el **30 de octubre de 2026**; confirma la fecha con el docente porque hoy es **31 de octubre de 2026**.

- La base original entregada contiene una sola versión V3.0.0. V3.1 se deriva de esa API; no se recibió un segundo ZIP.
- Esta solución conserva los endpoints actuales sin agregar un prefijo global `/api/v3`, para no romper las rutas ya existentes.
- Los porcentajes del ALB son ponderaciones de enrutamiento, no una garantía matemática del conteo exacto de solicitudes. Por eso `load-test.py` mide la distribución observada.
- La métrica de saturación se calcula en cada proceso con relación a los límites de CPU/memoria Fargate configurados; el quality gate revisa el máximo de la ventana y ECS Container Insights también permanece habilitado.
- Antes de ejecutar los workflows, verifica que el usuario IAM existente tenga permisos para ALB listener rules, `ModifyListener`, `DescribeListeners` y `DescribeTargetHealth`, ECS, ECR (`BatchDeleteImage` incluido), RDS, EC2/VPC, Secrets Manager, CloudWatch Logs, `iam:PassRole` y actualización de la inline policy existente (`iam:PutRolePolicy`), además de lectura/escritura del bucket S3 (incluido el lockfile `.tflock`). Si recibes `AccessDenied`, verifica también las SCP de AWS Organizations. No se cambian ni se exponen las credenciales existentes.
