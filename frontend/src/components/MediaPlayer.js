import { api } from "../services/api.js";
import { esc } from "./ChannelGrid.js";

const ICONS = {
  back: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  play: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  volume: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  muted: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/></svg>',
  fullscreen: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>',
  star: '<svg class="ui-icon favorite-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>',
};

export class MediaPlayer {
  constructor(el, { onClose }) {
    this.el = el; this.onClose = onClose; this.hls = null; this.hideTimer = null;
    this.retryTimer = null; this.statusTimer = null; this.retries = 0; this.isLoading = false;
  }
  get isOpen() { return !this.el.hidden; }

  open(channel, info) {
    this.channel = channel; this.retries = 0;
    this.el.hidden = false;
    this.el.innerHTML = `<video autoplay playsinline></video>
      <div class="player-ui">
        <div class="player-controls" aria-label="Controles del reproductor">
          <header class="player-topbar">
            <button type="button" class="control-btn home-btn" data-action="home" data-focus aria-label="Volver a la página principal">${ICONS.back}<span>Inicio</span></button>
            <div class="player-heading">
              <div class="player-title-line"><h3>${esc(channel.name)}</h3><span class="live-badge">EN VIVO</span></div>
              <p>${esc(info?.now?.title || channel.group)}</p>
            </div>
          </header>
          <div class="transport-controls">
            <button type="button" class="control-btn transport-btn" data-action="back" data-focus aria-label="Retroceder 10 segundos">−10</button>
            <button type="button" class="control-btn transport-btn play-btn" data-action="play" data-focus aria-label="Pausar">${ICONS.pause}</button>
            <button type="button" class="control-btn transport-btn" data-action="forward" data-focus aria-label="Adelantar 10 segundos">+10</button>
          </div>
          <div class="control-dock">
            <div class="seek-row">
              <span class="time-current">0:00</span>
              <input class="seek" data-focus type="range" min="0" max="0" value="0" step="1" aria-label="Posición">
              <span class="time-duration">--:--</span>
            </div>
            <div class="control-row">
              <div class="volume-control">
                <button type="button" class="control-btn" data-action="volume" data-focus aria-label="Silenciar">${ICONS.volume}</button>
                <input class="volume" data-focus type="range" min="0" max="1" value="1" step="0.05" aria-label="Volumen">
              </div>
              <div class="track-controls">
                <label class="track-control subtitle-control">Subtítulos
                  <select data-focus class="subtitles" aria-label="Subtítulos"><option value="off">Desactivados</option></select>
                </label>
                <label class="track-control quality-control" hidden>Calidad
                  <select data-focus class="quality" aria-label="Calidad"><option value="-1">Automática</option></select>
                </label>
                <button type="button" class="control-btn fullscreen-btn" data-action="fullscreen" data-focus aria-label="Pantalla completa">${ICONS.fullscreen}<span>Pantalla completa</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="player-status" role="status" aria-live="polite" hidden>
        <span class="loading-spinner" aria-hidden="true"></span>
        <span class="status-text"></span>
      </div>
      <div class="msg" role="alert" hidden></div>`;
    this.video = this.el.querySelector("video");
    this.el.onclick = () => this.#flashHud();
    this.el.onpointermove = () => this.#flashHud();
    this.el.onpointerdown = () => this.#flashHud();
    this.el.onkeydown = () => this.#flashHud();
    this.#bindControls();
    this.#setLoading("Cargando canal…");
    this.#load(api.streamUrl(channel.url));
    this.#flashHud();
    this.el.querySelector('[data-action="play"]').focus();
  }

  #bindControls() {
    const v = this.video;
    this.el.addEventListener("keydown", e => {
      if (!e.target.matches(".player-controls button")) return;
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!direction) return;
      const current = e.target.getBoundingClientRect();
      const center = [current.left + current.width / 2, current.top + current.height / 2];
      const next = [...this.el.querySelectorAll(".player-controls [data-focus]:not(:disabled)")]
        .filter(el => el !== e.target && el.getClientRects().length)
        .map(el => {
          const rect = el.getBoundingClientRect(), dx = rect.left + rect.width / 2 - center[0], dy = rect.top + rect.height / 2 - center[1];
          return { el, along: direction[0] ? dx * direction[0] : dy * direction[1], across: direction[0] ? Math.abs(dy) : Math.abs(dx) };
        })
        .filter(item => item.along > 4)
        .sort((a, b) => a.along + a.across * 2.5 - (b.along + b.across * 2.5))[0];
      if (next) { e.preventDefault(); next.el.focus(); }
    });
    this.el.querySelector('[data-action="home"]').onclick = () => this.close();
    this.el.querySelector('[data-action="play"]').onclick = () => v.paused ? v.play().catch(() => {}) : v.pause();
    this.el.querySelector('[data-action="back"]').onclick = () => this.#seekBy(-10);
    this.el.querySelector('[data-action="forward"]').onclick = () => this.#seekBy(10);
    this.el.querySelector('[data-action="volume"]').onclick = () => { v.muted = !v.muted; };
    this.el.querySelector('[data-action="fullscreen"]').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else this.el.requestFullscreen?.();
    };
    this.el.querySelector(".seek").oninput = e => {
      if (Number.isFinite(v.duration)) v.currentTime = Number(e.target.value);
      else if (v.seekable.length) v.currentTime = v.seekable.start(0) + Number(e.target.value);
    };
    this.el.querySelector(".volume").oninput = e => { v.volume = Number(e.target.value); };
    this.el.querySelector(".subtitles").onchange = e => this.#selectSubtitle(e.target.value);
    this.el.querySelector(".quality").onchange = e => { if (this.hls) this.hls.currentLevel = Number(e.target.value); };
    for (const event of ["play", "pause", "timeupdate", "durationchange", "progress", "volumechange", "loadedmetadata"]) {
      v.addEventListener(event, () => this.#updateControls());
    }
    v.addEventListener("playing", () => this.#clearStatus());
    v.addEventListener("waiting", () => this.#setLoading("Cargando…"));
    v.addEventListener("stalled", () => this.#setLoading("Reconectando…"));
    v.addEventListener("error", () => this.#showError("No se pudo reproducir este canal. Usa Inicio o Atrás para volver."));
    v.textTracks?.addEventListener?.("addtrack", () => this.#updateSubtitleOptions());
    v.addEventListener("loadedmetadata", () => this.#updateSubtitleOptions());
  }

  #load(src) {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.#destroyHls();
    const v = this.video;
    if (window.Hls?.isSupported()) {
      this.hls = new Hls({ lowLatencyMode: true, maxBufferLength: 20 });
      this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this.#updateSubtitleOptions());
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => this.#updateQualityOptions());
      this.hls.on(Hls.Events.LEVELS_UPDATED, () => this.#updateQualityOptions());
      this.hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && this.retries++ < 3) {
          const retry = this.retries;
          clearTimeout(this.retryTimer);
          this.#setLoading(`Reconectando… (${retry}/3)`);
          this.retryTimer = setTimeout(() => this.hls?.startLoad(), 1500 * retry);
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && this.retries++ < 3) {
          this.#setLoading(`Recuperando reproducción… (${this.retries}/3)`);
          this.hls.recoverMediaError();
        } else this.#showError("No se pudo reproducir este canal. Usa Inicio o Atrás para volver.");
      });
      this.hls.on(Hls.Events.FRAG_LOADED, () => { this.retries = 0; });
      this.hls.loadSource(src); this.hls.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
    } else this.#showError("Este navegador no soporta HLS. Usa Inicio o Atrás para volver.");
    v.play?.().catch(() => {});
  }

  #setLoading(text) {
    const wasLoading = this.isLoading;
    this.isLoading = true;
    const status = this.el.querySelector(".player-status");
    const message = this.el.querySelector(".msg");
    this.el.classList.add("is-loading");
    if (status) {
      status.hidden = false;
      status.querySelector(".status-text").textContent = text;
    }
    if (message) message.hidden = true;
    if (!wasLoading) {
      clearTimeout(this.statusTimer);
      this.statusTimer = setTimeout(() => {
        this.#showError("El canal no responde. Usa Volver o Atrás para salir.");
      }, 20000);
    }
    this.#flashHud();
  }

  #showError(text) {
    this.isLoading = false;
    clearTimeout(this.statusTimer);
    clearTimeout(this.retryTimer);
    this.statusTimer = this.retryTimer = null;
    this.hls?.stopLoad();
    this.video?.pause();
    const status = this.el.querySelector(".player-status");
    const message = this.el.querySelector(".msg");
    this.el.classList.remove("is-loading");
    if (status) status.hidden = true;
    if (message) {
      message.hidden = false;
      message.textContent = text;
    }
    this.#flashHud();
  }

  #clearStatus() {
    this.isLoading = false;
    clearTimeout(this.statusTimer);
    this.statusTimer = null;
    const status = this.el.querySelector(".player-status");
    const message = this.el.querySelector(".msg");
    this.el.classList.remove("is-loading");
    if (status) status.hidden = true;
    if (message) message.hidden = true;
    this.#flashHud();
  }

  #seekBy(seconds) {
    const v = this.video;
    if (Number.isFinite(v.duration)) {
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
    } else if (v.seekable.length) {
      const start = v.seekable.start(0), end = v.seekable.end(v.seekable.length - 1);
      v.currentTime = Math.max(start, Math.min(end, v.currentTime + seconds));
    }
  }

  #updateControls() {
    if (!this.video) return;
    const v = this.video, seek = this.el.querySelector(".seek");
    const finite = Number.isFinite(v.duration) && v.duration > 0;
    const seekable = finite || v.seekable.length > 0;
    const start = finite ? 0 : (v.seekable.length ? v.seekable.start(0) : 0);
    const end = finite ? v.duration : (v.seekable.length ? v.seekable.end(v.seekable.length - 1) : 0);
    seek.disabled = !seekable;
    this.el.querySelector('[data-action="back"]').disabled = !seekable;
    this.el.querySelector('[data-action="forward"]').disabled = !seekable;
    seek.max = seekable ? Math.max(0, end - start) : 0;
    seek.value = seekable ? Math.max(0, v.currentTime - start) : 0;
    this.el.querySelector(".time-current").textContent = this.#formatTime(v.currentTime - start);
    this.el.querySelector(".time-duration").textContent = finite ? this.#formatTime(v.duration) : (seekable ? "EN VIVO" : "--:--");
    const play = this.el.querySelector('[data-action="play"]');
    play.innerHTML = v.paused ? ICONS.play : ICONS.pause;
    play.setAttribute("aria-label", v.paused ? "Reproducir" : "Pausar");
    const volume = this.el.querySelector(".volume");
    volume.value = v.muted ? 0 : v.volume;
    const volumeButton = this.el.querySelector('[data-action="volume"]');
    volumeButton.innerHTML = v.muted || v.volume === 0 ? ICONS.muted : ICONS.volume;
    volumeButton.setAttribute("aria-label", v.muted || v.volume === 0 ? "Activar sonido" : "Silenciar");
  }

  #formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds), hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60), remainder = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  #updateSubtitleOptions() {
    const select = this.el.querySelector(".subtitles");
    if (!select) return;
    const selected = select.value;
    const tracks = this.hls?.subtitleTracks || [];
    const nativeTracks = [...(this.video.textTracks || [])];
    select.replaceChildren(new Option("Desactivados", "off"));
    tracks.forEach((track, i) => select.add(new Option(track.name || track.lang || `Subtítulo ${i + 1}`, `hls:${i}`)));
    nativeTracks.forEach((track, i) => select.add(new Option(track.label || track.language || `Subtítulo ${i + 1}`, `native:${i}`)));
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    else select.value = "off";
  }

  #selectSubtitle(value) {
    if (!this.video) return;
    for (const track of this.video.textTracks || []) track.mode = "disabled";
    if (this.hls) this.hls.subtitleTrack = value.startsWith("hls:") ? Number(value.slice(4)) : -1;
    if (value.startsWith("native:")) {
      const track = this.video.textTracks[Number(value.slice(7))];
      if (track) track.mode = "showing";
    }
  }

  #updateQualityOptions() {
    const control = this.el.querySelector(".quality-control"), select = this.el.querySelector(".quality");
    const levels = this.hls?.levels || [];
    if (!control || !select) return;
    control.hidden = levels.length < 2;
    const selected = select.value;
    select.replaceChildren(new Option("Automática", "-1"));
    levels.forEach((level, i) => {
      const label = level.height ? `${level.height}p` : `${Math.round((level.bitrate || 0) / 1000)} kbps`;
      select.add(new Option(label, String(i)));
    });
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  }

  #flashHud() {
    const ui = this.el.querySelector(".player-ui"); if (!ui) return;
    ui.classList.remove("hide"); clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.isLoading && !this.el.querySelector(".msg:not([hidden])") &&
          !this.el.querySelector(".player-controls :focus")) ui.classList.add("hide");
    }, 4000);
  }

  // Cambia el título mostrado (zapping) sin cerrar el reproductor.
  zap(channel, info) { this.#flashHud(); this.open(channel, info); }

  close() {
    clearTimeout(this.hideTimer); clearTimeout(this.retryTimer); clearTimeout(this.statusTimer);
    this.retryTimer = this.statusTimer = null; this.isLoading = false;
    this.el.classList.remove("is-loading");
    this.#destroyHls();
    this.el.onclick = this.el.onpointermove = this.el.onpointerdown = this.el.onkeydown = null;
    if (document.fullscreenElement === this.el) document.exitFullscreen();
    this.video?.removeAttribute("src"); this.video?.load?.();
    this.el.hidden = true; this.el.innerHTML = ""; this.onClose?.();
  }

  #destroyHls() { this.hls?.destroy(); this.hls = null; }
}
