const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const mime = require('mime-types');
const {
  trimVideo,
  concatVideos,
  applyText,
  applyFilters,
  processAudio
} = require('../services/ffmpegService');
const jobManager = require('../services/jobManager');
const {
  resolveSource,
  uploadsDir
} = require('../utils/filePaths');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const allowed = new Set(['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav']);
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 512 }, // 512MB
  fileFilter: (req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Formato no soportado'));
  }
});

router.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: 'No se subieron archivos' });
  }
  const files = req.files.map((file) => ({
    fileId: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    url: `/api/media/${file.filename}`
  }));
  res.json({ files });
});

router.get('/media/:fileId', (req, res) => {
  const filePath = resolveSource(req.params.fileId);
  if (!filePath) return res.status(404).json({ error: 'Archivo no encontrado' });
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': mime.lookup(filePath) || 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(res);
});

router.post('/trim', async (req, res) => {
  const { fileId, start = 0, end = 0 } = req.body;
  const source = resolveSource(fileId);
  if (!source) return res.status(404).json({ error: 'Archivo no encontrado' });

  const jobId = jobManager.createJob('trim', { fileId, start, end });
  jobManager.updateStatus(jobId, 'processing');
  const outputName = `${jobId}.mp4`;

  trimVideo({ inputPath: source, outputName, start, end, jobId })
    .then((outputPath) => {
      jobManager.setOutput(jobId, outputPath);
      jobManager.updateStatus(jobId, 'completed');
    })
    .catch((err) => {
      jobManager.setError(jobId, err);
    });

  res.json({ jobId });
});

router.post('/concat', async (req, res) => {
  const { fileIds = [] } = req.body;
  if (!Array.isArray(fileIds) || fileIds.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos dos clips' });
  }
  const inputPaths = fileIds.map(resolveSource).filter(Boolean);
  if (inputPaths.length !== fileIds.length) {
    return res.status(404).json({ error: 'Algún archivo no existe' });
  }
  const jobId = jobManager.createJob('concat', { fileIds });
  jobManager.updateStatus(jobId, 'processing');
  const outputName = `${jobId}.mp4`;

  concatVideos({ inputPaths, outputName, jobId })
    .then((outputPath) => {
      jobManager.setOutput(jobId, outputPath);
      jobManager.updateStatus(jobId, 'completed');
    })
    .catch((err) => jobManager.setError(jobId, err));

  res.json({ jobId });
});

router.post('/text', async (req, res) => {
  const { fileId, text, x, y, fontSize, color, start, end } = req.body;
  const source = resolveSource(fileId);
  if (!source) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (!text) return res.status(400).json({ error: 'Texto requerido' });

  const jobId = jobManager.createJob('text', { fileId, text });
  jobManager.updateStatus(jobId, 'processing');
  const outputName = `${jobId}.mp4`;

  applyText({ inputPath: source, outputName, text, x, y, fontSize, color, start, end, jobId })
    .then((outputPath) => {
      jobManager.setOutput(jobId, outputPath);
      jobManager.updateStatus(jobId, 'completed');
    })
    .catch((err) => jobManager.setError(jobId, err));

  res.json({ jobId });
});

router.post('/filter', async (req, res) => {
  const { fileId, brightness = 0, contrast = 1, grayscale = false } = req.body;
  const source = resolveSource(fileId);
  if (!source) return res.status(404).json({ error: 'Archivo no encontrado' });

  const jobId = jobManager.createJob('filter', { fileId });
  jobManager.updateStatus(jobId, 'processing');
  const outputName = `${jobId}.mp4`;

  applyFilters({ inputPath: source, outputName, brightness, contrast, grayscale, jobId })
    .then((outputPath) => {
      jobManager.setOutput(jobId, outputPath);
      jobManager.updateStatus(jobId, 'completed');
    })
    .catch((err) => jobManager.setError(jobId, err));

  res.json({ jobId });
});

router.post('/audio', async (req, res) => {
  const { fileId, start = 0, end = 0, volume = 1 } = req.body;
  const source = resolveSource(fileId);
  if (!source) return res.status(404).json({ error: 'Archivo no encontrado' });

  const jobId = jobManager.createJob('audio', { fileId, start, end, volume });
  jobManager.updateStatus(jobId, 'processing');
  const outputName = `${jobId}.mp4`;

  processAudio({ inputPath: source, outputName, start, end, volume, jobId })
    .then((outputPath) => {
      jobManager.setOutput(jobId, outputPath);
      jobManager.updateStatus(jobId, 'completed');
    })
    .catch((err) => jobManager.setError(jobId, err));

  res.json({ jobId });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job no encontrado' });
  res.json(job);
});

router.get('/jobs/:jobId/download', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);
  if (!job || job.status !== 'completed' || !job.outputPath) {
    return res.status(404).json({ error: 'Job no listo' });
  }
  res.download(job.outputPath, path.basename(job.outputPath));
});

module.exports = router;
