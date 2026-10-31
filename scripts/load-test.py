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


def one_request(url: str, failure_mode: Optional[str], canary_token: Optional[str], timeout: float) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
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
        return {"status": "network_error", "track": "unknown", "version": "unknown", "elapsed": time.perf_counter() - started, "error": str(exc)}

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
) -> dict[str, collections.Counter[str]]:
    stats = {
        "tracks": collections.Counter(),
        "versions": collections.Counter(),
        "statuses": collections.Counter(),
        "network_error_examples": collections.Counter(),
    }
    while time.perf_counter() < deadline:
        item = one_request(url, failure_mode, canary_token, timeout)
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
    parser.add_argument("--expect-canary-only", action="store_true")
    args = parser.parse_args()

    if args.requests < 1 or args.concurrency < 1:
        parser.error("requests y concurrency deben ser mayores que cero")
    if args.duration_seconds is not None and args.duration_seconds < 1:
        parser.error("duration-seconds debe ser mayor que cero")
    if args.failure and not args.canary_token:
        parser.error("--failure requiere --canary-token o CANARY_SMOKE_TOKEN")

    target = args.url.rstrip("/") + (args.path if args.path.startswith("/") else f"/{args.path}")
    started = time.perf_counter()
    tracks: collections.Counter[str] = collections.Counter()
    statuses: collections.Counter[str] = collections.Counter()
    versions: collections.Counter[str] = collections.Counter()
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
                )
                for _ in range(args.concurrency)
            ]
            for future in concurrent.futures.as_completed(futures):
                worker_stats = future.result()
                tracks.update(worker_stats["tracks"])
                versions.update(worker_stats["versions"])
                statuses.update(worker_stats["statuses"])
        requested = sum(statuses.values())
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            results = list(executor.map(
                lambda _: one_request(target, args.failure, args.canary_token, args.timeout),
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
        "network_error_examples": [
            {"error": message, "count": count}
            for message, count in network_error_examples.most_common(5)
        ],
        "failure_injection": args.failure or "none",
    }, indent=2, ensure_ascii=False))

    if network_errors:
        return 1
    if args.expect_canary_only and (tracks.get("canary", 0) != requested or tracks.get("stable", 0) > 0):
        print("ERROR: se esperaban todas las respuestas desde Canary.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
