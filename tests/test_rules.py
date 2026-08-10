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

    def test_agent_focused_awesome_list_is_excluded_unless_explicitly_allowed(self) -> None:
        repo = repository(
            name="awesome-agent-tools",
            description="A collection of AI agent skills and MCP servers",
            topics=["ai-agent", "mcp-server"],
        )
        self.assertIsNone(classify(repo, "Agent skill and agent framework catalog."))
        official = classify(
            repo,
            "Agent skill and agent framework catalog.",
            {"include_resource": True, "ecosystem_layer": "MCP & Connectors"},
        )
        self.assertIsNotNone(official)

    def test_repository_metadata_outranks_broad_readme_mentions(self) -> None:
        result = classify(
            repository(
                name="mcp-toolkit",
                description="An MCP server toolkit",
                topics=["ai", "mcp"],
            ),
            "Includes AI agent, multi-agent and coding agent projects.",
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.primary_capability, "MCP & Connectors")
        self.assertEqual(result.ecosystem_layer, "MCP & Connectors")
        self.assertEqual(result.project_subtype, "MCP Server")

    def test_agent_subtypes_are_separate_from_functional_capabilities(self) -> None:
        result = classify(
            repository(
                description="A coding agent for software engineering with browser automation",
                topics=["ai-agent", "coding-agent", "browser-automation"],
            ),
            "Runs coding tasks and can use a browser.",
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.ecosystem_layer, "Agents")
        self.assertEqual(result.project_subtype, "Coding Agent")
        self.assertIn("Browser & Computer Use", result.functional_capabilities)
        self.assertIn("Coding", result.use_cases)

    def test_skill_and_infrastructure_layers_are_detected(self) -> None:
        skill = classify(repository(description="Agent skill pack for Claude skills", topics=["agent-skills"]), "")
        memory = classify(repository(description="Agent memory and observability infrastructure", topics=["agent-memory"]), "")
        assert skill is not None and memory is not None
        self.assertEqual((skill.ecosystem_layer, skill.project_subtype), ("Skills & Plugins", "Agent Skill"))
        self.assertEqual(memory.ecosystem_layer, "Infrastructure")

    def test_manual_summary_and_feature_evidence_are_explicit(self) -> None:
        result = classify(
            repository(description="An AI agent framework", topics=["agent-framework"]),
            "Install the CLI with Docker. Includes a REST API and web UI.",
            {"summary_zh": "用于构建本地 Agent 的开源框架。"},
        )
        assert result is not None
        self.assertEqual(result.summary_source, "manual")
        self.assertTrue(result.features["docker"])
        self.assertTrue(result.features["api"])


if __name__ == "__main__":
    unittest.main()
