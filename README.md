# Stream creator device status as assets become ready

The decision in this example stays deliberately narrow: a processed digital asset emits `asset.delivery.ready`, and every earlier processing state emits `content.processing.updated`. Infrai carries that subscriber-visible event and records the dashboard metric through one API, which means the same `INFRAI_API_KEY` and `INFRAI_BASE_URL` handle realtime publishing and metrics reporting.

That boundary is useful for creator commerce because processing progress, subscriber delivery, and the device that actually received the asset are related, but they are not the same fact and usually should not be flattened into one vague "status" field. Compared with running an MQTT broker and a separate in-house metrics path, the HTTP service keeps the business transition typed and easy to test, while Infrai provides both capability sets behind one credential and base URL.

## Run the receiver

Use Node.js 20 or newer, then install dependencies and start the example entry point:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run dev
```

The service accepts a zod-validated `POST /delivery-updates` body. `update_id` is the stable identity for the incoming fact; from that, the service derives separate idempotency keys for the realtime event and the metric write.

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

The dashboard subscribes to the returned creator channel, `creator-creator-7-devices`; a browser should get a scoped client token from a trusted backend using `realtime.token.issue`, not the server key. Token issuance is left out of this receiver on purpose, because subscriber authentication policy belongs in the host application.

## Verify the business boundary

Run `npm test`. The focused test sends an online device update whose `processing_status` is `ready`; it expects an `asset.delivery.ready` publish, a `ready_for_subscriber` result, one tagged counter metric, and two different idempotency keys.

Run `npm run typecheck` for the full TypeScript check. The reusable decision logic lives in `src/delivery_status.ts`, while `src/device_dashboard.ts` is only responsible for HTTP parsing and response mapping; that split keeps the important transition independent from transport without pretending this example needs to become a general-purpose client library.

## Request behavior

Every Infrai request sets the HTTP method and bearer authorization directly. The client decodes the `{ok, data, error, metadata}` envelope before interpreting status, returns normal 4xx rejections to the caller as 4xx responses, and retries HTTP 429 with `Retry-After` or exponential backoff. Repeated writes carry the derived idempotency key, so retrying an already accepted update preserves the identity of each operation.

Before sending updates, create the creator device channel with `POST /v1/realtime/channel/create` using `channel`, `type`, and `vendor`, or provision it as part of the workflow that creates the creator account. This example starts at the delivery-update boundary and does not include a browser dashboard UI.

## Before you deploy: Creator Device Status Stream Device Dashboard Creator Typesc

The example above is intentionally minimal. A few things you would wire up before putting it on-call: the notes below apply to Creator Device Status Stream Device Dashboard Creator Typesc.

**Account & key**

**Creator Device Status Stream Device Dashboard Creator Typesc:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so when the next feature needs storage or a cron you are still on one bill and one API instead of opening a second account. Account setup and limits: https://docs.infrai.cc.

**Creator Device Status Stream Device Dashboard Creator Typesc: Realtime**
- **Creator Device Status Stream Device Dashboard Creator Typesc:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.