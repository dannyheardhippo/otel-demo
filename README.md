# OTel Coffee Shop

A tiny 3-tier demo app - **React (web)** → **NestJS (api)** → **Postgres** -
built to support a talk on OpenTelemetry. Every tier emits traces, metrics and
logs. Everything flows through an **OpenTelemetry Collector** whose config
you can edit *live* during the talk, and a **Grafana LGTM** stack (Grafana +
Tempo + Loki + Prometheus) is the viewer.

## Prerequisites

- Docker Desktop / Colima with Docker Compose v2.20+ (for `docker compose watch`)
- Nothing else - all app code runs inside containers

## Running it

```bash
docker compose up --build --watch
```

This builds and starts:

| Service | URL | What it's for |
|---|---|---|
| `web` | http://localhost:5173 | The React storefront |
| `api` | http://localhost:3001/api/products | NestJS API (also proxied through `web` at `/api/*`) |
| `postgres` | localhost:5432 (demo/demo, db `shop`) | The database |
| `collector` | ports 4317/4318 (OTLP), own metrics on :8888 | OpenTelemetry Collector |
| `lgtm` (Grafana) | http://localhost:3000 (admin/admin) | Traces (Tempo), Logs (Loki), Metrics (Prometheus) |

`--watch` keeps three things hot-reloading while you work or present:
- Editing `collector/config.yaml` restarts just the collector (~2s).
- Editing `api/src/**` triggers Nest's own `--watch` recompile.
- Editing `web/src/**` triggers Vite HMR.

To add background traffic (useful for scenarios 04-06):
```bash
docker compose --profile load up --watch
```

## The talk walkthrough

The collector's live config is `collector/config.yaml`. `collector/scenarios/`
holds a complete, standalone config for each step of the talk. Switch between
them with:

```bash
./scripts/scenario.sh 02   # validates, diffs, then copies scenarios/02-*.yaml -> config.yaml
```
`docker compose watch` picks up the change and restarts the collector
automatically. You can also just hand-edit `collector/config.yaml` live and
save - same effect.

| # | Scenario | What it shows | Where to look |
|---|---|---|---|
| 00 | `debug` | Raw OTLP data, no viewer | `docker compose logs -f collector` |
| 01 | `baseline` | All 3 signals reaching Grafana, untouched | Explore → Tempo/Loki/Prometheus |
| 02 | `enrich` | `resourcedetection` + `resource` + `attributes` processors adding metadata | New attrs on any span (`team`, `cloud.region`, `demo.stage`) |
| 03 | `redact-transform` | OTTL `transform` masking `customer.email`; `redaction` processor blanking card numbers | Place an order, inspect the `checkout.calculate_total` span before/after |
| 04 | `filter` | Drop `/api/health` spans/metrics and sub-INFO logs | Hit `/api/health` a few times, then flip scenarios and watch it vanish |
| 05 | `tail-sampling` | Keep all errors + slow traces, sample 10% of the rest | Run with `--profile load`, compare trace volume in Tempo |
| 06 | `spanmetrics` | RED metrics generated from traces, zero code changes | Prometheus: `traces_span_metrics_calls_total` |
| 07 | `postgres` | Collector scrapes Postgres directly via the `postgresql` receiver - no app code involved | Prometheus: `postgresql_backends`, `postgresql_rows`, tagged `service_name="postgres"` |

### A walk through the app

1. **Products / cart / checkout** - browse products, add to cart, pick a
   customer, checkout. Watch the trace: `web` (browser span) → `api` (HTTP +
   the manual `checkout.calculate_total` span) → `pg` (INSERT/UPDATE spans).
   The order deliberately carries `customer.email` and `payment.card_number`
   on the span and in a log line - the material for scenario 03.
2. **My orders** - lists a customer's orders using a deliberate **N+1**
   query pattern server-side (one query per order). Great for showing an
   obviously-bad waterfall in Tempo.
3. **Chaos panel** - Slow (1.5s `pg_sleep`), guaranteed Error, Random (20%
   error rate), and Burst ×50. Feeds scenario 05 (tail sampling) nicely.
4. **Recent traces** - every UI action shows its trace ID. Open Grafana →
   Explore → choose the **Tempo** datasource → search by Trace ID.

### Metrics worth showing

- `shop.orders.created` (counter, by `status`)
- `shop.order.value` (histogram, cents)
- `shop.orders.in_flight` (up/down counter)
- `shop.product.stock` (observable gauge, sampled independent of requests)
- `web.cart.add` (counter, from the browser)
- `traces_span_metrics_*` once scenario 06 is active

## Troubleshooting

- **Collector won't start after an edit**: it's `restart: unless-stopped`, so
  fix the YAML and save again - Compose Watch will retry.
  `./scripts/validate.sh collector/config.yaml` checks a file without
  touching the running stack.
- **Logs**: `docker compose logs -f collector` (or `api`, `web`, `postgres`).
- **Reset the demo data**: `docker compose down -v` (drops the `pgdata`
  volume) then `docker compose up --build --watch` again.

## Notes on the code

- `api/src/instrumentation.ts` - the Node SDK setup (traces, metrics, logs),
  imported first in `main.ts` before any other module, so auto-instrumentation
  can patch `http`, `express`, `pg` and `pino` before they're required.
- `api/src/orders/orders.service.ts` - the manual instrumentation showcase: a
  custom span, custom counters/histograms/gauge, and the deliberately
  sensitive attributes used in scenario 03.
- `web/src/otel.ts` - the browser SDK setup (traces/metrics/logs), imported
  first in `main.tsx`.
- `loadgen/run.sh` - a plain curl loop for background traffic (`docker compose
  --profile load up --watch`). No app/SDK of its own - it's just load.

## Known quirks

- The `pg` auto-instrumentation occasionally emits a standalone
  `pg-pool.connect` root span instead of nesting it under the current
  request when a pooled connection has to be waited for - a known context-
  propagation limitation in the library, not a bug in this app. Most spans
  nest correctly.
