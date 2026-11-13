// Navegación espacial para control remoto (D-Pad), teclado y mando.
// Mueve el foco entre elementos [data-focus] según la dirección pulsada
// y mantiene la clase .focused en el elemento activo.
const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
               37: [-1, 0], 39: [1, 0], 38: [0, -1], 40: [0, 1] };

export class RemoteFocus {
  constructor({ onBack, onMenu } = {}) {
    this.enabled = true;
    this.onBack = onBack; this.onMenu = onMenu;
    document.addEventListener("keydown", e => this.#key(e));
    document.addEventListener("focusin", e => e.target.classList?.add("focused"));
    document.addEventListener("focusout", e => e.target.classList?.remove("focused"));
  }

  focusFirst(root = document) { root.querySelector("[data-focus]")?.focus(); }

  #key(e) {
    if (!this.enabled || document.querySelector("dialog[open]")) return;
    const typing = e.target.tagName === "INPUT";
    const dir = DIRS[e.key] || DIRS[e.keyCode];
    if (dir) {
      if (typing && dir[1] === 0) return; // izquierda/derecha editan el texto
      e.preventDefault(); this.#move(dir);
    } else if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") {
      if (typing && e.key === "Backspace") return;
      this.onBack?.(e);
    } else if (e.key === "ContextMenu" || e.key === "f" || e.key === "F") {
      if (!typing) this.onMenu?.(e);
    }
  }

  #move([dx, dy]) {
    const items = [...document.querySelectorAll("[data-focus]")].filter(el => el.offsetParent !== null);
    const cur = items.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) return items[0]?.focus();
    const a = cur.getBoundingClientRect(), ac = [a.left + a.width / 2, a.top + a.height / 2];
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const vx = b.left + b.width / 2 - ac[0], vy = b.top + b.height / 2 - ac[1];
      const along = dx ? vx * dx : vy * dy, across = dx ? Math.abs(vy) : Math.abs(vx);
      if (along <= 4) continue;
      const score = along + across * 2.5;
      if (score < bestScore) { best = el; bestScore = score; }
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: "nearest", inline: "nearest" }); }
  }
}
