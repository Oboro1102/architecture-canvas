#!/usr/bin/env python3
"""Import-graph reachability analyzer.

BFS from entry points following import / export ... from statements.
Any file under --root NOT reachable is a deletion candidate.

Usage:
  python import_reachability.py --root <src> --entry App.vue main.ts --alias "@=./src" --dry-run
  # drop --dry-run and add --delete to actually delete + prune empty dirs.
"""
import argparse
import json
import os
import re
import sys

EXTS = {".ts", ".tsx", ".js", ".jsx", ".vue", ".mjs", ".json"}
IMPORT_RE = re.compile(
    r"""\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]""", re.DOTALL
)
DYNAMIC_RE = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")


def normalize_import(spec: str) -> str | None:
    """Return the resolved relative-or-alias path fragment, or None for bare pkg imports."""
    if spec.startswith("."):
        return ("rel", spec)
    return ("bare", spec)


def resolve(importer: str, kind: str, spec: str, root: str, alias_map: dict):
    importer_dir = os.path.dirname(importer)
    if kind == "rel":
        target = os.path.normpath(os.path.join(importer_dir, spec))
    else:
        # alias: "@=./src" means "@" -> <root>/src ; also support "@/" prefix
        for alias, repl in alias_map.items():
            if spec == alias or spec.startswith(alias + "/"):
                rest = spec[len(alias):].lstrip("/")
                target = os.path.normpath(os.path.join(root, repl, rest))
                break
        else:
            return None  # bare package import — not a source file we track
    # try extensions / index
    candidates = [target]
    if os.path.isdir(target):
        for e in EXTS:
            candidates.append(os.path.join(target, "index" + e))
    else:
        base, ext = os.path.splitext(target)
        if ext == "":
            for e in EXTS:
                candidates.append(base + e)
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def collect_source_files(root: str):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        # skip hidden / node_modules / test output
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "node_modules"]
        for f in filenames:
            ext = os.path.splitext(f)[1]
            if ext in EXTS:
                out.append(os.path.normpath(os.path.join(dirpath, f)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--entry", nargs="+", required=True)
    ap.add_argument("--alias", action="append", default=[], help="@=./src")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--delete", action="store_true")
    ap.add_argument("--json", help="write reachable+unreachable report here")
    args = ap.parse_args()

    root = os.path.normpath(args.root)
    alias_map = {}
    for a in args.alias:
        k, v = a.split("=", 1)
        # v may be relative to cwd; make absolute-ish relative to root
        alias_map[k] = v.lstrip("./")  # store as rel path fragment from root

    entries = [os.path.normpath(os.path.join(root, e)) for e in args.entry]
    # entries may also be absolute already
    entries = [e if os.path.isfile(e) else os.path.normpath(os.path.join(root, e)) for e in args.entry]

    all_files = set(collect_source_files(root))
    reachable = set()
    stack = [e for e in entries if e in all_files]
    # also seed with entries that exist even if not in all_files (e.g. main.ts at root)
    for e in entries:
        if os.path.isfile(e) and e not in stack:
            stack.append(e)

    while stack:
        cur = stack.pop()
        if cur in reachable:
            continue
        reachable.add(cur)
        try:
            with open(cur, encoding="utf-8") as fh:
                text = fh.read()
        except Exception:
            continue
        specs = [m.group(1) for m in IMPORT_RE.finditer(text)]
        specs += [m.group(1) for m in DYNAMIC_RE.finditer(text)]
        for spec in specs:
            kind, val = normalize_import(spec)
            res = resolve(cur, kind, val, root, alias_map)
            if res and res in all_files and res not in reachable:
                stack.append(res)

    unreachable = sorted(all_files - reachable)
    # group by top folder
    groups: dict[str, list[str]] = {}
    for f in unreachable:
        rel = os.path.relpath(f, root)
        top = rel.split(os.sep)[0]
        groups.setdefault(top, []).append(rel)

    print(f"ROOT: {root}")
    print(f"Reachable source files : {len(reachable)}")
    print(f"Unreachable candidates : {len(unreachable)}")
    print("--- grouped by top folder ---")
    for top in sorted(groups):
        print(f"\n[{top}] ({len(groups[top])})")
        for rel in groups[top]:
            print(f"  {rel}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump({"reachable": sorted(reachable), "unreachable": unreachable}, fh, indent=2)
        print(f"\nwrote report -> {args.json}")

    if args.delete and not args.dry_run:
        for f in unreachable:
            os.remove(f)
            print(f"DELETED {f}")
        # prune empty dirs
        for dirpath, dirnames, filenames in os.walk(root, topdown=False):
            if not dirnames and not filenames:
                try:
                    os.rmdir(dirpath)
                    print(f"RMDIR {dirpath}")
                except OSError:
                    pass


if __name__ == "__main__":
    main()
