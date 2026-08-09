from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class GitHubError(RuntimeError):
    """Raised when the GitHub API cannot provide a valid response."""


class GitHubClient:
    def __init__(self, token: str | None, timeout: float = 25.0) -> None:
        self.timeout = timeout
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "agent-capability-radar/0.1",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def _request(self, path: str, *, accept: str | None = None) -> Any:
        headers = dict(self.headers)
        if accept:
            headers["Accept"] = accept
        request = urllib.request.Request(f"https://api.github.com{path}", headers=headers)
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    payload = response.read()
                    if accept and "raw" in accept:
                        return payload.decode("utf-8", errors="replace")
                    return json.loads(payload)
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    return None
                last_error = error
                if error.code not in {429, 500, 502, 503, 504}:
                    break
            except (urllib.error.URLError, TimeoutError) as error:
                last_error = error
            if attempt < 2:
                time.sleep(2**attempt)
        raise GitHubError(f"GitHub API request failed for {path}: {last_error}")

    def search(self, query: str, *, limit: int = 50) -> list[dict[str, Any]]:
        params = urllib.parse.urlencode({"q": query, "sort": "stars", "order": "desc", "per_page": min(limit, 100)})
        payload = self._request(f"/search/repositories?{params}")
        if not isinstance(payload, dict):
            raise GitHubError(f"Unexpected search response for {query!r}")
        return list(payload.get("items") or [])[:limit]

    def repository(self, full_name: str) -> dict[str, Any] | None:
        encoded = "/".join(urllib.parse.quote(part, safe="") for part in full_name.split("/", 1))
        payload = self._request(f"/repos/{encoded}")
        return payload if isinstance(payload, dict) else None

    def readme(self, full_name: str) -> str:
        encoded = "/".join(urllib.parse.quote(part, safe="") for part in full_name.split("/", 1))
        payload = self._request(f"/repos/{encoded}/readme", accept="application/vnd.github.raw+json")
        return payload if isinstance(payload, str) else ""

    def rate_limit(self) -> dict[str, Any]:
        payload = self._request("/rate_limit")
        return payload if isinstance(payload, dict) else {}

