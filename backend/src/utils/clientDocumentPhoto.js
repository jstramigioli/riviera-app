const fs = require('fs');
const path = require('path');

const META_FILE = 'meta.json';
const LEGACY_BASENAME = 'dni';
const SLOTS = Object.freeze(['front', 'back']);
const SLOT_LABELS = Object.freeze({ front: 'frente', back: 'dorso' });

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

function normalizeSlot(slot) {
  const cleaned = String(slot || '').trim().toLowerCase();
  if (cleaned === 'frente') return 'front';
  if (cleaned === 'dorso') return 'back';
  if (SLOTS.includes(cleaned)) return cleaned;
  return null;
}

function assertSlot(slot) {
  const normalized = normalizeSlot(slot);
  if (!normalized) {
    return { error: 'Slot inválido (frente o dorso)' };
  }
  return { slot: normalized };
}

function assertMime(mimeType) {
  if (!ALLOWED_MIME.has(mimeType)) {
    return { error: 'Solo se permiten JPG, PNG o PDF' };
  }
  return { ok: true };
}

function emptySlotsMeta() {
  return { front: null, back: null };
}

function readLegacyMeta(clientId) {
  try {
    const raw = fs.readFileSync(metaPath(clientId), 'utf8');
    const meta = JSON.parse(raw);
    if (!meta) return null;
    // Nuevo formato: { front, back }
    if (Object.prototype.hasOwnProperty.call(meta, 'front') || Object.prototype.hasOwnProperty.call(meta, 'back')) {
      return {
        front: meta.front && meta.front.storedName ? meta.front : null,
        back: meta.back && meta.back.storedName ? meta.back : null
      };
    }
    // Legacy: un solo archivo (dni.*)
    if (meta.storedName) {
      return { front: meta, back: null };
    }
    return null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function readAllMeta(clientId) {
  const fromDisk = readLegacyMeta(clientId);
  return fromDisk || emptySlotsMeta();
}

function readMeta(clientId, slot = 'front') {
  const checked = assertSlot(slot);
  if (checked.error) return null;
  const all = readAllMeta(clientId);
  return all[checked.slot] || null;
}

function writeAllMeta(clientId, all) {
  ensureUploadsRoot();
  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    front: all.front || null,
    back: all.back || null
  };
  fs.writeFileSync(metaPath(clientId), JSON.stringify(payload, null, 2), 'utf8');
}

function absolutePath(clientId, storedName) {
  return path.join(clientDir(clientId), storedName);
}

function removeFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function clearSlotFiles(clientId, slot, currentMeta) {
  if (currentMeta?.storedName) {
    removeFileIfExists(absolutePath(clientId, currentMeta.storedName));
  }
  // Limpia legacy dni.* si estamos escribiendo front por primera vez
  if (slot === 'front') {
    const dir = clientDir(clientId);
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name === META_FILE) continue;
      if (name.startsWith(`${LEGACY_BASENAME}.`)) {
        removeFileIfExists(path.join(dir, name));
      }
    }
  }
}

function saveDocumentPhoto(clientId, file, slot = 'front') {
  const checked = assertSlot(slot);
  if (checked.error) return checked;
  const mimeCheck = assertMime(file.mimetype);
  if (mimeCheck.error) return mimeCheck;

  ensureUploadsRoot();
  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });

  const all = readAllMeta(clientId);
  clearSlotFiles(clientId, checked.slot, all[checked.slot]);

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
  writeAllMeta(clientId, all);
  return { meta, slot: checked.slot, all };
}

function deleteDocumentPhoto(clientId, slot = null) {
  const dir = clientDir(clientId);
  if (!fs.existsSync(dir)) return { deleted: false };

  if (slot == null) {
    fs.rmSync(dir, { recursive: true, force: true });
    return { deleted: true };
  }

  const checked = assertSlot(slot);
  if (checked.error) return checked;

  const all = readAllMeta(clientId);
  if (!all[checked.slot]) return { deleted: false, slot: checked.slot, all };

  clearSlotFiles(clientId, checked.slot, all[checked.slot]);
  all[checked.slot] = null;

  if (!all.front && !all.back) {
    fs.rmSync(dir, { recursive: true, force: true });
    return { deleted: true, slot: checked.slot, all: emptySlotsMeta() };
  }

  writeAllMeta(clientId, all);
  return { deleted: true, slot: checked.slot, all };
}

function toPublicMeta(meta) {
  if (!meta) return null;
  return {
    slot: meta.slot || null,
    originalName: meta.originalName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    updatedAt: meta.updatedAt,
    exists: true
  };
}

function toPublicSlots(all) {
  const slots = all || emptySlotsMeta();
  return {
    front: toPublicMeta(slots.front),
    back: toPublicMeta(slots.back)
  };
}

/** Campos Prisma Client a partir del meta de un slot. */
function prismaFieldsForSlot(slot, meta) {
  const checked = assertSlot(slot);
  if (checked.error) return {};
  const prefix = checked.slot === 'front' ? 'documentPhotoFront' : 'documentPhotoBack';
  if (!meta) {
    return {
      [`${prefix}StoredName`]: null,
      [`${prefix}OriginalName`]: null,
      [`${prefix}MimeType`]: null,
      [`${prefix}SizeBytes`]: null,
      [`${prefix}UpdatedAt`]: null
    };
  }
  return {
    [`${prefix}StoredName`]: meta.storedName,
    [`${prefix}OriginalName`]: meta.originalName || meta.storedName,
    [`${prefix}MimeType`]: meta.mimeType || null,
    [`${prefix}SizeBytes`]: Number.isFinite(meta.sizeBytes) ? meta.sizeBytes : null,
    [`${prefix}UpdatedAt`]: meta.updatedAt ? new Date(meta.updatedAt) : new Date()
  };
}

function prismaFieldsForAll(all) {
  return {
    ...prismaFieldsForSlot('front', all?.front || null),
    ...prismaFieldsForSlot('back', all?.back || null)
  };
}

function hasBothSlots(all) {
  const slots = all || emptySlotsMeta();
  return Boolean(slots.front?.storedName && slots.back?.storedName);
}

module.exports = {
  ALLOWED_MIME,
  UPLOADS_ROOT,
  SLOTS,
  SLOT_LABELS,
  assertMime,
  assertSlot,
  normalizeSlot,
  readMeta,
  readAllMeta,
  absolutePath,
  saveDocumentPhoto,
  deleteDocumentPhoto,
  toPublicMeta,
  toPublicSlots,
  prismaFieldsForSlot,
  prismaFieldsForAll,
  hasBothSlots,
  emptySlotsMeta
};
