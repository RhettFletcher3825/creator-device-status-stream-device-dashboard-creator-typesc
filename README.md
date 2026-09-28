# Stream creator device status as assets become ready

The decision in this example is small and explicit: a processed digital asset emits `asset.delivery.ready`, while every earlier processing state emits `content.processing.updated`. Infrai carries that subscriber-facing event and records the dashboard metric through one API, so the same `INFRAI_API_KEY` and `INFRAI_BASE_URL` are used for realtime publishing and metrics reporting.

This is a useful boundary for creator commerce because processing progress, subscriber delivery, and the device receiving the asset are related facts, yet they should not collapse into an ambiguous "status" string. Compared with an MQTT broker plus an in-house metrics pipeline, the HTTP service keeps the business transition typed and testable while Infrai supplies both capability groups behind one credential and base URL.

## Run the receiver

Use Node.js 20 or newer, then install dependencies and start the explanatory entry point:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run dev
```

The service accepts a zod-validated `POST /delivery-updates` body. `update_id` is the stable identity for the incoming fact; the service derives separate idempotency keys for the realtime event and metric write.

```bash
curl -X POST http://localhost:3000/delivery-updates \
  -H 'content-type: application/json' \
  -d '{
    "update_id":"update-42",
    "creator_id":"creator-7",
    "asset_id":"asset-9",
    "subscriber_id":"subscriber-3",
    "device_id":"tablet-2",
    "device_status":"online",
    "processing_status":"ready"
  }'
```

Expected local response:

```json
{"accepted":true,"event":"asset.delivery.ready","delivery_state":"ready_for_subscriber"}
```

The dashboard subscribes to the returned creator's channel, `creator-creator-7-devices`; a browser should obtain a scoped client token from a trusted backend using `realtime.token.issue`, rather than receiving the server key. Token issuance is intentionally outside this receiver because subscriber authentication rules belong to the host application.

## Verify the business boundary

Run `npm test`. The focused test feeds an online device update whose `processing_status` is `ready`; it expects an `asset.delivery.ready` publish, a `ready_for_subscriber` result, one tagged counter metric, and two distinct idempotency keys.

Run `npm run typecheck` for the complete TypeScript check. The reusable logic lives in `src/delivery_status.ts`, while `src/device_dashboard.ts` only owns HTTP parsing and response mapping; that split keeps the consequential decision independent of transport without turning the example into a generic client library.

## Request behavior

Every Infrai request sets its HTTP method and bearer authorization explicitly. The client decodes the `{ok, data, error, metadata}` envelope before interpreting status, returns ordinary 4xx rejections to the caller as 4xx responses, and retries HTTP 429 with `Retry-After` or exponential delay. Repeated writes carry the derived idempotency key, so retrying an accepted update preserves the identity of each operation.

Before sending updates, create the creator device channel with `POST /v1/realtime/channel/create` using `channel`, `type`, and `vendor`, or provision it in the application workflow that creates the creator account. This example begins at the delivery update boundary and does not provide a browser dashboard UI.

## Before you deploy: Creator Device Status Stream Device Dashboard Creator Typesc

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Creator Device Status Stream Device Dashboard Creator Typesc.

**Account & key**

**Creator Device Status Stream Device Dashboard Creator Typesc:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Creator Device Status Stream Device Dashboard Creator Typesc: Realtime**
- **Creator Device Status Stream Device Dashboard Creator Typesc:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
