from __future__ import annotations

import argparse
import json
from pathlib import Path

from collector.pipeline import collect, validate_site_data


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(description="Collect and score GitHub capability projects")
    cli.add_argument("--root", type=Path, default=Path.cwd(), help="Repository root")
    cli.add_argument("--dry-run", action="store_true", help="Collect and validate without writing files")
    cli.add_argument("--validate", type=Path, help="Validate an existing site.json and exit")
    return cli


def main() -> int:
    args = parser().parse_args()
    if args.validate:
        payload = json.loads(args.validate.read_text(encoding="utf-8"))
        validate_site_data(payload)
        print(f"valid: {len(payload['projects'])} projects")
        return 0
    payload = collect(args.root.resolve(), dry_run=args.dry_run)
    print(
        f"collected={payload['stats']['candidates']} "
        f"published={payload['stats']['published']} dry_run={args.dry_run}"
    )
    return 0

