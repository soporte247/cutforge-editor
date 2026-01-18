const { v4: uuid } = require('uuid');

const jobs = new Map();

const createJob = (type, meta = {}) => {
  const jobId = uuid();
  jobs.set(jobId, {
    id: jobId,
    type,
    status: 'queued',
    progress: 0,
    meta,
    outputPath: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null
  });
  return jobId;
};

const updateStatus = (jobId, status) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = status;
  if (status === 'completed' || status === 'error') {
    job.finishedAt = Date.now();
    job.progress = status === 'completed' ? 100 : job.progress;
  }
};

const updateProgress = (jobId, progress) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.progress = Math.max(0, Math.min(100, Number(progress)));
};

const setOutput = (jobId, outputPath) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.outputPath = outputPath;
};

const setError = (jobId, error) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.error = error instanceof Error ? error.message : error;
  job.status = 'error';
  job.finishedAt = Date.now();
};

const getJob = (jobId) => jobs.get(jobId);

module.exports = {
  createJob,
  updateStatus,
  updateProgress,
  setOutput,
  setError,
  getJob
};
