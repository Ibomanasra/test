import "server-only";
import { applyDueScheduledPrices } from "./services/prices-admin";
import { expireQuotes } from "./services/quotes";

const g = globalThis as unknown as { __saJobs?: boolean };

async function runSafely(name: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    if (typeof r === "number" && r > 0) console.info(`[job:${name}] processed ${r}`);
  } catch (err) {
    console.error(`[job:${name}] failed`, err);
  }
}

export function startJobs() {
  if (g.__saJobs) return;
  g.__saJobs = true;
  const every = (ms: number, name: string, fn: () => Promise<unknown>) => {
    setTimeout(() => void runSafely(name, fn), 10_000);
    setInterval(() => void runSafely(name, fn), ms).unref();
  };
  every(5 * 60_000, "scheduled-prices", () => applyDueScheduledPrices());
  every(60 * 60_000, "expire-quotes", () => expireQuotes());
}
