"""Per-statement cleanup of leftover QA_TEST rows."""
from sqlalchemy import create_engine, text

PREFIX = "QA_TEST_20260816_52531E28%"
engine = create_engine("postgresql://postgres:postgre@localhost:5432/postgres", isolation_level="AUTOCOMMIT")

STMTS = [
    "DELETE FROM hierarchyconfigproducttype WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p)",
    "DELETE FROM hierarchyconfignode WHERE parent_id IN (SELECT id FROM hierarchyconfignode WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p))",
    "DELETE FROM hierarchyconfignode WHERE configuration_id IN (SELECT id FROM hierarchyconfiguration WHERE code LIKE :p)",
    "DELETE FROM hierarchyconfiguration WHERE code LIKE :p",
    'DELETE FROM entitystatushistory WHERE changed_by IN (SELECT id FROM "user" WHERE username LIKE :p)',
    'DELETE FROM userrole WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE :p)',
    'DELETE FROM userloginhistory WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE :p)',
    'DELETE FROM auditlog WHERE actor_user_id IN (SELECT id FROM "user" WHERE username LIKE :p)',
    'UPDATE "user" SET is_active = false WHERE username LIKE :p',
]


def main() -> None:
    with engine.connect() as c:
        for sql in STMTS:
            try:
                r = c.execute(text(sql), {"p": PREFIX})
                print("OK", r.rowcount, sql[:90])
            except Exception as exc:
                print("ERR", sql[:90], "->", str(exc).splitlines()[0])
        try:
            r = c.execute(text('DELETE FROM "user" WHERE username LIKE :p'), {"p": PREFIX})
            print("USER DELETE", r.rowcount)
        except Exception as exc:
            print("USER DELETE BLOCKED", str(exc).splitlines()[0])
            fks = c.execute(
                text(
                    """
                    SELECT conrelid::regclass AS table, conname
                    FROM pg_constraint
                    WHERE confrelid = '\"user\"'::regclass AND contype='f'
                    """
                )
            ).fetchall()
            print("FK to user", fks)
        print(
            "remaining users",
            c.execute(
                text('SELECT id, username, is_active FROM "user" WHERE username LIKE :p'),
                {"p": PREFIX},
            ).fetchall(),
        )
        print(
            "remaining cfgs",
            c.execute(
                text("SELECT id, code FROM hierarchyconfiguration WHERE code LIKE :p"),
                {"p": PREFIX},
            ).fetchall(),
        )


if __name__ == "__main__":
    main()
