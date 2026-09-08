# Form validation test scenarios

Manual QA matrix for the rules in `docs/form_validation_rules_review.md`.
Expected messages come from `lib/form-validation.ts`.

**How to use:** for each row, perform the action with the given input and confirm the result. Required fields show a red `*`. Optional fields must save when left empty.

## 1. Authentication & users

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| AUTH-01 | Login | Blank submit | Empty username and password | Toast: `Please enter username and password`. No API call. |
| AUTH-02 | Login | Username only | Username filled, password empty | Same toast. No login. |
| AUTH-03 | Login | Password only | Password filled, username empty/whitespace | Same toast. No login. |
| AUTH-04 | Login | Valid credentials | Both fields filled | Login proceeds. |
| AUTH-05 | Signup | Missing identity | Empty full name / username / password | Field-specific required toast (`Full name` / `Username` / `Password`). |
| AUTH-06 | Signup | Confirm password blank | Password filled, confirm empty | Toast: `Confirm password is required`. |
| AUTH-07 | Signup | Password mismatch | Password ≠ confirm | Toast: `Passwords do not match`. |
| AUTH-08 | Signup | Policy fail | Password shorter than policy / missing upper/lower/number | Policy toast from settings (min length, character classes). |
| AUTH-09 | Signup | Email optional | Valid required fields, email empty | Signup succeeds. |
| AUTH-10 | Signup | Invalid email | Email `not-an-email` | Toast: `Enter a valid email address`. |
| AUTH-11 | Signup | Valid | Name, username, matching policy password, optional email | Request submitted. |
| AUTH-12 | Change password | Missing current/new | Either blank | `Current password is required` or `New password is required`. |
| AUTH-13 | Change password | Confirm blank/mismatch | Confirm empty or different | Confirm required or `Passwords do not match`. |
| AUTH-14 | Change password | Policy / history | Weak password or reuse of last 5 | Client policy toast, or backend history error. |
| AUTH-15 | Users create | Missing username/password/full name | Any blank | Field-specific required toast. |
| AUTH-16 | Users create | Weak password | Fails policy | Policy toast. |
| AUTH-17 | Users create | Email optional / invalid | Empty OK; `bad@` rejected | Empty saves; invalid email toast. |
| AUTH-18 | Users edit | Full name blank | Empty name | `Full name is required`. |
| AUTH-19 | Users edit | Password omitted | Leave password empty | Update succeeds (password unchanged). |
| AUTH-20 | Users edit | Password provided | New password fails policy | Policy toast. |

## 2. Settings / admin

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| SET-01 | Role create/edit | Name blank | Empty name | `Role name is required`. |
| SET-02 | Role create/edit | Optional fields | Description and permissions empty | Saves with name only. |
| SET-03 | Permission create/edit | Name blank | Empty name | `Permission name is required`. |
| SET-04 | Permission create/edit | Description empty | Name filled | Saves. |
| SET-05 | Status create/edit | Name blank | Empty name | `Status name is required`. |
| SET-06 | Status create/edit | Category blank | No category | `Category is required`. |
| SET-07 | Status create/edit | Invalid color | Non-hex / not in palette | `Select a valid color from the palette (e.g. #059669)`. |
| SET-08 | Status create/edit | Valid hex | Name, category, palette hex | Saves. Description optional. |
| SET-09 | Entity List | Name blank | Empty name | `Name is required.` |
| SET-10 | Entity List | Parent missing (non-system) | Level ≠ system, no parent | Message to select parent level. |
| SET-11 | Entity List | System without parent | Level = system, no parent | Creates. Abbreviation optional. |
| SET-12 | Hierarchy config | Name blank | Empty name | `Configuration name is required`. |
| SET-13 | Hierarchy config | Duplicate name | Existing name | Name-already-exists toast. |
| SET-14 | Hierarchy config | No product types | All product type codes cleared | `Add at least one product type`. |
| SET-15 | Hierarchy config | No nodes | Empty tree | `Add at least one hierarchy node before saving`. |
| SET-16 | Hierarchy config | Unassigned node | Node without entity | Assign-an-entity toast with unassigned count. |
| SET-17 | Hierarchy config | Valid | Unique name, ≥1 product type, ≥1 assigned node | Saves (code auto-slugged from name if blank). |

## 3. CRM — customers & orders

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| CRM-01 | Customer create | Name blank | Empty name | `Customer name is required`. |
| CRM-02 | Customer create | Status blank | No status | `Status is required`. |
| CRM-03 | Customer create | Optional contacts | Email/phone/country empty | Creates when name + status present. |
| CRM-04 | Customer create | Invalid email | `foo` | `Enter a valid email address`. |
| CRM-05 | Customer edit | Name blank | Clear name | `Customer name is required`. |
| CRM-06 | Customer edit | Status blank | Clear status | `Status is required`. |
| CRM-07 | Order create (`/orders`) | Customer blank | No customer | `Customer is required`. **Primary gap fix.** |
| CRM-08 | Order create | Title blank | Empty title | `Title is required`. |
| CRM-09 | Order create | Order date blank | Empty date | `Order date is required`. |
| CRM-10 | Order create | Currency blank | Clear default `PKR` | `Currency is required`. |
| CRM-11 | Order create | Status blank | No status | `Status is required`. |
| CRM-12 | Order create | Optional commercial fields | Contract, PO, delivery, value, PM, remarks empty | Creates. |
| CRM-13 | Order edit | Customer cleared | Unset customer | `Customer is required`. |
| CRM-14 | Order on customer detail | Customer pre-set | Open create from customer page | Customer selected; still required if cleared. |
| CRM-15 | Order create | Happy path | Customer, status, title, date, currency | Creates. |

## 4. Projects

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| PRJ-01 | Draft create | Name blank | Empty name | `Name is required`. |
| PRJ-02 | Draft create | No order | No order | `Order is required`. |
| PRJ-03 | Draft create | No configuration | No hierarchy config | `Hierarchy configuration is required`. |
| PRJ-04 | Draft create | No product type | Config selected, product type cleared | `Product type is required`. |
| PRJ-05 | Draft create | Flight count &lt; 1 | 0 | `Flight count must be at least 1`. |
| PRJ-06 | Draft create | SDLS count &lt; 1 | Any flight SDLS 0 | `Each flight must have at least 1 SDLS`. |
| PRJ-07 | Draft create | Optional fields | Description, dates, owner empty | Creates draft (or existing-project flow if flagged). |
| PRJ-08 | Draft create | Happy path | Name, order, config, product type, flights ≥1, SDLS ≥1 each | Creates. |
| PRJ-09 | Project edit | Missing name/owner/status/dates | Any required blank | Field-specific required toast. |
| PRJ-10 | Config change | Missing target/product/reason | Any blank | `Select a target configuration, product type, and enter a reason`. |
| PRJ-11 | Config change | Optional counts | Flight/SDLS blank | Submit allowed; values coerced. |

## 5. Hardware hierarchy

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| HW-01 | System create/edit | Name blank | Empty name | `Name is required`. |
| HW-02 | System create/edit | No project | No project | `Project is required`. |
| HW-03 | System create/edit | No status | No status | `Status is required`. |
| HW-04 | System | Optional install | Date / installed-by / picture empty | Saves. |
| HW-05 | Subsystem | No system parent | No system | `System is required`. |
| HW-06 | Module | No subsystem parent | No subsystem | `Subsystem is required`. |
| HW-07 | Unit | No module parent | No module | `Module is required`. Orphans blocked on UI. |
| HW-08 | Component | No unit parent | No unit | `Unit is required`. Orphans blocked on UI. |
| HW-09 | EntityForm number `0` | Required number field = `0` | Value `0` | **Accepted** (not treated as empty). Empty string still fails. |
| HW-10 | EntityForm from stock | Serialized PN, no serial | Part selected, serial empty | Error: select a serial number for the chosen part number. |
| HW-11 | Assign developer | No developer | Empty select | `Select a developer`. |
| HW-12 | Assign developer | Already issued | Item issued | `Assignment cannot be changed after physical issue`. |

## 6. Inventory

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| INV-01 | Create | Category blank | Empty name | Required category toast. |
| INV-02 | Create bulk | Location blank | No room/cabinet/rack | Category **and** Room / Cabinet / Rack required. |
| INV-03 | Create serialized | Part number blank | Empty PN | `Part number is required for serialized inventory`. |
| INV-04 | Create serialized non-component | Location blank | Empty location | Room / Cabinet / Rack required for each serialized unit. |
| INV-05 | Create component qty | Quantity 0 | Qty ≤ 0 | `Please enter a quantity greater than 0 for component inventory`. |
| INV-06 | Create | Optional metadata | OEM, SKU, dates, holder empty | Saves when required fields present. |
| INV-07 | Issue | No signature | Digital/hard-copy missing | `Signature is required to issue`. |
| INV-08 | Issue | No developer | Empty developer | `Select a developer`. |
| INV-09 | Issue serialized | No serial | Empty instance | `Select a serial number to issue`. |
| INV-10 | Issue bulk | Qty &gt; available | Qty 99 when 2 available | `Only 2 unit(s) available to issue`. |
| INV-11 | Issue | Notes empty | Notes blank | Allowed (optional). |
| INV-12 | Issuance remarks / return decision | Remarks blank | Empty notes | Confirm disabled / `Remarks is required`. |
| INV-13 | Shortage receive | Qty &lt; 1 | 0 or 1.5 | `Enter a quantity of at least 1`. |
| INV-14 | Shortage receive | PN blank | Empty part number | `Part number is required`. |
| INV-15 | Shortage receive | Serial/location empty | Optional | Receive succeeds. |

## 7. Maintenance, attachments

| ID | Form | Scenario | Input | Expected result |
| --- | --- | --- | --- | --- |
| MNT-01 | Case create | No project | Empty project | `Project is required`. |
| MNT-02 | Case create | No description | Empty description | `Description is required`. |
| MNT-03 | Case edit | No status | Status cleared | `Status is required`. |
| MNT-04 | Case edit | Resolution notes empty | Notes blank | Allowed (optional). |
| MNT-05 | Maintenance log | Serial blank | Empty serial | `Serial number is required`. |
| MNT-06 | Maintenance log | No lookup | Serial filled, no lookup | `Look up a serial number before saving`. |
| MNT-07 | Maintenance log | No performed-by | Empty user | `Performed by is required`. |
| MNT-08 | Maintenance log | Notes blank | Empty notes | `Notes is required`. |
| MNT-09 | Resolve fault | No resolution type | Type empty | `Resolution type is required` (submit disabled until selected). |
| MNT-10 | Resolve fault REPLACED | Stock exists, no serial | Type = Replacement, no row | `Replacement serial is required`. |
| MNT-11 | Resolve fault REPLACED | No stock | Type = Replacement, empty stock | Submit stays blocked; notes optional. |
| MNT-12 | Attachment upload | `requireFile=true`, no file | No file | `File is required`. |
| MNT-13 | Attachment upload | Type/description | Type default `other`, description empty | Allowed. |

## 8. Cross-cutting

| ID | Scenario | Expected result |
| --- | --- | --- |
| X-01 | Required labels | Required fields show a red `*` on customers, orders, projects, EntityForm, issuance remarks. |
| X-02 | Optional metadata | Contact info, descriptions, install dates, order commercial extras, project create dates/owner, inventory OEM/SKU save when omitted. |
| X-03 | Whitespace-only strings | `"   "` treated as empty for required text fields. |
| X-04 | Numeric `0` vs missing id | Quantity/`0` is valid on EntityForm; parent FK `0`/empty still required. |
| X-05 | Backend still last line | Invalid credentials, unique email/username, Entity List name match, and password history still come from the API. |
