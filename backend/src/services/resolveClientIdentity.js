/**
 * Resolución compartida de Client por identidad documental.
 * Clave: documentType + documentIssuingCountry + documentNumberNormalized.
 * Usado por check-in externo e interno (huéspedes).
 */

const { createNotesWithAddress } = require('../utils/clientAddressNotes');

const CLIENT_DOCUMENT_TYPES = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

function normalizeText(value) {
  if (value == null) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

/** Strip espacios, puntos, guiones y deja alfanumérico en mayúsculas. */
function normalizeDocumentNumber(value) {
  if (value == null) return null;
  const cleaned = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s.\-/\\_]/g, '');
  return cleaned || null;
}

function normalizeDocumentType(value) {
  const cleaned = normalizeText(value) || 'DNI';
  return CLIENT_DOCUMENT_TYPES.includes(cleaned) ? cleaned : 'DNI';
}

/** ISO-ish country code; default AR. */
function normalizeIssuingCountry(value, fallback = 'AR') {
  const cleaned = normalizeText(value);
  if (!cleaned) return fallback || 'AR';
  return cleaned.toUpperCase().slice(0, 8);
}

function normalizePersonName(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function namesMatch(aFirst, aLast, bFirst, bLast) {
  return (
    normalizePersonName(aFirst) === normalizePersonName(bFirst) &&
    normalizePersonName(aLast) === normalizePersonName(bLast)
  );
}

function parseBirthDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
    if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
    return d;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('invalid birthDate');
  return d;
}

function buildIdentityKey(input = {}) {
  const documentType = normalizeDocumentType(input.documentType);
  const documentNumber = normalizeText(input.documentNumber);
  const documentNumberNormalized = normalizeDocumentNumber(input.documentNumber);
  const documentIssuingCountry = documentNumberNormalized
    ? normalizeIssuingCountry(input.documentIssuingCountry ?? input.issuingCountry)
    : normalizeText(input.documentIssuingCountry ?? input.issuingCountry);

  return {
    documentType,
    documentNumber,
    documentNumberNormalized,
    documentIssuingCountry: documentNumberNormalized
      ? documentIssuingCountry || 'AR'
      : documentIssuingCountry || null
  };
}

/**
 * Busca Client por clave documental única (dentro de tx o prisma).
 */
async function findClientByDocumentKey(db, key) {
  if (!key?.documentNumberNormalized || !key.documentIssuingCountry) return null;
  return db.client.findFirst({
    where: {
      documentType: key.documentType,
      documentIssuingCountry: key.documentIssuingCountry,
      documentNumberNormalized: key.documentNumberNormalized
    }
  });
}

function profileUpdateData(payload, { includeNames = true, existingNotes = null } = {}) {
  const address = normalizeText(payload.address);
  const data = {
    email: normalizeText(payload.email),
    phone: normalizeText(payload.phone),
    documentType: normalizeDocumentType(payload.documentType),
    documentNumber: normalizeText(payload.documentNumber),
    documentIssuingCountry: buildIdentityKey(payload).documentIssuingCountry,
    documentNumberNormalized: buildIdentityKey(payload).documentNumberNormalized,
    birthDate: payload.birthDate instanceof Date ? payload.birthDate : null,
    country: normalizeText(payload.country) || 'AR',
    province: normalizeText(payload.province),
    city: normalizeText(payload.city),
    wantsPromotions: Boolean(payload.wantsPromotions),
    notes: createNotesWithAddress(existingNotes, address)
  };
  if (payload.birthDate != null && !(payload.birthDate instanceof Date)) {
    try {
      data.birthDate = parseBirthDate(payload.birthDate);
    } catch {
      data.birthDate = null;
    }
  }
  if (includeNames) {
    data.firstName = normalizeText(payload.firstName);
    data.lastName = normalizeText(payload.lastName);
  }
  return data;
}

/**
 * Resuelve Client: match por documento → update o create; discrepancia de nombre → no overwrite + revisión.
 *
 * @param {object} db prisma o tx
 * @param {object} input datos del form
 * @param {object} [options]
 * @param {number|null} [options.preferredClientId] cliente elegido en búsqueda interna
 * @param {boolean} [options.updatePreferredEvenWithoutDoc] si no hay doc, actualizar preferred
 * @returns {Promise<{ client, created: boolean, updated: boolean, needsManualReview: boolean, identityConflictNote: string|null }>}
 */
async function resolveClientIdentity(db, input, options = {}) {
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  if (!firstName || !lastName) {
    const err = new Error('Nombre y apellido son obligatorios');
    err.status = 400;
    throw err;
  }

  const key = buildIdentityKey(input);
  let birthDate = null;
  if (input.birthDate != null && input.birthDate !== '') {
    try {
      birthDate = input.birthDate instanceof Date ? input.birthDate : parseBirthDate(input.birthDate);
    } catch {
      const err = new Error('Fecha de nacimiento inválida');
      err.status = 400;
      throw err;
    }
  }

  const payload = {
    ...input,
    firstName,
    lastName,
    birthDate,
    documentType: key.documentType,
    documentNumber: key.documentNumber,
    documentIssuingCountry: key.documentIssuingCountry,
    documentNumberNormalized: key.documentNumberNormalized
  };

  const preferredId =
    options.preferredClientId != null && Number.isFinite(Number(options.preferredClientId))
      ? Number(options.preferredClientId)
      : null;

  let matched = null;
  if (key.documentNumberNormalized && key.documentIssuingCountry) {
    matched = await findClientByDocumentKey(db, key);
  }

  // Preferido sin match documental: si tiene el mismo doc o no hay doc en form, usarlo.
  if (!matched && preferredId) {
    const preferred = await db.client.findUnique({ where: { id: preferredId } });
    if (preferred) {
      const prefKey = buildIdentityKey(preferred);
      const sameDoc =
        key.documentNumberNormalized &&
        prefKey.documentNumberNormalized === key.documentNumberNormalized &&
        prefKey.documentType === key.documentType &&
        prefKey.documentIssuingCountry === key.documentIssuingCountry;
      if (sameDoc || !key.documentNumberNormalized || options.updatePreferredEvenWithoutDoc !== false) {
        matched = preferred;
      }
    }
  }

  if (!matched) {
    const created = await db.client.create({
      data: {
        ...profileUpdateData(payload, { includeNames: true, existingNotes: null }),
        needsIdentityReview: false
      }
    });
    return {
      client: created,
      created: true,
      updated: false,
      needsManualReview: false,
      identityConflictNote: null
    };
  }

  const conflict = !namesMatch(matched.firstName, matched.lastName, firstName, lastName);
  const existingNotes = matched.notes;
  const updateData = profileUpdateData(payload, {
    includeNames: !conflict,
    existingNotes
  });

  if (conflict) {
    updateData.needsIdentityReview = true;
  }

  const updated = await db.client.update({
    where: { id: matched.id },
    data: updateData
  });

  const note = conflict
    ? `Documento ${key.documentType} ${key.documentNumber || key.documentNumberNormalized} (${key.documentIssuingCountry}) coincide con ficha "${matched.firstName} ${matched.lastName}", pero el formulario envió "${firstName} ${lastName}".`
    : null;

  return {
    client: updated,
    created: false,
    updated: true,
    needsManualReview: conflict,
    identityConflictNote: note
  };
}

module.exports = {
  CLIENT_DOCUMENT_TYPES,
  normalizeText,
  normalizeDocumentNumber,
  normalizeDocumentType,
  normalizeIssuingCountry,
  normalizePersonName,
  namesMatch,
  parseBirthDate,
  buildIdentityKey,
  findClientByDocumentKey,
  resolveClientIdentity
};
