const fs = require('fs');
const path = require('path');

const META_FILE = 'meta.json';
const STORED_BASENAME = 'dni';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);

const EXT_BY_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf'
});

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'client-document-photos');

function ensureUploadsRoot() {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

function clientDir(clientId) {
  return path.join(UPLOADS_ROOT, String(clientId));
}

function metaPath(clientId) {
  return path.join(clientDir(clientId), META_FILE);
}

function assertMime(mimeType) {
  if (!ALLOWED_MIME.has(mimeType)) {
    return { error: 'Solo se permiten JPG, PNG o PDF' };
  }
  return { ok: true };
}

function readMeta(clientId) {
  try {
    const raw = fs.readFileSync(metaPath(clientId), 'utf8');
    const meta = JSON.parse(raw);
    if (!meta || !meta.storedName) return null;
    return meta;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function writeMeta(clientId, meta) {
  ensureUploadsRoot();
  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath(clientId), JSON.stringify(meta, null, 2), 'utf8');
}

function absolutePath(clientId, storedName) {
  return path.join(clientDir(clientId), storedName);
}

function clearStoredFiles(clientId) {
  const dir = clientDir(clientId);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, name));
  }
}

function saveDocumentPhoto(clientId, file) {
  const mimeCheck = assertMime(file.mimetype);
  if (mimeCheck.error) return mimeCheck;

  ensureUploadsRoot();
  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });
  clearStoredFiles(clientId);

  const ext = EXT_BY_MIME[file.mimetype] || '';
  const storedName = `${STORED_BASENAME}${ext}`;
  fs.writeFileSync(path.join(dir, storedName), file.buffer);

  const meta = {
    originalName: file.originalname || storedName,
    storedName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    updatedAt: new Date().toISOString()
  };
  writeMeta(clientId, meta);
  return { meta };
}

function deleteDocumentPhoto(clientId) {
  const dir = clientDir(clientId);
  if (!fs.existsSync(dir)) return { deleted: false };
  fs.rmSync(dir, { recursive: true, force: true });
  return { deleted: true };
}

function toPublicMeta(meta) {
  if (!meta) return null;
  return {
    originalName: meta.originalName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    updatedAt: meta.updatedAt,
    exists: true
  };
}

module.exports = {
  ALLOWED_MIME,
  UPLOADS_ROOT,
  assertMime,
  readMeta,
  absolutePath,
  saveDocumentPhoto,
  deleteDocumentPhoto,
  toPublicMeta
};
