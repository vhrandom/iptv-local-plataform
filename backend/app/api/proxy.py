import httpx
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from ..core.config import settings
from ..services.hls import rewrite_playlist

router = APIRouter(tags=["proxy"])
PASS = ("content-type", "content-range", "accept-ranges", "content-length")

@router.get("/stream/proxy")
async def proxy(request: Request, url: str):
    if urlparse(url).scheme not in ("http", "https"):
        raise HTTPException(400, "Solo se permiten URLs http/https")
    headers = {"User-Agent": settings.USER_AGENT}
    if "range" in request.headers:
        headers["Range"] = request.headers["range"]
    client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(15, read=30))
    try:
        r = await client.send(client.build_request("GET", url, headers=headers), stream=True)
    except httpx.HTTPError as e:
        await client.aclose()
        raise HTTPException(502, f"No se pudo conectar al origen: {e}")

    ctype = r.headers.get("content-type", "")
    if ".m3u8" in urlparse(str(r.url)).path.lower() or "mpegurl" in ctype.lower():
        body = (await r.aread()).decode("utf-8", "ignore")
        await r.aclose(); await client.aclose()
        if body.lstrip().startswith("#EXTM3U"):
            return Response(rewrite_playlist(body, str(r.url)),
                            media_type="application/vnd.apple.mpegurl",
                            headers={"Cache-Control": "no-cache"})
        return Response(body, status_code=r.status_code, media_type=ctype or None)

    async def gen():
        try:
            async for chunk in r.aiter_bytes():
                yield chunk
        finally:
            await r.aclose(); await client.aclose()

    return StreamingResponse(gen(), status_code=r.status_code,
                             headers={k: v for k, v in r.headers.items() if k.lower() in PASS})
