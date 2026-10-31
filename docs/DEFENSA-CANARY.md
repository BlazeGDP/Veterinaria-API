# Guion de demostración — Canary Deployment

## Preparación

- Comprobar en AWS que existen el cluster Stable y el cluster Canary.
- Abrir Grafana Cloud con el dashboard Veterinaria API - Canary vs Stable.
- Comprobar que los dos scrape jobs están activos.
- Mantener CloudShell con `URL`, `TOKEN` y `TF_STATE_BUCKET` cargados.

## Demostración A: Canary al 0%

```bash
./scripts/set-canary-traffic.sh 0
curl -i "$URL/health"
curl -i -H 'x-canary: true' -H "x-canary-token: $TOKEN" "$URL/health"
curl -i -H 'x-canary: true' -H "x-canary-token: $TOKEN" "$URL/appointments/summary"
```

En la primera llamada, los headers deben indicar `3.0.0 / stable`. En las llamadas con los dos headers de prueba, deben indicar `3.1.0 / canary` aunque Canary tenga 0% del tráfico público.

## Demostración B: Distribución y promoción

```bash
./scripts/set-canary-traffic.sh 5
python3 scripts/load-test.py --url "$URL" --path /appointments --duration-seconds 300 --concurrency 30
```

Explicar que los pesos son probabilísticos y verificar el conteo observado por track. Después ejecutar el workflow `Canary rollout with statistical quality gate` con `failure_mode=none`; el pipeline ejecuta 5%, 10%, 25%, 50% y finalmente 100% Canary.

Mostrar en Grafana:

- Requests/s y tasa de 5xx por track.
- p50, p95 y p99 de Stable frente a Canary.
- CPU/memoria.
- appointment list queries, appointment summary queries y appointments created.

Explicar la muestra mínima y el intervalo Wilson al 95%.

## Demostración C: Rollback

Ejecutar el workflow `Canary rollout with statistical quality gate` con `failure_mode=500`. Al llegar a una etapa con tráfico Canary, la cabecera de inyección autenticada con `x-canary-token` produce errores 500 solo en Canary. El quality gate debe detectar la regresión, fallar y restablecer el listener a 100% Stable / 0% Canary.

Confirmar con:

```bash
./scripts/set-canary-traffic.sh 0
curl -i "$URL/health"
```

Mostrar en Grafana el pico de 5xx en Canary y la recuperación de Stable.

## Cierre

Ejecutar `Destroy V3.1 Canary only` con `DESTROY-CANARY` para dejar únicamente Stable. Para apagar todos los recursos hasta la sustentación, ejecutar `Destroy all Veterinaria API AWS infrastructure` con `DESTROY-ALL`.

## Conceptos para las preguntas del docente

| Concepto | Explicación breve aplicada al proyecto |
|---|---|
| Canary vs. Rolling Update | Rolling Update reemplaza gradualmente tareas del mismo servicio; Canary mantiene Stable y una versión nueva en paralelo y limita el porcentaje de usuarios que llega a la nueva versión. |
| Canary vs. Blue/Green | Blue/Green mantiene dos entornos y normalmente cambia el tráfico en un corte; Canary incrementa el peso de la versión nueva por etapas y observa métricas entre etapas. |
| Canary vs. A/B testing | A/B compara variantes para medir resultados de producto/usuario; Canary busca detectar regresiones técnicas antes de promover una versión. |
| Canary vs. Feature Flag | Una feature flag activa/desactiva una funcionalidad dentro de una versión. No reparte tráfico por sí sola. Aquí `CANARY_FEATURE_ENABLED` oculta el endpoint nuevo en Stable, mientras ALB realiza el reparto. |
| Canary vs. Shadow | Shadow duplica solicitudes a la versión nueva, pero la respuesta que recibe el usuario sigue viniendo de Stable. Esta solución sí envía respuestas reales a Canary para medir comportamiento y latencia. |
| Radio de impacto | Con 5% de peso, una regresión de Canary afecta aproximadamente ese porcentaje de solicitudes públicas, no el 100%. El porcentaje real observado se mide con los headers de respuesta. |
| Traffic splitting | ALB usa pesos 95/5, 90/10, 75/25 y 50/50 antes de la promoción final 0/100. Son proporciones probabilísticas; el conteo instantáneo puede diferir del porcentaje configurado. |
| Sticky sessions | No se habilita stickiness en los Target Groups. Así cada solicitud nueva puede ser distribuida por el ALB según los pesos; con sticky sessions, un cliente podría permanecer en el mismo track y la muestra por usuario diferiría de la muestra por petición. |
| SLI y SLO | SLI es la señal medida (5xx, latencia, saturación); SLO es el umbral acordado para decidir. En este repo los límites están versionados en `config/canary-slo.json`. |
| Baseline | Stable se mide en la misma ventana y con la misma carga concurrente que Canary. Se comparan 5xx, p95/p99 y saturación, no una prueba separada en condiciones distintas. |
| Tamaño de muestra | El gate exige 200 solicitudes por track en 5 minutos. El intervalo Wilson al 95% expresa la incertidumbre de la proporción observada de errores 5xx. Si la muestra no alcanza el mínimo, el pipeline pausa y no promueve. |
| Expand/Contract | Primero se expande el esquema de forma compatible (por ejemplo, agregar una columna nullable y mantener consumidores viejos); después se despliega el código nuevo; solo al final se contrae/elimina lo antiguo cuando ninguna versión lo necesita. Aquí no se requiere migración porque el endpoint nuevo solo consulta columnas existentes. |
| Antipatrones | Migraciones destructivas antes de terminar el rollout, usar `latest` como artefacto, cambiar SLO después de ver resultados, promover con muestra pequeña, comparar cargas distintas, activar fallos en Stable o asumir que ALB desviará tráfico automáticamente si Canary no está saludable. |

## Qué mostrar como evidencia

1. Respuesta Stable con `X-App-Version: 3.0.0` y `X-App-Track: stable`.
2. Respuesta Canary al 0% público usando `x-canary: true` y `x-canary-token`.
3. Salida de `scripts/load-test.py` mostrando conteo observado y headers por versión.
4. Dashboard con requests, 4xx/5xx, p50/p95/p99, CPU/memoria y métrica de negocio.
5. Reporte JSON de `scripts/canary-analysis.py` con muestras, Wilson 95% y decisión PASS/FAIL.
6. Workflow de promoción completando 100% Canary y workflow de rollback restaurando Stable-only al inyectar la falla.
