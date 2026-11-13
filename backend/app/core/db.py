import sqlite3
from contextlib import contextmanager
from .config import settings

@contextmanager
def conn():
    c = sqlite3.connect(settings.DB_PATH)
    try:
        yield c
        c.commit()
    finally:
        c.close()

def init_db():
    with conn() as c:
        c.execute("CREATE TABLE IF NOT EXISTS favorites (channel_id TEXT PRIMARY KEY)")
