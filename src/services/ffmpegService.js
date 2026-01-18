const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const jobManager = require('./jobManager');
const { resolveRenderPath } = require('../utils/filePaths');

const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';

const sanitizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseProgress = (chunk, jobId, totalDurationSec) => {
  const text = chunk.toString();
  const outTimeMatch = text.match(/out_time_ms=(\d+)/);
  if (outTimeMatch && totalDurationSec > 0) {
    const outMs = Number(outTimeMatch[1]);
    const seconds = outMs / 1_000_000;
    const ratio = Math.min(1, seconds / totalDurationSec);
    jobManager.updateProgress(jobId, Math.round(ratio * 100));
  }
  if (text.includes('progress=end')) {
    jobManager.updateProgress(jobId, 100);
  }
};

const runFfmpeg = (args, jobId, totalDurationSec = 0) => new Promise((resolve, reject) => {
  const ffmpegArgs = ['-y', ...args, '-progress', 'pipe:2', '-nostats'];
  const ffmpeg = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });

  ffmpeg.stderr.on('data', (data) => parseProgress(data, jobId, totalDurationSec));

  ffmpeg.on('close', (code) => {
    if (code === 0) return resolve();
    reject(new Error(`ffmpeg exited with code ${code}`));
  });

  ffmpeg.on('error', (error) => reject(error));
});

const trimVideo = async ({ inputPath, outputName, start, end, jobId }) => {
  const startSec = sanitizeNumber(start, 0);
  const endSec = sanitizeNumber(end, startSec);
  const duration = Math.max(0, endSec - startSec);
  const outputPath = resolveRenderPath(outputName);

  const args = ['-ss', String(startSec), '-to', String(endSec), '-i', inputPath, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath];

  await runFfmpeg(args, jobId, duration || undefined);
  return outputPath;
};

const concatVideos = async ({ inputPaths, outputName, jobId }) => {
  const listPath = path.join(path.dirname(resolveRenderPath(outputName)), `${outputName}.txt`);
  const entries = inputPaths
    .map((p) => {
      const normalized = p.replace(/\\/g, '/');
      return `file '${normalized.replace(/'/g, "''")}'`;
    })
    .join('\n');
  fs.writeFileSync(listPath, entries, 'utf8');
  const outputPath = resolveRenderPath(outputName);

  const args = ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath];
  try {
    await runFfmpeg(args, jobId);
  } finally {
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
  }
  return outputPath;
};

const applyText = async ({ inputPath, outputName, text, x, y, fontSize, color, start, end, jobId }) => {
  const outputPath = resolveRenderPath(outputName);
  const safeText = String(text || '')
    .replace(/:/g, '\\:')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
  const fontFile = process.env.FONT_FILE;
  const enable = Number.isFinite(Number(start)) && Number.isFinite(Number(end))
    ? `enable='between(t,${start},${end})'`
    : '';
  const enableClause = enable ? `:${enable}` : '';
  const drawTextArgs = [
    `drawtext=${fontFile ? `fontfile=${fontFile}:` : ''}text='${safeText}':x=${x || '10'}:y=${y || 'H-th-20'}:fontsize=${fontSize || 32}:fontcolor=${color || 'white'}${enableClause}`
  ];

  const args = ['-i', inputPath, '-vf', drawTextArgs.join(','), '-c:v', 'libx264', '-c:a', 'copy', '-movflags', '+faststart', outputPath];
  await runFfmpeg(args, jobId);
  return outputPath;
};

const applyFilters = async ({ inputPath, outputName, brightness, contrast, grayscale, jobId }) => {
  const outputPath = resolveRenderPath(outputName);
  const filters = [];
  const b = sanitizeNumber(brightness, 0);
  const c = sanitizeNumber(contrast, 1);
  filters.push(`eq=brightness=${b}:contrast=${c}`);
  if (grayscale) {
    filters.push('format=gray');
  }
  const args = ['-i', inputPath, '-vf', filters.join(','), '-c:v', 'libx264', '-c:a', 'copy', '-movflags', '+faststart', outputPath];
  await runFfmpeg(args, jobId);
  return outputPath;
};

const processAudio = async ({ inputPath, outputName, start, end, volume, jobId }) => {
  const outputPath = resolveRenderPath(outputName);
  const startSec = sanitizeNumber(start, 0);
  const endSec = sanitizeNumber(end, 0);
  const duration = endSec > startSec ? endSec - startSec : undefined;

  const args = [];
  if (Number.isFinite(startSec)) args.push('-ss', String(startSec));
  if (Number.isFinite(endSec) && duration) args.push('-t', String(duration));
  args.push('-i', inputPath, '-filter:a', `volume=${sanitizeNumber(volume, 1)}`);
  args.push('-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', outputPath);

  await runFfmpeg(args, jobId, duration || 0);
  return outputPath;
};

module.exports = {
  trimVideo,
  concatVideos,
  applyText,
  applyFilters,
  processAudio
};
