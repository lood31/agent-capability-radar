from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from collector import SCHEMA_VERSION
from collector.catalog import migrate_catalog, validate_catalog
from collector.pipeline import validate_site_data, validate_site_size
from collector.translations import empty_translation_cache, validate_translation_cache


def content_defaults(project: dict[str, Any]) -> dict[str, Any]:
    manual = project.get("summary_source") == "manual" and bool(project.get("summary_zh"))
    return {
        **project,
        "readme_excerpt": project.get("readme_excerpt"),
        "readme_language": project.get("readme_language", "unknown"),
        "readme_url": project.get("readme_url"),
        "readme_hash": project.get("readme_hash"),
        "summary_status": project.get("summary_status", "ready" if manual else "pending"),
        "summary_model": project.get("summary_model"),
        "summary_updated_at": project.get("summary_updated_at"),
    }


def write(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    site_path = ROOT / "public" / "data" / "site.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    site["schema_version"] = SCHEMA_VERSION
    site["projects"] = [content_defaults(project) for project in site["projects"]]
    validate_site_data(site)
    validate_site_size(site)

    catalog_path = ROOT / "data" / "catalog.json"
    catalog = migrate_catalog(json.loads(catalog_path.read_text(encoding="utf-8")))
    catalog["projects"] = [content_defaults(project) for project in catalog["projects"]]
    validate_catalog(catalog)

    translations_path = ROOT / "data" / "translations.json"
    translations = (
        json.loads(translations_path.read_text(encoding="utf-8"))
        if translations_path.exists()
        else empty_translation_cache()
    )
    validate_translation_cache(translations)

    write(site_path, site)
    write(catalog_path, catalog)
    write(translations_path, translations)


if __name__ == "__main__":
    main()
