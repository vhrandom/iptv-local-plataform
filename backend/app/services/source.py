import asyncio, gzip, time
from pathlib import Path
import httpx
from ..core.config import settings

async def read_source(src: str) -> bytes:
    if src.startswith(("http://", "https://")):
        async with httpx.AsyncClient(follow_redirects=True, timeout=60,
                                     headers={"User-Agent": settings.USER_AGENT}) as c:
            r = await c.get(src)
            r.raise_for_status()
            data = r.content
    else:
        data = await asyncio.to_thread(Path(src).read_bytes)
    return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data

class TTLCache:
    def __init__(self, loader):
        self.loader, self.value, self.ts = loader, None, 0.0
        self.lock = asyncio.Lock()

    async def get(self, force=False):
        async with self.lock:
            if force or self.value is None or time.time() - self.ts > settings.CACHE_TTL:
                self.value = await self.loader()
                self.ts = time.time()
            return self.value
