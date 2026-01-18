const path = require('path');
const fs = require('fs');

const uploadsDir = path.resolve(__dirname, '../../storage/uploads');
const rendersDir = path.resolve(__dirname, '../../storage/renders');

const resolveUploadPath = (fileId) => path.join(uploadsDir, fileId);
const resolveRenderPath = (fileId) => path.join(rendersDir, fileId);

const ensureExists = (filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile();

const resolveSource = (fileId) => {
  const fromUpload = resolveUploadPath(fileId);
  if (ensureExists(fromUpload)) return fromUpload;
  const fromRender = resolveRenderPath(fileId);
  if (ensureExists(fromRender)) return fromRender;
  return null;
};

module.exports = {
  resolveUploadPath,
  resolveRenderPath,
  resolveSource,
  uploadsDir,
  rendersDir
};
