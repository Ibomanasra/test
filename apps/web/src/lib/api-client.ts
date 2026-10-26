"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

export interface ApiErrorBody {
  code: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.code);
  }
}

/** fetch-Wrapper für /api/v1: JSON rein/raus, Fehler als ApiError. */
export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; form?: FormData; locale?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.locale) headers["Accept-Language"] = init.locale;
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, { code: "network" });
  }
  const data = (await res.json().catch(() => ({}))) as { error?: ApiErrorBody } & T;
  if (!res.ok) throw new ApiError(res.status, data.error ?? { code: "generic" });
  return data;
}

/** Hook: führt API-Aufrufe aus und liefert eine übersetzte Fehlermeldung. */
export function useApi() {
  const t = useTranslations("errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        const code = err.body.code;
        if (code === "validation_error" && Array.isArray(err.body.details)) {
          const first = (err.body.details as { message?: string }[]).find((d) => d.message && t.has(d.message));
          if (first?.message) return t(first.message);
        }
        if (code === "rate_limited") {
          const seconds = (err.body.details as { retryAfter?: number } | undefined)?.retryAfter ?? 60;
          return t("rate_limited", { seconds });
        }
        if (t.has(code)) return t(code);
      }
      return t("generic");
    },
    [t],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        setError(translate(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [translate],
  );

  const call = useCallback(
    <T,>(path: string, init: Parameters<typeof apiFetch>[1] = {}) => run(() => apiFetch<T>(path, { locale, ...init })),
    [run, locale],
  );

  return { pending, error, setError, run, call };
}
