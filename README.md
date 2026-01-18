# CuteForge · Web video editor

Base sólida tipo CapCut Lite: frontend vanilla, backend Express, FFmpeg nativo. Pensado para producción y despliegue en Render.

## Pila
- Frontend: HTML + CSS + JS (sin frameworks) en [public](public)
- Backend: Node.js + Express en [src/server.js](src/server.js) y rutas en [src/routes/videoRoutes.js](src/routes/videoRoutes.js)
- Procesado: FFmpeg nativo invocado desde [src/services/ffmpegService.js](src/services/ffmpegService.js)
- Jobs y progreso: in-memory en [src/services/jobManager.js](src/services/jobManager.js)

## Requisitos
- Node.js 18+
- FFmpeg instalado y disponible en PATH (o define FFMPEG_PATH). En Render se instala vía `apt-get` en [render.yaml](render.yaml).

## Instalación local
1) Instala dependencias: `npm install`
2) Arranca en dev: `npm run dev`
3) Abre http://localhost:3000

Variables opcionales en `.env`:
- `PORT` (default 3000)
- `FFMPEG_PATH` si no está en PATH
- `FONT_FILE` ruta absoluta a fuente para drawtext

## Flujo de uso
1) Sube clips (MP4 recomendado) en la UI.
2) Ajusta timeline (inicio/fin), texto, filtros, audio.
3) Ejecuta acciones (trim, filtros, texto, audio, unir clips).
4) Progreso se muestra en UI; backend ejecuta FFmpeg. Descarga el render cuando termine.

## API principal
- `POST /api/upload` (FormData `files[]`)
- `POST /api/trim` { fileId, start, end }
- `POST /api/concat` { fileIds: [] }
- `POST /api/text` { fileId, text, x, y, fontSize, color, start, end }
- `POST /api/filter` { fileId, brightness, contrast, grayscale }
- `POST /api/audio` { fileId, start, end, volume }
- `GET /api/jobs/:jobId` estado/progreso
- `GET /api/jobs/:jobId/download` descarga render
- `GET /api/media/:fileId` stream de clips/subrenders

Las salidas se guardan en `storage/renders` con nombre `<jobId>.mp4`.

## Despliegue en Render
Render usa Node native build. Archivo [render.yaml](render.yaml):
- `buildCommand`: instala FFmpeg (apt) y `npm install`
- `startCommand`: `npm run start`
Asegura que FFmpeg está disponible en el plan que elijas.

## Notas de arquitectura
- Front no procesa video pesado; solo metadatos/timestamps.
- Web Worker en [public/worker.js](public/worker.js) evita bloquear la UI mientras prepara payloads.
- Cada job se rastrea y se consulta por polling; el progreso se estima a partir de FFmpeg `out_time_ms` cuando hay duración conocida.
- Separa rutas, servicios y utilidades para mantener el código mantenible y escalable.

## Pendientes/futuro
- Persistir jobs en un store externo para escalar horizontalmente.
- Validar fonts disponibles para drawtext en producción.
- Limpiar archivos temporales con un cron/TTL.

## Licencia
Uso interno / demo profesional. Ajusta según tus políticas.
