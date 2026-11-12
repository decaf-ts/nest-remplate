/**
 * Event helpers: HttpAdapter-based observers and a raw SSE reader.
 */
import { Adapter } from "@decaf-ts/core";
import type { Model } from "@decaf-ts/decorator-validation";
import type { Constructor } from "@decaf-ts/decoration";
import { PersistenceFlavour } from "../../../src/persistence/flavour";
import { type BearerHttpAdapter, httpAdapter, repositoryFor, sleep, waitFor, type ClientOptions } from "./client";

export interface ReceivedEvent {
  table: string;
  operation: string;
  /** a single id, or the list of ids of a bulk operation */
  id: string | string[];
}

/**
 * A frontend-like client: an `AxiosHttpAdapter` observing one or more models through
 * `RestService.observe()`, i.e. the decaf Observer API fed by the backend's SSE stream.
 */
export class EventListener {
  readonly events: ReceivedEvent[] = [];
  readonly adapter: BearerHttpAdapter;
  private readonly stops: Array<() => void> = [];

  constructor(host: string, options: ClientOptions = {}) {
    this.adapter = httpAdapter(host, options);
  }

  observe(...models: Constructor<Model>[]): this {
    for (const model of models) {
      const service = repositoryFor(this.adapter, model);
      this.stops.push(
        service.observe({
          refresh: async (table: any, operation: any, id: any) => {
            this.events.push({
              table: typeof table === "string" ? table : table?.name,
              operation: String(operation),
              id,
            });
          },
        } as any)
      );
    }
    return this;
  }

  get listening(): boolean {
    return Boolean((this.adapter as any).dispatch?.listening);
  }

  of(table: string, operation?: string): ReceivedEvent[] {
    return this.events.filter(
      (e) => e.table === table && (!operation || e.operation === operation)
    );
  }

  has(table: string, operation: string, id: string): boolean {
    return this.events.some(
      (e) =>
        e.table === table &&
        e.operation === operation &&
        (Array.isArray(e.id) ? e.id.includes(id) : e.id === id)
    );
  }

  async waitFor(table: string, operation: string, id: string, timeoutMs = 10000): Promise<void> {
    await waitFor(() => this.has(table, operation, id), timeoutMs);
  }

  stop(): void {
    while (this.stops.length) this.stops.pop()!();
  }

  async shutdown(): Promise<void> {
    this.stop();
    try {
      await this.adapter.shutdown();
    } catch {
      // best effort
    }
  }
}

/**
 * Number of SSE streams the backend has registered on its persistence adapter — one per
 * accepted `/events` connection. Proves the streams were really established server side.
 */
export function serverStreams(): number {
  return (Adapter.get(PersistenceFlavour) as any)?.observerHandler?.count?.() ?? 0;
}

/**
 * Waits until every listener is connected and the backend accepted `streams` streams,
 * then lets the connections settle (plain SSE does not replay events emitted while connecting).
 */
export async function connected(listeners: EventListener[], streams = listeners.length): Promise<void> {
  await waitFor(() => listeners.every((l) => l.listening) && serverStreams() >= streams);
  await sleep(200);
}

/**
 * Minimal raw SSE client (fetch-based) — used to assert on HTTP-level behaviour of the stream.
 */
export class RawSse {
  readonly frames: Array<{ event: string; data: unknown }> = [];
  private readonly controller = new AbortController();
  readonly response: Promise<Response>;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.response = fetch(url, {
      headers: { Accept: "text/event-stream", ...headers },
      signal: this.controller.signal,
    }).then((response) => {
      if (response.ok && response.body) void this.read(response);
      return response;
    });
  }

  private async read(response: Response): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      let chunk: { done: boolean; value?: Uint8Array };
      try {
        chunk = await reader.read();
      } catch {
        return;
      }
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trimStart();
        }
        if (!data) continue;
        let parsed: unknown = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          // keep raw payload
        }
        this.frames.push({ event, data: parsed });
      }
    }
  }

  /** `[table, operation, id, ...]` data frames (heartbeats excluded) */
  get messages(): unknown[][] {
    return this.frames
      .filter((f) => f.event !== "heartbeat" && Array.isArray(f.data))
      .map((f) => f.data as unknown[]);
  }

  close(): void {
    this.controller.abort();
  }
}
