import asyncio
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..core.config import ROOT, settings
from ..core.db import conn
from ..services.m3u import parse_m3u
from ..services.source import TTLCache, read_source

router = APIRouter(prefix="/api/v1", tags=["channels"])

async def _load():
    sources = [source.strip() for source in settings.M3U_SOURCE.split(";") if source.strip()]
    if not sources:
        clean_playlist = ROOT / "backend" / "data" / "lista_limpia.m3u"
        fallback_playlist = clean_playlist if clean_playlist.is_file() else ROOT / "backend" / "data" / "sample.m3u"
        sources = [str(fallback_playlist)]

    results = await asyncio.gather(*(read_source(source) for source in sources), return_exceptions=True)
    failures = [(source, result) for source, result in zip(sources, results) if isinstance(result, Exception)]
    if failures:
        for source, error in failures:
            logging.getLogger("iptv").error("No se pudo leer la lista M3U %s: %s", source, error)
        details = "; ".join(f"{source}: {error}" for source, error in failures)
        raise HTTPException(502, f"No se pudieron leer todas las listas M3U: {details}")

    return [
        channel
        for data in results
        for channel in parse_m3u(data.decode("utf-8", "ignore"))
    ]

channel_cache = TTLCache(_load)

@router.get("/channels")
async def list_channels():
    return await channel_cache.get()

@router.post("/refresh")
async def refresh():
    from .epg import epg_cache
    chans = await channel_cache.get(force=True)
    if settings.EPG_SOURCE:
        await epg_cache.get(force=True)
    return {"status": "ok", "channels": len(chans)}

class FavIn(BaseModel):
    channel_id: str
    favorite: bool = True

@router.get("/favorites")
def get_favorites():
    with conn() as c:
        return [r[0] for r in c.execute("SELECT channel_id FROM favorites")]

@router.post("/favorites")
def set_favorite(body: FavIn):
    with conn() as c:
        if body.favorite:
            c.execute("INSERT OR IGNORE INTO favorites VALUES (?)", (body.channel_id,))
        else:
            c.execute("DELETE FROM favorites WHERE channel_id=?", (body.channel_id,))
    return {"status": "ok"}
