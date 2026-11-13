from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests


def cargar_contenido_m3u(ruta_archivo):
  """Lee el texto de un archivo M3U local."""
  with open(ruta_archivo, "r", encoding="utf-8", errors="ignore") as f:
    return f.read()


def parsear_m3u(contenido):
  """
    Extrae pares de (metadatos_extinf, url_stream) del contenido M3U.
    """
  lineas = [linea.strip() for linea in contenido.splitlines() if linea.strip()]
  canales = []
  bloque_actual = []

  for linea in lineas:
    if linea.startswith("#EXTM3U"):
      continue
    elif linea.startswith("#"):
      bloque_actual.append(linea)
    else:
      if bloque_actual:
        canales.append(("\n".join(bloque_actual), linea))
        bloque_actual = []
      else:
        canales.append(("#EXTINF:-1,Canal sin nombre", linea))

  return canales


def verificar_stream(canal, timeout=5):
  """
    Comprueba si la URL del canal responde correctamente (HTTP 200-299).
    """
  metadatos, url = canal
  headers = {
      "User-Agent": (
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      )
  }

  try:
    with requests.get(
        url, headers=headers, timeout=timeout, stream=True, allow_redirects=True
    ) as resp:
      if 200 <= resp.status_code < 300:
        return (True, metadatos, url)
  except requests.RequestException:
    pass

  return (False, metadatos, url)


def procesar_carpeta_script(nombre_salida="lista_limpia.m3u", max_hilos=20):
  # Obtiene la ruta exacta donde vive este script (ej. /home/vhrandom/Escritorio/iptv)
  carpeta_script = Path(__file__).resolve().parent
  ruta_salida = carpeta_script / nombre_salida

  # Busca todos los .m3u y .m3u8 en la carpeta, excluyendo el archivo de salida
  archivos_m3u = [
      archivo
      for archivo in carpeta_script.iterdir()
      if archivo.is_file()
      and archivo.suffix.lower() in {".m3u", ".m3u8"}
      and archivo.name != nombre_salida
  ]

  if not archivos_m3u:
    print(f"No se encontraron archivos .m3u o .m3u8 en: {carpeta_script}")
    return

  print(f"Carpeta escaneada: {carpeta_script}")
  print(f"Archivos encontrados ({len(archivos_m3u)}):")
  for arch in archivos_m3u:
    print(f"  - {arch.name}")

  # Extraer y juntar todos los canales evitando URLs duplicadas
  todos_los_canales = []
  urls_vistas = set()

  for arch in archivos_m3u:
    contenido = cargar_contenido_m3u(arch)
    canales = parsear_m3u(contenido)
    for metadatos, url in canales:
      if url not in urls_vistas:
        urls_vistas.add(url)
        todos_los_canales.append((metadatos, url))

  total = len(todos_los_canales)
  if total == 0:
    print("Los archivos encontrados no contienen enlaces válidos.")
    return

  print(
      f"\nTotal de canales únicos a verificar: {total} (usando {max_hilos}"
      " hilos)..."
  )
  canales_activos = []

  with ThreadPoolExecutor(max_workers=max_hilos) as executor:
    futuros = {
        executor.submit(verificar_stream, canal): canal
        for canal in todos_los_canales
    }

    for i, futuro in enumerate(as_completed(futuros), 1):
      activo, metadatos, url = futuro.result()
      if activo:
        canales_activos.append((metadatos, url))
        estado = "ACTIVO"
      else:
        estado = "CAÍDO "

      nombre_canal = metadatos.split(",")[-1][:35]
      print(f"[{i}/{total}] [{estado}] {nombre_canal}")

  # Guardar todo en lista_limpia.m3u dentro de la misma carpeta del script
  with open(ruta_salida, "w", encoding="utf-8") as f:
    f.write("#EXTM3U\n")
    for metadatos, url in canales_activos:
      f.write(f"{metadatos}\n{url}\n")

  print(
      "\nProceso terminado: "
      f"{len(canales_activos)}/{total} canales activos guardados en"
      f" '{ruta_salida}'."
  )


if __name__ == "__main__":
  procesar_carpeta_script(nombre_salida="lista_limpia.m3u", max_hilos=20)