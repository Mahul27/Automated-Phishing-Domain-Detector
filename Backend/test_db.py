from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv
import os

load_dotenv()

connection_url = URL.create(
    drivername="mysql+pymysql",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", "3306")),
    database=os.getenv("DB_NAME")
)

try:
    engine = create_engine(connection_url)

    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

        print("✅ Successfully connected to Azure MySQL!")
        print("Test result:", result.scalar())

except Exception as e:
    print("❌ Database connection failed:")
    print(e)