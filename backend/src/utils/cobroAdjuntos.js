const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ADJUNTO_TIPOS = Object.freeze({
  FACTURA: 'FACTURA',
  COMPROBANTE: 'COMPROBANTE'
});

const MIME_BY_TIPO = Object.freeze({
  FACTURA: new Set(['application/pdf']),
  COMPROBANTE: new Set(['application/pdf', 'image/jpeg', 'image/png'])
});

const EXT_BY_MIME = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png'
});

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'cobro-adjuntos');

function ensureUploadsRoot() {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

function pagoDir(cobroId) {
  return path.join(UPLOADS_ROOT, String(cobroId));
}

function assertAdjuntoTipo(tipo) {
  const normalized = String(tipo || '').toUpperCase();
  if (!Object.values(ADJUNTO_TIPOS).includes(normalized)) {
    return { error: 'Tipo de adjunto inválido' };
  }
  return { tipo: normalized };
}

function assertMimeForTipo(tipo, mimeType) {
  const allowed = MIME_BY_TIPO[tipo];
  if (!allowed || !allowed.has(mimeType)) {
    return {
      error:
        tipo === ADJUNTO_TIPOS.FACTURA
          ? 'Solo se permiten PDF de factura'
          : 'Solo se permiten JPG, PNG o PDF de comprobante'
    };
  }
  return { ok: true };
}

function buildStoredName(mimeType) {
  const ext = EXT_BY_MIME[mimeType] || '';
  return `${crypto.randomUUID()}${ext}`;
}

function absolutePath(cobroId, storedName) {
  return path.join(pagoDir(cobroId), storedName);
}

function saveUploadedFile(cobroId, file, tipo) {
  ensureUploadsRoot();
  const dir = pagoDir(cobroId);
  fs.mkdirSync(dir, { recursive: true });
  const storedName = buildStoredName(file.mimetype);
  const dest = absolutePath(cobroId, storedName);
  fs.writeFileSync(dest, file.buffer);
  return {
    tipo,
    originalName: file.originalname || storedName,
    storedName,
    mimeType: file.mimetype,
    sizeBytes: file.size
  };
}

function deleteStoredFile(cobroId, storedName) {
  try {
    fs.unlinkSync(absolutePath(cobroId, storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function toPublicAdjunto(row) {
  return {
    id: row.id,
    cobroId: row.cobroId,
    tipo: row.tipo,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt
  };
}

module.exports = {
  ADJUNTO_TIPOS,
  MIME_BY_TIPO,
  UPLOADS_ROOT,
  ensureUploadsRoot,
  assertAdjuntoTipo,
  assertMimeForTipo,
  saveUploadedFile,
  absolutePath,
  deleteStoredFile,
  toPublicAdjunto
};
