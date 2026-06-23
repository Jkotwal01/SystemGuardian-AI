"""
Shared pytest fixtures for the SystemGuardian AI test suite.
"""
import pytest_asyncio
from pathlib import Path
from app.core.database import DatabaseManager, Base

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    test_db_path = Path("test_data.db")
    if test_db_path.exists():
        test_db_path.unlink()
        
    await DatabaseManager.initialize(test_db_path)
    engine = DatabaseManager._engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    yield
    
    await DatabaseManager.close()
    if test_db_path.exists():
        test_db_path.unlink()

@pytest_asyncio.fixture
async def db_session():
    factory = DatabaseManager.get_session_factory()
    async with factory() as session:
        yield session
        await session.rollback()
