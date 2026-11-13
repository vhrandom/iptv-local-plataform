import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # iptv-local-platform/
DATA_DIR = ROOT / "backend" / "data"
DEFAULT_M3U = DATA_DIR / "lista_limpia.m3u"
if not DEFAULT_M3U.is_file():
    DEFAULT_M3U = DATA_DIR / "sample.m3u"

class Settings:
    # La lista comprobada por filtro.py; M3U_SOURCE permite reemplazarla explícitamente.
    M3U_SOURCE = os.getenv("M3U_SOURCE", str(DEFAULT_M3U))
    # URL o ruta a XMLTV (.xml o .xml.gz). Opcional.
    EPG_SOURCE = os.getenv("EPG_SOURCE", "")
    DB_PATH = os.getenv("DB_PATH", str(ROOT / "backend" / "data" / "iptv.db"))
    CACHE_TTL = int(os.getenv("CACHE_TTL", "1800"))  # segundos
    USER_AGENT = os.getenv("USER_AGENT", "Mozilla/5.0 (X11; Linux x86_64) IPTVLocal/1.0")

settings = Settings()
