import httpx
from datetime import date

API = "http://127.0.0.1:8000/api"
c = httpx.Client(timeout=60)
r = c.post(API + "/auth/login", data={"username": "admin", "password": "password@82768243"})
print("login", r.status_code)
tok = r.json()["access_token"]
h = {"Authorization": "Bearer " + tok}
cr = c.post(
    API + "/customers/",
    headers=h,
    json={"name": "QA_TEST_ORDFIX_CUST", "email": "qaordfix@qa.test"},
)
print("customer", cr.status_code, cr.text[:300])
cid = cr.json().get("id") if cr.status_code < 400 else None
body = {
    "customer_id": cid or 1,
    "order_number": "QA-ORD-FIX",
    "title": "QA order fix",
    "order_date": str(date.today()),
}
or_ = c.post(API + "/orders/", headers=h, json=body)
print("order", or_.status_code, or_.text[:500])
if or_.status_code < 400:
    oid = or_.json().get("id")
    if oid:
        d = c.delete(f"{API}/orders/{oid}/", headers=h)
        print("del order", d.status_code, d.text[:200])
if cid:
    d = c.delete(f"{API}/customers/{cid}/", headers=h)
    print("del cust", d.status_code, d.text[:200])
