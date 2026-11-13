from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .api import channels, epg, proxy
from .core.config import ROOT
from .core.db import init_db

@asynccontextmanager
async def lifespan(_):
    init_db()
    yield

app = FastAPI(title="IPTV Local", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(channels.router)
app.include_router(epg.router)
app.include_router(proxy.router)

# Sirve el frontend: dist/ (compilado) si existe, si no src/ + public/
fe = ROOT / "frontend"
web = fe / "dist" if (fe / "dist").exists() else fe / "src"
pub = fe / "public"
if pub.exists() and web.name == "src":  # modo desarrollo: sin build, sirve public/ también
    @app.get("/sw.js", include_in_schema=False)
    def sw(): return FileResponse(pub / "sw.js", media_type="text/javascript")
    @app.get("/manifest.webmanifest", include_in_schema=False)
    def manifest(): return FileResponse(pub / "manifest.webmanifest")
    app.mount("/assets", StaticFiles(directory=pub / "assets"), name="assets")

if web.exists():
    app.mount("/", StaticFiles(directory=web, html=True), name="web")
