import {
  DEFAULT_PADDING,
  DOC_PREFIX,
  GAPLESS_DOC_TYPES,
  businessYear,
  formatDocNumber,
  type DocTypeKey,
} from "@sa/core";
import type { Tx } from "./index";

export interface AllocatedNumber {
  number: string;
  docType: DocTypeKey;
  year: number;
  seq: number;
}

/**
 * Vergibt die nächste Belegnummer.
 *
 * Ein einziges `INSERT … ON CONFLICT DO UPDATE … RETURNING` erhöht den Zähler und
 * sperrt die Zeile bis zum Ende der Transaktion. Damit gilt:
 *  - parallele Transaktionen warten aufeinander → keine doppelten Nummern
 *  - Rollback der Beleg-Transaktion setzt auch den Zähler zurück → keine Lücken
 *
 * Für lückenlose Belegarten (Rechnung, Gutschrift) MUSS der Aufruf in derselben
 * Transaktion erfolgen, die den Beleg schreibt.
 */
export async function allocateDocumentNumber(
  tx: Tx,
  docType: DocTypeKey,
  at: Date = new Date(),
): Promise<AllocatedNumber> {
  const year = businessYear(at);
  const defaultPrefix = DOC_PREFIX[docType];
  const gapless = GAPLESS_DOC_TYPES.has(docType);

  const rows = await tx.$queryRaw<{ seq: number; prefix: string; padding: number }[]>`
    INSERT INTO "NumberSequence" ("id", "docType", "year", "prefix", "padding", "nextNumber", "gapless")
    SELECT gen_random_uuid()::text, ${docType}::"DocType", ${year},
           coalesce(prev."prefix", ${defaultPrefix}),
           coalesce(prev."padding", ${DEFAULT_PADDING}),
           2, ${gapless}
    FROM (SELECT 1) AS one
    LEFT JOIN LATERAL (
      SELECT "prefix", "padding" FROM "NumberSequence"
      WHERE "docType" = ${docType}::"DocType" ORDER BY "year" DESC LIMIT 1
    ) AS prev ON true
    ON CONFLICT ("docType", "year")
    DO UPDATE SET "nextNumber" = "NumberSequence"."nextNumber" + 1
    RETURNING ("nextNumber" - 1)::int AS seq, "prefix", "padding"
  `;
  const row = rows[0];
  if (!row) throw new Error(`could not allocate number for ${docType}`);
  return {
    number: formatDocNumber({ prefix: row.prefix, year, seq: row.seq }, row.padding),
    docType,
    year,
    seq: row.seq,
  };
}
