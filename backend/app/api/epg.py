import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter
from ..core.config import ROOT, settings
from ..services.source import TTLCache, read_source
from ..services.xmltv import parse_xmltv
from .channels import channel_cache

router = APIRouter(prefix="/api/v1/epg", tags=["epg"])

async def _load():
    sources = [source.strip() for source in settings.EPG_SOURCE.split(";") if source.strip()]
    if not sources:
        data_dir = ROOT / "backend" / "data"
        sources = sorted(
            str(path) for path in data_dir.iterdir()
            if path.is_file() and (
                path.name.lower().endswith((".xml", ".xmltv", ".xml.gz", ".xmltv.gz"))
            )
        )
    if not sources:
        return {}
    results = await asyncio.gather(*(read_source(source) for source in sources), return_exceptions=True)
    failures = [(source, result) for source, result in zip(sources, results) if isinstance(result, Exception)]
    if failures:
        for source, error in failures:
            logging.getLogger("iptv").warning("EPG no disponible (%s): %s", source, error)
        return {}
    merged = {}
    try:
        for data in results:
            for channel_id, programmes in parse_xmltv(data).items():
                merged.setdefault(channel_id, []).extend(programmes)
        for programmes in merged.values():
            programmes.sort(key=lambda programme: programme["start"])
    except Exception as e:  # la guía es opcional: nunca debe romper los canales
        logging.getLogger("iptv").warning("No se pudo interpretar XMLTV: %s", e)
        return {}
    return merged

epg_cache = TTLCache(_load)

@router.get("/current")
async def current():
    """Mapa channel.id -> {now, next} (solo canales con guía)."""
    epg, channels = await epg_cache.get(), await channel_cache.get()
    now = datetime.now(timezone.utc)
    result = {}
    for ch in channels:
        channel_id = ch.get("tvg_id", "").strip()
        progs = epg.get(channel_id) if channel_id else None
        if not progs:
            continue
        upcoming = sorted(
            (p for p in progs if datetime.fromisoformat(p["stop"]) > now),
            key=lambda programme: datetime.fromisoformat(programme["start"]),
        )
        if upcoming:
            cur = upcoming[0] if datetime.fromisoformat(upcoming[0]["start"]) <= now else None
            nxt = upcoming[1] if cur and len(upcoming) > 1 else (upcoming[0] if not cur else None)
            result[ch["id"]] = {"now": cur, "next": nxt}
    return result
