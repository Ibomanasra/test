import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id, OWASP-Empfehlung (19 MiB, t=2, p=1)
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string | null | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    // Gleiche Laufzeit wie bei existierendem Benutzer (kein User-Enumeration über Timing)
    await hash(password, OPTIONS);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
