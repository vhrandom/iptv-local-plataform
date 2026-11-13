import hashlib, re
import unicodedata
from urllib.parse import urlsplit

ATTR = re.compile(r'([\w-]+)="([^"]*)"')
VOD_MARKER = re.compile(r"\b(?:movie|movies|film|films|pelicula|peliculas|cine|vod|serie|series)\b", re.IGNORECASE)
MOVIE_PATH = re.compile(r"(?:^|/)movie(?:s)?(?:/|$)", re.IGNORECASE)
MOVIE_EXT = {".mp4", ".m4v", ".mkv", ".avi", ".mov", ".mpg", ".mpeg", ".wmv"}
VOD_GROUPS = {"vod", "movie", "movies", "film", "films", "pelicula", "peliculas", "cine", "serie", "series"}

def _fold(value: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFKD", value.lower())
                   if not unicodedata.combining(char))

def _content_type(attrs: dict, group: str, url: str, duration: float) -> str:
    declared = " ".join((attrs.get(key, "") for key in ("tvg-type", "type", "content-type")))
    if VOD_MARKER.search(_fold(declared)) or duration > 0:
        return "vod"
    path = urlsplit(url).path.lower()
    if MOVIE_PATH.search(path) or re.search(r"(?:^|/)vod(?:/|$)", path) or any(path.endswith(ext) for ext in MOVIE_EXT):
        return "vod"
    groups = {_fold(value).strip() for value in re.split(r"[;,|/]", group)}
    if "vod" in groups:
        return "vod"
    # "Movies" is also used for linear movie channels; keep those live when they have an EPG id.
    if groups & VOD_GROUPS and not attrs.get("tvg-id"):
        return "vod"
    return "live"

def parse_m3u(text: str) -> list[dict]:
    channels, cur = [], None
    duration = -1.0
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("#EXTINF"):
            attrs = dict(ATTR.findall(line))
            try:
                duration = float(line.split(":", 1)[1].split(",", 1)[0].strip())
            except (IndexError, ValueError):
                duration = -1.0
            _, separator, title = line.partition(",")
            cur = {
                "name": (title.strip() if separator else "") or attrs.get("tvg-name", "Sin nombre"),
                "logo": attrs.get("tvg-logo", ""),
                "group": attrs.get("group-title") or "Sin categoría",
                "tvg_id": attrs.get("tvg-id", ""),
            }
        elif line and not line.startswith("#") and cur:
            cur["url"] = line
            cur["id"] = hashlib.md5(line.encode()).hexdigest()[:12]
            cur["type"] = _content_type(attrs, cur["group"], line, duration)
            channels.append(cur)
            cur = None
    return channels
