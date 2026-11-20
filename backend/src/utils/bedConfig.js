/**
 * Utilidades de configuración y compatibilidad de camas.
 * double = 2 plazas; single = 1 plaza.
 * Matrimonial separable puede usarse como 1 double o 2 singles.
 */

const BED_TYPE_DOUBLE = 'double';
const BED_TYPE_SINGLE = 'single';

function normalizeBedType(bedType) {
  const t = String(bedType || '').toLowerCase();
  if (t === BED_TYPE_DOUBLE || t === 'matrimonial') return BED_TYPE_DOUBLE;
  if (t === BED_TYPE_SINGLE || t === 'individual') return BED_TYPE_SINGLE;
  return null;
}

function bedCapacity(bed) {
  const type = normalizeBedType(bed?.bedType);
  if (type === BED_TYPE_DOUBLE) return 2;
  if (type === BED_TYPE_SINGLE) return 1;
  return 0;
}

function totalBedCapacity(beds = []) {
  return (Array.isArray(beds) ? beds : []).reduce((sum, bed) => sum + bedCapacity(bed), 0);
}

/**
 * Defaults por capacidad máxima del tipo (no exceder).
 * 1 → 1 single; 2 → 1 double; 3 → 1 double + 1 single; 4 → 2 doubles; etc.
 */
function defaultBedsForCapacity(maxPeople) {
  const capacity = Math.max(1, parseInt(maxPeople, 10) || 1);
  const doubles = Math.floor(capacity / 2);
  const singles = capacity % 2;
  const beds = [];
  let order = 0;
  for (let i = 0; i < doubles; i += 1) {
    beds.push({ bedType: BED_TYPE_DOUBLE, isSeparable: false, orderIndex: order });
    order += 1;
  }
  for (let i = 0; i < singles; i += 1) {
    beds.push({ bedType: BED_TYPE_SINGLE, isSeparable: false, orderIndex: order });
    order += 1;
  }
  return beds;
}

/**
 * Valida que las camas no excedan la capacidad máxima del tipo.
 * @returns {{ ok: boolean, capacity: number, maxPeople: number, message?: string }}
 */
function validateBedsAgainstCapacity(beds, maxPeople) {
  const max = Math.max(1, parseInt(maxPeople, 10) || 1);
  const list = Array.isArray(beds) ? beds : [];
  for (const bed of list) {
    const type = normalizeBedType(bed?.bedType);
    if (!type) {
      return { ok: false, capacity: 0, maxPeople: max, message: 'Tipo de cama inválido (double|single)' };
    }
    if (type === BED_TYPE_SINGLE && bed?.isSeparable) {
      return { ok: false, capacity: 0, maxPeople: max, message: 'Solo las camas matrimoniales pueden ser separables' };
    }
  }
  const capacity = totalBedCapacity(list);
  if (capacity > max) {
    return {
      ok: false,
      capacity,
      maxPeople: max,
      message: `Las camas suman ${capacity} plazas y el tipo admite máximo ${max}`
    };
  }
  return { ok: true, capacity, maxPeople: max };
}

function normalizeBedPreference(pref = {}) {
  const preferredDoubleBeds = Math.max(0, parseInt(pref.preferredDoubleBeds, 10) || 0);
  const preferredSingleBeds = Math.max(0, parseInt(pref.preferredSingleBeds, 10) || 0);
  const explicitNone = pref.bedPreferenceNone === true || pref.bedPreferenceNone === 'true';
  const explicitPref =
    pref.bedPreferenceNone === false ||
    pref.bedPreferenceNone === 'false' ||
    pref.hasBedPreference === true ||
    pref.hasBedPreference === 'true';

  if (explicitPref) {
    return { bedPreferenceNone: false, preferredDoubleBeds, preferredSingleBeds };
  }
  if (explicitNone || (preferredDoubleBeds === 0 && preferredSingleBeds === 0)) {
    return { bedPreferenceNone: true, preferredDoubleBeds: 0, preferredSingleBeds: 0 };
  }
  return { bedPreferenceNone: false, preferredDoubleBeds, preferredSingleBeds };
}

/**
 * ¿Puede la habitación satisfacer la preferencia de camas?
 * Considera matrimoniales separables como 2 individuales si hace falta.
 * Sin auto-asignación: solo booleano + mensaje.
 */
function roomCanSatisfyBedPreference(beds, preference) {
  const pref = normalizeBedPreference(preference);
  if (pref.bedPreferenceNone) {
    return { complies: true, message: 'Sin preferencia de camas' };
  }

  const reqDouble = pref.preferredDoubleBeds;
  const reqSingle = pref.preferredSingleBeds;
  if (reqDouble === 0 && reqSingle === 0) {
    return { complies: true, message: 'Sin preferencia de camas' };
  }

  const list = Array.isArray(beds) ? beds : [];
  const nonSepDoubles = list.filter((b) => normalizeBedType(b.bedType) === BED_TYPE_DOUBLE && !b.isSeparable).length;
  const sepDoubles = list.filter((b) => normalizeBedType(b.bedType) === BED_TYPE_DOUBLE && b.isSeparable).length;
  const singles = list.filter((b) => normalizeBedType(b.bedType) === BED_TYPE_SINGLE).length;

  const doublesAvailable = nonSepDoubles + sepDoubles;
  if (reqDouble > doublesAvailable) {
    return {
      complies: false,
      message: `Pide ${reqDouble} matrimonial(es); la habitación tiene ${doublesAvailable}`
    };
  }

  const doublesFromNonSep = Math.min(reqDouble, nonSepDoubles);
  const remainingDoubles = reqDouble - doublesFromNonSep;
  const sepUsedAsDouble = remainingDoubles;
  const sepRemaining = sepDoubles - sepUsedAsDouble;
  const availableSingles = singles + sepRemaining * 2;

  if (reqSingle > availableSingles) {
    return {
      complies: false,
      message: `Pide ${reqSingle} individual(es); con la config actual quedan ${availableSingles} disponibles`
    };
  }

  return { complies: true, message: 'Cumple preferencia de camas' };
}

function sanitizeBedsPayload(beds, maxPeople) {
  const list = Array.isArray(beds) ? beds : null;
  if (!list) return null;
  const normalized = list.map((bed, index) => {
    const bedType = normalizeBedType(bed.bedType);
    return {
      bedType,
      isSeparable: bedType === BED_TYPE_DOUBLE ? Boolean(bed.isSeparable) : false,
      orderIndex: Number.isFinite(bed.orderIndex) ? Number(bed.orderIndex) : index
    };
  });
  const validation = validateBedsAgainstCapacity(normalized, maxPeople);
  return { beds: normalized, validation };
}

module.exports = {
  BED_TYPE_DOUBLE,
  BED_TYPE_SINGLE,
  normalizeBedType,
  bedCapacity,
  totalBedCapacity,
  defaultBedsForCapacity,
  validateBedsAgainstCapacity,
  normalizeBedPreference,
  roomCanSatisfyBedPreference,
  sanitizeBedsPayload
};
