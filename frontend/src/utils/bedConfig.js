/**
 * Configuración y compatibilidad de camas (habitación + preferencia de reserva).
 */

export const BED_TYPE_DOUBLE = 'double';
export const BED_TYPE_SINGLE = 'single';

export function normalizeBedType(bedType) {
  const t = String(bedType || '').toLowerCase();
  if (t === BED_TYPE_DOUBLE || t === 'matrimonial') return BED_TYPE_DOUBLE;
  if (t === BED_TYPE_SINGLE || t === 'individual') return BED_TYPE_SINGLE;
  return null;
}

export function bedCapacity(bed) {
  const type = normalizeBedType(bed?.bedType);
  if (type === BED_TYPE_DOUBLE) return 2;
  if (type === BED_TYPE_SINGLE) return 1;
  return 0;
}

export function totalBedCapacity(beds = []) {
  return (Array.isArray(beds) ? beds : []).reduce((sum, bed) => sum + bedCapacity(bed), 0);
}

export function defaultBedsForCapacity(maxPeople) {
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

export function validateBedsAgainstCapacity(beds, maxPeople) {
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

export function normalizeBedPreference(pref = {}) {
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
 * Compatibilidad habitación ↔ preferencia (considera separables).
 * No asigna camas: solo aviso.
 */
export function roomCanSatisfyBedPreference(beds, preference) {
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

export function formatBedsSummary(beds = []) {
  const list = Array.isArray(beds) ? beds : [];
  if (list.length === 0) return 'Sin camas';
  const doubles = list.filter((b) => normalizeBedType(b.bedType) === BED_TYPE_DOUBLE);
  const singles = list.filter((b) => normalizeBedType(b.bedType) === BED_TYPE_SINGLE);
  const parts = [];
  if (doubles.length) {
    const sep = doubles.filter((b) => b.isSeparable).length;
    parts.push(
      `${doubles.length} matrimonial${doubles.length > 1 ? 'es' : ''}${sep ? ` (${sep} separable${sep > 1 ? 's' : ''})` : ''}`
    );
  }
  if (singles.length) {
    parts.push(`${singles.length} individual${singles.length > 1 ? 'es' : ''}`);
  }
  return parts.join(' · ');
}

export function formatBedPreferenceSummary(pref = {}) {
  const p = normalizeBedPreference(pref);
  if (p.bedPreferenceNone) return 'Sin preferencia';
  const parts = [];
  if (p.preferredDoubleBeds > 0) {
    parts.push(`${p.preferredDoubleBeds} matrimonial${p.preferredDoubleBeds > 1 ? 'es' : ''}`);
  }
  if (p.preferredSingleBeds > 0) {
    parts.push(`${p.preferredSingleBeds} individual${p.preferredSingleBeds > 1 ? 'es' : ''}`);
  }
  return parts.length ? parts.join(' · ') : 'Sin preferencia';
}

/** Cuenta matrimoniales e individuales en una config de camas. */
export function countBedsByType(beds = []) {
  const list = Array.isArray(beds) ? beds : [];
  let double = 0;
  let single = 0;
  for (const bed of list) {
    const type = normalizeBedType(bed?.bedType);
    if (type === BED_TYPE_DOUBLE) double += 1;
    else if (type === BED_TYPE_SINGLE) single += 1;
  }
  return { double, single };
}

/**
 * Máximos del select de preferencia Mat/Ind:
 * max entre habitaciones con capacidad === huéspedes.
 */
export function maxBedPreferenceLimits(rooms = [], requiredGuests) {
  const guests = Math.max(1, parseInt(requiredGuests, 10) || 1);
  const list = Array.isArray(rooms) ? rooms : [];
  const matching = list.filter((room) => {
    const capacity = Number(room?.maxPeople ?? room?.roomType?.maxPeople) || 0;
    return capacity === guests;
  });

  if (matching.length === 0) {
    return { maxDoubleBeds: 0, maxSingleBeds: 0 };
  }

  let maxDoubleBeds = 0;
  let maxSingleBeds = 0;
  for (const room of matching) {
    const counts = countBedsByType(room.beds);
    if (counts.double > maxDoubleBeds) maxDoubleBeds = counts.double;
    if (counts.single > maxSingleBeds) maxSingleBeds = counts.single;
  }
  return { maxDoubleBeds, maxSingleBeds };
}

/** Recorta preferencia si supera los máximos por capacidad. */
export function clampBedPreferenceToLimits(pref = {}, limits = {}) {
  const normalized = normalizeBedPreference(pref);
  const maxDouble = Math.max(0, parseInt(limits.maxDoubleBeds, 10) || 0);
  const maxSingle = Math.max(0, parseInt(limits.maxSingleBeds, 10) || 0);
  const preferredDoubleBeds = Math.min(normalized.preferredDoubleBeds, maxDouble);
  const preferredSingleBeds = Math.min(normalized.preferredSingleBeds, maxSingle);
  if (normalized.bedPreferenceNone) {
    return { bedPreferenceNone: true, preferredDoubleBeds: 0, preferredSingleBeds: 0 };
  }
  return {
    bedPreferenceNone: false,
    preferredDoubleBeds,
    preferredSingleBeds
  };
}
