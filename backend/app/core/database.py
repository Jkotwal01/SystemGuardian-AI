from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """All ORM models inherit from this single base."""

    pass


class DatabaseManager:
    """Singleton. Manages engine lifecycle and session factory."""

    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker[AsyncSession] | None = None

    @classmethod
    async def initialize(cls, db_path: Path) -> None:
        if cls._engine is not None:
            return

        db_url = f"sqlite+aiosqlite:///{db_path}"

        # SQLite specific config for async
        cls._engine = create_async_engine(
            db_url,
            echo=False,
            # Enable foreign keys for SQLite
            connect_args={"check_same_thread": False},
        )

        async with cls._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        cls._session_factory = async_sessionmaker(
            bind=cls._engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )

    @classmethod
    def get_session_factory(cls) -> async_sessionmaker[AsyncSession]:
        if cls._session_factory is None:
            raise RuntimeError("DatabaseManager not initialized. Call initialize() first.")
        return cls._session_factory

    @classmethod
    async def close(cls) -> None:
        if cls._engine is not None:
            await cls._engine.dispose()
            cls._engine = None
            cls._session_factory = None


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection function for FastAPI"""
    factory = DatabaseManager.get_session_factory()
    async with factory() as session:
        yield session
