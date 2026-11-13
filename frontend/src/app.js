import { api, getBase, setBase, needsServer } from "./services/api.js";
import { ChannelGrid, esc } from "./components/ChannelGrid.js";
import { EpgGuide } from "./components/EpgGuide.js";
import { MediaPlayer } from "./components/MediaPlayer.js";
import { RemoteFocus } from "./components/RemoteFocus.js";

const S = { channels: [], favs: new Set(), epg: {}, view: "live", group: "Todos", q: "", playing: null, lastFocus: null };
const $app = document.getElementById("app");

const remote = new RemoteFocus({
  onBack: () => { if (player.isOpen) player.close(); },
  onMenu: () => toggleFav(player.isOpen ? S.playing?.id : document.activeElement?.dataset?.id),
});
const player = new MediaPlayer(document.getElementById("player"), {
  onClose: () => { remote.enabled = true; S.playing = null; restoreFocus(); },
});

const visible = () => {
  const q = S.q.trim().toLowerCase();
  return S.channels.filter(c =>
    (S.view === "vod" ? c.type === "vod" : S.view === "favs" ? true : c.type !== "vod") &&
    (S.view !== "favs" || S.favs.has(c.id)) &&
    (S.group === "Todos" || c.group === S.group) &&
    (!q || c.name.toLowerCase().includes(q)));
};

function render() {
  const groups = ["Todos", ...new Set(visible().map(c => c.group))];
  const list = visible();
  const tabs = [["live", "En vivo"], ["vod", "VOD"], ["guide", "Guía"], ["favs", "Favoritos"]];
  $app.innerHTML = `
    <header class="top">
      <span class="brand">IPTV Local</span>
      ${tabs.map(([k, l]) => `<button class="tab" data-focus data-tab="${k}" aria-selected="${S.view === k}">${l}</button>`).join("")}
      <input class="search" data-focus type="search" placeholder="Buscar canal" value="${esc(S.q)}" aria-label="Buscar canal">
    </header>
    ${S.view !== "guide" ? `<nav class="groups">${groups.map(g =>
      `<button class="chip" data-focus data-group="${esc(g)}" aria-selected="${S.group === g}">${esc(g)}</button>`).join("")}</nav>` : ""}
    <main>${S.view === "guide" ? EpgGuide(list, S.epg) : ChannelGrid(list, S)}</main>`;
}

function restoreFocus() {
  const sel = S.lastFocus ? `[data-id="${S.lastFocus}"]` : "[data-focus]";
  (document.querySelector(sel) || document.querySelector("[data-focus]"))?.focus();
}

function play(id, { zap = false } = {}) {
  const ch = S.channels.find(c => c.id === id); if (!ch) return;
  S.playing = ch; S.lastFocus = id; remote.enabled = false;
  zap ? player.zap(ch, S.epg[id]) : player.open(ch, S.epg[id]);
}

async function toggleFav(id) {
  if (!id) return;
  const on = !S.favs.has(id);
  on ? S.favs.add(id) : S.favs.delete(id);
  try { await api.setFavorite(id, on); } catch { on ? S.favs.delete(id) : S.favs.add(id); }
  if (!player.isOpen) { S.lastFocus = id; render(); restoreFocus(); }
}

$app.addEventListener("click", e => {
  const t = e.target.closest("[data-tab],[data-group],[data-id]"); if (!t) return;
  if (t.dataset.tab) { S.view = t.dataset.tab; S.group = "Todos"; S.lastFocus = null; render(); document.querySelector(`[data-tab="${S.view}"]`).focus(); }
  else if (t.dataset.group) { S.group = t.dataset.group; render(); document.querySelector(`[data-group="${CSS.escape(S.group)}"]`)?.focus(); }
  else play(t.dataset.id);
});

$app.addEventListener("input", e => {
  if (!e.target.classList.contains("search")) return;
  S.q = e.target.value; render();
  const i = $app.querySelector(".search"); i.focus(); i.setSelectionRange(S.q.length, S.q.length);
});

// Zapping con ↑/↓ mientras se reproduce.
document.addEventListener("keydown", e => {
  if (!player.isOpen) return;
  if (["Escape", "Backspace", "GoBack", "BrowserBack", "Back"].includes(e.key) || e.keyCode === 4) {
    e.preventDefault();
    player.close();
    return;
  }
  if (e.target.closest?.(".player-controls")) return;
  const list = visible(), i = list.findIndex(c => c.id === S.playing?.id);
  if (e.key === "ArrowUp" || e.key === "ChannelUp") { e.preventDefault(); list[i - 1] && play(list[i - 1].id, { zap: true }); }
  else if (e.key === "ArrowDown" || e.key === "ChannelDown") { e.preventDefault(); list[i + 1] && play(list[i + 1].id, { zap: true }); }
  else if (e.key === "Enter") { e.preventDefault(); document.getElementById("player").click(); }
});

async function load() {
  try {
    const [channels, favs, epg] = await Promise.all([api.channels(), api.favorites(), api.epg().catch(() => ({}))]);
    Object.assign(S, { channels, favs: new Set(favs), epg });
    render(); remote.focusFirst($app);
  } catch (err) {
    $app.innerHTML = `<div class="empty">No se pudo conectar con ${esc(getBase())}.<br>
      <button class="btn primary" data-focus id="retry">Reintentar</button>
      <button class="btn" data-focus id="change">Cambiar servidor</button></div>`;
    $app.querySelector("#retry").onclick = load;
    $app.querySelector("#change").onclick = askServer;
    $app.querySelector("#retry").focus();
  }
}

function askServer() {
  const d = document.getElementById("setup");
  d.querySelector("#setupForm").onsubmit = () => { setBase(d.querySelector("#serverInput").value); load(); };
  d.showModal(); d.querySelector("#serverInput").focus();
}

// Actualiza la guía cada minuto para mover las barras de progreso.
setInterval(async () => {
  if (player.isOpen || document.hidden) return;
  S.epg = await api.epg().catch(() => S.epg);
  const id = document.activeElement?.dataset?.id; S.lastFocus = id || S.lastFocus;
  if (document.activeElement?.tagName !== "INPUT") { render(); restoreFocus(); }
}, 60000);

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.Capacitor?.isNativePlatform?.())
  navigator.serviceWorker.register("sw.js").catch(() => {});

needsServer() ? askServer() : load();
