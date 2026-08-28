"""Human-in-the-loop guardrail for Epoxiron delivery-note writes."""

from __future__ import annotations

import re
import secrets
from typing import Any


_DELIVERY_NOTES_ENDPOINT = "/api/hermes-tools/delivery-notes"
_CURL_COMMAND = re.compile(r"(?:^|[;&|]\s*|\s)curl(?:\s|$)", re.IGNORECASE)
_MUTATING_CURL_ARGUMENT = re.compile(
    r"(?:^|\s)(?:"
    r"(?:-X|--request)(?:=|\s+)(?:POST|PUT|PATCH|DELETE)\b"
    r"|-d(?=\s|=|['\"@{]|$)"
    r"|--data(?:-ascii|-binary|-raw|-urlencode)?(?=\s|=|$)"
    r"|--json(?=\s|=|$)"
    r"|-F(?=\s|=|['\"]|$)"
    r"|--form(?:-string)?(?=\s|=|$)"
    r"|-T(?=\s|=|$)"
    r"|--upload-file(?=\s|=|$)"
    r")",
    re.IGNORECASE,
)


def _requires_write_approval(tool_name: str, args: dict[str, Any]) -> bool:
    """Return true unless an Epoxiron delivery-note call is clearly read-only."""
    if tool_name != "terminal":
        return False

    command = args.get("command")
    if not isinstance(command, str):
        return False

    normalized = command.lower()
    if _DELIVERY_NOTES_ENDPOINT not in normalized:
        return False

    # Plain curl without a body or mutating method is GET/HEAD and may proceed.
    # Anything ambiguous is approval-gated so alternate clients cannot silently
    # bypass the policy.
    return not (
        _CURL_COMMAND.search(command)
        and not _MUTATING_CURL_ARGUMENT.search(command)
    )


def _guard_epoxiron_write(
    tool_name: str,
    args: dict[str, Any],
    task_id: str = "",
    **kwargs: Any,
) -> dict[str, str] | None:
    del task_id
    if not _requires_write_approval(tool_name, args):
        return None

    # A unique key prevents "approve for session/always" from silently
    # authorizing a later write. Every mutation must receive a fresh decision.
    tool_call_id = str(kwargs.get("tool_call_id") or "").strip()
    approval_id = tool_call_id or secrets.token_hex(12)

    return {
        "action": "approve",
        "message": (
            "Epoxiron va a crear o modificar un albaran. "
            "Aprueba solo despues de revisar el resumen calculado por la API."
        ),
        "rule_key": f"epoxiron:delivery-note-write:{approval_id}",
    }


def register(ctx: Any) -> None:
    """Register the policy hook with Hermes."""
    ctx.register_hook("pre_tool_call", _guard_epoxiron_write)
