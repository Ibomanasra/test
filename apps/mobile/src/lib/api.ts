/**
 * API-Client der App: dieselbe /api/v1 wie das Web, Anmeldung per Bearer-Token
 * (Session-Client MOBILE). Basis-URL über EXPO_PUBLIC_API_URL.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000").replace(/\/$/, "");

export interface ApiErrorBody {
  code: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.code);
  }
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  locale?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createApi(fetchImpl: FetchLike = fetch, baseUrl = API_URL) {
  return async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", "X-Client": "mobile" };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.locale) headers["Accept-Language"] = opts.locale;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    } catch {
      throw new ApiError(0, { code: "network" });
    }
    const data = (await res.json().catch(() => ({}))) as { error?: ApiErrorBody } & T;
    if (!res.ok) throw new ApiError(res.status, data.error ?? { code: "generic" });
    return data;
  };
}

export const api = createApi();

/** Telefonnummer wie im Web: 059… / +970… / +972… → E.164 */
export { normalizePhone } from "@sa/core";

export const imageUrl = (fileId: string) => `${API_URL}/api/v1/images/${fileId}`;
export const documentUrl = (path: string) => `${API_URL}${path}`;
