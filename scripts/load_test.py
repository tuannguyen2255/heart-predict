"""Bounded HTTP load test; only read endpoints and inference, no writes or paid AI."""
import argparse
import asyncio
from collections import Counter
import json
import math
import os
from pathlib import Path
import time

import httpx


def percentile(values, percent):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * percent / 100) - 1)] if ordered else None


async def run(args):
    token = os.getenv("LOAD_TEST_TOKEN")
    if args.scenario != "health" and not token:
        raise ValueError("Set LOAD_TEST_TOKEN to a test user's JWT for authenticated scenarios")
    payload = json.loads(Path(args.payload).read_text(encoding="utf-8")) if args.payload else None
    if args.scenario == "predict" and payload is None:
        raise ValueError("The predict scenario requires --payload <json-file>")
    path = {"health": "/health", "history": "/prediction/history?limit=21&offset=0", "predict": "/predict"}[args.scenario]
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    statuses, errors = Counter(), Counter()
    latencies, successful_latencies = [], []
    next_request = 0
    async with httpx.AsyncClient(
        base_url=args.base_url.rstrip("/"), headers=headers, timeout=args.timeout,
        limits=httpx.Limits(max_connections=args.concurrency, max_keepalive_connections=args.concurrency),
    ) as client:
        async def request():
            return await client.post(path, json=payload) if args.scenario == "predict" else await client.get(path)

        # Warmup is excluded from measurements; fail early on bad credentials/config.
        for _ in range(args.warmup):
            response = await request()
            response.raise_for_status()

        async def worker():
            nonlocal next_request
            while next_request < args.requests:
                next_request += 1  # No await between check and increment.
                started = time.perf_counter()
                success = False
                try:
                    response = await request()
                    statuses[str(response.status_code)] += 1
                    success = response.is_success
                except httpx.HTTPError as exc:
                    errors[type(exc).__name__] += 1
                elapsed = (time.perf_counter() - started) * 1000
                latencies.append(elapsed)
                if success:
                    successful_latencies.append(elapsed)

        started = time.perf_counter()
        await asyncio.gather(*(worker() for _ in range(args.concurrency)))
        elapsed = time.perf_counter() - started
    failure_rate = 1 - len(successful_latencies) / args.requests
    report = {
        "scenario": args.scenario, "requests": args.requests, "concurrency": args.concurrency,
        "duration_seconds": elapsed, "requests_per_second": args.requests / elapsed,
        "successful_requests_per_second": len(successful_latencies) / elapsed,
        "status_codes": dict(statuses), "transport_errors": dict(errors), "failure_rate": failure_rate,
        "latency_ms": {f"p{p}": percentile(latencies, p) for p in (50, 95, 99)},
        "successful_latency_ms": {f"p{p}": percentile(successful_latencies, p) for p in (50, 95, 99)},
    }
    print(json.dumps(report, indent=2))
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return failure_rate <= args.max_error_rate and (
        args.max_p95_ms is None or report["latency_ms"]["p95"] <= args.max_p95_ms
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--scenario", choices=["health", "history", "predict"], default="health")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--payload")
    parser.add_argument("--output")
    parser.add_argument("--max-error-rate", type=float, default=0.01)
    parser.add_argument("--max-p95-ms", type=float)
    args = parser.parse_args()
    if not (1 <= args.concurrency <= 1000 and args.requests > 0 and args.warmup >= 0
            and args.timeout > 0 and 0 <= args.max_error_rate <= 1
            and (args.max_p95_ms is None or args.max_p95_ms > 0)):
        parser.error("Invalid request count, concurrency, warmup, timeout or threshold")
    try:
        passed = asyncio.run(run(args))
    except (ValueError, OSError, httpx.HTTPError) as exc:
        parser.exit(2, f"Load test could not run: {type(exc).__name__}: {exc}\n")
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
