# Rollout Canary compacto y diagnóstico de enrutamiento

Reemplazar estos archivos en el repositorio, conservando `.git`:

- `.github/workflows/rollout-canary.yml`
- `scripts/canary-rollout.sh`
- `scripts/set-canary-traffic.sh`
- `scripts/load-test.py`
- `config/canary-slo.json`

## Plan reducido

El rollout utiliza las etapas públicas 10% -> 50% -> 100%. Esto cubre los rangos exigidos por la rúbrica: 5-10%, 25-50% y 100% promovido.

- Dos etapas de horneado de 120 segundos (configurable a 150 o 180 en Actions).
- Concurrencia por defecto: 10.
- Scrape de Grafana: 60 segundos; espera posterior: 15 segundos.
- Ventana de análisis: 2 minutos.
- Muestra mínima por versión: 150.
- Wilson 95%, 5xx, latencia y saturación permanecen activos.
- Espera máxima adicional por métricas: 45 segundos por etapa.
- Verificación final: 40 peticiones secuenciales con `Connection: close`.
- Se deshabilita explícitamente la stickiness del forward action y se leen los pesos del listener después de modificarlo.

Tiempo esperado: 5 a 8 minutos, dependiendo de la respuesta de Grafana Cloud y del tiempo de inicialización del workflow. No es posible garantizar promoción si faltan muestras o una métrica viola los SLO.

## Reporte de Grafana

El JSON de cada Quality Gate lo imprime `scripts/canary-analysis.py` en los logs de GitHub Actions, dentro del paso `Run progressive rollout and statistical gates`. En Grafana, el dashboard muestra las series visuales. Para revisar manualmente, abre Explore -> Prometheus y consulta por ejemplo:

```promql
sum by (track) (increase(http_requests_total[2m]))
```

```promql
sum by (track) (increase(http_requests_total{status_code=~"5.."}[2m]))
```

```promql
histogram_quantile(0.95, sum by (le, track) (rate(http_request_duration_seconds_bucket[2m])))
```

## Si falla la verificación de 100%

El rollout imprime todas las reglas del listener. Una regla de prioridad superior que coincida con `/appointments` puede enrutar ese path con su propia acción y no usar la acción predeterminada. Inspecciona esa salida antes de volver a ejecutar.

También puedes consultar desde CloudShell:

```bash
ALB_DNS='api-restful-veterinaria-alb-743336797.us-east-2.elb.amazonaws.com'
ALB_ARN=$(aws elbv2 describe-load-balancers --region us-east-2 \
  --query "LoadBalancers[?DNSName=='${ALB_DNS}'].LoadBalancerArn | [0]" --output text)
LISTENER_ARN=$(aws elbv2 describe-listeners --region us-east-2 \
  --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text)
aws elbv2 describe-rules --region us-east-2 --listener-arn "$LISTENER_ARN" \
  --query 'Rules[].{Priority:Priority,IsDefault:IsDefault,Conditions:Conditions,Actions:Actions}' \
  --output json
```

## Instalar

```powershell
git add .github/workflows/rollout-canary.yml scripts/canary-rollout.sh scripts/set-canary-traffic.sh scripts/load-test.py config/canary-slo.json
git commit -m ":rocket: optimize canary rollout duration and verify 100 percent routing"
git push origin main
```

El workflow sigue siendo manual (`workflow_dispatch`). No requiere reconstruir ni desplegar las APIs.
