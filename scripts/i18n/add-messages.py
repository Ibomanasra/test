#!/usr/bin/env python3
"""Fügt Übersetzungen in apps/web/src/messages/{ar,en,he}.json ein.
Aufruf: python3 scripts/i18n/add-messages.py <datei.tsv>
TAB-getrennt: key<TAB>ar<TAB>en[<TAB>he]  – ohne Hebräisch-Spalte gilt in he.json die englische Fassung (Fallback)."""
import json, sys, pathlib
root = pathlib.Path(__file__).resolve().parents[2] / "apps/web/src/messages"
rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
for r in rows:
    if len(r) not in (3, 4):
        sys.exit(f"bad row: {r}")
for idx, loc in ((1, "ar"), (2, "en"), (3, "he")):
    p = root / f"{loc}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    for r in rows:
        if idx >= len(r):
            continue
        node = d
        parts = r[0].split(".")
        for k in parts[:-1]:
            node = node.setdefault(k, {})
        node[parts[-1]] = r[idx]
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
missing_he = sum(1 for r in rows if len(r) == 3)
print(f"{len(rows)} keys" + (f" ({missing_he} without Hebrew – English fallback)" if missing_he else ""))
