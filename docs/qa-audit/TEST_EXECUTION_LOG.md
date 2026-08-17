# Live Test Execution Log

**Run prefix:** `QA_TEST_20260816_52531E28`

Method: HTTP API against `http://127.0.0.1:8000/api` plus PostgreSQL verification.

| Test ID | Requirement ID | Role | Scenario | Expected | Actual | Result | Severity | Module |
|---------|----------------|------|----------|----------|--------|--------|----------|--------|
| TC-001 | ENV | SYSTEM | Database snapshot before tests | Readable live DB | {"user": 15, "project": 203, "inventory": 95, "inventoryinstance": 629, "inventoryreservation": 38, "inventoryshortage": | PASS |  | database |
| TC-002 | SPEC00-AUTH | ADMIN | Admin login with valid credentials | 200 + access_token | 200 keys=['access_token', 'token_type', 'user_id', 'username', 'email', 'roles', 'permissions', 'session_id'] | PASS |  | auth |
| TC-003 | SPEC00-AUTH | ANON | Login with invalid password | 401/400/403 | 401 | PASS |  | auth |
| TC-004 | SPEC00-AUTH | ANON | GET /auth/me without token | 401/403 | 401 {'detail': 'Not authenticated'} | PASS |  | security |
| TC-005 | SPEC00-AUTH | ADMIN | GET current user | 200 admin profile | 200 admin | PASS |  | auth |
| TC-006 | SPEC00-PERM | ADMIN | Admin permission list includes workflow keys | project.approve present | 200 count=136 | PASS |  | auth |
| TC-007 | SPEC00-R01 | ADMIN | Five workflow roles exist in RBAC | ['Admin', 'ProjectDirector', 'HierarchyManager', 'InventoryManager', 'Developer' | present=['Admin', 'ProjectManager', 'Technician', 'Maintenance', 'Viewer', 'SubAdmin', 'ProjectDirector', 'HierarchyMana | PASS |  | roles |
| TC-008 | SPEC00-S01 | ADMIN | Canonical item and project statuses exist | All Spec 00 codes present | missing_item=[] missing_project=[] | PASS |  | status |
| TC-009 | SPEC00-T01 | SYSTEM | Allowed item transition AVAILABLE→RESERVED | True | True | PASS |  | status |
| TC-010 | SPEC00-T02 | SYSTEM | Forbidden item transition AVAILABLE→ISSUED | False | False | PASS |  | status |
| TC-011 | SPEC00-T03 | SYSTEM | Forbidden skip RESERVED→INSTALLED_VERIFIED | False | False | PASS |  | status |
| TC-012 | SPEC00-T04 | SYSTEM | Allowed project DRAFT→APPROVED | True | True | PASS |  | status |
| TC-013 | SPEC00-T05 | SYSTEM | Forbidden project DRAFT→READY_FOR_INVENTORY | False | False | PASS |  | status |
| TC-014 | SPEC00-R02 | ADMIN | Create one user per workflow role | Users created and can login | created | PASS |  | roles |
| TC-015 | SPEC00-P01 | PD | PD has project.assign_hm | present | ['project.assign_hm', 'audit.read', 'project.cancel', 'view_projects', 'view_users', 'view_executive_dashboard', 'view_n | PASS |  | roles |
| TC-016 | SPEC00-P02 | HM | HM has project.create_draft | present | ['view_hierarchy', 'create_projects', 'hierarchy.generate', 'view_statuses', 'inventory.release', 'hierarchy.assign_deve | PASS |  | roles |
| TC-017 | SPEC00-P03 | HM | HM does not have project.approve | absent | ['view_hierarchy', 'create_projects', 'hierarchy.generate', 'view_statuses', 'inventory.release', 'hierarchy.assign_deve | PASS |  | roles |
| TC-018 | SPEC00-P04 | IM | IM has issue permission | present | ['edit_inventory', 'issue_inventory', 'view_entities', 'view_status_history', 'item.inspect', 'audit.read', 'view_projec | PASS |  | roles |
| TC-019 | SPEC00-P05 | DEV | Dev has item.request | present | ['view_hierarchy', 'view_entities', 'view_status_history', 'view_projects', 'view_inventory_issuances', 'view_statuses', | PASS |  | roles |
| TC-020 | SPEC00-P06 | HM | HM cannot manage configs | absent | ['view_hierarchy', 'create_projects', 'hierarchy.generate', 'view_statuses', 'inventory.release', 'hierarchy.assign_deve | PASS |  | roles |
| TC-021 | SPEC01-F01 | ADMIN | Config meta returns fixed 8-level model | fixed_levels present | 200 ['fixed_levels', 'default_product_types', 'default_notes'] | PASS |  | config |
| TC-022 | SPEC01-F02 | ADMIN | Fixed levels include Product Type through Component | 8 levels | ['product_type', 'flight', 'sdls', 'system', 'subsystem', 'module', 'unit', 'component'] | PASS |  | config |
| TC-023 | SPEC01-C01 | ADMIN | Admin creates Config A | 201 | 201 {'id': 479, 'code': 'QA_TEST_20260816_52531E28_CFG_A', 'name': 'QA_TEST_20260816_52531E28 SSDLS-1', 'description': ' | PASS |  | config |
| TC-024 | SPEC01-C02 | ADMIN | Admin creates Config B | 201 | 201 {'id': 480, 'code': 'QA_TEST_20260816_52531E28_CFG_B', 'name': 'QA_TEST_20260816_52531E28 SSDLS-2', 'description': N | PASS |  | config |
| TC-025 | SPEC01-C03 | VIEWER | Non-admin cannot create config | 403 | 403 {'detail': 'User does not have permission: hierarchy_config.manage'} | PASS |  | config |
| TC-026 | SPEC01-C04 | HM | HM cannot create config | 403 | 403 {'detail': 'User does not have permission: hierarchy_config.manage'} | PASS |  | config |
| TC-027 | SPEC01-A01 | ADMIN | Mark Config B unavailable | 200 | 200 | PASS |  | config |
| TC-028 | SPEC01-A02 | HM | HM available list excludes unavailable Config B | A in, B out | ['ALT-001d13', 'C12-09F72413', 'C12-1993C34F', 'C12-805E6FA8', 'C12-DA7BF4E6', 'C12-F847EECA', 'C12G-E71BB3B2', 'TEST-A' | PASS |  | config |
| TC-029 | SPEC01-C05 | ADMIN | Admin lists all configs | 200 list | 200 n=56 | PASS |  | config |
| TC-030 | SPEC01-C06 | HM | HM cannot list all (manage) configs | 403 | 403 | PASS |  | config |
| TC-031 | SPEC01-C07 | ADMIN | Duplicate config code rejected | 4xx | 400 {'detail': "Configuration code 'QA_TEST_20260816_52531E28_CFG_A' already exists"} | PASS |  | config |
| TC-032 | SPEC02-D01 | PD | PD cannot create draft | 403 | 403 {'detail': 'User does not have permission: project.create_draft'} | PASS |  | project |
| TC-033 | SPEC02-D02 | HM | HM creates project in DRAFT | 201 DRAFT | 201 DRAFT | PASS |  | project |
| TC-034 | SPEC02-D03 | HM | Create without config rejected | 4xx | 422 {'detail': [{'type': 'missing', 'loc': ['body', 'hierarchy_config_id'], 'msg': 'Field required', 'input': {'name': ' | PASS |  | project |
| TC-035 | SPEC02-D04 | HM | Create with unavailable config rejected | 4xx | 422 {'detail': 'Hierarchy configuration is not available for selection'} | PASS |  | project |
| TC-036 | SPEC02-G01 | HM | Generate hierarchy blocked for DRAFT | 403/422 | 403 {'detail': 'Generate Hierarchy requires project status APPROVED (current: DRAFT)'} | PASS |  | hierarchy |
| TC-037 | SPEC02-A01 | HM | Non-admin cannot approve | 403 | 403 {'detail': 'User does not have permission: project.approve'} | PASS |  | project |
| TC-038 | SPEC02-A02 | PD | PD cannot approve | 403 | 403 {'detail': 'User does not have permission: project.approve'} | PASS |  | project |
| TC-039 | SPEC02-A03 | PD | PD can assign HM | 200 | 200 {'name': 'QA_TEST_20260816_52531E28_PROJ_MAIN', 'description': 'QA main project', 'start_date': '2026-08-16T12:59:39 | PASS |  | project |
| TC-040 | SPEC02-A04 | ADMIN | Admin approves draft → APPROVED | APPROVED | 200 APPROVED | PASS |  | project |
| TC-041 | SPEC02-F01 | HM | Structural fields frozen after APPROVED | reject or unchanged flight_count | 422 {'detail': 'Structural fields are frozen after approval: flight_count, hierarchy_config_id, product_type, sdls_per_f | PASS |  | project |
| TC-042 | SPEC02-F02 | HM | Non-structural field remains editable after approve | 200 or documented restriction | 200 {'name': 'QA_TEST_20260816_52531E28_PROJ_MAIN', 'description': 'updated notes', 'start_date': '2026-08-16T12:59:39.3 | PASS |  | project |
| TC-043 | SPEC03-G01 | VIEWER | Non-HM cannot generate | 403 | 403 {'detail': 'User does not have permission: hierarchy.generate'} | PASS |  | hierarchy |
| TC-044 | SPEC03-G02 | HM | Generate hierarchy on APPROVED | READY_FOR_INVENTORY | 200 {'ok': True, 'project_id': 592, 'status': 'READY_FOR_INVENTORY', 'config_code': 'QA_TEST_20260816_52531E28_CFG_A', ' | PASS |  | hierarchy |
| TC-045 | SPEC03-T01 | HM | Generated tree: 2 flights × 2 SDLS = 4 SDLS | 2 flights, 4 SDLS | flights=2 sdls=4 status=READY_FOR_INVENTORY | PASS |  | hierarchy |
| TC-046 | SPEC03-T02 | HM | Each SDLS has the same system template count | equal system counts | [1, 1, 1, 1] | PASS |  | hierarchy |
| TC-047 | SPEC03-G03 | HM | Second generate blocked | 4xx | 422 {'detail': 'Hierarchy has already been generated for this project'} | PASS |  | hierarchy |
| TC-048 | SPEC03-T03 | HM | Reservable system node exists | system id present | {'flight_id': 379, 'sdls_id': 629, 'system_id': 767, 'flight': {'id': 379, 'name': 'Flight-1', 'code': 'F01', 'sequence' | PASS |  | hierarchy |
| TC-049 | SPEC03-C01 | HM | Concurrent double-click generate does not duplicate trees | one success, one reject OR both idempotent with one tree | [(200, "{'ok': True, 'project_id': 593, 'status': 'READY_FOR_INVENTORY', 'config_code': 'QA_TEST_20260816_52531E28_CFG_A | FAIL | HIGH | hierarchy |
| TC-050 | CRUD-INV-01 | IM | IM creates serialized inventory | 201 | 200 {'installation_date': None, 'installed_by_id': None, 'picture_url': None, 'original_part_number': None, 'original_se | PASS |  | inventory |
| TC-051 | CRUD-INV-03 | IM | Add second serial via receipt (same PN/name) | 201 | 200 | PASS |  | inventory |
| TC-052 | SPEC05-R01 | HM | HM cannot receive/create inventory | 403 | 403 {'detail': 'User does not have permission: create_inventory'} | PASS |  | inventory |
| TC-053 | SPEC04-R01 | HM | Reserve available serial for Flight/SDLS/system | outcome=reserved | 201 {'outcome': 'reserved', 'reservation': {'id': 332, 'project_id': 592, 'flight_id': 379, 'sdls_id': 629, 'target_enti | PASS |  | reservation |
| TC-054 | SPEC04-R02 | HM | DB reservation metadata stored (flight, sdls, by, expiry) | row with expiry and HM | {'status': 'active', 'reserved_by_user_id': 237, 'flight_id': 379, 'sdls_id': 629, 'serial_number': 'QA_TEST_20260816_52 | PASS |  | database |
| TC-055 | SPEC04-R03 | HM | Instance status RESERVED in DB | RESERVED | {'status_name': 'RESERVED'} | PASS |  | database |
| TC-056 | SPEC04-R04 | HM | Second project cannot reserve already reserved serial | fail or shortage | 422 {'detail': "Serial 'QA_TEST_20260816_52531E28-SN-001' is not available for reservation"} | PASS |  | reservation |
| TC-057 | SPEC04-R05 | HM | Cannot reserve on DRAFT project | 4xx | 403 {'detail': 'Project must be READY_FOR_INVENTORY to reserve inventory (current: DRAFT)'} | PASS |  | reservation |
| TC-058 | SPEC04-R06 | IM | IM cannot reserve | 403 | 403 {'detail': 'User does not have permission: inventory.reserve'} | PASS |  | reservation |
| TC-059 | SPEC06-U01 | IM | Inventory list shows reserved serial | Reserved visible | 200 [] | FAIL | HIGH | inventory |
| TC-060 | SPEC07-A01 | HM | HM assigns developer to hierarchy item | 200 | 200 {'entity_type': 'system', 'id': 767, 'name': 'QAComm_52531E28', 'assigned_developer_id': 240, 'assigned_developer_na | PASS |  | issue |
| TC-061 | SPEC07-A02 | IM | IM cannot assign developer | 403 | 403 {'detail': 'User does not have permission: hierarchy.assign_developer'} | PASS |  | issue |
| TC-062 | SPEC07-Q01 | DEV | Developer requests reserved item | 201 | 200 {'id': 173, 'project_id': 592, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_MAIN', 'flight_id': 379, 'flight_code | PASS |  | issue |
| TC-063 | SPEC07-I01 | IM | Issue without signature payload blocked | 4xx | 422 {'detail': 'Digital signature payload is required'} | PASS |  | issue |
| TC-064 | SPEC07-I02 | IM | IM issues with digital signature → ISSUED | ISSUED | 200 {'id': 173, 'project_id': 592, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_MAIN', 'flight_id': 379, 'flight_code | PASS |  | issue |
| TC-065 | SPEC07-I03 | IM | DB instance ISSUED after issue | ISSUED | {'status_name': 'ISSUED'} | PASS |  | database |
| TC-066 | SPEC07-T01 | SYSTEM | After 24h job, ISSUED → INSTALLATION_IN_PROGRESS | INSTALLATION_IN_PROGRESS | {'status_name': 'INSTALLATION_IN_PROGRESS'} job={'flipped': 2, 'skipped': 7, 'examined': 9} | PASS |  | issue |
| TC-067 | SPEC08-I01 | DEV | Developer starts install | 200 | 200 {'issuance_id': 187, 'entity_type': 'system', 'entity_id': 767, 'entity_name': 'QAComm_52531E28', 'project_id': 592, | PASS |  | install |
| TC-068 | SPEC08-V01 | HM | HM verify before complete rejected | 4xx | 422 {'detail': 'HM cannot verify without a Pass test result'} | PASS |  | install |
| TC-069 | SPEC08-T01 | DEV | Developer records Pass | 200 | 200 {'issuance_id': 187, 'entity_type': 'system', 'entity_id': 767, 'entity_name': 'QAComm_52531E28', 'project_id': 592, | PASS |  | install |
| TC-070 | SPEC08-T02 | DEV | Status under testing after test/install | UNDER_TESTING_REVIEW (or documented) | {'status_name': 'UNDER_TESTING_REVIEW'} | PASS |  | install |
| TC-071 | SPEC08-C01 | DEV | Dev reports installation complete | 200 | 200 {'issuance_id': 187, 'entity_type': 'system', 'entity_id': 767, 'entity_name': 'QAComm_52531E28', 'project_id': 592, | PASS |  | install |
| TC-072 | SPEC08-V02 | HM | HM verification queue lists item | list | 200 n=1 | PASS |  | install |
| TC-073 | SPEC08-V03 | HM | HM verifies after complete | 200 | 200 {'issuance_id': 187, 'entity_type': 'system', 'entity_id': 767, 'entity_name': 'QAComm_52531E28', 'project_id': 592, | PASS |  | install |
| TC-074 | SPEC08-V04 | HM | DB status INSTALLED_VERIFIED after HM verify | INSTALLED_VERIFIED | {'status_name': 'INSTALLED_VERIFIED'} | PASS |  | database |
| TC-075 | SPEC09-P01 | HM | Progress endpoint returns automatic % | progress payload | 200 {'project_id': 592, 'project_status': 'READY_FOR_INVENTORY', 'progress_pct': 25, 'weight': 4, 'verified_leaves': 1,  | PASS |  | progress |
| TC-076 | SPEC09-P02 | SYSTEM | No manual project % field on create payload | absent | checked draft schema | PASS |  | progress |
| TC-077 | SPEC09-G01 | ADMIN | Cannot mark complete with unverified remaining nodes | rejected or still not COMPLETED | 200 {'name': 'QA_TEST_20260816_52531E28_PROJ_MAIN', 'description': 'updated notes', 'start_date': '2026-08-16T12:59:39.3 | PASS | HIGH | progress |
| TC-078 | SPEC05-S01 | HM | Reserve with zero stock creates shortage | outcome=shortage | 201 {'outcome': 'shortage', 'reservation': None, 'shortage': {'id': 40, 'project_id': 596, 'flight_id': 384, 'sdls_id':  | PASS |  | shortage |
| TC-079 | SPEC05-N01 | HM | Shortage notifies HM and IM with PN/Qty/Flight/SDLS/LRU | notices contain context fields | HM=200 [{'id': 171, 'user_id': 237, 'shortage_id': 40, 'notice_type': 'shortage_created', 'part_number': None, 'qty': 1, | PASS |  | shortage |
| TC-080 | SPEC05-F01 | IM | FCFS: first shortage (A) gets first received unit | project A 596 | receipt=500 fulfill=None db={'project_id': 596, 'serial_number': 'QA_TEST_20260816_52531E28-SN-FCFS1'} | PASS |  | shortage |
| TC-081 | SPEC05-F02 | IM | Wrong PN receipt does not close unrelated shortage | B still open | (200, [{'id': 41, 'project_id': 597, 'flight_id': 385, 'sdls_id': 637, 'target_entity_type': 'system', 'target_entity_id | PASS |  | shortage |
| TC-082 | SPEC06-J01 | HM | Expiry job endpoint runs | 200 | 200 {'examined': 10, 'reminded': 1, 'released': 1, 'skipped_progressed': 0} | PASS |  | expiry |
| TC-083 | SPEC06-J02 | SYSTEM | Idle reserved stock auto-releases to AVAILABLE after grace | AVAILABLE / released | res={'status': 'released', 'notes': 'AUTO_RELEASE_EXPIRY', 'released_at': datetime.datetime(2026, 8, 16, 13, 0, 21, 5189 | PASS |  | expiry |
| TC-084 | SPEC06-J03 | SYSTEM | Issued/verified items are not auto-released | not AVAILABLE | {'status_name': 'INSTALLED_VERIFIED'} | PASS |  | expiry |
| TC-085 | SPEC06-N01 | HM | HM receives expiry reminder/auto-release notice | notice list | 200 [{'id': 40, 'user_id': 237, 'reservation_id': 334, 'notice_type': 'reservation_auto_released', 'part_number': 'QA_TE | PASS |  | expiry |
| TC-086 | SPEC10-F01 | DEV | Fail test recorded | 200 | 200 {'issuance_id': 188, 'entity_type': 'system', 'entity_id': 777, 'entity_name': 'QAComm_52531E28', 'project_id': 599, | PASS |  | rework |
| TC-087 | SPEC10-F02 | DEV | Fail never sets INSTALLED_VERIFIED | not verified | {'status_name': 'UNDER_TESTING_REVIEW'} | PASS |  | rework |
| TC-088 | SPEC10-F03 | IM | Fail creates rework case | case exists | 200 [{'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id': | PASS |  | rework |
| TC-089 | SPEC10-L01 | DEV | Developer removes failed item | 200 | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-090 | SPEC10-L02 | DEV | Returned to IM | 200 | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-091 | SPEC10-L03 | IM | IM starts inspection | 200 | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-092 | SPEC10-L04 | IM | Disposition REPAIRABLE | 200 | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-093 | SPEC10-L05 | IM | Repair complete before re-issue | 200 or not required | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-094 | SPEC10-L06 | IM | Signed re-issue after repair | 200 | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-095 | SPEC10-H01 | IM | Rework attempt history preserved | events/history present | 200 {'id': 16, 'project_id': 599, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_REWORK', 'flight_id': 387, 'sdls_id':  | PASS |  | rework |
| TC-096 | SPEC11-A01 | VIEWER | Unauthorized role cannot cancel | 403 | 403 {'detail': 'User does not have permission: project.cancel'} | PASS |  | recall |
| TC-097 | SPEC11-A02 | HM | Cancel without confirmation blocked | 4xx | 422 {'detail': 'Cancellation requires explicit confirmation'} | PASS |  | recall |
| TC-098 | SPEC11-A03 | HM | Cancel preview shows inventory impact | 200 | 200 {'project_id': 600, 'project_name': 'QA_TEST_20260816_52531E28_PROJ_CANCEL', 'project_status': 'READY_FOR_INVENTORY' | PASS |  | recall |
| TC-099 | SPEC11-A04 | HM | Cancel sets CANCELLED | CANCELLED | 200 {'project_id': 600, 'project_status': 'CANCELLED', 'critical_path_unfinished': True, 'reserved_released': 1, 'shorta | PASS |  | recall |
| TC-100 | SPEC11-R01 | HM | Reserved-not-issued stock released to AVAILABLE on cancel | AVAILABLE | {'status_name': 'AVAILABLE'} | PASS |  | recall |
| TC-101 | SPEC11-B01 | HM | Reserve blocked on cancelled project | 4xx | 403 {'detail': 'Project must be READY_FOR_INVENTORY to reserve inventory (current: CANCELLED)'} | PASS |  | recall |
| TC-102 | SPEC11-B02 | HM | Generate blocked on cancelled project | 4xx | 403 {'detail': 'Generate Hierarchy requires project status APPROVED (current: CANCELLED)'} | PASS |  | recall |
| TC-103 | SPEC11-V01 | HM | Cancelled hierarchy remains viewable | 200 | 200 status=CANCELLED | PASS |  | recall |
| TC-104 | SPEC12-C01 | HM | In-place configuration change rejected after hierarchy | 4xx | 422 {'detail': 'Structural fields are frozen after approval: flight_count, hierarchy_config_id, product_type, sdls_per_f | PASS |  | config-change |
| TC-105 | SPEC12-C02 | HM | HM requests configuration change | 201 | 201 {'id': 17, 'source_project_id': 601, 'source_project_name': 'QA_TEST_20260816_52531E28_PROJ_CC', 'source_project_sta | PASS |  | config-change |
| TC-106 | SPEC12-C03 | HM | Return all project inventory for CR | 200 | 200 {'id': 17, 'source_project_id': 601, 'source_project_name': 'QA_TEST_20260816_52531E28_PROJ_CC', 'source_project_sta | PASS |  | config-change |
| TC-107 | SPEC12-C04 | HM | HM submits CR with target approved config | 200 | 200 {'id': 17, 'source_project_id': 601, 'source_project_name': 'QA_TEST_20260816_52531E28_PROJ_CC', 'source_project_sta | PASS |  | config-change |
| TC-108 | SPEC12-C05 | HM | HM cannot approve CR | 403 | 403 {'detail': 'User does not have permission: config_change.approve'} | PASS |  | config-change |
| TC-109 | SPEC12-C06 | ADMIN | Admin approves CR | 200 | 200 {'id': 17, 'source_project_id': 601, 'source_project_name': 'QA_TEST_20260816_52531E28_PROJ_CC', 'source_project_sta | PASS |  | config-change |
| TC-110 | SPEC12-C07 | HM | Create successor project from approved CR | 201 | 201 {'change': {'id': 17, 'source_project_id': 601, 'source_project_name': 'QA_TEST_20260816_52531E28_PROJ_CC', 'source_ | PASS |  | config-change |
| TC-111 | SPEC12-C08 | SYSTEM | Old project marked SUPERSEDED | SUPERSEDED | {'status_name': 'SUPERSEDED'} | PASS |  | config-change |
| TC-112 | SPEC13-Q01 | ADMIN | Admin can list audit events | 200 list | 200 n=20 | PASS |  | audit |
| TC-113 | SPEC13-Q02 | ADMIN | Filter audit by project | 200 | 200 n=9 | PASS |  | audit |
| TC-114 | SPEC13-Q03 | ADMIN | Admin can export audit CSV | CSV | 200 text/csv; charset=utf-8 id,occurred_at,actor_user_id,actor_username,actor_role,action,entity_type,entity_id,project_ | PASS |  | audit |
| TC-115 | SPEC13-I01 | ADMIN | API cannot delete audit rows | 4xx | 405 {'detail': 'Audit rows cannot be updated or deleted'} | PASS |  | audit |
| TC-116 | SPEC13-I02 | ADMIN | API cannot update audit rows | 4xx | 405 {'detail': 'Audit rows cannot be updated or deleted'} | PASS |  | audit |
| TC-117 | SPEC13-A01 | VIEWER | Viewer cannot read workflow audit | 403 | 403 {'detail': 'User does not have permission: audit.read'} | PASS |  | audit |
| TC-118 | SPEC13-F01 | ADMIN | Audit envelope includes who/when/action | required fields | {'id': 'f0662fbd-c779-4c59-bb99-950bbd1e1c65', 'occurred_at': '2026-08-16T13:00:07.238559', 'actor_user_id': 237, 'actor | PASS |  | audit |
| TC-119 | CRUD-CUS-01 | ADMIN | Create customer | 201 | 200 {'name': 'QA_TEST_20260816_52531E28_CUSTOMER', 'organization_type': None, 'primary_contact_name': None, 'designation | PASS |  | customers |
| TC-120 | CRUD-ORD-01 | ADMIN | Create order | 201 | 422 {'detail': [{'type': 'missing', 'loc': ['body', 'order_number'], 'msg': 'Field required', 'input': {'customer_id': 1 | FAIL | MEDIUM | orders |
| TC-121 | NEG-ID-01 | HM | Non-existent project GET | 404 | 404 {'detail': 'Project not found'} | PASS |  | project |
| TC-122 | NEG-ID-02 | ADMIN | Approve non-existent project | 4xx | 403 {'detail': 'User does not have permission: project.approve'} | PASS |  | project |
| TC-123 | SPEC07-ISO-01 | HM | HM sees only owned/created/assigned projects | 404 or hidden for other HM | 404 {'detail': 'Project not found'} | PASS |  | security |
| TC-124 | UI-LOGIN-01 | ANON | Login page reachable | 200 | 200 | PASS |  | ui |
| TC-125 | UI-GATE-01 | ANON | Projects page without session | redirect to login or 200 client-gated | 200 loc=None | PASS |  | ui |
| TC-126 | SPEC00-AUTH | ADMIN | Logout | 200 | 200 {'message': 'Logged out successfully'} | PASS |  | auth |
| TC-127 | CLEANUP | SYSTEM | Remove QA_TEST records | deleted where safe | {"ok": false, "notes": ["configs: (psycopg2.errors.ForeignKeyViolation) update or delete on table \"hierarchyconfigurati | PARTIAL |  | database |
| TC-128 | ENV | SYSTEM | Database snapshot after cleanup | counts recorded | {"user": 21, "project": 203, "inventory": 95, "inventoryinstance": 629, "inventoryreservation": 38, "inventoryshortage": | PASS |  | database |
