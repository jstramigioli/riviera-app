const { SENSITIVE_FIELDS, SUMMARY_FIELDS } = require('./entities');

function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && typeof value.toNumber === 'function') {
    try {
      return value.toNumber();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.has(key)) {
        out[key] = '[redacted]';
        continue;
      }
      // Evitar grafos profundos de relaciones anidadas
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !('toNumber' in val)) {
        const keys = Object.keys(val);
        if (keys.some((k) => typeof val[k] === 'object' && val[k] !== null && !(val[k] instanceof Date))) {
          out[key] = { _ref: true, keys: keys.slice(0, 12) };
          continue;
        }
      }
      out[key] = toPlain(val);
    }
    return out;
  }
  return value;
}

function entityIdFromRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.id === undefined || record.id === null) return null;
  return String(record.id);
}

function entityIdFromArgs(args) {
  const where = args?.where;
  if (!where || typeof where !== 'object') return null;
  if (where.id !== undefined && where.id !== null && typeof where.id !== 'object') {
    return String(where.id);
  }
  return null;
}

function computeDiff(before, after) {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return null;
  }
  const diff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    if (key === 'updatedAt' || key === 'createdAt') continue;
    const left = before[key];
    const right = after[key];
    const leftJson = JSON.stringify(left);
    const rightJson = JSON.stringify(right);
    if (leftJson !== rightJson) {
      diff[key] = { from: left ?? null, to: right ?? null };
    }
  }
  return Object.keys(diff).length ? diff : null;
}

function buildSummary(action, entity, before, after, entityId) {
  const record = after || before || {};
  const bits = [];
  for (const field of SUMMARY_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === '') continue;
    if (field === 'id') continue;
    bits.push(`${field}=${String(record[field])}`);
    if (bits.length >= 4) break;
  }
  const idPart = entityId ? `#${entityId}` : '';
  const detail = bits.length ? ` (${bits.join(', ')})` : '';
  return `${action} ${entity}${idPart}${detail}`.slice(0, 480);
}

module.exports = {
  toPlain,
  entityIdFromRecord,
  entityIdFromArgs,
  computeDiff,
  buildSummary
};
