#!/usr/bin/env python3
"""Verifica que GitHub Actions puede consultar Grafana Cloud Prometheus."""
from __future__ import annotations
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def main() -> int:
    base = os.environ.get("GRAFANA_PROMETHEUS_URL", "").strip().rstrip("/")
    user = os.environ.get("GRAFANA_PROMETHEUS_USER", "").strip()
    token = os.environ.get("GRAFANA_PROMETHEUS_READ_TOKEN", "").strip()
    if not all((base, user, token)):
        print("ERROR: faltan GRAFANA_PROMETHEUS_URL, GRAFANA_PROMETHEUS_USER o GRAFANA_PROMETHEUS_READ_TOKEN.", file=sys.stderr)
        return 2

    if base.endswith("/api/prom/api/v1/query") or base.endswith("/api/v1/query"):
        query_endpoint = base
    elif base.endswith("/api/prom"):
        query_endpoint = base + "/api/v1/query"
    else:
        query_endpoint = base + "/api/prom/api/v1/query"

    url = query_endpoint + "?" + urllib.parse.urlencode({"query": "up"})
    basic = base64.b64encode(f"{user}:{token}".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(url, headers={
        "Authorization": f"Basic {basic}",
        "Accept": "application/json",
        "User-Agent": "veterinaria-canary-quality-gate/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            reason = "HTTP 401: usuario o token incorrecto."
        elif exc.code == 403:
            reason = "HTTP 403: el token no tiene permiso metrics:read."
        elif exc.code == 404:
            reason = "HTTP 404: revisa que GRAFANA_PROMETHEUS_URL sea el Query endpoint /api/prom."
        else:
            reason = f"HTTP {exc.code} al consultar Prometheus."
        print(f"ERROR conectando con Grafana Cloud: {reason}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"ERROR conectando con Grafana Cloud: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    if payload.get("status") != "success":
        print("ERROR: Grafana respondió, pero la consulta Prometheus no fue exitosa.", file=sys.stderr)
        return 2

    print("Grafana Cloud Prometheus: autenticación y consulta correctas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
