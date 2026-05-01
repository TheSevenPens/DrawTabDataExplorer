#!/usr/bin/env python3
"""One-shot import of pen specs from kuuube-wacom-pen-info.xlsx.

Reads the spreadsheet, matches Excel rows to records in
data-repo/data/pens/WACOM-pens.json by PenId, computes per-pen updates,
and either prints a dry-run diff (default) or rewrites the JSON file
(--write).

Field rules:
  - Weight: strip "g"; first numeric token; "???" / annotated → flag, skip
  - Size:   parse "L x D mm" or "L x D x T mm" (3-dim → take 1st two);
            accepts x / × / � (mojibake) as separator; if 2nd token has
            "-" or "?" the diameter is left untouched
  - Pressure levels → PressureLevels; also implies PressureSensitive=YES
  - Pen Buttons → ButtonCount (+ Eraser/Wheel/BarrelRotation YES/NO);
                  "N/A" → ButtonCount=0 with all three flags NO

Fields the spreadsheet does NOT cover (Tilt, Hover, Shape) are never
written.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("missing openpyxl: python -m pip install openpyxl")

REPO = Path(__file__).resolve().parent.parent
JSON_PATH = REPO / "data-repo" / "data" / "pens" / "WACOM-pens.json"

# Canonical key order in the JSON output, matching the existing file
# convention (see KP-503E / KP-504E).
FIELD_ORDER = [
    "EntityId", "Brand", "PenId", "PenName", "PenFamily", "PenTech",
    "PenYear", "ButtonCount", "PressureSensitive", "PressureLevels",
    "Wheel", "Eraser", "Shape", "Weight", "Length", "Diameter",
    "Tilt", "BarrelRotation", "Hover", "Notes", "Tags",
    "_id", "_CreateDate", "_ModifiedDate",
]

OUTER_INDENT = " " * 17
INNER_INDENT = " " * 21

# Manual overrides applied AFTER Excel-derived updates. Each entry maps
# PenId → field → value, with None meaning "delete this field". Decisions
# captured during the edge-case walkthrough on 2026-05-01.
SP_NOTE = "Tip switch reports only on/off (2 states), not graded pressure."
OVERRIDES = {
    # Pro Pen Slim: source recorded "157 x 9.5-10? mm" — diameter is a
    # range with explicit uncertainty. Pick 10 (upper bound).
    "KP-301E": {"Diameter": "10"},
    # Ballpoint Pen for Intuos Pro: source "18g [15g]" — bracketed value
    # is a more recent measurement. Use 15.
    "KP-133": {"Weight": "15"},
    # 1988 SP-series pens have a 2-state tip switch only (no graded
    # pressure curve). The raw "PressureLevels=2" value is technically
    # accurate but misleading on the detail page; treat as not
    # pressure-sensitive and drop PressureLevels.
    "SP-200":  {"PressureSensitive": "NO", "PressureLevels": None, "Notes": SP_NOTE},
    "SP-210":  {"PressureSensitive": "NO", "PressureLevels": None, "Notes": SP_NOTE},
    "SP-200A": {"PressureSensitive": "NO", "PressureLevels": None, "Notes": SP_NOTE},
    "SP-210A": {"PressureSensitive": "NO", "PressureLevels": None, "Notes": SP_NOTE},
}


def parse_weight(raw):
    s = str(raw).strip()
    if "?" in s:
        return None
    m = re.search(r"\d+(?:\.\d+)?", s)
    return m.group(0) if m else None


def parse_size(raw):
    """Return (length, diameter) numeric strings, or None for missing."""
    s = str(raw).strip()
    s = s.replace("×", "x").replace("�", "x")
    parts = re.split(r"\s*x\s*", s, flags=re.IGNORECASE)
    if not parts or "?" in parts[0] and not re.search(r"\d", parts[0]):
        return (None, None)
    length = None
    m = re.match(r"\s*(\d+(?:\.\d+)?)", parts[0])
    if m:
        length = m.group(1)
    diameter = None
    if len(parts) >= 2:
        # uncertainty in second token (e.g. "9.5-10?") → leave blank
        if "-" not in parts[1] and "?" not in parts[1]:
            m = re.match(r"\s*(\d+(?:\.\d+)?)", parts[1])
            if m:
                diameter = m.group(1)
    return (length, diameter)


def parse_buttons(raw):
    s = str(raw).strip()
    if s == "N/A":
        return {
            "ButtonCount": "0", "Eraser": "NO",
            "Wheel": "NO", "BarrelRotation": "NO",
        }
    m = re.match(r"^\s*(\d+)", s)
    btn = m.group(1) if m else "0"
    low = s.lower()
    return {
        "ButtonCount": btn,
        "Eraser": "YES" if "eraser" in low else "NO",
        "Wheel": "YES" if "wheel" in low else "NO",
        "BarrelRotation": "YES" if "rotation" in low else "NO",
    }


def derive_updates(row):
    """From one Excel row, return (updates_dict, flags_list)."""
    pid, weight_raw, size_raw, pressure, buttons_raw = row
    upd, flags = {}, []

    if weight_raw:
        ws = str(weight_raw)
        if any(t in ws for t in ("?", "[", "or")):
            flags.append(f"weight annotated: {weight_raw!r}")
        w = parse_weight(weight_raw)
        if w is not None:
            upd["Weight"] = w

    if size_raw:
        sz = str(size_raw)
        nums = re.findall(r"\d+(?:\.\d+)?", sz)
        if len(nums) >= 3:
            flags.append(f"3-dim size, taking first 2: {size_raw!r}")
        if "?" in sz:
            flags.append(f"size uncertain: {size_raw!r}")
        length, diameter = parse_size(size_raw)
        if length is not None:
            upd["Length"] = length
        if diameter is not None:
            upd["Diameter"] = diameter

    if pressure is not None:
        upd["PressureLevels"] = str(pressure)
        upd["PressureSensitive"] = "YES"

    if buttons_raw is not None:
        upd.update(parse_buttons(buttons_raw))

    return upd, flags


def format_value(v):
    """JSON-encode a value the way PowerShell's ConvertTo-Json does for
    the simple primitives that appear on pen records (string only)."""
    return json.dumps(v, ensure_ascii=False)


def format_pen_object(pen):
    keys_sorted = [k for k in FIELD_ORDER if k in pen]
    extras = [k for k in pen if k not in FIELD_ORDER]
    keys_sorted.extend(extras)

    # The opening "{" gets no leading indent — the surrounding file
    # text already provides the indent before the brace span. The closing
    # "}" sits on its own line so it does need indenting.
    lines = ["{"]
    for i, k in enumerate(keys_sorted):
        sep = "," if i < len(keys_sorted) - 1 else ""
        lines.append(f"{INNER_INDENT}\"{k}\":  {format_value(pen[k])}{sep}")
    lines.append(OUTER_INDENT + "}")
    return "\n".join(lines)


def diff_fields(current, updates):
    """Return list of (field, before, after, kind) for changed fields.

    A value of None in `updates` means "delete this field"."""
    out = []
    for k, v in updates.items():
        cur = current.get(k)
        if v is None:
            if cur is not None:
                out.append((k, cur, None, "-"))
        elif cur is None:
            out.append((k, None, v, "+"))
        elif cur != v:
            out.append((k, cur, v, "~"))
        # else: identical, skip
    return out


def find_pen_block_span(text, uuid):
    """Return (start, end) text indices for the pen object containing the
    given _id UUID, including the surrounding braces."""
    m = re.search(rf'"_id":\s+"{re.escape(uuid)}"', text)
    if not m:
        return None
    # walk backwards to find the opening '{'
    i = m.start()
    depth = 0
    while i >= 0:
        if text[i] == "}":
            depth += 1
        elif text[i] == "{":
            if depth == 0:
                start = i
                break
            depth -= 1
        i -= 1
    else:
        return None
    # walk forwards to find the matching '}'
    i = m.start()
    depth = 0
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            if depth == 0:
                end = i + 1
                break
            depth -= 1
        i += 1
    else:
        return None
    return (start, end)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--xlsx",
        default=r"C:\Users\seven\OneDrive\kuuube-wacom-pen-info.xlsx",
        help="path to the spreadsheet",
    )
    ap.add_argument("--write", action="store_true", help="apply changes (default: dry-run)")
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    ws = wb["Sheet1"]

    excel_rows = {}
    duplicates = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        pid = row[0].strip()
        if pid in excel_rows:
            duplicates.append(pid)
            continue
        excel_rows[pid] = row

    with open(JSON_PATH, encoding="utf-8") as f:
        text = f.read()
    data = json.loads(text)
    pens = data["Pens"]
    by_penid = {p["PenId"]: p for p in pens}

    today_iso = datetime.utcnow().strftime("%Y-%m-%dT00:00:00.000Z")

    updates_planned = []  # list of (pen_dict, diffs, flags, new_pen_dict)
    no_match_excel = []
    no_match_db = []
    no_changes = []

    for pid, row in excel_rows.items():
        if pid not in by_penid:
            no_match_excel.append(pid)
            continue
        upd, flags = derive_updates(row)
        if pid in OVERRIDES:
            for k, v in OVERRIDES[pid].items():
                upd[k] = v
            flags.append(f"manual override applied")
        cur = by_penid[pid]
        diffs = diff_fields(cur, upd)
        if not diffs:
            no_changes.append(pid)
            continue
        new_pen = dict(cur)
        for k, v in upd.items():
            if v is None:
                new_pen.pop(k, None)
            else:
                new_pen[k] = v
        new_pen["_ModifiedDate"] = today_iso
        updates_planned.append((cur, diffs, flags, new_pen))

    db_only = [p["PenId"] for p in pens if p["PenId"] not in excel_rows]

    # ---- Report ----
    print(f"Excel rows: {len(excel_rows)} unique  ({len(duplicates)} dup)")
    if duplicates:
        print(f"  duplicates (skipped): {duplicates}")
    print(f"DB pens:    {len(pens)}")
    print(f"Matched:    {len(updates_planned) + len(no_changes)}")
    print(f"No-op:      {len(no_changes)}")
    print(f"Planned:    {len(updates_planned)} updates")
    print(f"Excel only (no DB row): {no_match_excel}")
    print(f"DB only (no Excel row): {db_only}")
    print()

    for cur, diffs, flags, _new in updates_planned:
        print(f"  {cur['PenId']}  ({cur['EntityId']})")
        for k, before, after, kind in diffs:
            if kind == "+":
                print(f"    + {k:<20} = {after!r}")
            elif kind == "-":
                print(f"    - {k:<20}  was {before!r}")
            else:
                print(f"    ~ {k:<20}  {before!r}  ->  {after!r}")
        for f in flags:
            print(f"    ! {f}")

    if not args.write:
        print()
        print(f"(dry-run; pass --write to apply {len(updates_planned)} updates)")
        return

    # ---- Write phase ----
    new_text = text
    for cur, _diffs, _flags, new_pen in updates_planned:
        span = find_pen_block_span(new_text, cur["_id"])
        if span is None:
            sys.exit(f"could not locate {cur['PenId']} ({cur['_id']}) in file")
        start, end = span
        new_text = new_text[:start] + format_pen_object(new_pen) + new_text[end:]

    with open(JSON_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_text)
    print()
    print(f"wrote {JSON_PATH}  ({len(updates_planned)} pens updated)")


if __name__ == "__main__":
    main()
