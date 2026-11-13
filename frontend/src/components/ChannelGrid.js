export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const favoriteIcon = '<svg class="ui-icon favorite-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>';

export const pct = p => {
  if (!p) return 0;
  const a = Date.parse(p.start), b = Date.parse(p.stop);
  return Math.max(0, Math.min(100, ((Date.now() - a) / (b - a)) * 100));
};

export function ChannelGrid(channels, { favs, epg, view }) {
  if (!channels.length) return `<div class="empty">${view === "vod" ? "No hay contenido VOD para mostrar. Revisa que la lista M3U indique group-title=\"VOD\" o tvg-type=\"movie\"." : "No hay canales para mostrar."}</div>`;
  return `<div class="grid">${channels.map(c => {
    const now = epg[c.id]?.now;
    return `<button class="card" data-focus data-id="${c.id}">
      ${favs.has(c.id) ? `<span class="star" title="Favorito">${favoriteIcon}</span>` : ""}
      <span class="logo">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
      <span class="name">${esc(c.name)}</span>
      <span class="now">${esc(now?.title || c.group)}</span>
      ${now ? `<span class="bar"><i style="width:${pct(now)}%"></i></span>` : ""}
    </button>`;
  }).join("")}</div>`;
}
