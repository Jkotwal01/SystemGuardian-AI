from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """
    Generic async repository. Provides CRUD for any ORM model.
    All domain-specific queries live in subclasses.
    """

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, id: str) -> T | None:
        return await self._session.get(self.model, id)

    async def get_all(self, limit: int = 100, offset: int = 0) -> Sequence[T]:
        stmt = select(self.model).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def save(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.commit()
        await self._session.refresh(entity)
        return entity

    async def delete(self, id: str) -> bool:
        entity = await self.get_by_id(id)
        if entity:
            await self._session.delete(entity)
            await self._session.commit()
            return True
        return False

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model)
        result = await self._session.execute(stmt)
        return result.scalar_one() or 0
