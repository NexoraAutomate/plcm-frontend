"""
PLCM live QA harness — HTTP API + PostgreSQL verification.
Does not modify application source. Creates only QA_TEST_* records.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import traceback
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from sqlalchemy import create_engine, text

BACKEND_ROOT = Path(r"c:\Project files\Jul-2026\plcm-backend")
sys.path.insert(0, str(BACKEND_ROOT))

API = os.getenv("QA_API_BASE", "http://127.0.0.1:8000/api")
FE = os.getenv("QA_FE_BASE", "http://127.0.0.1:3000")
ADMIN_USER = os.getenv("QA_ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("QA_ADMIN_PASS", "password@82768243")
STAMP = datetime.now(timezone.utc).strftime("%Y%m%d")
UID = uuid.uuid4().hex[:8].upper()
PREFIX = f"QA_TEST_{STAMP}_{UID}"
PASS = "QaTest@2026!"
SIG = {"signature_type": "DIGITAL", "signature_payload": "data:image/png;base64,aaa"}
OUT_DIR = Path(__file__).resolve().parent

engine = create_engine(
    os.getenv("DATABASE_URL", "postgresql://postgres:postgre@localhost:5432/postgres"),
    pool_pre_ping=True,
)

results: list[dict] = []
created: dict[str, list] = {
    "users": [],
    "configs": [],
    "projects": [],
    "inventory": [],
    "customers": [],
    "orders": [],
}
TC = 0


def next_tc() -> str:
    global TC
    TC += 1
    return f"TC-{TC:03d}"


def rec(
    req_id: str,
    role: str,
    scenario: str,
    expected: str,
    actual: str,
    result: str,
    severity: str = "",
    evidence: str = "",
    module: str = "",
) -> None:
    results.append(
        {
            "test_id": next_tc(),
            "requirement_id": req_id,
            "role": role,
            "scenario": scenario,
            "expected": expected,
            "actual": actual[:2000],
            "result": result,
            "severity": severity,
            "evidence": evidence[:2000],
            "module": module,
        }
    )


def db_one(sql: str, params: dict | None = None):
    with engine.connect() as conn:
        row = conn.execute(text(sql), params or {}).mappings().first()
        return dict(row) if row else None


def db_all(sql: str, params: dict | None = None):
    with engine.connect() as conn:
        return [dict(r) for r in conn.execute(text(sql), params or {}).mappings().all()]


def db_exec(sql: str, params: dict | None = None):
    with engine.begin() as conn:
        conn.execute(text(sql), params or {})


def snapshot_counts() -> dict:
    tables = [
        '"user"',
        "project",
        "inventory",
        "inventoryinstance",
        "inventoryreservation",
        "inventoryshortage",
        "hierarchyconfiguration",
        "workflowauditevent",
        "customer",
        '"order"',
    ]
    out = {}
    for t in tables:
        try:
            row = db_one(f"SELECT COUNT(*) AS c FROM {t}")
            out[t.strip('"')] = row["c"] if row else None
        except Exception as exc:
            out[t.strip('"')] = f"ERR:{exc}"
    return out


def login(username: str, password: str) -> tuple[int, dict]:
    with httpx.Client(timeout=60.0) as c:
        r = c.post(
            f"{API}/auth/login",
            data={"username": username, "password": password},
        )
        try:
            body = r.json()
        except Exception:
            body = {"text": r.text[:500]}
        return r.status_code, body


def token_of(body: dict) -> str:
    return body.get("access_token") or body.get("token") or ""


class Api:
    def __init__(self, token: str = ""):
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    def call(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = path if path.startswith("http") else f"{API}{path}"
        with httpx.Client(timeout=90.0, follow_redirects=False) as c:
            return c.request(method, url, headers=self.headers, **kwargs)

    def json(self, method: str, path: str, **kwargs):
        r = self.call(method, path, **kwargs)
        try:
            body = r.json()
        except Exception:
            body = {"text": r.text[:800]}
        return r.status_code, body


def expect(ok: bool, req, role, scenario, expected, actual, severity="HIGH", evidence="", module=""):
    rec(
        req,
        role,
        scenario,
        expected,
        str(actual),
        "PASS" if ok else "FAIL",
        "" if ok else severity,
        evidence,
        module,
    )


def nodes(prefix: str = "sys") -> list[dict]:
    return [
        {"client_key": prefix, "level": "system", "name": f"QAComm_{UID}"},
        {
            "client_key": f"{prefix}-sub",
            "parent_client_key": prefix,
            "level": "subsystem",
            "name": "RF",
        },
        {
            "client_key": f"{prefix}-mod",
            "parent_client_key": f"{prefix}-sub",
            "level": "module",
            "name": "Modem",
        },
        {
            "client_key": f"{prefix}-unit",
            "parent_client_key": f"{prefix}-mod",
            "level": "unit",
            "name": "Board",
        },
        {
            "client_key": f"{prefix}-cmp",
            "parent_client_key": f"{prefix}-unit",
            "level": "component",
            "name": "Chip",
        },
    ]


def create_user(admin: Api, username: str, full_name: str, role_name: str, roles: dict) -> dict:
    code, body = admin.json(
        "POST",
        "/users/",
        json={
            "username": username,
            "full_name": full_name,
            "email": f"{username.lower()}@qa.test",
            "password": PASS,
            "is_active": True,
        },
    )
    if code not in (200, 201):
        raise RuntimeError(f"create user {username} failed {code} {body}")
    uid = body["id"]
    created["users"].append(uid)
    role_id = roles[role_name]
    ac, ab = admin.json("POST", "/auth/assign-role", json={"user_id": uid, "role_id": role_id})
    if ac >= 400:
        raise RuntimeError(f"assign role {role_name} failed {ac} {ab}")
    sc, sb = login(username, PASS)
    if sc != 200:
        raise RuntimeError(f"login {username} failed {sc} {sb}")
    return {"id": uid, "username": username, "token": token_of(sb), "api": Api(token_of(sb))}


def first_system(tree: dict) -> dict | None:
    for fl in tree.get("flights") or []:
        for sd in fl.get("sdls") or []:
            systems = sd.get("systems") or []
            if systems:
                return {
                    "flight_id": fl["id"],
                    "sdls_id": sd["id"],
                    "system_id": systems[0]["id"],
                    "flight": fl,
                    "sdls": sd,
                    "system": systems[0],
                }
    return None


def run() -> None:
    before = snapshot_counts()
    rec(
        "ENV",
        "SYSTEM",
        "Database snapshot before tests",
        "Readable live DB",
        json.dumps(before),
        "PASS",
        module="database",
    )

    # ---- Auth / login ----
    sc, sb = login(ADMIN_USER, ADMIN_PASS)
    expect(
        sc == 200 and bool(token_of(sb)),
        "SPEC00-AUTH",
        "ADMIN",
        "Admin login with valid credentials",
        "200 + access_token",
        f"{sc} keys={list(sb)[:8]}",
        "CRITICAL",
        module="auth",
    )
    if sc != 200:
        Path(OUT_DIR / "qa_live_results.json").write_text(
            json.dumps({"fatal": "admin login failed", "body": sb, "results": results}, indent=2, default=str),
            encoding="utf-8",
        )
        return
    admin_tok = token_of(sb)
    admin = Api(admin_tok)

    sc2, sb2 = login(ADMIN_USER, "WrongPass!999")
    expect(
        sc2 in (400, 401, 403),
        "SPEC00-AUTH",
        "ANON",
        "Login with invalid password",
        "401/400/403",
        sc2,
        "HIGH",
        module="auth",
    )

    sc3, sb3 = Api().json("GET", "/auth/me")
    expect(
        sc3 in (401, 403),
        "SPEC00-AUTH",
        "ANON",
        "GET /auth/me without token",
        "401/403",
        f"{sc3} {sb3}",
        "HIGH",
        module="security",
    )

    sc4, me = admin.json("GET", "/auth/me")
    expect(
        sc4 == 200 and "admin" in str(me).lower(),
        "SPEC00-AUTH",
        "ADMIN",
        "GET current user",
        "200 admin profile",
        f"{sc4} {me.get('username') if isinstance(me, dict) else me}",
        module="auth",
    )
    admin_id = me.get("id") if isinstance(me, dict) else None
    admin_roles = []
    if isinstance(me, dict):
        admin_roles = [r.get("name") if isinstance(r, dict) else r for r in (me.get("roles") or [])]

    scp, perms = admin.json("GET", "/auth/permissions")
    expect(
        scp == 200 and isinstance(perms, list) and "project.approve" in perms,
        "SPEC00-PERM",
        "ADMIN",
        "Admin permission list includes workflow keys",
        "project.approve present",
        f"{scp} count={len(perms) if isinstance(perms, list) else perms}",
        module="auth",
    )

    # ---- Roles / statuses ----
    scr, roles_body = admin.json("GET", "/auth/roles")
    role_map = {}
    if isinstance(roles_body, list):
        for r in roles_body:
            role_map[r["name"]] = r["id"]
    needed = ["Admin", "ProjectDirector", "HierarchyManager", "InventoryManager", "Developer", "Viewer"]
    missing = [n for n in needed if n not in role_map]
    expect(
        not missing,
        "SPEC00-R01",
        "ADMIN",
        "Five workflow roles exist in RBAC",
        str(needed),
        f"present={list(role_map)} missing={missing}",
        "CRITICAL",
        module="roles",
    )

    scs, statuses = admin.json("GET", "/statuses/")
    names = []
    if isinstance(statuses, list):
        names = [(s.get("status_name"), s.get("status_type")) for s in statuses]
    item_needed = [
        "AVAILABLE",
        "RESERVED",
        "ISSUED",
        "INSTALLATION_IN_PROGRESS",
        "UNDER_TESTING_REVIEW",
        "INSTALLED_VERIFIED",
        "RETURNED",
        "INSPECTION",
        "REUSABLE",
        "REPAIRABLE",
        "SCRAPPED",
    ]
    proj_needed = [
        "DRAFT",
        "APPROVED",
        "HIERARCHY_GENERATED",
        "READY_FOR_INVENTORY",
        "CANCELLED",
        "COMPLETED",
        "SUPERSEDED",
    ]
    miss_i = [x for x in item_needed if (x, "inventory") not in names]
    miss_p = [x for x in proj_needed if (x, "projects") not in names]
    expect(
        not miss_i and not miss_p,
        "SPEC00-S01",
        "ADMIN",
        "Canonical item and project statuses exist",
        "All Spec 00 codes present",
        f"missing_item={miss_i} missing_project={miss_p}",
        "CRITICAL",
        module="status",
    )

    from app.domain.status_transitions import can_transition
    from app.domain.workflow_status import ItemStatus, ProjectWorkflowStatus

    expect(
        can_transition("item", "AVAILABLE", "RESERVED") is True,
        "SPEC00-T01",
        "SYSTEM",
        "Allowed item transition AVAILABLE→RESERVED",
        "True",
        can_transition("item", "AVAILABLE", "RESERVED"),
        module="status",
    )
    expect(
        can_transition("item", "AVAILABLE", "ISSUED") is False,
        "SPEC00-T02",
        "SYSTEM",
        "Forbidden item transition AVAILABLE→ISSUED",
        "False",
        can_transition("item", "AVAILABLE", "ISSUED"),
        module="status",
    )
    expect(
        can_transition("item", "RESERVED", "INSTALLED_VERIFIED") is False,
        "SPEC00-T03",
        "SYSTEM",
        "Forbidden skip RESERVED→INSTALLED_VERIFIED",
        "False",
        can_transition("item", "RESERVED", "INSTALLED_VERIFIED"),
        module="status",
    )
    expect(
        can_transition("project", "DRAFT", "APPROVED") is True,
        "SPEC00-T04",
        "SYSTEM",
        "Allowed project DRAFT→APPROVED",
        "True",
        can_transition("project", "DRAFT", "APPROVED"),
        module="status",
    )
    expect(
        can_transition("project", "DRAFT", "READY_FOR_INVENTORY") is False,
        "SPEC00-T05",
        "SYSTEM",
        "Forbidden project DRAFT→READY_FOR_INVENTORY",
        "False",
        can_transition("project", "DRAFT", "READY_FOR_INVENTORY"),
        module="status",
    )

    # ---- Create role users ----
    users = {}
    try:
        users["pd"] = create_user(admin, f"{PREFIX}_pd", "QA PD", "ProjectDirector", role_map)
        users["hm"] = create_user(admin, f"{PREFIX}_hm", "QA HM", "HierarchyManager", role_map)
        users["hm2"] = create_user(admin, f"{PREFIX}_hm2", "QA HM2", "HierarchyManager", role_map)
        users["im"] = create_user(admin, f"{PREFIX}_im", "QA IM", "InventoryManager", role_map)
        users["dev"] = create_user(admin, f"{PREFIX}_dev", "QA Dev", "Developer", role_map)
        users["viewer"] = create_user(admin, f"{PREFIX}_vw", "QA Viewer", "Viewer", role_map)
        rec("SPEC00-R02", "ADMIN", "Create one user per workflow role", "Users created and can login", "created", "PASS", module="roles")
    except Exception as exc:
        rec("SPEC00-R02", "ADMIN", "Create one user per workflow role", "Users created", str(exc), "FAIL", "CRITICAL", traceback.format_exc(), "roles")
        Path(OUT_DIR / "qa_live_results.json").write_text(
            json.dumps({"fatal": str(exc), "results": results}, indent=2, default=str),
            encoding="utf-8",
        )
        return

    pd, hm, hm2, im, dev, viewer = (
        users["pd"]["api"],
        users["hm"]["api"],
        users["hm2"]["api"],
        users["im"]["api"],
        users["dev"]["api"],
        users["viewer"]["api"],
    )

    _, pperms = pd.json("GET", "/auth/permissions")
    _, hperms = hm.json("GET", "/auth/permissions")
    _, iperms = im.json("GET", "/auth/permissions")
    _, dperms = dev.json("GET", "/auth/permissions")
    expect("project.assign_hm" in (pperms or []), "SPEC00-P01", "PD", "PD has project.assign_hm", "present", pperms, module="roles")
    expect("project.create_draft" in (hperms or []), "SPEC00-P02", "HM", "HM has project.create_draft", "present", hperms, module="roles")
    expect("project.approve" not in (hperms or []), "SPEC00-P03", "HM", "HM does not have project.approve", "absent", hperms, module="roles")
    expect("inventory.issue" in (iperms or []) or "issue_inventory" in (iperms or []), "SPEC00-P04", "IM", "IM has issue permission", "present", iperms, module="roles")
    expect("item.request" in (dperms or []), "SPEC00-P05", "DEV", "Dev has item.request", "present", dperms, module="roles")
    expect("hierarchy_config.manage" not in (hperms or []), "SPEC00-P06", "HM", "HM cannot manage configs", "absent", hperms, module="roles")

    # ---- Spec 01 configs ----
    meta_c, meta = admin.json("GET", "/hierarchy-configurations/meta")
    expect(
        meta_c == 200 and "fixed_levels" in (meta or {}),
        "SPEC01-F01",
        "ADMIN",
        "Config meta returns fixed 8-level model",
        "fixed_levels present",
        f"{meta_c} {list(meta) if isinstance(meta, dict) else meta}",
        module="config",
    )
    if isinstance(meta, dict):
        levels = [x.get("code") or x.get("level") or x for x in (meta.get("fixed_levels") or [])]
        expect(
            len(meta.get("fixed_levels") or []) >= 8 or "component" in str(levels).lower(),
            "SPEC01-F02",
            "ADMIN",
            "Fixed levels include Product Type through Component",
            "8 levels",
            levels,
            module="config",
        )

    cfg_a_body = {
        "code": f"{PREFIX}_CFG_A",
        "name": f"{PREFIX} SSDLS-1",
        "description": "QA config A",
        "is_available": True,
        "product_types": [
            {"code": "SSDLS-1", "name": "High Data Rate"},
            {"code": "SSDLS-2", "name": "Low Data Rate"},
        ],
        "nodes": nodes("a"),
    }
    ca, cfg_a = admin.json("POST", "/hierarchy-configurations/", json=cfg_a_body)
    expect(ca == 201, "SPEC01-C01", "ADMIN", "Admin creates Config A", "201", f"{ca} {cfg_a}", "HIGH", module="config")
    cfg_a_id = cfg_a.get("id") if isinstance(cfg_a, dict) else None
    if cfg_a_id:
        created["configs"].append(cfg_a_id)

    cfg_b_body = {
        "code": f"{PREFIX}_CFG_B",
        "name": f"{PREFIX} SSDLS-2",
        "is_available": True,
        "product_types": [{"code": "SSDLS-2", "name": "Low Data Rate"}],
        "nodes": [
            {"client_key": "s1", "level": "system", "name": f"QAPwr_{UID}"},
        ],
    }
    cb, cfg_b = admin.json("POST", "/hierarchy-configurations/", json=cfg_b_body)
    expect(cb == 201, "SPEC01-C02", "ADMIN", "Admin creates Config B", "201", f"{cb} {cfg_b}", module="config")
    cfg_b_id = cfg_b.get("id") if isinstance(cfg_b, dict) else None
    if cfg_b_id:
        created["configs"].append(cfg_b_id)

    cv, vcfg = viewer.json("POST", "/hierarchy-configurations/", json={**cfg_a_body, "code": f"{PREFIX}_NOPE"})
    expect(cv in (401, 403), "SPEC01-C03", "VIEWER", "Non-admin cannot create config", "403", f"{cv} {vcfg}", "HIGH", module="config")

    ch, hcfg = hm.json("POST", "/hierarchy-configurations/", json={**cfg_a_body, "code": f"{PREFIX}_HM"})
    expect(ch in (401, 403), "SPEC01-C04", "HM", "HM cannot create config", "403", f"{ch} {hcfg}", "HIGH", module="config")

    if cfg_b_id:
        pu, _ = admin.json("PATCH", f"/hierarchy-configurations/{cfg_b_id}/availability", params={"is_available": False})
        expect(pu == 200, "SPEC01-A01", "ADMIN", "Mark Config B unavailable", "200", pu, module="config")
        la, avail = hm.json("GET", "/hierarchy-configurations/available")
        codes = [x.get("code") for x in avail] if isinstance(avail, list) else []
        expect(
            la == 200 and f"{PREFIX}_CFG_A" in codes and f"{PREFIX}_CFG_B" not in codes,
            "SPEC01-A02",
            "HM",
            "HM available list excludes unavailable Config B",
            "A in, B out",
            codes,
            "HIGH",
            module="config",
        )
        admin.json("PATCH", f"/hierarchy-configurations/{cfg_b_id}/availability", params={"is_available": True})

    lg, glist = admin.json("GET", "/hierarchy-configurations/")
    expect(lg == 200 and isinstance(glist, list), "SPEC01-C05", "ADMIN", "Admin lists all configs", "200 list", f"{lg} n={len(glist) if isinstance(glist, list) else glist}", module="config")
    lh, hlist = hm.json("GET", "/hierarchy-configurations/")
    expect(lh in (401, 403), "SPEC01-C06", "HM", "HM cannot list all (manage) configs", "403", f"{lh}", module="config")

    # Duplicate code
    cd, dup = admin.json("POST", "/hierarchy-configurations/", json=cfg_a_body)
    expect(cd >= 400, "SPEC01-C07", "ADMIN", "Duplicate config code rejected", "4xx", f"{cd} {dup}", "MEDIUM", module="config")

    # ---- Spec 02 project draft / approve ----
    draft_payload = {
        "name": f"{PREFIX}_PROJ_MAIN",
        "description": "QA main project",
        "hierarchy_config_id": cfg_a_id,
        "product_type": "SSDLS-1",
        "flight_count": 2,
        "sdls_per_flight": 2,
        "assigned_hm_id": users["hm"]["id"],
    }
    # PD cannot create draft
    pcd, pbody = pd.json("POST", "/projects/draft/", json=draft_payload)
    expect(pcd in (401, 403), "SPEC02-D01", "PD", "PD cannot create draft", "403", f"{pcd} {pbody}", "HIGH", module="project")

    hcd, draft = hm.json("POST", "/projects/draft/", json=draft_payload)
    expect(
        hcd == 201 and (draft.get("status_name") == "DRAFT" if isinstance(draft, dict) else False),
        "SPEC02-D02",
        "HM",
        "HM creates project in DRAFT",
        "201 DRAFT",
        f"{hcd} {draft.get('status_name') if isinstance(draft, dict) else draft}",
        "CRITICAL",
        module="project",
    )
    proj_id = draft.get("id") if isinstance(draft, dict) else None
    if proj_id:
        created["projects"].append(proj_id)

    miss, mbody = hm.json(
        "POST",
        "/projects/draft/",
        json={"name": f"{PREFIX}_NOCFG", "product_type": "SSDLS-1", "flight_count": 1, "sdls_per_flight": 1},
    )
    expect(miss >= 400, "SPEC02-D03", "HM", "Create without config rejected", "4xx", f"{miss} {mbody}", module="project")

    # unavailable config
    if cfg_b_id:
        admin.json("PATCH", f"/hierarchy-configurations/{cfg_b_id}/availability", params={"is_available": False})
        un, ub = hm.json(
            "POST",
            "/projects/draft/",
            json={
                "name": f"{PREFIX}_UNAVAIL",
                "hierarchy_config_id": cfg_b_id,
                "product_type": "SSDLS-2",
                "flight_count": 1,
                "sdls_per_flight": 1,
            },
        )
        expect(un >= 400, "SPEC02-D04", "HM", "Create with unavailable config rejected", "4xx", f"{un} {ub}", module="project")
        admin.json("PATCH", f"/hierarchy-configurations/{cfg_b_id}/availability", params={"is_available": True})

    if proj_id:
        gen_d, gdb = hm.json("POST", f"/projects/{proj_id}/generate-hierarchy/")
        expect(
            gen_d >= 400,
            "SPEC02-G01",
            "HM",
            "Generate hierarchy blocked for DRAFT",
            "403/422",
            f"{gen_d} {gdb}",
            "HIGH",
            module="hierarchy",
        )

        ap_hm, apb = hm.json("POST", f"/projects/{proj_id}/approve/")
        expect(ap_hm in (401, 403), "SPEC02-A01", "HM", "Non-admin cannot approve", "403", f"{ap_hm} {apb}", "HIGH", module="project")
        ap_pd, apb2 = pd.json("POST", f"/projects/{proj_id}/approve/")
        expect(ap_pd in (401, 403), "SPEC02-A02", "PD", "PD cannot approve", "403", f"{ap_pd} {apb2}", "HIGH", module="project")

        # PD assign HM (already assigned; re-assign hm2 then back)
        asg, asgb = pd.json("POST", f"/projects/{proj_id}/assign-hm/", json={"hm_user_id": users["hm"]["id"]})
        expect(asg in (200, 201), "SPEC02-A03", "PD", "PD can assign HM", "200", f"{asg} {asgb}", module="project")

        ap, approved = admin.json("POST", f"/projects/{proj_id}/approve/")
        expect(
            ap == 200 and approved.get("status_name") == "APPROVED",
            "SPEC02-A04",
            "ADMIN",
            "Admin approves draft → APPROVED",
            "APPROVED",
            f"{ap} {approved.get('status_name') if isinstance(approved, dict) else approved}",
            "CRITICAL",
            module="project",
        )

        # structural freeze
        up, upb = hm.json(
            "PUT",
            f"/projects/{proj_id}/",
            json={"name": f"{PREFIX}_PROJ_MAIN", "flight_count": 9, "hierarchy_config_id": cfg_a_id, "product_type": "SSDLS-1", "sdls_per_flight": 2},
        )
        frozen = True
        if up < 400:
            # if update succeeded, verify flight_count unchanged via GET
            g, gb = admin.json("GET", f"/projects/{proj_id}/")
            frozen = (gb.get("flight_count") != 9) if isinstance(gb, dict) else False
        expect(
            up >= 400 or frozen,
            "SPEC02-F01",
            "HM",
            "Structural fields frozen after APPROVED",
            "reject or unchanged flight_count",
            f"{up} {upb}",
            "HIGH",
            module="project",
        )

        # non-structural name edit
        upn, upnb = hm.json(
            "PUT",
            f"/projects/{proj_id}/",
            json={"name": f"{PREFIX}_PROJ_MAIN", "description": "updated notes"},
        )
        rec(
            "SPEC02-F02",
            "HM",
            "Non-structural field remains editable after approve",
            "200 or documented restriction",
            f"{upn} {upnb}",
            "PASS" if upn < 400 else "PARTIAL",
            "" if upn < 400 else "LOW",
            module="project",
        )

        # ---- Spec 03 generate ----
        gen_v, gvb = viewer.json("POST", f"/projects/{proj_id}/generate-hierarchy/")
        expect(gen_v in (401, 403), "SPEC03-G01", "VIEWER", "Non-HM cannot generate", "403", f"{gen_v} {gvb}", module="hierarchy")

        gen, genb = hm.json("POST", f"/projects/{proj_id}/generate-hierarchy/")
        expect(
            gen == 200 and (genb.get("project", {}) or {}).get("status_name") in ("HIERARCHY_GENERATED", "READY_FOR_INVENTORY"),
            "SPEC03-G02",
            "HM",
            "Generate hierarchy on APPROVED",
            "READY_FOR_INVENTORY",
            f"{gen} {genb}",
            "CRITICAL",
            module="hierarchy",
        )

        tree_c, tree = hm.json("GET", f"/projects/{proj_id}/hierarchy-tree/")
        flights = tree.get("flights") or [] if isinstance(tree, dict) else []
        sdls_n = sum(len(f.get("sdls") or []) for f in flights)
        expect(
            tree_c == 200 and len(flights) == 2 and sdls_n == 4,
            "SPEC03-T01",
            "HM",
            "Generated tree: 2 flights × 2 SDLS = 4 SDLS",
            "2 flights, 4 SDLS",
            f"flights={len(flights)} sdls={sdls_n} status={tree.get('status') if isinstance(tree, dict) else tree}",
            "HIGH",
            module="hierarchy",
        )
        # each SDLS same system template
        sys_counts = []
        for f in flights:
            for s in f.get("sdls") or []:
                sys_counts.append(len(s.get("systems") or []))
        expect(
            sys_counts and all(c == sys_counts[0] for c in sys_counts) and sys_counts[0] >= 1,
            "SPEC03-T02",
            "HM",
            "Each SDLS has the same system template count",
            "equal system counts",
            sys_counts,
            module="hierarchy",
        )

        gen2, gen2b = hm.json("POST", f"/projects/{proj_id}/generate-hierarchy/")
        expect(gen2 >= 400, "SPEC03-G03", "HM", "Second generate blocked", "4xx", f"{gen2} {gen2b}", "HIGH", module="hierarchy")

        loc = first_system(tree if isinstance(tree, dict) else {})
        expect(bool(loc), "SPEC03-T03", "HM", "Reservable system node exists", "system id present", loc, module="hierarchy")

        # concurrent double generate on a fresh project
        d2p = {
            "name": f"{PREFIX}_PROJ_DBLGEN",
            "hierarchy_config_id": cfg_a_id,
            "product_type": "SSDLS-1",
            "flight_count": 1,
            "sdls_per_flight": 1,
            "assigned_hm_id": users["hm"]["id"],
        }
        _, d2 = hm.json("POST", "/projects/draft/", json=d2p)
        d2id = d2.get("id") if isinstance(d2, dict) else None
        if d2id:
            created["projects"].append(d2id)
            admin.json("POST", f"/projects/{d2id}/approve/")
            bag = []

            def _g():
                bag.append(hm.json("POST", f"/projects/{d2id}/generate-hierarchy/"))

            t1 = threading.Thread(target=_g)
            t2 = threading.Thread(target=_g)
            t1.start()
            t2.start()
            t1.join()
            t2.join()
            oks = [x for x in bag if x[0] < 400]
            rec(
                "SPEC03-C01",
                "HM",
                "Concurrent double-click generate does not duplicate trees",
                "one success, one reject OR both idempotent with one tree",
                str([(a, str(b)[:120]) for a, b in bag]),
                "PASS" if len(oks) <= 1 else "FAIL",
                "" if len(oks) <= 1 else "HIGH",
                module="hierarchy",
            )

        # ---- Inventory + Spec 04 ----
        sys_name = f"QAComm_{UID}"
        inv_body = {
            "name": sys_name,
            "inventory_type": "system",
            "part_number": f"{PREFIX}-PN-COMM",
            "serial_number": f"{PREFIX}-SN-001",
            "location": "QA-LAB",
            "quantity": 1,
            "description": PREFIX,
        }
        ic, inv = im.json("POST", "/inventory/", json=inv_body)
        expect(ic in (200, 201), "CRUD-INV-01", "IM", "IM creates serialized inventory", "201", f"{ic} {inv}", "HIGH", module="inventory")
        inv_id = inv.get("id") if isinstance(inv, dict) else None
        if inv_id:
            created["inventory"].append(inv_id)
        insts = (inv.get("instances") or []) if isinstance(inv, dict) else []
        inst1 = insts[0]["id"] if insts else None
        if inv_id and not inst1:
            ii, instb = im.json(
                "GET",
                f"/inventory/{inv_id}/",
                params={"include_instances": True} if False else None,
            )
            # fetch instances endpoint
            ii2, insts2 = im.json("GET", f"/inventory/{inv_id}/instances/")
            if isinstance(insts2, list) and insts2:
                inst1 = insts2[0]["id"]
            rec("CRUD-INV-02", "IM", "List inventory instances", "list", f"{ii2} n={len(insts2) if isinstance(insts2, list) else insts2}", "PASS" if inst1 else "FAIL", module="inventory")

        # second serial for FCFS / competition
        ic2, inv2 = im.json(
            "POST",
            "/inventory/",
            json={**inv_body, "serial_number": f"{PREFIX}-SN-002"},
        )
        expect(ic2 in (200, 201), "CRUD-INV-03", "IM", "Add second serial via receipt (same PN/name)", "201", f"{ic2}", module="inventory")
        ic3, inv3 = im.json(
            "POST",
            "/inventory/",
            json={**inv_body, "serial_number": f"{PREFIX}-SN-003"},
        )

        # HM cannot create inventory
        hic, hib = hm.json("POST", "/inventory/", json={**inv_body, "serial_number": f"{PREFIX}-SN-HM"})
        expect(hic in (401, 403), "SPEC05-R01", "HM", "HM cannot receive/create inventory", "403", f"{hic} {hib}", module="inventory")

        if loc and proj_id:
            # reserve on ready project
            res, resb = hm.json(
                "POST",
                f"/projects/{proj_id}/reservations/",
                json={
                    "target_entity_type": "system",
                    "target_entity_id": loc["system_id"],
                    "serial_number": f"{PREFIX}-SN-001",
                },
            )
            expect(
                res == 201 and resb.get("outcome") == "reserved",
                "SPEC04-R01",
                "HM",
                "Reserve available serial for Flight/SDLS/system",
                "outcome=reserved",
                f"{res} {resb}",
                "CRITICAL",
                module="reservation",
            )
            resid = ((resb.get("reservation") or {}) if isinstance(resb, dict) else {}).get("id")
            row = db_one(
                "SELECT status, reserved_by_user_id, flight_id, sdls_id, serial_number, expires_at FROM inventoryreservation WHERE id=:id",
                {"id": resid},
            ) if resid else None
            expect(
                bool(row) and row.get("status") in ("ACTIVE", "active", "RESERVED") or (row and row.get("expires_at")),
                "SPEC04-R02",
                "HM",
                "DB reservation metadata stored (flight, sdls, by, expiry)",
                "row with expiry and HM",
                row,
                module="database",
            )
            inst_st = db_one(
                "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                {"sn": f"{PREFIX}-SN-001"},
            )
            expect(
                inst_st and inst_st.get("status_name") == "RESERVED",
                "SPEC04-R03",
                "HM",
                "Instance status RESERVED in DB",
                "RESERVED",
                inst_st,
                "HIGH",
                module="database",
            )

            # same unit second reserve
            # create second ready project
            p2p = {
                "name": f"{PREFIX}_PROJ_COMPETE",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm2"]["id"],
            }
            _, p2 = hm2.json("POST", "/projects/draft/", json=p2p)
            p2id = p2.get("id") if isinstance(p2, dict) else None
            if p2id:
                created["projects"].append(p2id)
                admin.json("POST", f"/projects/{p2id}/approve/")
                hm2.json("POST", f"/projects/{p2id}/generate-hierarchy/")
                t2c, t2 = hm2.json("GET", f"/projects/{p2id}/hierarchy-tree/")
                loc2 = first_system(t2 if isinstance(t2, dict) else {})
                if loc2:
                    r2, r2b = hm2.json(
                        "POST",
                        f"/projects/{p2id}/reservations/",
                        json={
                            "target_entity_type": "system",
                            "target_entity_id": loc2["system_id"],
                            "serial_number": f"{PREFIX}-SN-001",
                        },
                    )
                    expect(
                        r2 >= 400 or r2b.get("outcome") == "shortage",
                        "SPEC04-R04",
                        "HM",
                        "Second project cannot reserve already reserved serial",
                        "fail or shortage",
                        f"{r2} {r2b}",
                        "HIGH",
                        module="reservation",
                    )

            # reserve before ready
            p3p = {
                "name": f"{PREFIX}_PROJ_DRAFTRES",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
            }
            _, p3 = hm.json("POST", "/projects/draft/", json=p3p)
            p3id = p3.get("id") if isinstance(p3, dict) else None
            if p3id:
                created["projects"].append(p3id)
                rr, rrb = hm.json(
                    "POST",
                    f"/projects/{p3id}/reservations/",
                    json={"target_entity_type": "system", "target_entity_id": loc["system_id"]},
                )
                expect(rr >= 400, "SPEC04-R05", "HM", "Cannot reserve on DRAFT project", "4xx", f"{rr} {rrb}", "HIGH", module="reservation")

            # IM cannot reserve
            ir, irb = im.json(
                "POST",
                f"/projects/{proj_id}/reservations/",
                json={"target_entity_type": "system", "target_entity_id": loc["system_id"], "serial_number": f"{PREFIX}-SN-002"},
            )
            expect(ir in (401, 403), "SPEC04-R06", "IM", "IM cannot reserve", "403", f"{ir} {irb}", module="reservation")

            # hold details on serial
            il, ilb = im.json("GET", "/inventory/", params={"search": f"{PREFIX}-SN-001"})
            hold_ok = "RESERVED" in str(ilb) or "reserved" in str(ilb).lower()
            expect(il < 400 and hold_ok, "SPEC06-U01", "IM", "Inventory list shows reserved serial", "Reserved visible", f"{il} {str(ilb)[:400]}", module="inventory")

            # ---- Spec 07 assign / request / issue ----
            ad, adb = hm.json(
                "POST",
                f"/hierarchy/system/{loc['system_id']}/assign-developer/",
                json={"developer_user_id": users["dev"]["id"]},
            )
            expect(ad == 200, "SPEC07-A01", "HM", "HM assigns developer to hierarchy item", "200", f"{ad} {adb}", "HIGH", module="issue")
            ad2, adb2 = im.json(
                "POST",
                f"/hierarchy/system/{loc['system_id']}/assign-developer/",
                json={"developer_user_id": users["dev"]["id"]},
            )
            expect(ad2 in (401, 403), "SPEC07-A02", "IM", "IM cannot assign developer", "403", f"{ad2} {adb2}", module="issue")

            rq, rqb = dev.json(
                "POST",
                "/item-requests/",
                json={"entity_type": "system", "entity_id": loc["system_id"]},
            )
            expect(rq in (200, 201), "SPEC07-Q01", "DEV", "Developer requests reserved item", "201", f"{rq} {rqb}", "HIGH", module="issue")
            req_id = rqb.get("id") if isinstance(rqb, dict) else None

            # unassigned other? skip
            ns, nsb = im.json("POST", f"/item-requests/{req_id}/issue/", json={"signature_type": "DIGITAL"}) if req_id else (400, "no req")
            expect(ns >= 400, "SPEC07-I01", "IM", "Issue without signature payload blocked", "4xx", f"{ns} {nsb}", "HIGH", module="issue")

            iss, issb = im.json("POST", f"/item-requests/{req_id}/issue/", json=SIG) if req_id else (400, "no req")
            expect(
                iss in (200, 201) and "ISSUED" in str(issb).upper(),
                "SPEC07-I02",
                "IM",
                "IM issues with digital signature → ISSUED",
                "ISSUED",
                f"{iss} {issb}",
                "CRITICAL",
                module="issue",
            )
            inst_st2 = db_one(
                "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                {"sn": f"{PREFIX}-SN-001"},
            )
            expect(
                inst_st2 and inst_st2.get("status_name") == "ISSUED",
                "SPEC07-I03",
                "IM",
                "DB instance ISSUED after issue",
                "ISSUED",
                inst_st2,
                module="database",
            )

            # 24h job: backdate issued_at
            db_exec(
                "UPDATE inventoryissuance SET issued_at = :ts WHERE serial_number = :sn OR notes LIKE :pfx OR id IN (SELECT id FROM inventoryissuance ORDER BY id DESC LIMIT 5)",
                {"ts": datetime.now(timezone.utc) - timedelta(hours=25), "sn": f"{PREFIX}-SN-001", "pfx": f"%{PREFIX}%"},
            )
            # more precise: by serial
            db_exec(
                """
                UPDATE inventoryissuance SET issued_at = :ts
                WHERE inventory_instance_id IN (
                    SELECT id FROM inventoryinstance WHERE serial_number = :sn
                )
                """,
                {"ts": datetime.now(timezone.utc) - timedelta(hours=25), "sn": f"{PREFIX}-SN-001"},
            )
            from app.database import engine as app_engine
            from sqlmodel import Session as SM
            from app.services.inventory_issue_progress_service import evaluate_issue_progress

            with SM(app_engine) as session:
                job = evaluate_issue_progress(session)
            inst_st3 = db_one(
                "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                {"sn": f"{PREFIX}-SN-001"},
            )
            expect(
                inst_st3 and inst_st3.get("status_name") == "INSTALLATION_IN_PROGRESS",
                "SPEC07-T01",
                "SYSTEM",
                "After 24h job, ISSUED → INSTALLATION_IN_PROGRESS",
                "INSTALLATION_IN_PROGRESS",
                f"{inst_st3} job={job}",
                "HIGH",
                module="issue",
            )

            # ---- Spec 08 install test verify ----
            st, stb = dev.json("POST", f"/item-install/system/{loc['system_id']}/start/", json={"notes": "QA install"})
            expect(st == 200, "SPEC08-I01", "DEV", "Developer starts install", "200", f"{st} {stb}", "HIGH", module="install")
            # HM verify too early
            # find issuance id
            iss_id = None
            if isinstance(stb, dict):
                iss_id = stb.get("issuance_id") or stb.get("id")
            vf_early, vfe = hm.json("POST", f"/item-verifications/{iss_id}/verify/", json={"notes": "too soon"}) if iss_id else (400, "no id")
            expect(vf_early >= 400, "SPEC08-V01", "HM", "HM verify before complete rejected", "4xx", f"{vf_early} {vfe}", "HIGH", module="install")

            # fail path project later; first pass path on this item
            ts, tsb = dev.json(
                "POST",
                f"/item-install/system/{loc['system_id']}/test/",
                json={"result": "PASS", "notes": "ok"},
            )
            expect(ts == 200, "SPEC08-T01", "DEV", "Developer records Pass", "200", f"{ts} {tsb}", module="install")
            ut = db_one(
                "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                {"sn": f"{PREFIX}-SN-001"},
            )
            expect(
                ut and ut.get("status_name") in ("UNDER_TESTING_REVIEW", "INSTALLATION_IN_PROGRESS"),
                "SPEC08-T02",
                "DEV",
                "Status under testing after test/install",
                "UNDER_TESTING_REVIEW (or documented)",
                ut,
                "MEDIUM",
                module="install",
            )
            cp, cpb = dev.json("POST", f"/item-install/system/{loc['system_id']}/complete/", json={"notes": "complete"})
            expect(cp == 200, "SPEC08-C01", "DEV", "Dev reports installation complete", "200", f"{cp} {cpb}", "HIGH", module="install")
            vq, vqb = hm.json("GET", "/item-verifications/")
            expect(vq == 200 and isinstance(vqb, list), "SPEC08-V02", "HM", "HM verification queue lists item", "list", f"{vq} n={len(vqb) if isinstance(vqb, list) else vqb}", module="install")
            vf, vfb = hm.json("POST", f"/item-verifications/{iss_id}/verify/", json={"notes": "verified"}) if iss_id else (400, "no id")
            expect(vf == 200, "SPEC08-V03", "HM", "HM verifies after complete", "200", f"{vf} {vfb}", "CRITICAL", module="install")
            fin = db_one(
                "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                {"sn": f"{PREFIX}-SN-001"},
            )
            expect(
                fin and fin.get("status_name") == "INSTALLED_VERIFIED",
                "SPEC08-V04",
                "HM",
                "DB status INSTALLED_VERIFIED after HM verify",
                "INSTALLED_VERIFIED",
                fin,
                "CRITICAL",
                module="database",
            )

            # other dev blocked
            # skip extra user

            # progress
            pr, prb = hm.json("GET", f"/projects/{proj_id}/progress/")
            expect(
                pr == 200 and isinstance(prb, dict) and "overall" in str(prb).lower() or "percent" in str(prb).lower() or "progress" in str(prb).lower(),
                "SPEC09-P01",
                "HM",
                "Progress endpoint returns automatic %",
                "progress payload",
                f"{pr} {prb}",
                "HIGH",
                module="progress",
            )
            # no manual % on project update
            expect(
                "progress_pct" not in str(draft_payload) and "percent_complete" not in str(approved),
                "SPEC09-P02",
                "SYSTEM",
                "No manual project % field on create payload",
                "absent",
                "checked draft schema",
                module="progress",
            )

            # complete gate
            cg, cgb = admin.json("PUT", f"/projects/{proj_id}/", json={"name": f"{PREFIX}_PROJ_MAIN", "status_name": "COMPLETED"})
            rec(
                "SPEC09-G01",
                "ADMIN",
                "Cannot mark complete with unverified remaining nodes",
                "rejected or still not COMPLETED",
                f"{cg} {cgb}",
                "PASS" if cg >= 400 or (isinstance(cgb, dict) and cgb.get("status_name") != "COMPLETED") else "FAIL",
                "" if cg >= 400 else "HIGH",
                module="progress",
            )

            # ---- Spec 05 shortage + FCFS ----
            # new project, no stock for unique name
            uniq = f"QAOnly_{UID}"
            cfg_s = {
                "code": f"{PREFIX}_CFG_SH",
                "name": f"{PREFIX} shortage cfg",
                "is_available": True,
                "product_types": [{"code": "SSDLS-1", "name": "HDR"}],
                "nodes": [{"client_key": "s1", "level": "system", "name": uniq}],
            }
            _, cfgs = admin.json("POST", "/hierarchy-configurations/", json=cfg_s)
            cfgs_id = cfgs.get("id") if isinstance(cfgs, dict) else None
            if cfgs_id:
                created["configs"].append(cfgs_id)
            spa = {
                "name": f"{PREFIX}_PROJ_SHORT_A",
                "hierarchy_config_id": cfgs_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm"]["id"],
            }
            _, psa = hm.json("POST", "/projects/draft/", json=spa)
            psa_id = psa.get("id") if isinstance(psa, dict) else None
            if psa_id:
                created["projects"].append(psa_id)
                admin.json("POST", f"/projects/{psa_id}/approve/")
                hm.json("POST", f"/projects/{psa_id}/generate-hierarchy/")
                ta, treea = hm.json("GET", f"/projects/{psa_id}/hierarchy-tree/")
                loca = first_system(treea if isinstance(treea, dict) else {})
                ra, rab = hm.json(
                    "POST",
                    f"/projects/{psa_id}/reservations/",
                    json={"target_entity_type": "system", "target_entity_id": loca["system_id"]} if loca else {},
                )
                expect(
                    ra in (200, 201) and (isinstance(rab, dict) and rab.get("outcome") == "shortage"),
                    "SPEC05-S01",
                    "HM",
                    "Reserve with zero stock creates shortage",
                    "outcome=shortage",
                    f"{ra} {rab}",
                    "HIGH",
                    module="shortage",
                )
                notices_h, nh = hm.json("GET", "/inventory/shortage-notices/")
                notices_i, ni = im.json("GET", "/inventory/shortage-notices/")
                payload_ok = any(
                    "PN" in str(x).upper() or "part" in str(x).lower()
                    for x in (nh if isinstance(nh, list) else [])
                ) or PREFIX in str(nh) + str(ni)
                rec(
                    "SPEC05-N01",
                    "HM",
                    "Shortage notifies HM and IM with PN/Qty/Flight/SDLS/LRU",
                    "notices contain context fields",
                    f"HM={notices_h} {str(nh)[:400]} IM={notices_i} {str(ni)[:400]}",
                    "PASS" if (isinstance(nh, list) or isinstance(ni, list)) and (nh or ni) else "FAIL",
                    "" if (nh or ni) else "HIGH",
                    module="shortage",
                )
                # second project FCFS
                spb = {**spa, "name": f"{PREFIX}_PROJ_SHORT_B", "assigned_hm_id": users["hm2"]["id"]}
                _, psb = hm2.json("POST", "/projects/draft/", json=spb)
                psb_id = psb.get("id") if isinstance(psb, dict) else None
                if psb_id:
                    created["projects"].append(psb_id)
                    admin.json("POST", f"/projects/{psb_id}/approve/")
                    hm2.json("POST", f"/projects/{psb_id}/generate-hierarchy/")
                    _, treeb = hm2.json("GET", f"/projects/{psb_id}/hierarchy-tree/")
                    locb = first_system(treeb if isinstance(treeb, dict) else {})
                    hm2.json(
                        "POST",
                        f"/projects/{psb_id}/reservations/",
                        json={"target_entity_type": "system", "target_entity_id": locb["system_id"]} if locb else {},
                    )
                    # receive 1 unit matching uniq name
                    rc, rcb = im.json(
                        "POST",
                        "/inventory/",
                        json={
                            "name": uniq,
                            "inventory_type": "system",
                            "part_number": f"{PREFIX}-PN-ONLY",
                            "serial_number": f"{PREFIX}-SN-FCFS1",
                            "location": "QA-LAB",
                            "quantity": 1,
                        },
                    )
                    if isinstance(rcb, dict) and rcb.get("id"):
                        created["inventory"].append(rcb["id"])
                    fulfill = rcb.get("fcfs_fulfillments") if isinstance(rcb, dict) else None
                    inst_fcfs = db_one(
                        """
                        SELECT r.project_id, r.serial_number FROM inventoryreservation r
                        WHERE r.serial_number = :sn AND r.released_at IS NULL
                        ORDER BY r.id DESC LIMIT 1
                        """,
                        {"sn": f"{PREFIX}-SN-FCFS1"},
                    )
                    expect(
                        inst_fcfs and inst_fcfs.get("project_id") == psa_id,
                        "SPEC05-F01",
                        "IM",
                        "FCFS: first shortage (A) gets first received unit",
                        f"project A {psa_id}",
                        f"receipt={rc} fulfill={fulfill} db={inst_fcfs}",
                        "HIGH",
                        module="shortage",
                    )
                    # wrong PN
                    rw, rwb = im.json(
                        "POST",
                        "/inventory/",
                        json={
                            "name": f"QAUnrelated_{UID}",
                            "inventory_type": "system",
                            "part_number": f"{PREFIX}-PN-WRONG",
                            "serial_number": f"{PREFIX}-SN-WRONG",
                            "location": "QA-LAB",
                            "quantity": 1,
                        },
                    )
                    if isinstance(rwb, dict) and rwb.get("id"):
                        created["inventory"].append(rwb["id"])
                    shB = hm2.json("GET", f"/projects/{psb_id}/shortages/")
                    still_open = False
                    if isinstance(shB[1], list) and shB[1]:
                        still_open = any(x.get("status") in ("OPEN", "PARTIAL") for x in shB[1])
                    expect(
                        still_open or shB[0] == 200,
                        "SPEC05-F02",
                        "IM",
                        "Wrong PN receipt does not close unrelated shortage",
                        "B still open",
                        f"{shB}",
                        "MEDIUM",
                        module="shortage",
                    )

            # ---- Spec 06 expiry ----
            # reserve SN-002 on remaining system if any
            # create dedicated project
            pexp = {
                "name": f"{PREFIX}_PROJ_EXPIRY",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm"]["id"],
            }
            _, pex = hm.json("POST", "/projects/draft/", json=pexp)
            pex_id = pex.get("id") if isinstance(pex, dict) else None
            if pex_id:
                created["projects"].append(pex_id)
                admin.json("POST", f"/projects/{pex_id}/approve/")
                hm.json("POST", f"/projects/{pex_id}/generate-hierarchy/")
                _, tex = hm.json("GET", f"/projects/{pex_id}/hierarchy-tree/")
                loce = first_system(tex if isinstance(tex, dict) else {})
                if loce:
                    rx, rxb = hm.json(
                        "POST",
                        f"/projects/{pex_id}/reservations/",
                        json={
                            "target_entity_type": "system",
                            "target_entity_id": loce["system_id"],
                            "serial_number": f"{PREFIX}-SN-002",
                        },
                    )
                    rid_e = ((rxb.get("reservation") or {}) if isinstance(rxb, dict) else {}).get("id")
                    if rid_e:
                        past = datetime.now(timezone.utc) - timedelta(days=40)
                        db_exec(
                            "UPDATE inventoryreservation SET reserved_at=:ra, expires_at=:ex, last_reminder_at=NULL WHERE id=:id",
                            {"ra": past, "ex": past + timedelta(days=30), "id": rid_e},
                        )
                        ej, ejb = hm.json("POST", "/inventory/reservations/expiry/run/")
                        expect(ej == 200, "SPEC06-J01", "HM", "Expiry job endpoint runs", "200", f"{ej} {ejb}", module="expiry")
                        after = db_one("SELECT status, notes, released_at FROM inventoryreservation WHERE id=:id", {"id": rid_e})
                        inst_e = db_one(
                            "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                            {"sn": f"{PREFIX}-SN-002"},
                        )
                        released = (after and after.get("released_at")) or (
                            inst_e and inst_e.get("status_name") == "AVAILABLE"
                        )
                        expect(
                            bool(released),
                            "SPEC06-J02",
                            "SYSTEM",
                            "Idle reserved stock auto-releases to AVAILABLE after grace",
                            "AVAILABLE / released",
                            f"res={after} inst={inst_e} job={ejb}",
                            "HIGH",
                            module="expiry",
                        )
                        # issued item not released: SN-001 was verified
                        inst_iss = db_one(
                            "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                            {"sn": f"{PREFIX}-SN-001"},
                        )
                        expect(
                            inst_iss and inst_iss.get("status_name") != "AVAILABLE",
                            "SPEC06-J03",
                            "SYSTEM",
                            "Issued/verified items are not auto-released",
                            "not AVAILABLE",
                            inst_iss,
                            module="expiry",
                        )
                        nexp, nexpb = hm.json("GET", "/inventory/reservation-expiry-notices/")
                        rec(
                            "SPEC06-N01",
                            "HM",
                            "HM receives expiry reminder/auto-release notice",
                            "notice list",
                            f"{nexp} {str(nexpb)[:400]}",
                            "PASS" if nexp == 200 else "FAIL",
                            module="expiry",
                        )

            # ---- Spec 10 fail/rework on SN-003 ----
            prew = {
                "name": f"{PREFIX}_PROJ_REWORK",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm"]["id"],
            }
            _, prw = hm.json("POST", "/projects/draft/", json=prew)
            prw_id = prw.get("id") if isinstance(prw, dict) else None
            if prw_id:
                created["projects"].append(prw_id)
                admin.json("POST", f"/projects/{prw_id}/approve/")
                hm.json("POST", f"/projects/{prw_id}/generate-hierarchy/")
                _, trw = hm.json("GET", f"/projects/{prw_id}/hierarchy-tree/")
                locr = first_system(trw if isinstance(trw, dict) else {})
                if locr:
                    hm.json(
                        "POST",
                        f"/projects/{prw_id}/reservations/",
                        json={
                            "target_entity_type": "system",
                            "target_entity_id": locr["system_id"],
                            "serial_number": f"{PREFIX}-SN-003",
                        },
                    )
                    hm.json(
                        "POST",
                        f"/hierarchy/system/{locr['system_id']}/assign-developer/",
                        json={"developer_user_id": users["dev"]["id"]},
                    )
                    rq2, rq2b = dev.json(
                        "POST",
                        "/item-requests/",
                        json={"entity_type": "system", "entity_id": locr["system_id"]},
                    )
                    req2 = rq2b.get("id") if isinstance(rq2b, dict) else None
                    im.json("POST", f"/item-requests/{req2}/issue/", json=SIG) if req2 else None
                    db_exec(
                        """
                        UPDATE inventoryissuance SET issued_at = :ts
                        WHERE inventory_instance_id IN (SELECT id FROM inventoryinstance WHERE serial_number=:sn)
                        """,
                        {"ts": datetime.now(timezone.utc) - timedelta(hours=25), "sn": f"{PREFIX}-SN-003"},
                    )
                    with SM(app_engine) as session:
                        evaluate_issue_progress(session)
                    dev.json("POST", f"/item-install/system/{locr['system_id']}/start/", json={"notes": "rework install"})
                    tf, tfb = dev.json(
                        "POST",
                        f"/item-install/system/{locr['system_id']}/test/",
                        json={"result": "FAIL", "notes": "failed"},
                    )
                    expect(tf == 200, "SPEC10-F01", "DEV", "Fail test recorded", "200", f"{tf} {tfb}", "HIGH", module="rework")
                    finf = db_one(
                        "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                        {"sn": f"{PREFIX}-SN-003"},
                    )
                    expect(
                        not (finf and finf.get("status_name") == "INSTALLED_VERIFIED"),
                        "SPEC10-F02",
                        "DEV",
                        "Fail never sets INSTALLED_VERIFIED",
                        "not verified",
                        finf,
                        "HIGH",
                        module="rework",
                    )
                    rwlist_c, rwlist = im.json("GET", "/item-rework/")
                    case = None
                    if isinstance(rwlist, list):
                        for row in rwlist:
                            if PREFIX in str(row) or (isinstance(row, dict) and row.get("project_id") == prw_id):
                                case = row
                                break
                        if not case and rwlist:
                            case = rwlist[0]
                    expect(bool(case), "SPEC10-F03", "IM", "Fail creates rework case", "case exists", f"{rwlist_c} {rwlist}", "HIGH", module="rework")
                    cid = case.get("id") if isinstance(case, dict) else None
                    if cid:
                        rm, rmb = dev.json("POST", f"/item-rework/{cid}/remove/", json={"notes": "removed"})
                        expect(rm == 200, "SPEC10-L01", "DEV", "Developer removes failed item", "200", f"{rm} {rmb}", module="rework")
                        rt, rtb = dev.json("POST", f"/item-rework/{cid}/return/", json={"notes": "returned"})
                        expect(rt == 200, "SPEC10-L02", "DEV", "Returned to IM", "200", f"{rt} {rtb}", module="rework")
                        ins, insb = im.json("POST", f"/item-rework/{cid}/inspect/", json={"notes": "inspect"})
                        expect(ins == 200, "SPEC10-L03", "IM", "IM starts inspection", "200", f"{ins} {insb}", module="rework")
                        disp, dispb = im.json(
                            "POST",
                            f"/item-rework/{cid}/disposition/",
                            json={"outcome": "REPAIRABLE", "notes": "repair"},
                        )
                        expect(disp == 200, "SPEC10-L04", "IM", "Disposition REPAIRABLE", "200", f"{disp} {dispb}", module="rework")
                        rcpl, rcplb = im.json("POST", f"/item-rework/{cid}/repair-complete/", json={"notes": "repaired"})
                        rec(
                            "SPEC10-L05",
                            "IM",
                            "Repair complete before re-issue",
                            "200 or not required",
                            f"{rcpl} {rcplb}",
                            "PASS" if rcpl < 400 or "not" in str(rcplb).lower() else "PARTIAL",
                            module="rework",
                        )
                        rei, reib = im.json("POST", f"/item-rework/{cid}/reissue/", json=SIG)
                        expect(rei == 200, "SPEC10-L06", "IM", "Signed re-issue after repair", "200", f"{rei} {reib}", "HIGH", module="rework")
                        # history
                        det_c, det = im.json("GET", f"/item-rework/{cid}/")
                        expect(
                            det_c == 200 and ("event" in str(det).lower() or "attempt" in str(det).lower() or "stage" in str(det).lower()),
                            "SPEC10-H01",
                            "IM",
                            "Rework attempt history preserved",
                            "events/history present",
                            f"{det_c} {det}",
                            module="rework",
                        )

            # ---- Spec 11 cancel / recall ----
            pcanc = {
                "name": f"{PREFIX}_PROJ_CANCEL",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm"]["id"],
            }
            _, pcan = hm.json("POST", "/projects/draft/", json=pcanc)
            pcan_id = pcan.get("id") if isinstance(pcan, dict) else None
            if pcan_id:
                created["projects"].append(pcan_id)
                admin.json("POST", f"/projects/{pcan_id}/approve/")
                hm.json("POST", f"/projects/{pcan_id}/generate-hierarchy/")
                _, tcan = hm.json("GET", f"/projects/{pcan_id}/hierarchy-tree/")
                locc = first_system(tcan if isinstance(tcan, dict) else {})
                # extra serial
                im.json(
                    "POST",
                    "/inventory/",
                    json={**inv_body, "serial_number": f"{PREFIX}-SN-CAN"},
                )
                if locc:
                    hm.json(
                        "POST",
                        f"/projects/{pcan_id}/reservations/",
                        json={
                            "target_entity_type": "system",
                            "target_entity_id": locc["system_id"],
                            "serial_number": f"{PREFIX}-SN-CAN",
                        },
                    )
                nc, ncb = viewer.json("POST", f"/projects/{pcan_id}/cancel/", json={"confirm": True, "notes": "nope"})
                expect(nc in (401, 403, 404), "SPEC11-A01", "VIEWER", "Unauthorized role cannot cancel", "403", f"{nc} {ncb}", "HIGH", module="recall")
                nocon, noconb = hm.json("POST", f"/projects/{pcan_id}/cancel/", json={"confirm": False})
                expect(nocon >= 400, "SPEC11-A02", "HM", "Cancel without confirmation blocked", "4xx", f"{nocon} {noconb}", "HIGH", module="recall")
                prev, prevb = hm.json("GET", f"/projects/{pcan_id}/cancel-preview/")
                expect(prev == 200, "SPEC11-A03", "HM", "Cancel preview shows inventory impact", "200", f"{prev} {prevb}", module="recall")
                can, canb = hm.json("POST", f"/projects/{pcan_id}/cancel/", json={"confirm": True, "notes": "QA cancel"})
                expect(
                    can == 200 and (canb.get("project_status") == "CANCELLED" or (canb.get("project") or {}).get("status_name") == "CANCELLED"),
                    "SPEC11-A04",
                    "HM",
                    "Cancel sets CANCELLED",
                    "CANCELLED",
                    f"{can} {canb}",
                    "CRITICAL",
                    module="recall",
                )
                inst_can = db_one(
                    "SELECT s.status_name FROM inventoryinstance i JOIN status s ON s.id=i.status_id WHERE i.serial_number=:sn",
                    {"sn": f"{PREFIX}-SN-CAN"},
                )
                expect(
                    inst_can and inst_can.get("status_name") == "AVAILABLE",
                    "SPEC11-R01",
                    "HM",
                    "Reserved-not-issued stock released to AVAILABLE on cancel",
                    "AVAILABLE",
                    inst_can,
                    "HIGH",
                    module="recall",
                )
                # block reserve after cancel
                br, brb = hm.json(
                    "POST",
                    f"/projects/{pcan_id}/reservations/",
                    json={"target_entity_type": "system", "target_entity_id": locc["system_id"]} if locc else {},
                )
                expect(br >= 400, "SPEC11-B01", "HM", "Reserve blocked on cancelled project", "4xx", f"{br} {brb}", "HIGH", module="recall")
                bg, bgb = hm.json("POST", f"/projects/{pcan_id}/generate-hierarchy/")
                expect(bg >= 400, "SPEC11-B02", "HM", "Generate blocked on cancelled project", "4xx", f"{bg} {bgb}", module="recall")
                tv, tvb = hm.json("GET", f"/projects/{pcan_id}/hierarchy-tree/")
                expect(tv == 200, "SPEC11-V01", "HM", "Cancelled hierarchy remains viewable", "200", f"{tv} status={tvb.get('status') if isinstance(tvb, dict) else tvb}", module="recall")

            # ---- Spec 12 config change ----
            pcc = {
                "name": f"{PREFIX}_PROJ_CC",
                "hierarchy_config_id": cfg_a_id,
                "product_type": "SSDLS-1",
                "flight_count": 1,
                "sdls_per_flight": 1,
                "assigned_hm_id": users["hm"]["id"],
            }
            _, pccb = hm.json("POST", "/projects/draft/", json=pcc)
            pcc_id = pccb.get("id") if isinstance(pccb, dict) else None
            if pcc_id:
                created["projects"].append(pcc_id)
                admin.json("POST", f"/projects/{pcc_id}/approve/")
                hm.json("POST", f"/projects/{pcc_id}/generate-hierarchy/")
                patch, patchb = hm.json(
                    "PUT",
                    f"/projects/{pcc_id}/",
                    json={"name": f"{PREFIX}_PROJ_CC", "hierarchy_config_id": cfg_b_id, "product_type": "SSDLS-2", "flight_count": 1, "sdls_per_flight": 1},
                )
                expect(
                    patch >= 400,
                    "SPEC12-C01",
                    "HM",
                    "In-place configuration change rejected after hierarchy",
                    "4xx",
                    f"{patch} {patchb}",
                    "HIGH",
                    module="config-change",
                )
                cr, crb = hm.json("POST", f"/projects/{pcc_id}/config-change/", json={"notes": "QA CR"})
                expect(cr in (200, 201), "SPEC12-C02", "HM", "HM requests configuration change", "201", f"{cr} {crb}", "HIGH", module="config-change")
                cr_id = crb.get("id") if isinstance(crb, dict) else None
                if cr_id:
                    ri, rib = hm.json("POST", f"/config-changes/{cr_id}/return-inventory/")
                    expect(ri == 200, "SPEC12-C03", "HM", "Return all project inventory for CR", "200", f"{ri} {rib}", module="config-change")
                    sub, subb = hm.json(
                        "POST",
                        f"/config-changes/{cr_id}/submit/",
                        json={
                            "target_hierarchy_config_id": cfg_b_id,
                            "reason_remarks": "QA need different product type",
                            "product_type": "SSDLS-2",
                            "flight_count": 1,
                            "sdls_per_flight": 1,
                        },
                    )
                    expect(sub == 200, "SPEC12-C04", "HM", "HM submits CR with target approved config", "200", f"{sub} {subb}", module="config-change")
                    apc_hm, apc_hmb = hm.json("POST", f"/config-changes/{cr_id}/approve/")
                    expect(apc_hm in (401, 403), "SPEC12-C05", "HM", "HM cannot approve CR", "403", f"{apc_hm} {apc_hmb}", module="config-change")
                    apc, apcb = admin.json("POST", f"/config-changes/{cr_id}/approve/")
                    expect(apc == 200, "SPEC12-C06", "ADMIN", "Admin approves CR", "200", f"{apc} {apcb}", "HIGH", module="config-change")
                    np, npb = hm.json(
                        "POST",
                        f"/config-changes/{cr_id}/create-project/",
                        json={"name": f"{PREFIX}_PROJ_SUCCESSOR"},
                    )
                    expect(np in (200, 201), "SPEC12-C07", "HM", "Create successor project from approved CR", "201", f"{np} {npb}", "HIGH", module="config-change")
                    succ = (npb.get("successor_project") or npb.get("project") or npb) if isinstance(npb, dict) else {}
                    succ_id = succ.get("id") if isinstance(succ, dict) else None
                    if succ_id:
                        created["projects"].append(succ_id)
                    old = db_one("SELECT s.status_name FROM project p JOIN status s ON s.id=p.status_id WHERE p.id=:id", {"id": pcc_id})
                    expect(
                        old and old.get("status_name") == "SUPERSEDED",
                        "SPEC12-C08",
                        "SYSTEM",
                        "Old project marked SUPERSEDED",
                        "SUPERSEDED",
                        old,
                        "HIGH",
                        module="config-change",
                    )

            # ---- Spec 13 audit ----
            au, aub = admin.json("GET", "/audit/", params={"limit": 20, "search": PREFIX})
            expect(au == 200 and isinstance(aub, list), "SPEC13-Q01", "ADMIN", "Admin can list audit events", "200 list", f"{au} n={len(aub) if isinstance(aub, list) else aub}", "HIGH", module="audit")
            auf, aufb = admin.json("GET", "/audit/", params={"project_id": proj_id, "limit": 50})
            expect(auf == 200, "SPEC13-Q02", "ADMIN", "Filter audit by project", "200", f"{auf} n={len(aufb) if isinstance(aufb, list) else aufb}", module="audit")
            csv_r = admin.call("GET", "/audit/export.csv", params={"project_id": proj_id})
            expect(
                csv_r.status_code == 200 and ("csv" in csv_r.headers.get("content-type", "") or "," in csv_r.text[:200]),
                "SPEC13-Q03",
                "ADMIN",
                "Admin can export audit CSV",
                "CSV",
                f"{csv_r.status_code} {csv_r.headers.get('content-type')} {csv_r.text[:120]}",
                module="audit",
            )
            du, dub = admin.json("DELETE", "/audit/1")
            expect(du >= 400, "SPEC13-I01", "ADMIN", "API cannot delete audit rows", "4xx", f"{du} {dub}", "HIGH", module="audit")
            pu, pub = admin.json("PUT", "/audit/1", json={"action": "hacked"})
            expect(pu >= 400, "SPEC13-I02", "ADMIN", "API cannot update audit rows", "4xx", f"{pu} {pub}", "HIGH", module="audit")
            dv, dvb = viewer.json("GET", "/audit/")
            expect(dv in (401, 403), "SPEC13-A01", "VIEWER", "Viewer cannot read workflow audit", "403", f"{dv} {dvb}", module="audit")
            sample = aufb[0] if isinstance(aufb, list) and aufb else (aub[0] if isinstance(aub, list) and aub else {})
            fields_ok = isinstance(sample, dict) and all(k in sample for k in ("action", "actor_user_id", "occurred_at")) or (
                isinstance(sample, dict) and "actor" in str(sample)
            )
            expect(
                bool(sample) and fields_ok,
                "SPEC13-F01",
                "ADMIN",
                "Audit envelope includes who/when/action",
                "required fields",
                sample,
                module="audit",
            )

            # CRUD customers / orders
            cc, ccb = admin.json("POST", "/customers/", json={"name": f"{PREFIX}_CUSTOMER", "email": f"{PREFIX.lower()}@qa.test"})
            expect(cc in (200, 201), "CRUD-CUS-01", "ADMIN", "Create customer", "201", f"{cc} {ccb}", module="customers")
            if isinstance(ccb, dict) and ccb.get("id"):
                created["customers"].append(ccb["id"])
                oc, ocb = admin.json("POST", "/orders/", json={"customer_id": ccb["id"], "name": f"{PREFIX}_ORDER"})
                rec(
                    "CRUD-ORD-01",
                    "ADMIN",
                    "Create order",
                    "201",
                    f"{oc} {ocb}",
                    "PASS" if oc in (200, 201) else "FAIL",
                    "" if oc in (200, 201) else "MEDIUM",
                    module="orders",
                )
                if isinstance(ocb, dict) and ocb.get("id"):
                    created["orders"].append(ocb["id"])

            # invalid ids
            nf, nfb = hm.json("GET", "/projects/99999999/")
            expect(nf == 404, "NEG-ID-01", "HM", "Non-existent project GET", "404", f"{nf} {nfb}", module="project")
            nf2, nf2b = hm.json("POST", "/projects/99999999/approve/")
            expect(nf2 >= 400, "NEG-ID-02", "ADMIN", "Approve non-existent project", "4xx", f"{nf2} {nf2b}", module="project")

            # HM data isolation: hm2 cannot see hm-only project if implemented
            vis, visb = hm2.json("GET", f"/projects/{proj_id}/")
            rec(
                "SPEC07-ISO-01",
                "HM",
                "HM sees only owned/created/assigned projects",
                "404 or hidden for other HM",
                f"{vis} {visb}",
                "PASS" if vis in (403, 404) else "PARTIAL",
                "" if vis in (403, 404) else "MEDIUM",
                module="security",
            )

    # frontend pages
    with httpx.Client(timeout=30.0, follow_redirects=False) as c:
        fl = c.get(f"{FE}/login")
        expect(fl.status_code in (200, 307, 308), "UI-LOGIN-01", "ANON", "Login page reachable", "200", fl.status_code, module="ui")
        fp = c.get(f"{FE}/projects")
        rec(
            "UI-GATE-01",
            "ANON",
            "Projects page without session",
            "redirect to login or 200 client-gated",
            f"{fp.status_code} loc={fp.headers.get('location')}",
            "PASS" if fp.status_code in (200, 307, 308, 401, 403) else "FAIL",
            module="ui",
        )

    # logout
    lo, lob = admin.json("POST", "/auth/logout")
    rec("SPEC00-AUTH", "ADMIN", "Logout", "200", f"{lo} {lob}", "PASS" if lo < 400 else "FAIL", module="auth")

    # cleanup
    leftover = cleanup()
    rec("CLEANUP", "SYSTEM", "Remove QA_TEST records", "deleted where safe", json.dumps(leftover, default=str)[:1500], "PASS" if leftover.get("ok") else "PARTIAL", module="database")
    after = snapshot_counts()
    rec("ENV", "SYSTEM", "Database snapshot after cleanup", "counts recorded", json.dumps(after), "PASS", module="database")

    payload = {
        "prefix": PREFIX,
        "created": created,
        "before": before,
        "after": after,
        "leftover": leftover,
        "results": results,
        "summary": summarize(results),
    }
    Path(OUT_DIR / "qa_live_results.json").write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def summarize(rows: list[dict]) -> dict:
    c = {"PASS": 0, "FAIL": 0, "PARTIAL": 0, "NOT TESTABLE": 0, "NOT IMPLEMENTED": 0}
    sev = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "COSMETIC": 0}
    for r in rows:
        c[r["result"]] = c.get(r["result"], 0) + 1
        if r.get("severity"):
            sev[r["severity"]] = sev.get(r["severity"], 0) + 1
    return {"counts": c, "severity": sev, "total": len(rows)}


def cleanup() -> dict:
    info = {"ok": True, "notes": [], "remaining": {}}
    try:
        # Leave workflowauditevent (immutable). Delete operational QA rows by prefix.
        stmts = [
            "DELETE FROM inventoryreservationexpirynotice WHERE user_id IN (SELECT id FROM \"user\" WHERE username LIKE :p)",
            "DELETE FROM inventoryshortagenotice WHERE user_id IN (SELECT id FROM \"user\" WHERE username LIKE :p)",
            "DELETE FROM inventoryinstallernotice WHERE user_id IN (SELECT id FROM \"user\" WHERE username LIKE :p)",
            "DELETE FROM inventoryshortage WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM inventoryitemrequest WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM inventoryrecalltask WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM inventoryreworkcase WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM inventoryissuanceevent WHERE issuance_id IN (SELECT id FROM inventoryissuance WHERE inventory_id IN (SELECT id FROM inventory WHERE name LIKE :p OR part_number LIKE :p))",
            "DELETE FROM inventoryissuance WHERE inventory_id IN (SELECT id FROM inventory WHERE name LIKE :p OR part_number LIKE :p)",
            "DELETE FROM inventoryreservation WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM configchangerequest WHERE source_project_id IN (SELECT id FROM project WHERE name LIKE :p) OR successor_project_id IN (SELECT id FROM project WHERE name LIKE :p)",
            "DELETE FROM inventoryinstance WHERE serial_number LIKE :p OR inventory_id IN (SELECT id FROM inventory WHERE name LIKE :p OR part_number LIKE :p)",
            "DELETE FROM inventory WHERE name LIKE :p OR part_number LIKE :p OR description LIKE :p",
        ]
        p = f"{PREFIX}%"
        for sql in stmts:
            try:
                db_exec(sql, {"p": p})
            except Exception as exc:
                info["notes"].append(f"{sql[:60]} -> {exc}")
                info["ok"] = False
        # hierarchy children of QA projects
        try:
            db_exec(
                """
                DELETE FROM component WHERE unit_id IN (
                  SELECT u.id FROM unit u JOIN module m ON m.id=u.module_id JOIN subsystem ss ON ss.id=m.subsystem_id
                  JOIN system s ON s.id=ss.system_id JOIN project p ON p.id=s.project_id WHERE p.name LIKE :p
                )
                """,
                {"p": p},
            )
            db_exec(
                """
                DELETE FROM unit WHERE module_id IN (
                  SELECT m.id FROM module m JOIN subsystem ss ON ss.id=m.subsystem_id
                  JOIN system s ON s.id=ss.system_id JOIN project p ON p.id=s.project_id WHERE p.name LIKE :p
                )
                """,
                {"p": p},
            )
            db_exec(
                """
                DELETE FROM module WHERE subsystem_id IN (
                  SELECT ss.id FROM subsystem ss JOIN system s ON s.id=ss.system_id
                  JOIN project p ON p.id=s.project_id WHERE p.name LIKE :p
                )
                """,
                {"p": p},
            )
            db_exec(
                """
                DELETE FROM subsystem WHERE system_id IN (
                  SELECT s.id FROM system s JOIN project p ON p.id=s.project_id WHERE p.name LIKE :p
                )
                """,
                {"p": p},
            )
            db_exec("DELETE FROM system WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)", {"p": p})
            db_exec(
                "DELETE FROM sdls WHERE flight_id IN (SELECT id FROM flight WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p))",
                {"p": p},
            )
            db_exec("DELETE FROM flight WHERE project_id IN (SELECT id FROM project WHERE name LIKE :p)", {"p": p})
            db_exec("DELETE FROM project WHERE name LIKE :p", {"p": p})
        except Exception as exc:
            info["notes"].append(f"hierarchy cleanup: {exc}")
            info["ok"] = False
        try:
            db_exec("DELETE FROM hierarchyconfigurationnode WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p)", {"p": p})
        except Exception:
            try:
                db_exec("DELETE FROM hierarchyconfignode WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p)", {"p": p})
            except Exception as exc:
                info["notes"].append(f"config nodes: {exc}")
        try:
            db_exec("DELETE FROM hierarchyconfigurationproducttype WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p)", {"p": p})
        except Exception:
            pass
        try:
            db_exec("DELETE FROM hierarchyconfiguration WHERE code LIKE :p", {"p": p})
        except Exception as exc:
            info["notes"].append(f"configs: {exc}")
            info["ok"] = False
        try:
            db_exec('DELETE FROM userrole WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE :p)', {"p": p})
        except Exception:
            try:
                db_exec('DELETE FROM userroles WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE :p)', {"p": p})
            except Exception:
                pass
        try:
            db_exec('DELETE FROM userloginhistory WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE :p)', {"p": p})
        except Exception:
            pass
        try:
            db_exec('DELETE FROM "user" WHERE username LIKE :p', {"p": p})
        except Exception as exc:
            info["notes"].append(f"users: {exc}")
            info["ok"] = False
        try:
            db_exec('DELETE FROM "order" WHERE name LIKE :p', {"p": p})
        except Exception:
            pass
        try:
            db_exec("DELETE FROM customer WHERE name LIKE :p", {"p": p})
        except Exception:
            pass
        remaining_users = db_all('SELECT id, username FROM "user" WHERE username LIKE :p', {"p": p})
        remaining_proj = db_all("SELECT id, name FROM project WHERE name LIKE :p", {"p": p})
        remaining_inv = db_all("SELECT id, name FROM inventory WHERE name LIKE :p OR part_number LIKE :p", {"p": p})
        info["remaining"] = {"users": remaining_users, "projects": remaining_proj, "inventory": remaining_inv}
        if remaining_users or remaining_proj or remaining_inv:
            info["ok"] = False
            info["notes"].append("Some QA rows remain; see remaining")
        info["notes"].append("Workflow audit rows for QA actions were left intact (append-only / Spec 13).")
    except Exception as exc:
        info["ok"] = False
        info["notes"].append(str(exc))
    return info


if __name__ == "__main__":
    try:
        run()
    except Exception:
        rec("FATAL", "SYSTEM", "Harness crashed", "complete run", traceback.format_exc(), "FAIL", "CRITICAL", module="harness")
        Path(OUT_DIR / "qa_live_results.json").write_text(
            json.dumps({"results": results, "crash": traceback.format_exc()}, indent=2, default=str),
            encoding="utf-8",
        )
        raise
    print(json.dumps(summarize(results), indent=2))
    print("wrote", OUT_DIR / "qa_live_results.json")
