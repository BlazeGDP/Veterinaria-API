#!/usr/bin/env python3
"""Genera carga concurrente y cuenta qué track atendió cada solicitud."""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Optional


def one_request(url: str, failure_mode: Optional[str], canary_token: Optional[str], timeout: float, close_connection: bool = False) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if close_connection:
        headers["Connection"] = "close"
    if failure_mode:
        headers["x-canary-failure"] = failure_mode
        if canary_token:
            headers["x-canary-token"] = canary_token
    request = urllib.request.Request(url, headers=headers, method="GET")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read()
            status = response.status
            track = response.headers.get("X-App-Track", "unknown")
            version = response.headers.get("X-App-Version", "unknown")
    except urllib.error.HTTPError as exc:
        exc.read()
        status = exc.code
        track = exc.headers.get("X-App-Track", "unknown")
        version = exc.headers.get("X-App-Version", "unknown")
    except Exception as exc:  # network errors are counted separately
        return {
            "status": "network_error",
            "track": "unknown",
            "version": "unknown",
            "elapsed": time.perf_counter() - started,
            "error": f"{type(exc).__name__}: {exc}",
        }

    return {
        "status": str(status),
        "track": track.lower(),
        "version": version,
        "elapsed": time.perf_counter() - started,
    }


def duration_worker(
    url: str,
    failure_mode: Optional[str],
    canary_token: Optional[str],
    timeout: float,
    deadline: float,
    close_connection: bool = False,
) -> dict[str, collections.Counter[str]]:
    stats = {
        "tracks": collections.Counter(),
        "versions": collections.Counter(),
        "statuses": collections.Counter(),
        "network_error_examples": collections.Counter(),
    }
    while True:
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            break
        # Do not let the final in-flight request extend the bake time by the full HTTP timeout.
        request_timeout = min(timeout, max(0.5, remaining))
        item = one_request(url, failure_mode, canary_token, request_timeout, close_connection)
        stats["tracks"][item["track"]] += 1
        stats["versions"][item["version"]] += 1
        stats["statuses"][str(item["status"])] += 1
        if item.get("error"):
            stats["network_error_examples"][item["error"]] += 1
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Base URL of the ALB, e.g. http://...elb.amazonaws.com")
    parser.add_argument("--requests", type=int, default=6000, help="Número fijo de peticiones (modo por defecto)")
    parser.add_argument("--duration-seconds", type=int, default=None, help="Genera carga continua durante este tiempo")
    parser.add_argument("--concurrency", type=int, default=30)
    parser.add_argument("--path", default="/appointments")
    parser.add_argument("--failure", choices=["500", "latency"], default=None)
    parser.add_argument("--canary-token", default=os.environ.get("CANARY_SMOKE_TOKEN"), help="Token requerido para autorizar la inyección Canary")
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--max-network-error-rate-percent", type=float, default=1.0, help="Máximo de errores de transporte tolerados antes de abortar (porcentaje)")
    parser.add_argument("--expect-canary-only", action="store_true")
    parser.add_argument("--close-connection", action="store_true", help="Abre una conexión HTTP nueva por petición; útil para validar cambios de enrutamiento ALB")
    args = parser.parse_args()

    if args.requests < 1 or args.concurrency < 1:
        parser.error("requests y concurrency deben ser mayores que cero")
    if args.duration_seconds is not None and args.duration_seconds < 1:
        parser.error("duration-seconds debe ser mayor que cero")
    if not 0 <= args.max_network_error_rate_percent <= 100:
        parser.error("max-network-error-rate-percent debe estar entre 0 y 100")
    if args.failure and not args.canary_token:
        parser.error("--failure requiere --canary-token o CANARY_SMOKE_TOKEN")

    target = args.url.rstrip("/") + (args.path if args.path.startswith("/") else f"/{args.path}")
    started = time.perf_counter()
    tracks: collections.Counter[str] = collections.Counter()
    statuses: collections.Counter[str] = collections.Counter()
    versions: collections.Counter[str] = collections.Counter()
    network_error_examples: collections.Counter[str] = collections.Counter()
    if args.duration_seconds is not None:
        deadline = started + args.duration_seconds
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            futures = [
                executor.submit(
                    duration_worker,
                    target,
                    args.failure,
                    args.canary_token,
                    args.timeout,
                    deadline,
                    args.close_connection,
                )
                for _ in range(args.concurrency)
            ]
            for future in concurrent.futures.as_completed(futures):
                worker_stats = future.result()
                tracks.update(worker_stats["tracks"])
                versions.update(worker_stats["versions"])
                statuses.update(worker_stats["statuses"])
                network_error_examples.update(worker_stats["network_error_examples"])
        requested = sum(statuses.values())
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            results = list(executor.map(
                lambda _: one_request(target, args.failure, args.canary_token, args.timeout, args.close_connection),
                range(args.requests),
            ))
        tracks.update(item["track"] for item in results)
        statuses.update(str(item["status"]) for item in results)
        versions.update(item["version"] for item in results)
        network_error_examples.update(
            item["error"] for item in results if item.get("error")
        )
        requested = len(results)
    elapsed = time.perf_counter() - started
    network_errors = statuses.get("network_error", 0)
    tracked_requests = tracks.get("stable", 0) + tracks.get("canary", 0)
    observed_distribution = {
        "stable": round(100 * tracks.get("stable", 0) / tracked_requests, 2) if tracked_requests else 0.0,
        "canary": round(100 * tracks.get("canary", 0) / tracked_requests, 2) if tracked_requests else 0.0,
    }

    print(json.dumps({
        "url": target,
        "requests": requested,
        "concurrency": args.concurrency,
        "duration_target_seconds": args.duration_seconds,
        "elapsed_seconds": round(elapsed, 2),
        "requests_per_second": round(requested / elapsed, 2) if elapsed else 0,
        "tracks": dict(tracks),
        "observed_distribution_percent": observed_distribution,
        "versions": dict(versions),
        "statuses": dict(statuses),
        "network_errors": network_errors,
        "network_error_rate_percent": round(100 * network_errors / requested, 3) if requested else 0.0,
        "network_error_examples": [
            {"error": message, "count": count}
            for message, count in network_error_examples.most_common(5)
        ],
        "failure_injection": args.failure or "none",
    }, indent=2, ensure_ascii=False))

    network_error_rate = (100 * network_errors / requested) if requested else 0.0
    if network_error_rate > args.max_network_error_rate_percent:
        print(
            f"ABORT: errores de transporte {network_error_rate:.3f}% superan "
            f"el límite configurado de {args.max_network_error_rate_percent:.3f}%."
        )
        return 1
    if network_errors:
        print(
            f"AVISO: {network_error_rate:.3f}% de errores de transporte; "
            f"dentro del límite de {args.max_network_error_rate_percent:.3f}%. "
            "Se continúa al quality gate de Prometheus."
        )
    if args.expect_canary_only:
        recognized = tracks.get("stable", 0) + tracks.get("canary", 0)
        unknown = tracks.get("unknown", 0)
        if recognized == 0 or tracks.get("canary", 0) != recognized or unknown > 0:
            print(
                "ERROR: se esperaban todas las respuestas clasificadas desde Canary; "
                f"canary={tracks.get('canary', 0)}, stable={tracks.get('stable', 0)}, unknown={unknown}."
            )
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
