/** Fehler mit HTTP-Status und stabilem Code (wird im Client übersetzt: errors.<code>). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const unauthorized = (code = "unauthorized") => new AppError(401, code);
export const forbidden = (code = "forbidden") => new AppError(403, code);
export const notFound = (code = "not_found") => new AppError(404, code);
export const badRequest = (code: string, details?: unknown) => new AppError(400, code, code, details);
export const conflict = (code: string) => new AppError(409, code);
export const tooManyRequests = (code = "rate_limited", retryAfter?: number) =>
  new AppError(429, code, code, retryAfter ? { retryAfter } : undefined);
