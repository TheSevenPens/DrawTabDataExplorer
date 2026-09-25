#!/usr/bin/env python3
"""One-shot import of pen specs from kuuube-wacom-pen-info.xlsx.

Reads the spreadsheet, matches Excel rows to the Wacom pen source files
data-repo/source/pens/wacom/<EntityId>.json by PenId, computes per-pen
updates, and either prints a dry-run diff (default) or sends the complete
plan to data-repo/scripts/apply-update.ts (--write). The shared TypeScript
transaction validates schemas and references before committing source files,
bundles and metadata. Python never writes dataset JSON.

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

--write first checks committed bundle/metadata freshness, then submits one
validated transaction. A rejected batch leaves existing files unchanged.
--repo-root points it at a copy of the data-repo (the directory holding
source/ and data/), for testing.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("missing openpyxl: python -m pip install openpyxl")

REPO = Path(__file__).resolve().parent.parent
DATA_REPO = REPO / "data-repo"
GENERATE_TS = DATA_REPO / "scripts" / "generate.ts"

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


def _no_duplicate_keys(pairs):
    keys = [k for k, _ in pairs]
    dups = sorted({k for k in keys if keys.count(k) > 1})
    if dups:
        raise ValueError(f"duplicate object keys: {', '.join(dups)}")
    return dict(pairs)


def _parse_float(s):
    # JSON.stringify writes an integral number without a fraction (5.0 -> 5);
    # Python would keep 5.0. Store integral floats as int so the dump matches.
    f = float(s)
    return int(f) if f.is_integer() else f


def read_data_json(path):
    """Parse a dataset file like readDataJson(): BOM skipped, duplicate
    keys rejected."""
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f, object_pairs_hook=_no_duplicate_keys, parse_float=_parse_float)


def read_wacom_pen_sources(repo_root):
    """{path: record} for every Wacom pen source file, sorted by path."""
    src_dir = Path(repo_root) / "source" / "pens" / "wacom"
    if not src_dir.is_dir():
        sys.exit(f"no pen sources at {src_dir}")
    return {f: read_data_json(f) for f in sorted(src_dir.glob("*.json"))}


def run_generator(repo_root, write):
    """Run data-repo/scripts/generate.ts on repo_root (check mode, or
    --write) from the Explorer root. Returns (exit code, output)."""
    npx = shutil.which("npx")
    if npx is None:
        sys.exit("npx not found on PATH (needed to run data-repo/scripts/generate.ts)")
    cmd = [npx, "tsx", str(GENERATE_TS), "--repo-root", str(repo_root)]
    if write:
        cmd.append("--write")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, encoding="utf-8")
    return r.returncode, (r.stdout + r.stderr).strip()


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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--xlsx",
        default=r"C:\Users\seven\OneDrive\kuuube-wacom-pen-info.xlsx",
        help="path to the spreadsheet",
    )
    ap.add_argument("--write", action="store_true", help="apply changes (default: dry-run)")
    ap.add_argument(
        "--repo-root",
        default=str(DATA_REPO),
        help="data-repo root holding source/ and data/ "
        "(default: the data-repo submodule; point it at a copy for testing)",
    )
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

    repo_root = Path(args.repo_root).resolve()
    sources = read_wacom_pen_sources(repo_root)
    pens = list(sources.values())
    by_penid = {p["PenId"]: p for p in pens}

    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00.000Z")

    updates_planned = []  # list of (pen_dict, diffs, flags, new_pen_dict)
    no_match_excel = []
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

    if not updates_planned:
        print()
        print("nothing to write")
        return

    # ---- Write phase ----
    # Start from bundles that match their sources, so the regenerate below
    # carries this import's changes and nothing else.
    code, out = run_generator(repo_root, write=False)
    if code != 0:
        print(out, file=sys.stderr)
        sys.exit("generate.ts check failed before writing; nothing was written")

    print()
    # Send a complete plan to the shared TypeScript transaction boundary.
    npx = shutil.which("npx")
    if npx is None:
        sys.exit("npx not found on PATH")
    plan = [{"collection": "pens", "record": new_pen}
            for _cur, _diffs, _flags, new_pen in updates_planned]
    cmd = [npx, "tsx", str(DATA_REPO / "scripts" / "apply-update.ts"),
           "--repo-root", str(repo_root)]
    result = subprocess.run(cmd, cwd=REPO, input=json.dumps(plan, ensure_ascii=False),
                            capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit("import rejected; no source or bundle changes were committed")
    print(result.stdout.strip())
    print(f"{len(updates_planned)} pens updated; bundles and metadata regenerated")


if __name__ == "__main__":
    main()
