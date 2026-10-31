#!/usr/bin/env python3
"""Quality gate estadístico Canary vs Stable consultando Prometheus en Grafana Cloud."""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional


def query_prometheus(base_url: str, username: str, token: str, expression: str) -> Optional[float]:
    endpoint = base_url.rstrip("/")
    if not endpoint.endswith("/api/prom"):
        endpoint += "/api/prom"
    url = endpoint + "/api/v1/query?" + urllib.parse.urlencode({"query": expression})
    credentials = base64.b64encode(f"{username}:{token}".encode()).decode()
    request = urllib.request.Request(url, headers={"Authorization": f"Basic {credentials}", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode())

    if payload.get("status") != "success":
        raise RuntimeError(f"Prometheus rechazó la consulta: {payload}")
    results = payload.get("data", {}).get("result", [])
    if not results:
        return None
    value = results[0].get("value", [None, None])[1]
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def wilson_interval(errors: float, total: float, z: float = 1.96) -> tuple[float, float]:
    if total <= 0:
        return (0.0, 1.0)
    n = float(total)
    p = min(max(float(errors) / n, 0.0), 1.0)
    denominator = 1.0 + (z * z / n)
    center = (p + (z * z / (2.0 * n))) / denominator
    margin = (z * math.sqrt((p * (1.0 - p) / n) + (z * z / (4.0 * n * n)))) / denominator
    return max(0.0, center - margin), min(1.0, center + margin)


def fmt(value: Optional[float], multiplier: float = 1.0) -> Optional[float]:
    return None if value is None else round(value * multiplier, 4)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slo", default="config/canary-slo.json")
    parser.add_argument("--window", default=None)
    parser.add_argument("--allow-no-baseline", action="store_true")
    parser.add_argument("--load-report", default=None, help="JSON del generador de carga con conteos exactos por track")
    args = parser.parse_args()

    base_url = os.environ.get("GRAFANA_PROMETHEUS_URL", "").strip()
    username = os.environ.get("GRAFANA_PROMETHEUS_USER", "").strip()
    token = os.environ.get("GRAFANA_PROMETHEUS_READ_TOKEN", "").strip()
    if not all([base_url, username, token]):
        print("Faltan GRAFANA_PROMETHEUS_URL, GRAFANA_PROMETHEUS_USER o GRAFANA_PROMETHEUS_READ_TOKEN.", file=sys.stderr)
        return 2

    slo = json.loads(Path(args.slo).read_text(encoding="utf-8"))
    window = args.window or slo["window"]

    def q(metric: str, track: str, selector: str = "") -> Optional[float]:
        extra = f",{selector}" if selector else ""
        return query_prometheus(base_url, username, token, f'sum(increase({metric}{{track="{track}"{extra}}}[{window}]))')

    def quantile(track: str, percentile: float) -> Optional[float]:
        expression = (
            f'histogram_quantile({percentile}, '
            f'sum by (le) (rate(http_request_duration_seconds_bucket{{track="{track}"}}[{window}])))'
        )
        return query_prometheus(base_url, username, token, expression)

    def gauge(metric: str, track: str) -> Optional[float]:
        return query_prometheus(base_url, username, token, f'max_over_time({metric}{{track="{track}"}}[{window}])')

    # Prometheus totals are retained for diagnosis, but sample size and HTTP status
    # counts come from the load generator when a stage report is supplied. This avoids
    # treating scrape cadence/ingestion gaps as if requests had never occurred.
    stable_prometheus_total = q("http_requests_total", "stable") or 0.0
    canary_prometheus_total = q("http_requests_total", "canary") or 0.0
    stable_total = stable_prometheus_total
    stable_errors = q("http_requests_total", "stable", 'status_code=~"5.."') or 0.0
    stable_4xx = q("http_requests_total", "stable", 'status_code=~"4.."') or 0.0
    canary_total = canary_prometheus_total
    canary_errors = q("http_requests_total", "canary", 'status_code=~"5.."') or 0.0
    canary_4xx = q("http_requests_total", "canary", 'status_code=~"4.."') or 0.0
    sample_source = "grafana_prometheus_increase"
    load_report: dict[str, Any] | None = None
    if args.load_report:
        load_report = json.loads(Path(args.load_report).read_text(encoding="utf-8"))
        by_track = load_report.get("track_statuses")
        if not isinstance(by_track, dict) or not isinstance(by_track.get("stable"), dict) or not isinstance(by_track.get("canary"), dict):
            raise RuntimeError("El reporte de carga no contiene track_statuses para stable y canary; no se puede calcular una muestra fiable.")

        def count_statuses(track_name: str, prefix: str | None = None) -> int:
            total = 0
            for status, count in by_track[track_name].items():
                if prefix is None or str(status).startswith(prefix):
                    try:
                        total += int(count)
                    except (TypeError, ValueError):
                        raise RuntimeError(f"Conteo inválido en track_statuses.{track_name}.{status}")
            return total

        stable_total = count_statuses("stable")
        stable_errors = count_statuses("stable", "5")
        stable_4xx = count_statuses("stable", "4")
        canary_total = count_statuses("canary")
        canary_errors = count_statuses("canary", "5")
        canary_4xx = count_statuses("canary", "4")
        sample_source = "direct_load_test_response_headers"

    stable_p50 = quantile("stable", 0.50)
    stable_p95 = quantile("stable", 0.95)
    stable_p99 = quantile("stable", 0.99)
    canary_p50 = quantile("canary", 0.50)
    canary_p95 = quantile("canary", 0.95)
    canary_p99 = quantile("canary", 0.99)
    canary_cpu = gauge("process_cpu_saturation_ratio", "canary")
    canary_memory = gauge("process_memory_saturation_ratio", "canary")
    stable_cpu = gauge("process_cpu_saturation_ratio", "stable")
    stable_memory = gauge("process_memory_saturation_ratio", "stable")
    canary_appointments = q("appointments_created_total", "canary") or 0.0
    stable_appointments = q("appointments_created_total", "stable") or 0.0
    canary_summary_queries = q("appointment_summary_queries_total", "canary") or 0.0
    stable_appointment_list_queries = q("appointments_list_queries_total", "stable") or 0.0
    canary_appointment_list_queries = q("appointments_list_queries_total", "canary") or 0.0

    stable_ci = wilson_interval(stable_errors, stable_total)
    canary_ci = wilson_interval(canary_errors, canary_total)
    stable_error_rate = stable_errors / stable_total if stable_total else 0.0
    canary_error_rate = canary_errors / canary_total if canary_total else 0.0

    report: dict[str, Any] = {
        "window": window,
        "sample_source": sample_source,
        "metrics_source": "grafana_cloud_prometheus",
        "http_sample_note": "El tamaño de muestra y los códigos HTTP se cuentan directamente desde las respuestas del generador; Prometheus aporta latencias, saturación y métricas de negocio.",
        "stable": {
            "requests": round(stable_total, 2),
            "prometheus_requests_observed": round(stable_prometheus_total, 2),
            "5xx": round(stable_errors, 2),
            "4xx": round(stable_4xx, 2),
            "4xx_rate_percent": fmt(stable_4xx / stable_total if stable_total else 0.0, 100),
            "5xx_rate_percent": fmt(stable_error_rate, 100),
            "wilson_95_ci_percent": [fmt(stable_ci[0], 100), fmt(stable_ci[1], 100)],
            "p50_ms": fmt(stable_p50, 1000),
            "p95_ms": fmt(stable_p95, 1000),
            "p99_ms": fmt(stable_p99, 1000),
            "cpu_saturation": stable_cpu,
            "memory_saturation": stable_memory,
            "appointments_created": round(stable_appointments, 2),
            "appointment_list_queries": round(stable_appointment_list_queries, 2),
        },
        "canary": {
            "requests": round(canary_total, 2),
            "prometheus_requests_observed": round(canary_prometheus_total, 2),
            "5xx": round(canary_errors, 2),
            "4xx": round(canary_4xx, 2),
            "4xx_rate_percent": fmt(canary_4xx / canary_total if canary_total else 0.0, 100),
            "5xx_rate_percent": fmt(canary_error_rate, 100),
            "wilson_95_ci_percent": [fmt(canary_ci[0], 100), fmt(canary_ci[1], 100)],
            "p50_ms": fmt(canary_p50, 1000),
            "p95_ms": fmt(canary_p95, 1000),
            "p99_ms": fmt(canary_p99, 1000),
            "cpu_saturation": canary_cpu,
            "memory_saturation": canary_memory,
            "appointments_created": round(canary_appointments, 2),
            "appointment_summary_queries": round(canary_summary_queries, 2),
            "appointment_list_queries": round(canary_appointment_list_queries, 2),
        },
        "decision": "PENDING",
        "reasons": [],
    }

    reasons: list[str] = report["reasons"]
    if load_report is not None:
        report["load_test_network_errors"] = int(load_report.get("network_errors", 0))
        report["load_test_network_error_rate_percent"] = float(load_report.get("network_error_rate_percent", 0.0))
        report["load_test_unknown_track_responses"] = int(load_report.get("tracks", {}).get("unknown", 0))
    if canary_total > 0 and canary_error_rate > max(slo["maxCanary5xxRate"] * 3, 0.05):
        reasons.append("ABORT: la tasa 5xx de Canary supera el umbral crítico del 5%.")
    if canary_p95 is not None and canary_p95 > slo["maxP95Seconds"]:
        reasons.append("ABORT: el p95 de Canary supera el límite absoluto.")
    if canary_p99 is not None and canary_p99 > slo["maxP99Seconds"]:
        reasons.append("ABORT: el p99 de Canary supera el límite absoluto.")

    required = slo["minSamplesPerTrack"]
    baseline_needed = not args.allow_no_baseline
    missing = []
    if canary_total < required:
        missing.append(f"Canary necesita {required} solicitudes; tiene {canary_total:.0f}.")
    if baseline_needed and stable_total < required:
        missing.append(f"Stable necesita {required} solicitudes; tiene {stable_total:.0f}.")
    if any(value is None for value in [canary_p50, canary_p95, canary_p99, canary_cpu, canary_memory]):
        missing.append("Aún faltan series de latencia o saturación de Canary.")
    if baseline_needed and stable_p95 is None:
        missing.append("Aún falta la latencia p95 de Stable para comparar la línea base.")

    if reasons:
        report["decision"] = "FAIL"
    elif missing:
        report["decision"] = "INSUFFICIENT_SAMPLE"
        reasons.extend(missing)
    else:
        if canary_error_rate > slo["maxCanary5xxRate"]:
            reasons.append("La tasa observada de errores 5xx de Canary supera el SLO.")
        if canary_ci[1] > slo["maxCanaryWilsonUpper95"]:
            reasons.append("El límite superior Wilson al 95% supera el SLO de errores.")
        if baseline_needed and canary_ci[1] > stable_ci[1] + slo["maxCanaryErrorRateDifference"]:
            reasons.append("La cota superior del error de Canary se deteriora frente a Stable.")
        if baseline_needed and stable_p95 is not None and canary_p95 is not None:
            if canary_p95 > max(slo["minP95ComparisonSeconds"], stable_p95 * slo["maxP95RelativeToStable"]):
                reasons.append("El p95 de Canary es más de 1.5 veces el p95 de Stable.")
        if canary_p99 is not None and canary_p99 > slo["maxP99Seconds"]:
            reasons.append("El p99 de Canary supera el SLO.")
        if canary_cpu is not None and canary_cpu > slo["maxCpuSaturation"]:
            reasons.append("La saturación de CPU de Canary supera el 85%.")
        if canary_memory is not None and canary_memory > slo["maxMemorySaturation"]:
            reasons.append("La saturación de memoria de Canary supera el 85%.")
        report["decision"] = "FAIL" if reasons else "PASS"

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if report["decision"] == "PASS":
        return 0
    if report["decision"] == "INSUFFICIENT_SAMPLE":
        return 2
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR consultando Grafana/Prometheus: {exc}", file=sys.stderr)
        raise SystemExit(2)
