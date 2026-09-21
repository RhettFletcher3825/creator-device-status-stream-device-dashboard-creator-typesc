import { z } from "zod";
import type { DashboardSink } from "./infrai_client.js";

export const deliveryUpdateSchema = z.object({
  update_id: z.string().min(1),
  creator_id: z.string().min(1),
  asset_id: z.string().min(1),
  subscriber_id: z.string().min(1),
  device_id: z.string().min(1),
  device_status: z.enum(["online", "offline"]),
  processing_status: z.enum(["queued", "processing", "ready", "failed"]),
});

export type DeliveryUpdate = z.infer<typeof deliveryUpdateSchema>;

export type StreamDecision = {
  event: "content.processing.updated" | "asset.delivery.ready";
  delivery_state: "waiting_for_asset" | "ready_for_subscriber";
};

export function decideStreamUpdate(input: DeliveryUpdate): StreamDecision {
  return input.processing_status === "ready"
    ? { event: "asset.delivery.ready", delivery_state: "ready_for_subscriber" }
    : { event: "content.processing.updated", delivery_state: "waiting_for_asset" };
}

export async function streamDeliveryUpdate(infrai: DashboardSink, input: DeliveryUpdate): Promise<StreamDecision> {
  const decision = decideStreamUpdate(input);
  const channel = `creator-${input.creator_id}-devices`;
  const data = { ...input, delivery_state: decision.delivery_state };

  await Promise.all([
    infrai.realtime.publish(
      { channel, event: decision.event, data, account_id: input.creator_id },
      `${input.update_id}:realtime`,
    ),
    infrai.metrics.report(
      {
        type: "counter",
        name: "creator.device_status_updates",
        value: 1,
        tags: { device_status: input.device_status, processing_status: input.processing_status },
      },
      `${input.update_id}:metric`,
    ),
  ]);

  return decision;
}
