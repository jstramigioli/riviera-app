/**
 * Fotos de documento por estadía (OnlineCheckIn).
 * Independientes de la ficha Client: no se pierden al actualizar el perfil.
 */
const fs = require('fs');
const path = require('path');
const {
  assertSlot,
  assertMime,
  ALLOWED_MIME,
  emptySlotsMeta,
  toPublicMeta,
  toPublicSlots
} = require('./clientDocumentPhoto');

const EXT_BY_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf'
});

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'checkin-document-photos');
const META_FILE = 'meta.json';

function ensureRoot() {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

function checkInDir(checkInId) {
  return path.join(UPLOADS_ROOT, String(checkInId));
}

function metaPath(checkInId) {
  return path.join(checkInDir(checkInId), META_FILE);
}

function readAllMeta(checkInId) {
  try {
    const raw = fs.readFileSync(metaPath(checkInId), 'utf8');
    const meta = JSON.parse(raw);
    return {
      front: meta?.front?.storedName ? meta.front : null,
      back: meta?.back?.storedName ? meta.back : null
    };
  } catch (err) {
    if (err.code === 'ENOENT') return emptySlotsMeta();
    throw err;
  }
}

function writeAllMeta(checkInId, all) {
  ensureRoot();
  const dir = checkInDir(checkInId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    metaPath(checkInId),
    JSON.stringify({ front: all.front || null, back: all.back || null }, null, 2),
    'utf8'
  );
}

function absolutePath(checkInId, storedName) {
  return path.join(checkInDir(checkInId), storedName);
}

function removeFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function saveCheckInDocumentPhoto(checkInId, file, slot = 'front') {
  const checked = assertSlot(slot);
  if (checked.error) return checked;
  const mimeCheck = assertMime(file.mimetype);
  if (mimeCheck.error) return mimeCheck;

  ensureRoot();
  const dir = checkInDir(checkInId);
  fs.mkdirSync(dir, { recursive: true });

  const all = readAllMeta(checkInId);
  if (all[checked.slot]?.storedName) {
    removeFileIfExists(absolutePath(checkInId, all[checked.slot].storedName));
  }

  const ext = EXT_BY_MIME[file.mimetype] || '';
  const storedName = `${checked.slot}${ext}`;
  fs.writeFileSync(path.join(dir, storedName), file.buffer);

  const meta = {
    originalName: file.originalname || storedName,
    storedName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    updatedAt: new Date().toISOString(),
    slot: checked.slot
  };
  all[checked.slot] = meta;
  writeAllMeta(checkInId, all);
  return { meta, slot: checked.slot, all };
}

/** Campos Prisma OnlineCheckIn para un slot. */
function prismaCheckInFieldsForSlot(slot, meta) {
  const checked = assertSlot(slot);
  if (checked.error) return {};
  const prefix = checked.slot === 'front' ? 'documentPhotoFront' : 'documentPhotoBack';
  if (!meta) {
    return {
      [`${prefix}StoredName`]: null,
      [`${prefix}OriginalName`]: null,
      [`${prefix}MimeType`]: null,
      [`${prefix}SizeBytes`]: null
    };
  }
  return {
    [`${prefix}StoredName`]: meta.storedName,
    [`${prefix}OriginalName`]: meta.originalName || meta.storedName,
    [`${prefix}MimeType`]: meta.mimeType || null,
    [`${prefix}SizeBytes`]: Number.isFinite(meta.sizeBytes) ? meta.sizeBytes : null
  };
}

module.exports = {
  ALLOWED_MIME,
  UPLOADS_ROOT,
  assertSlot,
  readAllMeta,
  absolutePath,
  saveCheckInDocumentPhoto,
  prismaCheckInFieldsForSlot,
  toPublicMeta,
  toPublicSlots,
  emptySlotsMeta
};
