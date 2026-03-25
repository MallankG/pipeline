import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

# We will use Postgres as the database backend.
# The URL should look like: postgresql+asyncpg://user:password@host:port/database
# If local, e.g. postgresql+asyncpg://etl_user:etl_password@localhost:5432/etl_db
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://etl_user:etl_password@localhost:5432/etl_db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session
