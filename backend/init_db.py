import asyncio
from app.config import get_settings
from app.core.database import DatabaseManager

async def init_db():
    settings = get_settings()
    print("Initializing DB at", settings.db_path)
    await DatabaseManager.initialize(settings.db_path)
    print("Done")

if __name__ == "__main__":
    asyncio.run(init_db())
