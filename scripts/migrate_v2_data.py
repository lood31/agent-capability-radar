from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from collector.rules import classify


def enrich(
    project: dict[str, Any],
    overrides: dict[str, Any],
    *,
    keep_excluded: bool = False,
) -> tuple[dict[str, Any], bool]:
    repo = {
        "id": project["id"],
        "name": str(project["full_name"]).split("/")[-1],
        "full_name": project["full_name"],
        "description": project.get("description"),
        "topics": project.get("topics", []),
        "archived": False,
        "fork": False,
    }
    legacy_override = {
        "capabilities": project.get("capabilities", []),
        "primary_capability": project.get("primary_capability"),
        "content_type": project.get("content_type"),
        **overrides.get(project["full_name"], {}),
    }
    result = classify(repo, "", legacy_override)
    excluded = result is None
    if result is None and keep_excluded:
        result = classify(repo, "", {**legacy_override, "include_resource": True})
    if result is None:
        return project, True
    enriched = {
        **project,
        "ecosystem_layer": result.ecosystem_layer,
        "project_subtype": result.project_subtype,
        "use_cases": result.use_cases,
        "functional_capabilities": result.functional_capabilities,
        "summary_zh": result.summary_zh,
        "summary_source": result.summary_source,
        "features": result.features,
        "preview": result.preview,
    }
    if keep_excluded and excluded:
        enriched["active"] = False
    return enriched, excluded


def write(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    config = json.loads((ROOT / "config" / "discovery.json").read_text(encoding="utf-8"))
    overrides = config.get("overrides", {})
    site_path = ROOT / "public" / "data" / "site.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    site["schema_version"] = "1.2"
    migrated_site = [enrich(project, overrides) for project in site["projects"]]
    site["projects"] = [project for project, excluded in migrated_site if not excluded]
    site["stats"]["published"] = len(site["projects"])
    write(site_path, site)

    catalog_path = ROOT / "data" / "catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    catalog["projects"] = [
        enrich(project, overrides, keep_excluded=True)[0]
        for project in catalog["projects"]
    ]
    write(catalog_path, catalog)


if __name__ == "__main__":
    main()
