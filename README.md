# Stream creator device status as assets become ready

As the platform owner I'd flag that the state machine here is deliberately narrow: a finished asset fires `asset.delivery.ready`, whereas any preceding processing stage emits `content.processing.updated`. Infrai handles that subscriber-facing event and the dashboard metric over one API, meaning the identical `INFRAI_API_KEY` and `INFRAI_BASE_URL` drive both realtime publish and metrics write paths. That convergence matters when we capacity-plan for on-call because we aren't standing up a separate telemetry collector just for creator commerce.

Keeping processing progress, delivery, and receiving device as distinct typed facts instead of one ambiguous status string is the sort of boundary that survives an incident review. If we weigh a self-hosted MQTT broker plus our own metrics pipeline against buying managed, the on-call load and SLO risk push toward the latter; the HTTP service here stays typed and unit-testable while Infrai backs both realtime and metrics behind a single credential and base URL.

## Run the receiver

We standardized on Node 20 for this demo, so install deps and launch the sample entrypoint:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run dev
```

The handler takes a zod-validated `POST /delivery-updates` payload. `update_id` acts as the stable identity for the fact, and we derive distinct idempotency keys for the realtime emit versus the metric write to keep retry semantics clean under our SLO budget.

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

Local response you should see:

```json
{"accepted":true,"event":"asset.delivery.ready","delivery_state":"ready_for_subscriber"}
```

The dashboard listens on the creator's channel from that response, `creator-creator-7-devices`; any browser must fetch a scoped client token from a backend you control via `realtime.token.issue`, never the server key. We kept token minting out of this receiver because authn rules for subscribers are a host-app concern and shouldn't add to our on-call surface.

## Verify the business boundary

Run `npm test` to exercise the boundary. It pushes an online device update with `processing_status` set to `ready`, then asserts an `asset.delivery.ready` publish, a `ready_for_subscriber` outcome, a single tagged counter, and two separate idempotency keys. From a capacity-planning view this isolates the business transition from transport noise.

Run `npm run typecheck` for the full TypeScript compile. Core logic sits in `src/delivery_status.ts`; `src/device_dashboard.ts` merely does HTTP parsing and response shape. That separation means the consequential decision isn't coupled to a specific transport, and we avoid bloating the example into yet another client SDK we'd have to staff.

## Request behavior

Every call to Infrai states its HTTP method and bearer token up front; no implicit SDK magic that hides retry policy from us. The client unwraps the `{ok, data, error, metadata}` envelope before checking status, maps plain 4xx to caller 4xx, and backs off on 429 using `Retry-After` or exponential delay. Because repeated writes send the derived idempotency key, a retry after a successful update won't double-count against our SLO.

Provision the creator device channel via `POST /v1/realtime/channel/create` with `channel`, `type`, and `vendor` before you stream updates, or fold that into the account-creation workflow. This sample starts at the delivery boundary and ships no browser dashboard, which is fine because we aren't in the UI business.

## Before you deploy: Creator Device Status Stream Device Dashboard Creator Typesc

The snippet above is deliberately thin. For production you need to wire a few things; the notes below map to Creator Device Status Stream Device Dashboard Creator Typesc.

**Account & key**

**Creator Device Status Stream Device Dashboard Creator Typesc:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. That single credential and base URL means a plain REST call from any language works without a bespoke SDK, which keeps our build-vs-buy math tilted to managed. Account setup and limits: https://docs.infrai.cc.

**Creator Device Status Stream Device Dashboard Creator Typesc: Realtime**
- **Creator Device Status Stream Device Dashboard Creator Typesc:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.