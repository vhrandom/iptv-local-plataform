import io
from datetime import datetime, timedelta, timezone
import xml.etree.ElementTree as ET

def _t(s: str) -> datetime:
    s = s.strip()
    fmt = "%Y%m%d%H%M%S %z" if " " in s else "%Y%m%d%H%M%S"
    d = datetime.strptime(s, fmt)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)

def parse_xmltv(data: bytes, horizon_h: int = 24) -> dict[str, list[dict]]:
    now = datetime.now(timezone.utc)
    limit = now + timedelta(hours=horizon_h)
    out: dict[str, list[dict]] = {}
    for _, el in ET.iterparse(io.BytesIO(data), events=("end",)):
        if el.tag != "programme":
            continue
        try:
            start, stop = _t(el.get("start")), _t(el.get("stop"))
            if stop > now and start < limit:
                out.setdefault(el.get("channel"), []).append({
                    "title": (el.findtext("title") or "").strip(),
                    "desc": (el.findtext("desc") or "").strip(),
                    "start": start.isoformat(), "stop": stop.isoformat(),
                })
        except (TypeError, ValueError):
            pass
        el.clear()
    for lst in out.values():
        lst.sort(key=lambda p: p["start"])
    return out
