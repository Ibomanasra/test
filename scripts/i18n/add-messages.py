#!/usr/bin/env python3
"""Fügt Übersetzungen (Schlüssel, AR, EN) in apps/web/src/messages/{ar,en}.json ein.
Aufruf: python3 scripts/i18n/add-messages.py <datei.tsv>   (TAB-getrennt: key<TAB>ar<TAB>en)"""
import json, sys, pathlib
root = pathlib.Path(__file__).resolve().parents[2] / "apps/web/src/messages"
rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
for idx, loc in ((1, "ar"), (2, "en")):
    p = root / f"{loc}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    for r in rows:
        if len(r) != 3:
            sys.exit(f"bad row: {r}")
        node = d
        parts = r[0].split(".")
        for k in parts[:-1]:
            node = node.setdefault(k, {})
        node[parts[-1]] = r[idx]
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{len(rows)} keys")
