import json
from pathlib import Path

src = Path(r"c:\Project files\Jul-2026\plcm-frontend\docs\qa-audit\qa_live_results.json")
dst = Path(r"c:\Project files\Jul-2026\plcm-frontend\docs\qa-audit\TEST_EXECUTION_LOG.md")
d = json.loads(src.read_text(encoding="utf-8"))


def cell(s, n=160):
    return str(s or "").replace("|", "/").replace("\n", " ")[:n]


lines = [
    "# Live Test Execution Log",
    "",
    f"**Run prefix:** `{d.get('prefix')}`",
    "",
    "Method: HTTP API against `http://127.0.0.1:8000/api` plus PostgreSQL verification.",
    "",
    "| Test ID | Requirement ID | Role | Scenario | Expected | Actual | Result | Severity | Module |",
    "|---------|----------------|------|----------|----------|--------|--------|----------|--------|",
]
for r in d["results"]:
    lines.append(
        "| {test_id} | {requirement_id} | {role} | {scenario} | {expected} | {actual} | {result} | {severity} | {module} |".format(
            test_id=r["test_id"],
            requirement_id=r["requirement_id"],
            role=r["role"],
            scenario=cell(r["scenario"]),
            expected=cell(r["expected"], 80),
            actual=cell(r["actual"], 120),
            result=r["result"],
            severity=r.get("severity") or "",
            module=r.get("module") or "",
        )
    )
dst.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", dst, "rows", len(d["results"]))
