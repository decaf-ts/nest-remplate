/**
 * HTTP clients for the e2e tests, built on `@decaf-ts/for-http`'s `AxiosHttpAdapter` —
 * the same adapter a decaf frontend uses to talk to this backend.
 */
import { Model } from "@decaf-ts/decorator-validation";
import type { Constructor } from "@decaf-ts/decoration";
import { BaseError } from "@decaf-ts/db-decorators";
import { AxiosHttpAdapter, RestService, type HttpConfig } from "@decaf-ts/for-http";
import type { AxiosRequestConfig } from "axios";

let aliasSeq = 0;

/**
 * `AxiosHttpAdapter` sending `Authorization: Bearer <token>` on every REST call, and on the
 * SSE stream / subscription calls through `eventHeaderResolver`.
 */
export class BearerHttpAdapter extends AxiosHttpAdapter {
  constructor(
    config: HttpConfig,
    alias: string,
    private readonly bearer?: string
  ) {
    super(config, alias);
  }

  override async request<V>(details: AxiosRequestConfig, ...args: any[]): Promise<V> {
    const headers = Object.assign(
      {},
      details.headers || {},
      this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}
    );
    return super.request<V>({ ...details, headers }, ...(args as []));
  }
}

export interface ClientOptions {
  /** bearer token; omit for anonymous calls */
  token?: string;
  /** subscribe to topics (backend in subscription mode) */
  eventsSubscription?: boolean;
  /** SSE endpoint path */
  eventsPath?: string;
  /**
   * Gives this client its own SSE connection, like a separate browser tab/device has
   * (default true). In a single process for-http shares one connection per stream URL,
   * so a distinct `?client=` query string forces a separate stream. Not needed (and not
   * applied) in subscription mode, where the dispatcher already adds its own client id.
   */
  ownConnection?: boolean;
}

export function httpAdapter(host: string, options: ClientOptions = {}): BearerHttpAdapter {
  const { token, ownConnection = true } = options;
  const alias = `e2e-http-${++aliasSeq}`;
  const eventsPath = options.eventsPath ?? "/events";
  return new BearerHttpAdapter(
    {
      protocol: "http",
      host,
      eventsListenerPath:
        ownConnection && !options.eventsSubscription
          ? `${eventsPath}?client=${alias}`
          : eventsPath,
      eventsSubscription: options.eventsSubscription,
      eventHeaderResolver: (): Record<string, string> =>
        token ? { Authorization: `Bearer ${token}` } : {},
      eventsReconnect: { delayMs: 200, maxDelayMs: 1000 },
    },
    alias,
    token
  );
}

/**
 * Client "repository" over the HTTP API for one model: CRUD, bulk, queries and observation.
 *
 * `RestService` is for-http's frontend-side repository: it skips client-side handlers and
 * validation (`ignoreHandlers`/`ignoreValidation`) because the backend owns them — server
 * fields such as `createdBy` or `createdAt` are always computed by the API.
 */
export function repositoryFor<M extends Model>(
  adapter: BearerHttpAdapter,
  model: Constructor<M>
): RestService<M, BearerHttpAdapter> {
  return new RestService<M, BearerHttpAdapter>(adapter, model);
}

/**
 * HTTP status carried by an error raised by the HTTP adapter (or `undefined`).
 * The adapter rebuilds the server's decaf error (`ForbiddenError` → 403, `AuthorizationError`
 * → 401, `NotAcceptableError` → 406, ...), whose `code` is the HTTP status.
 */
export function statusOf(error: unknown): number | undefined {
  if (error instanceof BaseError && typeof error.code === "number") return error.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  // e.g. "[InternalError][500] 401": the trailing number is the HTTP status of the call
  const trailing = message.match(/\]\s*([1-5]\d\d)\s*$/);
  if (trailing) return Number(trailing[1]);
  const coded = message.match(/\]\[([1-5]\d\d)\]/);
  return coded ? Number(coded[1]) : undefined;
}

/**
 * Runs `fn` and returns the error it threw (fails the test if nothing was thrown).
 */
export async function rejection(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn();
  } catch (e: unknown) {
    return e as Error;
  }
  throw new Error("expected the call to be rejected");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(predicate: () => boolean, timeoutMs = 15000, stepMs = 25): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await sleep(stepMs);
  }
  if (!predicate()) throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
