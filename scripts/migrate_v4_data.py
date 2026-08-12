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
from collector.project_content import (
    build_project_content,
    clean_readme_markdown,
    metadata_guide,
    write_project_content,
)
from collector.translations import migrate_translation_cache, validate_translation_cache


def guide_defaults(project: dict[str, Any]) -> dict[str, Any]:
    source = (
        "manual"
        if project.get("summary_source") == "manual"
        else "readme_zh"
        if project.get("summary_source") == "readme_zh"
        else "metadata_fallback"
    )
    return {
        **project,
        "content_url": f"data/projects/{int(project['id'])}.json",
        "guide_source": project.get("guide_source", source),
        "guide_status": project.get("guide_status", "partial"),
        "guide_updated_at": project.get("guide_updated_at") or project.get("summary_updated_at"),
    }


def guide_for(project: dict[str, Any]) -> dict[str, Any]:
    return metadata_guide(project)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    site_path = ROOT / "public" / "data" / "site.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    site["schema_version"] = SCHEMA_VERSION
    site["projects"] = [guide_defaults(project) for project in site["projects"]]
    validate_site_data(site)
    validate_site_size(site)

    catalog_path = ROOT / "data" / "catalog.json"
    catalog = migrate_catalog(json.loads(catalog_path.read_text(encoding="utf-8")))
    catalog["projects"] = [guide_defaults(project) for project in catalog["projects"]]
    validate_catalog(catalog)

    translations_path = ROOT / "data" / "translations.json"
    translations = migrate_translation_cache(
        json.loads(translations_path.read_text(encoding="utf-8"))
    )
    validate_translation_cache(translations)

    for project in catalog["projects"]:
        markdown, truncated = clean_readme_markdown(project.get("readme_excerpt") or "")
        content_project = {**project, "guide_zh": guide_for(project)}
        content = build_project_content(
            content_project,
            readme_markdown=markdown,
            readme_truncated=truncated,
        )
        write_project_content(ROOT / "data" / "projects" / f"{int(project['id'])}.json", content)

    write_json(site_path, site)
    write_json(catalog_path, catalog)
    write_json(translations_path, translations)


if __name__ == "__main__":
    main()
