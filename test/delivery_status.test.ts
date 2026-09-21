import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardSink, MetricInput, PublishInput } from "../src/infrai_client.js";
import { streamDeliveryUpdate } from "../src/delivery_status.js";

test("a processed asset becomes ready for its subscriber", async () => {
  const published: PublishInput[] = [];
  const metrics: MetricInput[] = [];
  const keys: string[] = [];
  const sink: DashboardSink = {
    realtime: {
      async publish(input, key) { published.push(input); keys.push(key); },
    },
    metrics: {
      async report(input, key) { metrics.push(input); keys.push(key); },
    },
  };

  const decision = await streamDeliveryUpdate(sink, {
    update_id: "update-42",
    creator_id: "creator-7",
    asset_id: "asset-9",
    subscriber_id: "subscriber-3",
    device_id: "tablet-2",
    device_status: "online",
    processing_status: "ready",
  });

  assert.deepEqual(decision, { event: "asset.delivery.ready", delivery_state: "ready_for_subscriber" });
  assert.equal(published[0]?.channel, "creator-creator-7-devices");
  assert.equal(published[0]?.event, "asset.delivery.ready");
  assert.deepEqual(metrics[0]?.tags, { device_status: "online", processing_status: "ready" });
  assert.deepEqual(keys.sort(), ["update-42:metric", "update-42:realtime"]);
});
