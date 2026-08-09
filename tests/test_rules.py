from __future__ import annotations

import unittest

from collector.rules import classify


def repository(**changes: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": 1,
        "name": "example",
        "full_name": "owner/example",
        "description": "An AI agent framework with MCP server support",
        "topics": ["ai-agent", "mcp-server"],
        "archived": False,
        "fork": False,
    }
    base.update(changes)
    return base


class ClassificationTests(unittest.TestCase):
    def test_project_can_have_multiple_capabilities(self) -> None:
        result = classify(repository(), "A model context protocol server for an agent framework")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertIn("Agent Core", result.capabilities)
        self.assertIn("MCP & Connectors", result.capabilities)

    def test_ambiguous_human_agent_is_rejected(self) -> None:
        result = classify(
            repository(description="CRM for real estate agent", topics=[], name="sales-agent"),
            "Manage leads for every real estate agent.",
        )
        self.assertIsNone(result)

    def test_research_tool_is_classified(self) -> None:
        result = classify(
            repository(description="Research assistant for literature review and citation", topics=["research-assistant"]),
            "Search papers and manage bibliography for academic writing.",
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.primary_capability, "Research & Learning")
        self.assertIn("论文检索与阅读", result.research_use_cases)

    def test_override_can_force_classification(self) -> None:
        result = classify(
            repository(description="Small utility", topics=[]),
            "",
            {"capabilities": ["Skills & Prompts"], "primary_capability": "Skills & Prompts"},
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.primary_capability, "Skills & Prompts")

    def test_generic_awesome_list_is_not_classified_from_readme_mentions(self) -> None:
        result = classify(
            repository(
                name="awesome-python",
                description="An opinionated list of Python frameworks and libraries",
                topics=["awesome", "python"],
            ),
            "Includes an AI agent framework, an MCP server, observability and sandbox tools.",
        )
        self.assertIsNone(result)

    def test_repository_metadata_outranks_broad_readme_mentions(self) -> None:
        result = classify(
            repository(
                name="awesome-mcp-servers",
                description="A collection of MCP servers",
                topics=["ai", "mcp"],
            ),
            "Includes AI agent, multi-agent and coding agent projects.",
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.primary_capability, "MCP & Connectors")


if __name__ == "__main__":
    unittest.main()
