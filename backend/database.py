"""MySQL database connection for the existing Threat Hunter schema."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker


# ============================================================
# PATHS
# ============================================================

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================
#
# The MySQL credentials are stored in:
#
# backend/.env
#
# Load that file explicitly so the application does not depend
# on the current working directory.
# ============================================================

load_dotenv(
    BACKEND_ROOT / ".env"
)

# Also allow a project-level .env.local if one exists.
load_dotenv(
    PROJECT_ROOT / ".env.local"
)


# ============================================================
# READ DATABASE SETTINGS
# ============================================================

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv(
    "DB_PORT",
    "3306",
)
DB_NAME = os.getenv("DB_NAME")


# ============================================================
# VALIDATE DATABASE SETTINGS
# ============================================================

missing = []

if not DB_USER:
    missing.append("DB_USER")

if not DB_PASSWORD:
    missing.append("DB_PASSWORD")

if not DB_HOST:
    missing.append("DB_HOST")

if not DB_NAME:
    missing.append("DB_NAME")


if missing:

    raise RuntimeError(
        "Missing MySQL environment variables: "
        + ", ".join(missing)
    )


# ============================================================
# CREATE MYSQL URL SAFELY
# ============================================================
#
# URL.create() is preferable to manually constructing a URL
# because it safely handles special characters in passwords.
# ============================================================

DATABASE_URL = URL.create(
    drivername="mysql+pymysql",

    username=DB_USER,

    password=DB_PASSWORD,

    host=DB_HOST,

    port=int(DB_PORT),

    database=DB_NAME,
)


# ============================================================
# SQLALCHEMY ENGINE
# ============================================================

engine = create_engine(
    DATABASE_URL,

    pool_pre_ping=True,

    pool_recycle=1800,

    connect_args={
        "connect_timeout": 15,
    },
)


# ============================================================
# SESSION
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,

    autoflush=False,

    bind=engine,
)


# ============================================================
# FASTAPI DATABASE DEPENDENCY
# ============================================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# ============================================================
# DATABASE INITIALISATION
# ============================================================
#
# IMPORTANT:
# Your Azure MySQL database already contains the required
# tables.
#
# Therefore we intentionally DO NOT run create_all().
# ============================================================

def init_db():

    return None