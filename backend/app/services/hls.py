import re
from urllib.parse import quote, urljoin

URI_ATTR = re.compile(r'URI="([^"]+)"')
PROXY = "/stream/proxy?url="

def _p(base: str, ref: str) -> str:
    return PROXY + quote(urljoin(base, ref), safe="")

def rewrite_playlist(body: str, base: str) -> str:
    out = []
    for line in body.splitlines():
        s = line.strip()
        if not s:
            out.append(line)
        elif s.startswith("#"):
            out.append(URI_ATTR.sub(lambda m: f'URI="{_p(base, m.group(1))}"', line))
        else:
            out.append(_p(base, s))
    return "\n".join(out) + "\n"
