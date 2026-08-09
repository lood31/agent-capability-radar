from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from collector.models import Growth


class HistoryStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._records: dict[int, list[tuple[datetime, int]]] = defaultdict(list)
        self._load()

    def _load(self) -> None:
        if not self.root.exists():
            return
        cutoff = datetime.now(UTC) - timedelta(days=35)
        for path in sorted(self.root.glob("*.jsonl")):
            for line in path.read_text(encoding="utf-8").splitlines():
                try:
                    raw = json.loads(line)
                    captured = datetime.fromisoformat(raw["captured_at"].replace("Z", "+00:00"))
                    if captured >= cutoff:
                        self._records[int(raw["repo_id"])].append((captured, int(raw["stars"])))
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue
        for records in self._records.values():
            records.sort(key=lambda item: item[0])

    def growth_for(self, repo_id: int, stars: int, now: datetime) -> Growth:
        records = self._records.get(repo_id, [])

        def delta(days: int) -> int | None:
            target = now - timedelta(days=days)
            eligible = [item for item in records if item[0] <= target]
            return max(0, stars - eligible[-1][1]) if eligible else None

        day_1 = delta(1)
        day_7 = delta(7)
        day_30 = delta(30)
        baseline_7 = stars - day_7 if day_7 is not None else 0
        percent_7 = round(day_7 / baseline_7 * 100, 2) if day_7 is not None and baseline_7 else None

        daily: dict[str, int] = {}
        for captured, count in records:
            daily[captured.date().isoformat()] = count
        daily[now.date().isoformat()] = stars
        sparkline = list(daily.values())[-30:]
        return Growth(day_1, day_7, day_30, percent_7, sparkline)

    def append(self, repositories: list[dict[str, Any]], now: datetime) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        path = self.root / f"{now:%Y-%m}.jsonl"
        captured_at = now.isoformat().replace("+00:00", "Z")
        lines = [
            json.dumps(
                {
                    "captured_at": captured_at,
                    "repo_id": int(repo["id"]),
                    "full_name": repo["full_name"],
                    "stars": int(repo.get("stargazers_count", 0)),
                },
                ensure_ascii=False,
                separators=(",", ":"),
            )
            for repo in repositories
        ]
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            for line in lines:
                handle.write(line + "\n")

    @property
    def history_days(self) -> int:
        dates = {captured.date() for records in self._records.values() for captured, _ in records}
        return len(dates)

