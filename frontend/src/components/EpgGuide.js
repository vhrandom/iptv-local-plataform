import { esc, pct } from "./ChannelGrid.js";

const hm = iso => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function EpgGuide(channels, epg) {
  const rows = channels.filter(c => epg[c.id]);
  if (!rows.length) return `<div class="empty">No hay información de guía. Configura EPG_SOURCE con una fuente XMLTV o coloca un archivo .xml/.xmltv/.xml.gz/.xmltv.gz en backend/data/. Verifica que los tvg-id de la lista M3U coincidan con los channel id del XMLTV.</div>`;
  return `<div class="guide">${rows.map(c => {
    const { now, next } = epg[c.id];
    return `<button class="row" data-focus data-id="${c.id}">
      <span class="p">${esc(c.name)}</span>
      <span><span class="p">${esc(now?.title || "—")}</span>
        ${now ? `<span class="t"> ${hm(now.start)}–${hm(now.stop)}</span><span class="bar"><i style="width:${pct(now)}%"></i></span>` : ""}</span>
      <span class="t">${next ? `Sigue: ${esc(next.title)} · ${hm(next.start)}` : ""}</span>
    </button>`;
  }).join("")}</div>`;
}
