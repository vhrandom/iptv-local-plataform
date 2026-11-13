const KEY = "iptv_server";

// En el navegador servido por el backend, se usa el mismo origen.
// En la app Capacitor (https://localhost / http://localhost) hay que indicar el servidor.
const isCapacitor = () => !!window.Capacitor?.isNativePlatform?.();

export const getBase = () => localStorage.getItem(KEY) || (isCapacitor() ? "" : location.origin);
export const setBase = url => localStorage.setItem(KEY, url.replace(/\/+$/, ""));
export const needsServer = () => getBase() === "";

async function req(path, opts) {
  const r = await fetch(getBase() + path, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const api = {
  channels: () => req("/api/v1/channels"),
  epg: () => req("/api/v1/epg/current"),
  favorites: () => req("/api/v1/favorites"),
  setFavorite: (channel_id, favorite) => req("/api/v1/favorites", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_id, favorite }),
  }),
  streamUrl: url => `${getBase()}/stream/proxy?url=${encodeURIComponent(url)}`,
};
