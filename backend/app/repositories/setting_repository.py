from app.core.repository import BaseRepository
from app.models.setting import SettingModel


class SettingRepository(BaseRepository[SettingModel]):
    model = SettingModel

    async def get_value(self, key: str) -> str | None:
        setting = await self.get_by_id(key)
        return setting.value if setting else None
