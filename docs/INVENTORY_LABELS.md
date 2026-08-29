# Inventory labels and scanning

Inventory Managers can generate QR labels, Code 128 barcodes, or both from the
Inventory list. Serialized groups generate one label per selected serial. The
label preview includes the inventory name, part/serial number, label type, and
opaque signed payload.

Select Print for the first print. Reprint requires a reason and increments the
existing label’s print count; it does not create stock or a new serial. History
shows every print/reprint and scan event with quantity, timestamp, and reason.

The Scan Label page accepts camera scans where the browser provides
`BarcodeDetector` support and always provides manual payload entry as a fallback.
The backend must resolve and authorize a signed payload before inventory details
are displayed. Invalid, altered, unassigned, deactivated, replaced, and
conflicting labels produce a clear result state.

QR payloads contain only an opaque label ID and a server signature:
`PLCM1.<label-id>.<signature>`. Barcodes use a shorter signed payload:
`PLCB.<base36-label-database-id>.<short-signature>`, which is suitable for
millions of labels while remaining server-validated. A copied physical sticker
cannot be detected by software alone. Use activation/investigation, server
validation, scan history, and user/time/location checks to identify suspicious
reuse. Authorized managers can investigate, deactivate, or replace a compromised
label from the scan result.

The current frontend has no test runner, so label behavior is covered by the
typed API/UI implementation and the backend tests; use `npm run lint` and
`npm run build` in an environment with frontend dependencies installed.
