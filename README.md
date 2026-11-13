# IPTV Local Platform

Backend FastAPI + frontend web (HLS.js) + wrapper Capacitor para Android TV.

## Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
EPG_SOURCE="http://tu-servidor/guia.xml.gz" \
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Abre `http://IP-DEL-SERVIDOR:8000` desde cualquier dispositivo de la LAN.
Si no se define `M3U_SOURCE`, se usa `backend/data/lista_limpia.m3u` si existe; en caso contrario se carga el stream de prueba `backend/data/sample.m3u`.
Las listas y enlaces personales están excluidos de Git. Para usar tu lista local, coloca los archivos fuente en `backend/data/` y ejecuta `python backend/data/filtro.py`; luego se usará la `lista_limpia.m3u` generada.
Puedes reemplazarla definiendo `M3U_SOURCE` con otra ruta/URL; para elegir varias fuentes, sepáralas por `;`.
El contenido VOD se identifica
por `tvg-type="movie"`, grupos como `VOD`/`Películas`, duración finita o rutas/extensiones típicas.
Los grupos `Movies` con `tvg-id` se conservan como canales lineales para no confundir canales de cine con películas a demanda.

La guía requiere una fuente XMLTV: configura `EPG_SOURCE` con la URL o ruta del XML/XML.GZ; admite varias fuentes separadas por `;`.
Si no se configura, el servidor intenta cargar archivos `.xml`, `.xmltv`, `.xml.gz` o `.xmltv.gz` desde `backend/data/`.
Los `tvg-id` de la M3U deben coincidir con los `channel id` del XMLTV.

Docker: `docker build -f backend/Dockerfile -t iptv-local . && docker run -p 8000:8000 iptv-local`

## APK Android TV
```bash
cd android-wrapper && npm install
npm run sync
npx cap open android      # abrir en Android Studio
export JAVA_HOME="$HOME/.local/jdks/temurin-17"
export ANDROID_HOME="$HOME/.local/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
cd android && ./gradlew assembleDebug
```
El APK de prueba se genera en `android-wrapper/android/app/build/outputs/apk/debug/app-debug.apk`.
Requiere JDK 17 y Android SDK Platform 34 con Build Tools 34.0.0.
En `AndroidManifest.xml` añade a `<activity>`/`<application>`:
- `android:hardwareAccelerated="true"` y `android:usesCleartextTraffic="true"`
- `<uses-feature android:name="android.software.leanback" android:required="false"/>`
- `<category android:name="android.intent.category.LEANBACK_LAUNCHER"/>` en el intent-filter
Al abrir la app por primera vez pide la dirección del servidor (ej. `http://192.168.1.50:8000`).

## Controles
Flechas: mover foco · Enter: abrir/seleccionar · ↑/↓ en reproducción: cambiar canal ·
Esc/Atrás: salir del reproductor · F o tecla Menú: favorito.

## Notas
- El proxy `/stream/proxy` reescribe listas .m3u8 para que segmentos y claves pasen también por el servidor. No lo expongas a Internet (cualquiera podría usarlo como relay).
- HLS.js se carga desde CDN en `index.html`; para uso 100 % offline, descarga el archivo a `public/` y cambia la ruta.
- No se usó Tailwind: el CSS es propio (`src/styles.css`) para que el APK funcione sin CDN.
