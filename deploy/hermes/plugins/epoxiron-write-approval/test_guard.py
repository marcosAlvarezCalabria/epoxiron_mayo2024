"""Unit tests for the Epoxiron write-approval classifier."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


PLUGIN_PATH = Path(__file__).with_name("__init__.py")
SPEC = importlib.util.spec_from_file_location("epoxiron_write_approval", PLUGIN_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load Epoxiron guardrail plugin")
PLUGIN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PLUGIN)


class EpoxironWriteApprovalTests(unittest.TestCase):
    def requires_approval(self, command: str) -> bool:
        return PLUGIN._requires_write_approval("terminal", {"command": command})

    def test_allows_delivery_note_get(self) -> None:
        self.assertFalse(
            self.requires_approval(
                "curl --config secret.conf http://api:3001/api/hermes-tools/delivery-notes"
            )
        )

    def test_requires_approval_for_explicit_post(self) -> None:
        self.assertTrue(
            self.requires_approval(
                "curl -X POST http://api:3001/api/hermes-tools/delivery-notes -d '{}'"
            )
        )

    def test_requires_approval_when_data_implies_post(self) -> None:
        self.assertTrue(
            self.requires_approval(
                "curl http://api:3001/api/hermes-tools/delivery-notes --json '{}'"
            )
        )

    def test_requires_approval_for_status_patch(self) -> None:
        self.assertTrue(
            self.requires_approval(
                "curl --request=PATCH http://api:3001/api/hermes-tools/delivery-notes/id/status -d '{}'"
            )
        )

    def test_requires_approval_for_ambiguous_alternate_client(self) -> None:
        self.assertTrue(
            self.requires_approval(
                "python client.py http://api:3001/api/hermes-tools/delivery-notes"
            )
        )

    def test_ignores_read_only_price_calculation(self) -> None:
        self.assertFalse(
            self.requires_approval(
                "curl -X POST http://api:3001/api/hermes-tools/calculate-price -d '{}'"
            )
        )

    def test_ignores_non_terminal_tools(self) -> None:
        self.assertFalse(
            PLUGIN._requires_write_approval(
                "skill_view",
                {"command": "curl -X POST http://api:3001/api/hermes-tools/delivery-notes"},
            )
        )

    def test_each_write_uses_its_tool_call_as_the_approval_scope(self) -> None:
        command = "curl -X POST http://api:3001/api/hermes-tools/delivery-notes -d '{}'"
        first = PLUGIN._guard_epoxiron_write(
            "terminal", {"command": command}, tool_call_id="call-one"
        )
        second = PLUGIN._guard_epoxiron_write(
            "terminal", {"command": command}, tool_call_id="call-two"
        )

        self.assertEqual(
            first["rule_key"], "epoxiron:delivery-note-write:call-one"
        )
        self.assertEqual(
            second["rule_key"], "epoxiron:delivery-note-write:call-two"
        )
        self.assertNotEqual(first["rule_key"], second["rule_key"])


if __name__ == "__main__":
    unittest.main()
