import sys
from pathlib import Path


# ============================================================
# PYTHON PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


# ============================================================
# DATABASE
# ============================================================

from database.database import SessionLocal
from sqlalchemy import text


tables = [
    "domains",
    "scan_results",
    "domain_features",
    "model_outputs",
]


db = SessionLocal()

try:

    for table in tables:

        print()
        print("=" * 70)
        print(f"TABLE: {table}")
        print("=" * 70)

        result = db.execute(
            text(f"SHOW CREATE TABLE `{table}`")
        )

        row = result.mappings().one()

        # SHOW CREATE TABLE returns:
        # Table
        # Create Table

        create_statement = row["Create Table"]

        print(create_statement)

        print()

finally:

    db.close()