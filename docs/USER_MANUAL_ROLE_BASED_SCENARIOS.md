# Role-Based User Manual / Verification Manual

**Application:** PLCM  
**Purpose:** Human testers can execute these scenarios in the UI (and, where noted, confirm in the database).  
**Audience:** Users who do not need source code.  
**Date:** 17 August 2026  

This manual is based on the **implemented** application and Specs 00–13. Only functions that exist for a role are included.

**Default URLs (local):**

- Application: `http://localhost:3000`
- API (for optional checks): `http://localhost:8000/api`
- Swagger: `http://localhost:8000/docs`

**Accounts:** Use users your administrator created for each role below. Workflow role names in the system are:

| Manual name | Role in Users screen |
|-------------|----------------------|
| Administrator | Admin |
| Project Director | ProjectDirector |
| Hierarchy Manager | HierarchyManager |
| Inventory Manager | InventoryManager |
| Developer | Developer |

Local bootstrap may include username `admin`. Optional demo users (`demo-pd`, `demo-hm`, `demo-im`, `demo-dev`) exist only if the server was started with `CREATE_WORKFLOW_DEMO_USERS=true`.

**Pass criteria for every scenario:** The **Expected Result** occurs, the UI does not crash, and (where a Database Verification section exists) the database matches.

**Known product issues to watch for (do not “work around” silently):**

- Two rapid Generate Hierarchy clicks may both succeed (race).
- Inventory Manager warehouse list/search may not show reserved serials even though Admin can see them.

---

# Role: Administrator

## Scenario ADMIN-001

### Scenario Name
Login

### Objective
Administrator can authenticate and reach the dashboard.

### Role
Administrator

### Preconditions
Application is running. Admin account is active.

### Test Data
Valid Admin username and password.

### Steps
1. Open the application.
2. Enter username.
3. Enter password.
4. Click Login.

### Expected Result
User is signed in. Sidebar shows Admin items including Users, Roles, Statuses, Settings, Projects, Inventory, Audit Trail, Config Changes.

### Database Verification
`userloginhistory` has a Success row for this user (optional).

### Pass Criteria
Dashboard loads without error.

### Notes
Invalid password must show an error and remain on login (see ADMIN-020).

---

## Scenario ADMIN-002

### Scenario Name
Logout

### Objective
Session ends.

### Role
Administrator

### Preconditions
Logged in as Admin.

### Test Data
None

### Steps
1. Click Logout.

### Expected Result
Returned to login. Direct visit to `/projects` does not show project data until login.

### Database Verification
Optional: logout time recorded.

### Pass Criteria
Token/session no longer usable.

### Notes
—

---

## Scenario ADMIN-003

### Scenario Name
Dashboard and navigation

### Objective
Admin can open major modules.

### Role
Administrator

### Preconditions
Logged in.

### Test Data
None

### Steps
1. Open Executive Dashboard.
2. Open Hierarchy Dashboard.
3. Open Projects, Inventory, Customers, Orders, Users, Settings, Audit Trail, Notifications.

### Expected Result
Each page loads. No permission error.

### Database Verification
N/A

### Pass Criteria
All listed pages open.

### Notes
—

---

## Scenario ADMIN-004

### Scenario Name
Create user

### Objective
Admin can create a user.

### Role
Administrator

### Preconditions
Logged in as Admin. Users permission available.

### Test Data
Username unique; password meeting policy (length, upper, lower, number, special).

### Steps
1. Open Users (Settings or `/users`).
2. Create user with username, full name, email, password.
3. Save.

### Expected Result
User appears in the list, typically as Viewer until a role is assigned.

### Database Verification
Row in `"user"` with that username.

### Pass Criteria
User can be found in the list.

### Notes
—

---

## Scenario ADMIN-005

### Scenario Name
Assign role

### Objective
Admin assigns HierarchyManager / InventoryManager / Developer / ProjectDirector.

### Role
Administrator

### Preconditions
User exists.

### Test Data
Target user; role name from the table above.

### Steps
1. Open the user.
2. Assign the role.
3. Save.

### Expected Result
User shows the new role. Admin role cannot be assigned to another user via the API.

### Database Verification
`userrole` links user to the chosen role.

### Pass Criteria
Next login for that user shows the role’s menus.

### Notes
Attempting to assign Admin to a non-admin user should be denied.

---

## Scenario ADMIN-006

### Scenario Name
Create hierarchy configuration

### Objective
Admin stores an approved Smart SDLS configuration.

### Role
Administrator

### Preconditions
Logged in as Admin.

### Test Data
Unique config code/name; product types SSDLS-1 and SSDLS-2; lower tree System → Subsystem → Module → Unit → Component.

### Steps
1. Open Settings → Hierarchy Configurations (`/settings?tab=hierarchy-configs`).
2. Create configuration.
3. Confirm fixed level order is shown.
4. Add product types and template nodes.
5. Save as available.

### Expected Result
Configuration is listed and available for HM project create.

### Database Verification
`hierarchyconfiguration` row; product types and nodes stored.

### Pass Criteria
HM can select this config on a new project.

### Notes
Non-Admin must not be able to create configs (HM-020).

---

## Scenario ADMIN-007

### Scenario Name
Mark configuration unavailable

### Objective
Unavailable configs are hidden from HM selection.

### Role
Administrator

### Preconditions
Two configs exist (A available, B will be unavailable).

### Test Data
Config B.

### Steps
1. Set Config B unavailable.
2. As HM, open Create Project configuration list.

### Expected Result
Config B is absent; Config A remains.

### Database Verification
`is_available` false on B.

### Pass Criteria
HM cannot create a project with B.

### Notes
—

---

## Scenario ADMIN-008

### Scenario Name
Approve draft project

### Objective
Only Admin moves DRAFT → APPROVED.

### Role
Administrator

### Preconditions
HM created a draft project.

### Test Data
Draft project name.

### Steps
1. Open Projects.
2. Open the draft.
3. Click Approve.

### Expected Result
Status badge **Approved**. Generate Hierarchy becomes available to HM.

### Database Verification
Project status `APPROVED`.

### Pass Criteria
HM can generate; before approve they could not.

### Notes
HM/PD Approve must fail (PD-004, HM-005).

---

## Scenario ADMIN-009

### Scenario Name
Approve configuration change

### Objective
Admin approves an HM configuration-change request.

### Role
Administrator

### Preconditions
HM submitted a CR after returning inventory.

### Test Data
Open CR on Config Changes (`/config-changes`).

### Steps
1. Open Config Changes.
2. Open the submitted request.
3. Approve.

### Expected Result
CR approved. HM can create the successor project.

### Database Verification
Config-change status approved.

### Pass Criteria
Successor project can be created; old project later **Superseded**.

### Notes
—

---

## Scenario ADMIN-010

### Scenario Name
Audit trail list, filter, CSV

### Objective
Admin queries immutable workflow history.

### Role
Administrator

### Preconditions
Some workflow actions have occurred.

### Test Data
A known project.

### Steps
1. Open Audit Trail (`/audit`).
2. Filter by project, actor, action, date.
3. Open an entity History drawer if present.
4. Export CSV.

### Expected Result
Rows show who, role, time, action, old→new where applicable. CSV downloads. There is no Edit/Delete on audit rows.

### Database Verification
`workflowauditevent` rows exist; application cannot UPDATE/DELETE them.

### Pass Criteria
Filters work; export works; no delete control.

### Notes
Viewer must be denied (VW-003).

---

## Scenario ADMIN-011

### Scenario Name
Statuses and roles screens

### Objective
Admin can view status and role masters.

### Role
Administrator

### Preconditions
Logged in.

### Test Data
None

### Steps
1. Open Statuses. Confirm inventory statuses Available, Reserved, Issued, Installation In Progress, Under Testing / Review, Installed Verified, Returned, Inspection, Reusable, Repairable, Scrapped.
2. Confirm project statuses Draft, Approved, Hierarchy Generated, Ready For Inventory, Cancelled, Completed, Superseded.
3. Open Roles and confirm workflow roles exist.

### Expected Result
Labels match the vocabulary above (not a parallel name such as “In Stock” for Available).

### Database Verification
`status` table `status_name` / `status_type`.

### Pass Criteria
All listed codes/labels present.

### Notes
—

---

## Scenario ADMIN-012

### Scenario Name
Customers and orders CRUD

### Objective
Admin can create customer and order.

### Role
Administrator

### Preconditions
Logged in with customer/order permissions.

### Test Data
Customer name; order title, order date; order number if the form requires it.

### Steps
1. Create customer.
2. Create order linked to that customer (include title and order date).
3. Open, edit a non-critical field, save.
4. Delete only if the record is test data.

### Expected Result
Create/read/update succeed. If order number is required on the form but then replaced by `ORD-YYYY-NNN`, record that behavior.

### Database Verification
`customer` and `"order"` rows.

### Pass Criteria
Records persist.

### Notes
—

---

## Scenario ADMIN-013

### Scenario Name
Unauthorized: Admin role assignment

### Objective
Admin cannot grant Admin to others.

### Role
Administrator

### Preconditions
A non-admin user exists.

### Test Data
Target user.

### Steps
1. Try to assign role Admin to that user.

### Expected Result
Denied.

### Database Verification
User roles unchanged.

### Pass Criteria
Still not Admin.

### Notes
—

---

## Scenario ADMIN-020

### Scenario Name
Invalid login

### Objective
Wrong password is rejected.

### Role
Administrator (attempt)

### Preconditions
Login page.

### Test Data
Valid username, wrong password.

### Steps
1. Submit login.

### Expected Result
Error message. Not signed in.

### Database Verification
Failed login history (optional).

### Pass Criteria
No session.

### Notes
—

---

# Role: Project Director

## Scenario PD-001

### Scenario Name
Login and dashboard

### Objective
PD signs in and sees allowed navigation.

### Role
Project Director

### Preconditions
PD user active.

### Test Data
PD credentials.

### Steps
1. Login.
2. Observe sidebar.

### Expected Result
Projects, dashboards, notifications visible. Hierarchy configuration create not available. Issue Queue / Inspect Queue typically hidden.

### Database Verification
N/A

### Pass Criteria
No Admin-only settings for configs/users unless extra permissions were granted.

### Notes
—

---

## Scenario PD-002

### Scenario Name
Assign Hierarchy Manager

### Objective
PD assigns HM to a project.

### Role
Project Director

### Preconditions
A project exists. An HM user exists.

### Test Data
Project id; HM user.

### Steps
1. Open the project.
2. Assign HM.
3. Save.

### Expected Result
Project shows assigned HM. That HM can see the project.

### Database Verification
`assigned_hm_id` (or equivalent) set.

### Pass Criteria
Assigned HM sees the project; another HM may not.

### Notes
—

---

## Scenario PD-003

### Scenario Name
Cannot create draft / cannot approve

### Objective
PD cannot perform HM draft or Admin approve.

### Role
Project Director

### Preconditions
Logged in as PD. An available configuration exists.

### Test Data
Config id.

### Steps
1. Attempt Create Project (draft workflow).
2. On a draft created by HM, attempt Approve.

### Expected Result
Create draft denied or not shown. Approve denied or not shown.

### Database Verification
No new DRAFT from PD; draft status unchanged.

### Pass Criteria
Both operations fail for PD.

### Notes
—

---

## Scenario PD-004

### Scenario Name
Cancel project with confirmation

### Objective
PD can cancel and trigger recall/release.

### Role
Project Director

### Preconditions
Project in a cancellable state (e.g. Ready For Inventory) with some reserved stock.

### Test Data
Project with at least one reserved (not issued) serial.

### Steps
1. Open project.
2. Open Cancel. Review impact preview.
3. Cancel without confirm — must be blocked.
4. Cancel with confirm.

### Expected Result
Status **Cancelled**. Reserved stock returns to Available. Reserve/Generate blocked. Hierarchy still viewable.

### Database Verification
Project `CANCELLED`; reservation released; instance `AVAILABLE`.

### Pass Criteria
Preview + confirmed cancel behave as above.

### Notes
Same cancel exists for HM (HM-018).

---

## Scenario PD-005

### Scenario Name
View progress (read)

### Objective
PD can read automatic progress.

### Role
Project Director

### Preconditions
Project with generated hierarchy.

### Test Data
Project.

### Steps
1. Open project / hierarchy dashboard.
2. Confirm overall % is displayed and not a manual slider.

### Expected Result
Progress is system-calculated.

### Database Verification
N/A (read API `/projects/{id}/progress/`).

### Pass Criteria
No editable “% complete” field.

### Notes
—

---

# Role: Hierarchy Manager

## Scenario HM-001

### Scenario Name
Login

### Objective
HM authenticates.

### Role
Hierarchy Manager

### Preconditions
HM user active.

### Test Data
HM credentials.

### Steps
1. Open application and login.

### Expected Result
Signed in. Projects, Verify Queue, Shortages (if permitted), Config Changes request, My notifications.

### Database Verification
N/A

### Pass Criteria
Login succeeds.

### Notes
—

---

## Scenario HM-002

### Scenario Name
Create draft project

### Objective
HM creates DRAFT from an available configuration.

### Role
Hierarchy Manager

### Preconditions
Available Spec 01 configuration. Optionally PD assignment.

### Test Data
Name; configuration; product type SSDLS-1; flight count 2; SDLS per flight 2.

### Steps
1. Open Projects → Create.
2. Select available configuration.
3. Enter product type, flights, SDLS per flight.
4. Save.

### Expected Result
Status **Draft**. Generate Hierarchy disabled.

### Database Verification
Project status `DRAFT`; `hierarchy_config_id` set.

### Pass Criteria
Draft exists; generate blocked.

### Notes
Missing config or unavailable config must error (HM-003).

---

## Scenario HM-003

### Scenario Name
Create project validation

### Objective
Invalid create is rejected.

### Role
Hierarchy Manager

### Preconditions
Logged in.

### Test Data
Empty required fields; unavailable config.

### Steps
1. Submit with missing configuration.
2. Submit with an unavailable configuration if you can force it.

### Expected Result
Validation error. No project, or project not created.

### Database Verification
No extra DRAFT row.

### Pass Criteria
Both invalid attempts fail.

### Notes
—

---

## Scenario HM-004

### Scenario Name
Cannot approve project

### Objective
HM is not the creation approver.

### Role
Hierarchy Manager

### Preconditions
Own draft exists.

### Test Data
Draft project.

### Steps
1. Open draft.
2. Look for Approve. If present, click it.

### Expected Result
Approve hidden or API/UI denied.

### Database Verification
Status remains `DRAFT`.

### Pass Criteria
Still draft until Admin approves.

### Notes
—

---

## Scenario HM-005

### Scenario Name
Generate hierarchy after approval

### Objective
HM materializes Flight → SDLS → System tree.

### Role
Hierarchy Manager

### Preconditions
Admin approved the project.

### Test Data
Approved project with flight_count=2, sdls_per_flight=2.

### Steps
1. Confirm Generate is enabled.
2. Confirm (if a dialog appears).
3. Wait for completion.
4. Open hierarchy tree / project detail.
5. Click Generate a second time.

### Expected Result
Status **Ready For Inventory** (or Hierarchy Generated then Ready). Tree shows 2 flights and 4 SDLS. Each SDLS has the same lower template. Second generate is blocked.

### Database Verification
`flight` / `sdls` / `system` counts match.

### Pass Criteria
Counts match; second generate fails.

### Notes
Do **not** double-click Generate; a known race can allow two successes.

---

## Scenario HM-006

### Scenario Name
Structural freeze after approve

### Objective
Config and counts cannot be silently edited in place.

### Role
Hierarchy Manager

### Preconditions
Project approved or hierarchy generated.

### Test Data
Attempt to change configuration or flight count.

### Steps
1. Edit project.
2. Try to change configuration or flight/SDLS counts.
3. Save.

### Expected Result
Rejected or fields disabled. Name/description may still save.

### Database Verification
`hierarchy_config_id`, `flight_count` unchanged.

### Pass Criteria
No in-place structural change.

### Notes
Use Config Change workflow instead (HM-016).

---

## Scenario HM-007

### Scenario Name
Reserve available inventory

### Objective
HM locks AVAILABLE stock to Flight → SDLS → item.

### Role
Hierarchy Manager

### Preconditions
Project Ready For Inventory. Matching AVAILABLE serial exists (same system name / PN).

### Test Data
Serial number; target system node.

### Steps
1. Open project hierarchy.
2. Reserve on the system (or leaf) node.
3. Confirm reserved badge, reserved-by, expiry.

### Expected Result
Item status **Reserved**. Serial not reservable by another project.

### Database Verification
`inventoryreservation` active; instance status `RESERVED`.

### Pass Criteria
Lock holds.

### Notes
—

---

## Scenario HM-008

### Scenario Name
Release unused reservation

### Objective
HM returns unused reserved stock to Available.

### Role
Hierarchy Manager

### Preconditions
Active reservation, not issued.

### Test Data
Reservation on project.

### Steps
1. Open reservations.
2. Release with confirm.

### Expected Result
Status **Available**. Another project can reserve it.

### Database Verification
Reservation released; instance `AVAILABLE`.

### Pass Criteria
Stock free again.

### Notes
—

---

## Scenario HM-009

### Scenario Name
Shortage when stock is missing

### Objective
Unavailable reserve creates shortage and notifies HM and IM.

### Role
Hierarchy Manager

### Preconditions
Ready project whose template name has no stock.

### Test Data
Hierarchy node with no matching inventory.

### Steps
1. Reserve.
2. Open Shortages (`/shortages`) and Notifications.

### Expected Result
Shortage OPEN. Notice includes part number, qty, flight, SDLS, LRU/item.

### Database Verification
`inventoryshortage` OPEN; `inventoryshortagenotice` for HM and IM.

### Pass Criteria
Shortage + notices exist.

### Notes
—

---

## Scenario HM-010

### Scenario Name
Assign developer

### Objective
HM assigns a Developer to a hierarchy item.

### Role
Hierarchy Manager

### Preconditions
Reserved (or reservable) item. Developer user exists. HM owns the project.

### Test Data
Developer user.

### Steps
1. Open hierarchy item.
2. Assign Developer.
3. Confirm Assigned badge.

### Expected Result
Developer sees the item under My Assignments.

### Database Verification
Assignment stored on entity.

### Pass Criteria
Dev can request the item; IM cannot assign.

### Notes
Reassign is allowed until IM issues.

---

## Scenario HM-011

### Scenario Name
Verify installation

### Objective
HM verifies only after Dev reports complete.

### Role
Hierarchy Manager

### Preconditions
Dev completed pass path; item in verify queue.

### Test Data
Issuance in Verify Queue (`/verify-queue`).

### Steps
1. Open Verify Queue.
2. Attempt verify if complete was not reported — must fail.
3. After Dev reports complete, Verify.

### Expected Result
Status **Installed Verified**. Progress % increases.

### Database Verification
Instance `INSTALLED_VERIFIED`.

### Pass Criteria
Verified only after complete.

### Notes
Fail path must never verify (HM-012 / DEV-007).

---

## Scenario HM-012

### Scenario Name
Progress and completion gate

### Objective
Progress is automatic; project is not complete with unfinished nodes.

### Role
Hierarchy Manager

### Preconditions
Hierarchy generated; some items verified, some not.

### Test Data
Project.

### Steps
1. Open progress / dashboard.
2. Confirm no manual % control.
3. Confirm project cannot be marked Completed while nodes remain unverified.

### Expected Result
Partial % shown. Completion blocked.

### Database Verification
Status not `COMPLETED`.

### Pass Criteria
Automatic %; gate holds.

### Notes
—

---

## Scenario HM-013

### Scenario Name
Project list isolation

### Objective
HM sees owned/created/assigned projects only.

### Role
Hierarchy Manager

### Preconditions
Two HM users; each has a project.

### Test Data
Other HM’s project URL/id.

### Steps
1. From HM-A, open own projects — visible.
2. Open HM-B project by URL if known.

### Expected Result
Other project hidden (not found).

### Database Verification
N/A

### Pass Criteria
404/hidden, not a full record.

### Notes
—

---

## Scenario HM-014

### Scenario Name
Reservation expiry reminder (long-running)

### Objective
Idle reserved stock reminds HM after policy idle period.

### Role
Hierarchy Manager

### Preconditions
Reservation left unused (not issued). Policy default 30 days + 7 day grace.

### Test Data
Reserved serial.

### Steps
1. Leave reservation idle (or ask Admin to run expiry job after test dates are aged in a test environment).
2. Check Notifications.

### Expected Result
Reminder, then auto-release to Available with reason auto-expiry if ignored.

### Database Verification
`last_reminder_at`; later `released_at` / instance AVAILABLE.

### Pass Criteria
Issued items are not auto-released.

### Notes
Do not age production reservations.

---

## Scenario HM-015

### Scenario Name
Cancel project

### Objective
HM cancel with confirmation.

### Role
Hierarchy Manager

### Preconditions
Cancellable project.

### Test Data
Project with reserved stock.

### Steps
1. Cancel without confirmation — blocked.
2. Confirm cancel.

### Expected Result
Cancelled; reserved stock available; further reserve/issue/generate blocked; tree viewable.

### Database Verification
`CANCELLED`.

### Pass Criteria
Same as PD-004.

### Notes
—

---

## Scenario HM-016

### Scenario Name
Configuration change (no in-place edit)

### Objective
HM moves to a new config via CR + new project.

### Role
Hierarchy Manager

### Preconditions
Hierarchy generated (and/or reserved). Second available config exists.

### Test Data
Source project; target config; reason.

### Steps
1. Confirm in-place config selector is disabled.
2. Request configuration change (`/config-changes` or project action).
3. Return all project inventory.
4. Submit target config + reason.
5. Wait for Admin approve.
6. Create new Project/Flight.

### Expected Result
Old project remains, then **Superseded**, linked to successor. New project uses the new config.

### Database Verification
`configchangerequest`; successor/predecessor ids; old status `SUPERSEDED`.

### Pass Criteria
CONTROL RULE held.

### Notes
—

---

## Scenario HM-020

### Scenario Name
Cannot manage hierarchy configurations

### Objective
HM is read-only for templates.

### Role
Hierarchy Manager

### Preconditions
Logged in as HM.

### Test Data
None

### Steps
1. Open Settings hierarchy configs if the menu appears.
2. Attempt create/edit.

### Expected Result
Denied or hidden.

### Database Verification
No new configuration from HM.

### Pass Criteria
Create fails.

### Notes
—

---

# Role: Inventory Manager

## Scenario IM-001

### Scenario Name
Login and queues

### Objective
IM reaches inventory, issue queue, inspect queue, shortages.

### Role
Inventory Manager

### Preconditions
IM user active.

### Test Data
IM credentials.

### Steps
1. Login.
2. Open Inventory, Issue Queue, Inspect Queue, Shortages, Notifications.

### Expected Result
Those modules load. Project Approve / Generate typically hidden.

### Database Verification
N/A

### Pass Criteria
Queues open.

### Notes
If Inventory list is empty for IM while Admin sees stock, record as defect (known HIGH).

---

## Scenario IM-002

### Scenario Name
Receive stock

### Objective
IM enters part/serial into inventory.

### Role
Inventory Manager

### Preconditions
Logged in as IM.

### Test Data
Name matching a hierarchy system; unique serial; location; part number.

### Steps
1. Open Inventory → Create / receive.
2. Enter type system, name, PN, serial, location.
3. Save.

### Expected Result
Serial listed. If a matching OPEN shortage exists, FCFS auto-reserve may occur immediately.

### Database Verification
`inventory` + `inventoryinstance` AVAILABLE or immediately RESERVED if FCFS matched.

### Pass Criteria
Receipt succeeds.

### Notes
Wrong PN must not close an unrelated shortage (IM-004).

---

## Scenario IM-003

### Scenario Name
FCFS auto-reserve

### Objective
First shortage gets first unit.

### Role
Inventory Manager

### Preconditions
Project A shortage at T0, Project B shortage at T1, same PN/name, qty 1 each.

### Test Data
One received serial.

### Steps
1. Receive one matching unit.
2. Check both projects’ reservations/shortages.

### Expected Result
Only A reserved. B still short.

### Database Verification
Reservation `project_id` = A.

### Pass Criteria
A wins.

### Notes
Receive two units: both can fulfill if each needed 1.

---

## Scenario IM-004

### Scenario Name
Wrong part number receipt

### Objective
Unrelated receipt does not clear shortage.

### Role
Inventory Manager

### Preconditions
Open shortage for PN-X.

### Test Data
Serial with different name/PN.

### Steps
1. Receive unrelated stock.
2. Recheck shortage.

### Expected Result
Shortage still OPEN.

### Database Verification
Shortage status OPEN/PARTIAL.

### Pass Criteria
Unchanged shortage.

### Notes
—

---

## Scenario IM-005

### Scenario Name
Issue to developer with signature

### Objective
IM issues reserved, requested stock with signature.

### Role
Inventory Manager

### Preconditions
HM assigned Dev; Dev requested; item reserved to that hierarchy.

### Test Data
Issue Queue item; digital signature or hard-copy acknowledgment.

### Steps
1. Open Issue Queue (`/issue-queue`).
2. Attempt issue with no signature — blocked.
3. Issue with signature.

### Expected Result
Status **Issued**. Reservation consumed into issuance.

### Database Verification
Instance `ISSUED`; issuance row with signature type.

### Pass Criteria
Unsigned issue fails; signed issue succeeds.

### Notes
After ~24 hours the system should move to Installation In Progress without a manual status dropdown.

---

## Scenario IM-006

### Scenario Name
Cannot reserve or assign developer

### Objective
IM does not perform HM reservation or assignment.

### Role
Inventory Manager

### Preconditions
Ready project.

### Test Data
Hierarchy node.

### Steps
1. Confirm Reserve / Assign Developer are hidden or denied.

### Expected Result
403 or no action.

### Database Verification
No new reservation by IM.

### Pass Criteria
Denied.

### Notes
—

---

## Scenario IM-007

### Scenario Name
Inspect rework / recall disposition

### Objective
IM inspects returned units and sets Reusable / Repairable / Scrapped.

### Role
Inventory Manager

### Preconditions
Dev returned a failed or recalled item.

### Test Data
Inspect Queue (`/inspect-queue`) case.

### Steps
1. Start inspection.
2. Set disposition (one of the three).
3. If Repairable, complete repair and re-issue with signature.
4. If Scrapped, confirm that serial cannot be re-issued.

### Expected Result
Statuses match: Reusable→Available, Repairable, or Scrapped.

### Database Verification
Instance status matches disposition.

### Pass Criteria
Disposition persisted; scrap cannot re-issue.

### Notes
—

---

## Scenario IM-008

### Scenario Name
Reserved serial visibility

### Objective
IM can see Reserved serials and still issue them.

### Role
Inventory Manager

### Preconditions
An HM reservation exists.

### Test Data
Reserved serial.

### Steps
1. Open Inventory.
2. Search the serial.
3. Filter stock = Reserved if available.
4. Open the serial / Reserved badge.

### Expected Result
Status Reserved with project, flight, SDLS, hierarchy, reserved-by, dates. Issue action still available for the request path.

### Database Verification
Reservation active.

### Pass Criteria
Serial visible to IM. If list is empty, fail and log (known HIGH).

### Notes
Admin list may succeed even when IM list does not.

---

# Role: Developer

## Scenario DEV-001

### Scenario Name
Login and My Assignments

### Objective
Developer sees assigned work only.

### Role
Developer

### Preconditions
HM assigned this Dev to a hierarchy item.

### Test Data
Dev credentials.

### Steps
1. Login.
2. Open My Assignments (`/my-assignments`).

### Expected Result
Assigned items listed. Admin/config screens hidden.

### Database Verification
N/A

### Pass Criteria
Assignments visible.

### Notes
—

---

## Scenario DEV-002

### Scenario Name
Request item from IM

### Objective
Developer requests reserved assigned stock.

### Role
Developer

### Preconditions
Item assigned and reserved; not yet issued.

### Test Data
Assignment row.

### Steps
1. Request item (one / all / reserved-only if bulk exists).
2. Confirm it appears in IM Issue Queue.

### Expected Result
Pending request created. Dev cannot take stock without IM issue.

### Database Verification
`inventoryitemrequest` pending.

### Pass Criteria
Request exists; stock still Reserved until IM issues.

### Notes
—

---

## Scenario DEV-003

### Scenario Name
Install after issue

### Objective
Developer records installation.

### Role
Developer

### Preconditions
Item issued (and preferably Installation In Progress after 24h or after start-install).

### Test Data
Issued assignment.

### Steps
1. Open assignment.
2. Start / record install.

### Expected Result
Status moves toward Installation In Progress / Under Testing.

### Database Verification
Instance status not still merely RESERVED.

### Pass Criteria
Install recorded.

### Notes
Unassigned developer must be blocked (DEV-008).

---

## Scenario DEV-004

### Scenario Name
Test Pass, report complete

### Objective
Pass path toward HM verify.

### Role
Developer

### Preconditions
Install started.

### Test Data
Pass result.

### Steps
1. Submit test result Pass.
2. Report installation complete.
3. Confirm HM sees Verify Queue.

### Expected Result
Complete reported. Item not Installed Verified until HM verifies.

### Database Verification
Not `INSTALLED_VERIFIED` yet.

### Pass Criteria
HM can verify; Dev cannot self-verify.

### Notes
—

---

## Scenario DEV-005

### Scenario Name
Test Fail opens rework

### Objective
Fail never verifies.

### Role
Developer

### Preconditions
Item under test.

### Test Data
Fail result.

### Steps
1. Submit Fail.
2. Remove item.
3. Return to IM.

### Expected Result
Rework case open. Status not Installed Verified. IM inspect queue populated.

### Database Verification
Rework case; instance Returned/related status.

### Pass Criteria
Fail path only.

### Notes
Loop again after re-issue until Pass + HM verify.

---

## Scenario DEV-006

### Scenario Name
Recall return

### Objective
Developer returns issued items when project is cancelled.

### Role
Developer

### Preconditions
Cancel created a recall task for this Dev.

### Test Data
Recall task.

### Steps
1. Confirm return on the recall task.
2. IM then inspects.

### Expected Result
Item returned for IM disposition.

### Database Verification
Recall task stage advanced.

### Pass Criteria
Dev return recorded.

### Notes
Force-return is PD/HM/Admin recovery, not Dev.

---

## Scenario DEV-007

### Scenario Name
Cannot approve / reserve / issue

### Objective
Developer cannot perform other roles’ workflow gates.

### Role
Developer

### Preconditions
Logged in as Dev.

### Test Data
A draft project id if known.

### Steps
1. Confirm Approve, Reserve, Issue, Config manage are hidden or denied.

### Expected Result
403 or hidden.

### Database Verification
N/A

### Pass Criteria
Denied.

### Notes
—

---

## Scenario DEV-008

### Scenario Name
Cannot act on another developer’s item

### Objective
Only assigned Dev installs/tests that item.

### Role
Developer

### Preconditions
Item assigned to Dev-A. Tester uses Dev-B.

### Test Data
Entity type/id of Dev-A’s item.

### Steps
1. As Dev-B, open My Assignments — item absent.
2. If a direct URL/API is attempted, action is denied.

### Expected Result
403 / not listed.

### Database Verification
N/A

### Pass Criteria
Blocked.

### Notes
—

---

# Cross-role error scenarios

## Scenario X-001

### Scenario Name
Unauthenticated access

### Objective
Anonymous user cannot call APIs or see data.

### Role
None

### Preconditions
Logged out.

### Test Data
None

### Steps
1. Open `/projects`.
2. Call API without token if testing with Swagger.

### Expected Result
Login page or 401.

### Database Verification
N/A

### Pass Criteria
No data leak.

### Notes
—

## Scenario X-002

### Scenario Name
Non-existent record

### Objective
Invalid ids fail safely.

### Role
Any authenticated

### Preconditions
Logged in.

### Test Data
Project id 99999999

### Steps
1. Open `/projects/99999999`.

### Expected Result
Not found. App does not crash.

### Database Verification
N/A

### Pass Criteria
404/empty state.

### Notes
—
