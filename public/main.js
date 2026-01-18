const state = {
  files: [],
  activeFile: null,
  duration: 0,
  worker: new Worker('worker.js'),
  polling: null
};

const el = (id) => document.getElementById(id);
const player = el('player');
const startInput = el('startInput');
const endInput = el('endInput');
const durationLabel = el('durationLabel');
const startLabel = el('startLabel');
const endLabel = el('endLabel');
const progressBar = el('progressBar');
const jobLabel = el('jobLabel');
const logBox = el('log');
const healthBadge = el('healthBadge');
const downloadLink = el('downloadLink');

const log = (message) => {
  const ts = new Date().toLocaleTimeString();
  logBox.textContent = `[${ts}] ${message}\n${logBox.textContent}`;
};

const requestWorker = (type, payload) => new Promise((resolve) => {
  const requestId = crypto.randomUUID();
  const handler = (event) => {
    if (event.data?.id === requestId) {
      state.worker.removeEventListener('message', handler);
      resolve(event.data.payload);
    }
  };
  state.worker.addEventListener('message', handler);
  state.worker.postMessage({ id: requestId, type, payload });
});

const checkHealth = async () => {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('sin respuesta');
    const data = await res.json();
    healthBadge.textContent = `Backend ok · ${Math.round(data.uptime)}s uptime`;
    healthBadge.style.background = 'rgba(108,240,194,0.16)';
    healthBadge.style.color = '#6cf0c2';
  } catch (err) {
    healthBadge.textContent = 'Backend no responde';
    healthBadge.style.background = 'rgba(255,99,132,0.16)';
    healthBadge.style.color = '#ff8ca0';
    log('No se pudo consultar /health');
  }
};

const renderClipList = () => {
  const container = el('clipList');
  container.innerHTML = '';
  state.files.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'clip-item';
    if (state.activeFile === file.fileId) item.classList.add('active');
    item.innerHTML = `
      <div class="checkbox"><input type="checkbox" data-file="${file.fileId}" class="concat-check"> <span>${file.originalName}</span></div>
      <small>${(file.size / 1024 / 1024).toFixed(1)} MB</small>
    `;
    item.addEventListener('click', () => selectClip(file.fileId));
    container.appendChild(item);
  });
};

const selectClip = (fileId) => {
  state.activeFile = fileId;
  renderClipList();
  setVideoSource(`/api/media/${fileId}`);
  log(`Clip activo: ${fileId}`);
};

const setVideoSource = (src) => {
  player.src = src;
  player.load();
};

player.addEventListener('loadedmetadata', () => {
  state.duration = Number(player.duration.toFixed(2));
  startInput.max = state.duration;
  endInput.max = state.duration;
  endInput.value = state.duration;
  startInput.value = 0;
  startLabel.textContent = '0.0';
  endLabel.textContent = state.duration.toString();
  durationLabel.textContent = `${state.duration}s`;
});

const updateTimelineLabels = () => {
  startLabel.textContent = Number(startInput.value).toFixed(2);
  endLabel.textContent = Number(endInput.value).toFixed(2);
  const dur = Math.max(0, Number(endInput.value) - Number(startInput.value));
  durationLabel.textContent = `${dur.toFixed(2)}s`;
};

['input', 'change'].forEach((evt) => {
  startInput.addEventListener(evt, () => {
    if (Number(startInput.value) > Number(endInput.value)) {
      endInput.value = startInput.value;
    }
    updateTimelineLabels();
  });
  endInput.addEventListener(evt, () => {
    if (Number(endInput.value) < Number(startInput.value)) {
      startInput.value = endInput.value;
    }
    updateTimelineLabels();
  });
});

const uploadFiles = async () => {
  const input = document.getElementById('fileInput');
  if (!input.files.length) return log('Selecciona archivos primero');
  const form = new FormData();
  Array.from(input.files).forEach((file) => form.append('files', file));
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Error al subir');
    const data = await res.json();
    state.files = [...state.files, ...data.files];
    if (!state.activeFile) selectClip(data.files[0].fileId);
    renderClipList();
    log(`Subidos ${data.files.length} archivos`);
  } catch (err) {
    log(`Falló la subida: ${err.message}`);
  }
};

document.getElementById('uploadBtn').addEventListener('click', uploadFiles);

document.getElementById('trimBtn').addEventListener('click', async () => {
  if (!state.activeFile) return log('Selecciona un clip');
  const { start, end } = await requestWorker('timeline', {
    start: Number(startInput.value),
    end: Number(endInput.value),
    duration: state.duration
  });
  runJob('/api/trim', { fileId: state.activeFile, start, end }, 'Trim en progreso');
});

document.getElementById('concatBtn').addEventListener('click', async () => {
  const checks = Array.from(document.querySelectorAll('.concat-check:checked'));
  const ids = checks.map((c) => c.dataset.file);
  if (ids.length < 2) return log('Selecciona al menos dos clips para unir');
  runJob('/api/concat', { fileIds: ids }, 'Unión de clips');
});

document.getElementById('filterBtn').addEventListener('click', async () => {
  if (!state.activeFile) return log('Selecciona un clip');
  const payload = await requestWorker('filters', {
    brightness: Number(document.getElementById('brightness').value),
    contrast: Number(document.getElementById('contrast').value),
    grayscale: document.getElementById('grayscale').checked
  });
  runJob('/api/filter', { fileId: state.activeFile, ...payload }, 'Aplicando filtros');
});

document.getElementById('textBtn').addEventListener('click', async () => {
  if (!state.activeFile) return log('Selecciona un clip');
  const payload = await requestWorker('text', {
    text: document.getElementById('textValue').value,
    x: Number(document.getElementById('textX').value),
    y: Number(document.getElementById('textY').value),
    fontSize: Number(document.getElementById('fontSize').value),
    color: document.getElementById('fontColor').value,
    start: Number(document.getElementById('textStart').value),
    end: Number(document.getElementById('textEnd').value)
  });
  runJob('/api/text', { fileId: state.activeFile, ...payload }, 'Aplicando texto');
});

document.getElementById('audioBtn').addEventListener('click', async () => {
  if (!state.activeFile) return log('Selecciona un clip');
  const payload = await requestWorker('audio', {
    start: Number(document.getElementById('audioStart').value),
    end: Number(document.getElementById('audioEnd').value),
    volume: Number(document.getElementById('volume').value)
  });
  runJob('/api/audio', { fileId: state.activeFile, ...payload }, 'Procesando audio');
});

const runJob = async (url, body, label) => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    const { jobId } = await res.json();
    log(`${label} | job ${jobId}`);
    startPolling(jobId, label);
  } catch (err) {
    log(`Error en job: ${err.message}`);
  }
};

const startPolling = (jobId, label) => {
  if (state.polling) clearInterval(state.polling);
  progressBar.style.width = '0%';
  jobLabel.textContent = label;
  downloadLink.style.display = 'none';

  const tick = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('job no encontrado');
      const job = await res.json();
      progressBar.style.width = `${job.progress || 0}%`;
      jobLabel.textContent = `${label} · ${job.progress || 0}%`;
      if (job.status === 'completed') {
        clearInterval(state.polling);
        jobLabel.textContent = 'Render listo';
        downloadLink.href = `/api/jobs/${jobId}/download`;
        downloadLink.style.display = 'inline-flex';
        setVideoSource(`/api/media/${jobId}.mp4`);
        log('Render finalizado');
      } else if (job.status === 'error') {
        clearInterval(state.polling);
        jobLabel.textContent = 'Error en render';
        log(`Error: ${job.error || 'desconocido'}`);
      }
    } catch (err) {
      clearInterval(state.polling);
      jobLabel.textContent = 'Error al consultar job';
      log(err.message);
    }
  };
  tick();
  state.polling = setInterval(tick, 1200);
};

checkHealth();
log('CuteForge listo. Sube un clip para empezar.');
