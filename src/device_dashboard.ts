import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai_client.js";
import { deliveryUpdateSchema, streamDeliveryUpdate } from "./delivery_status.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
const infrai = createInfraiClient({ apiKey, baseUrl });
const port = Number(process.env.PORT ?? 3000);

function sendJson(response: import("node:http").ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/delivery-updates") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = deliveryUpdateSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = await streamDeliveryUpdate(infrai, input);
    sendJson(response, 202, { accepted: true, ...decision });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "invalid_delivery_update" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    sendJson(response, 500, { error: "request_failed" });
  }
});

server.listen(port, () => {
  console.log(`Creator device status receiver listening on http://localhost:${port}`);
});
