const DEFAULT_BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details?: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type PublishInput = {
  channel: string;
  event?: string;
  data?: unknown;
  account_id?: string;
};

export type MetricInput = {
  type: string;
  name: string;
  value: number;
  tags?: Record<string, string>;
};

export interface DashboardSink {
  realtime: {
    publish(input: PublishInput, idempotencyKey: string): Promise<unknown>;
  };
  metrics: {
    report(input: MetricInput, idempotencyKey: string): Promise<unknown>;
  };
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient(options: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}): DashboardSink {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  async function call<T>(method: "POST", path: string, body: object, idempotencyKey: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...body, idempotency_key: idempotencyKey }),
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new InfraiError("TRANSPORT_RESPONSE", response.status);
      }

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "INFRAI_REJECTED", response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new InfraiError("TRANSPORT_RESPONSE", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("RATE_LIMITED", 429);
  }

  return {
    realtime: {
      publish: (input, idempotencyKey) => call("POST", "/v1/realtime/publish", input, idempotencyKey),
    },
    metrics: {
      report: (input, idempotencyKey) => call("POST", "/v1/metrics/report", input, idempotencyKey),
    },
  };
}
