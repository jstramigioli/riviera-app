import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiX, FiCheck } from 'react-icons/fi';
import {
  fetchPromotionRules,
  createPromotionRule,
  updatePromotionRule,
  deletePromotionRule,
  fetchPaymentMethodConfigs,
  fetchRoomTypes,
  fetchServiceTypes
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import styles from './PromocionesTab.module.css';

const EMPTY_FORM = {
  label: '',
  kind: 'DESCUENTO',
  activo: true,
  modality: 'AUTO',
  aplicaEnParcial: true,
  benefitType: 'PERCENT',
  benefitValue: '10',
  benefitCapARS: '',
  descripcionInterna: '',
  conditions: []
};

const MODALITY_LABEL = {
  AUTO: 'Automática',
  MANUAL: 'Manual (por defecto desactivado)',
  SUGERIDA: 'Manual (por defecto activado)'
};

/** Variables del editor (Variable | Operador | Valor). */
const CONDITION_VARS = [
  { value: 'NIGHTS', label: 'Cantidad de noches' },
  { value: 'ROOM_TYPE', label: 'Tipo habitación' },
  { value: 'SERVICE_TYPE', label: 'Servicio' },
  { value: 'PAYMENT_METHOD', label: 'Medio de pago' },
  { value: 'OCCUPANCY_HOTEL', label: '% de ocupación' },
  { value: 'DATE_RANGE', label: 'Fecha creación reserva' },
  { value: 'STAY_DATE', label: 'Fecha estadía' }
];

const CONDITION_TYPE_LABEL = Object.fromEntries(CONDITION_VARS.map((v) => [v.value, v.label]));
CONDITION_TYPE_LABEL.MIN_NIGHTS = 'Cantidad de noches';
CONDITION_TYPE_LABEL.MAX_NIGHTS = 'Cantidad de noches';
CONDITION_TYPE_LABEL.OCCUPANCY_HOTEL_MAX = '% de ocupación';
CONDITION_TYPE_LABEL.OCCUPANCY_HOTEL_MIN = '% de ocupación';
CONDITION_TYPE_LABEL.DAYS_OF_WEEK = 'Fecha estadía';

/** Operadores en palabras (nunca símbolos). */
const OP_NUMERIC = [
  { value: 'gte', label: 'mayor o igual a' },
  { value: 'lte', label: 'menor o igual a' },
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'distinto de' }
];
/** % de ocupación: umbrales (sin igual / distinto). */
const OP_OCCUPANCY = [
  { value: 'gt', label: 'mayor a' },
  { value: 'gte', label: 'mayor o igual a' },
  { value: 'lt', label: 'menor a' },
  { value: 'lte', label: 'menor o igual a' }
];
const OCCUPANCY_OPS = new Set(OP_OCCUPANCY.map((o) => o.value));
const OP_EQUALITY = [
  { value: 'eq', label: 'igual a' },
  { value: 'neq', label: 'distinto de' }
];
const OP_STAY = [
  { value: 'between', label: 'entre' },
  { value: 'includes', label: 'incluye' },
  { value: 'excludes', label: 'no incluye' }
];
const OP_LABEL = {
  gt: 'mayor a',
  gte: 'mayor o igual a',
  lt: 'menor a',
  lte: 'menor o igual a',
  eq: 'igual a',
  neq: 'distinto de',
  between: 'entre',
  includes: 'incluye',
  excludes: 'no incluye'
};

const WEEKDAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' }
];

function slugCodeFromLabel(label) {
  const base = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const stamp = Date.now().toString(36).toUpperCase();
  return (base || 'PROMO') + '_' + stamp;
}

function defaultOpForType(type) {
  if (type === 'NIGHTS') return 'gte';
  if (type === 'OCCUPANCY_HOTEL') return 'lte';
  if (type === 'DATE_RANGE') return 'between';
  if (type === 'STAY_DATE' || type === 'DAYS_OF_WEEK') return 'between';
  return 'eq';
}

function emptyCondition(type = 'PAYMENT_METHOD') {
  return {
    type,
    op: defaultOpForType(type),
    paymentMethodConfigId: '',
    roomTypeId: '',
    serviceTypeId: '',
    nights: '',
    percent: '',
    from: '',
    to: '',
    days: []
  };
}

function firstIdFromParams(p, listKey, singleKey) {
  if (Array.isArray(p[listKey]) && p[listKey].length) return String(p[listKey][0]);
  if (Array.isArray(p.ids) && p.ids.length) return String(p.ids[0]);
  if (p[singleKey] != null && p[singleKey] !== '') return String(p[singleKey]);
  return '';
}

function normalizeOp(op, fallback = 'eq') {
  const v = String(op || fallback).toLowerCase().trim();
  if (v === 'eq' || v === '=' || v === 'equals' || v === 'igual a' || v === 'igual') return 'eq';
  if (v === 'neq' || v === '!=' || v === 'ne' || v === 'not' || v === '≠' || v === 'distinto de' || v === 'distinto') {
    return 'neq';
  }
  if (v === 'gte' || v === '>=' || v === 'min' || v === '≥' || v === 'mayor o igual a' || v === 'mayor o igual') {
    return 'gte';
  }
  if (v === 'lte' || v === '<=' || v === 'max' || v === '≤' || v === 'menor o igual a' || v === 'menor o igual') {
    return 'lte';
  }
  if (v === 'gt' || v === '>' || v === 'mayor a' || v === 'mayor') return 'gt';
  if (v === 'lt' || v === '<' || v === 'menor a' || v === 'menor') return 'lt';
  if (v === 'between' || v === 'entre') return 'between';
  if (v === 'includes' || v === 'incluye' || v === 'include') return 'includes';
  if (
    v === 'excludes' ||
    v === 'exclude' ||
    v === 'not_includes' ||
    v === 'no_incluye' ||
    v === 'no incluye' ||
    v === 'no-incluye'
  ) {
    return 'excludes';
  }
  return fallback;
}

function normalizeOccupancyOp(op) {
  const o = normalizeOp(op, 'lte');
  return OCCUPANCY_OPS.has(o) ? o : 'lte';
}

function conditionFromApi(c) {
  const p = c.params || {};
  const rawType = String(c.type || '').toUpperCase();

  if (rawType === 'MIN_NIGHTS') {
    return { ...emptyCondition('NIGHTS'), op: 'gte', nights: String(p.minNights ?? p.value ?? '') };
  }
  if (rawType === 'MAX_NIGHTS') {
    return { ...emptyCondition('NIGHTS'), op: 'lte', nights: String(p.maxNights ?? p.value ?? '') };
  }
  if (rawType === 'OCCUPANCY_HOTEL_MAX') {
    return {
      ...emptyCondition('OCCUPANCY_HOTEL'),
      op: normalizeOccupancyOp('lte'),
      percent: String(p.maxPercent ?? p.value ?? '')
    };
  }
  if (rawType === 'OCCUPANCY_HOTEL_MIN') {
    return {
      ...emptyCondition('OCCUPANCY_HOTEL'),
      op: normalizeOccupancyOp('gte'),
      percent: String(p.minPercent ?? p.value ?? '')
    };
  }

  const base = emptyCondition(rawType);
  switch (rawType) {
    case 'PAYMENT_METHOD':
      return {
        ...base,
        op: normalizeOp(p.op, 'eq'),
        paymentMethodConfigId: String(p.paymentMethodConfigId ?? '')
      };
    case 'ROOM_TYPE':
      return {
        ...base,
        op: normalizeOp(p.op, 'eq'),
        roomTypeId: firstIdFromParams(p, 'roomTypeIds', 'roomTypeId')
      };
    case 'SERVICE_TYPE':
      return {
        ...base,
        op: normalizeOp(p.op, 'eq'),
        serviceTypeId: firstIdFromParams(p, 'serviceTypeIds', 'serviceTypeId')
      };
    case 'NIGHTS':
      return {
        ...base,
        op: normalizeOp(p.op, 'gte'),
        nights: String(p.value ?? p.nights ?? '')
      };
    case 'OCCUPANCY_HOTEL':
      return {
        ...base,
        op: normalizeOccupancyOp(p.op),
        percent: String(p.percent ?? p.value ?? p.maxPercent ?? p.minPercent ?? '')
      };
    case 'DATE_RANGE':
      return {
        ...base,
        op: 'between',
        from: String(p.from || p.desde || '').slice(0, 10),
        to: String(p.to || p.hasta || '').slice(0, 10)
      };
    case 'STAY_DATE': {
      const stayOp = normalizeOp(p.op, 'between');
      return {
        ...emptyCondition('STAY_DATE'),
        op: stayOp,
        from: String(p.from || p.desde || '').slice(0, 10),
        to: String(p.to || p.hasta || '').slice(0, 10),
        days: Array.isArray(p.days || p.weekdays) ? (p.days || p.weekdays).map(Number) : []
      };
    }
    case 'DAYS_OF_WEEK':
      // Compat API → UI Fecha estadía (incluye / no incluye)
      return {
        ...emptyCondition('STAY_DATE'),
        op: normalizeOp(p.op, 'includes'),
        days: Array.isArray(p.days || p.weekdays) ? (p.days || p.weekdays).map(Number) : []
      };
    default:
      return base;
  }
}

function paramsFromCondition(c) {
  const op = normalizeOp(c.op, defaultOpForType(c.type));
  switch (c.type) {
    case 'PAYMENT_METHOD': {
      const id = Number(c.paymentMethodConfigId);
      if (!id) throw new Error('Elegí un medio de pago');
      return { paymentMethodConfigId: id, op };
    }
    case 'ROOM_TYPE': {
      const id = Number(c.roomTypeId);
      if (!id) throw new Error('Elegí un tipo de habitación');
      return { roomTypeIds: [id], op };
    }
    case 'SERVICE_TYPE': {
      const id = String(c.serviceTypeId || '').trim();
      if (!id) throw new Error('Elegí un servicio');
      return { serviceTypeIds: [id], op };
    }
    case 'NIGHTS': {
      const n = Number(c.nights);
      if (!n && n !== 0) throw new Error('Indicá la cantidad de noches');
      return { op, value: n };
    }
    case 'OCCUPANCY_HOTEL': {
      const n = Number(c.percent);
      if (c.percent === '' || Number.isNaN(n)) throw new Error('Indicá el % de ocupación');
      if (n < 0 || n > 100) throw new Error('El % de ocupación debe estar entre 0 y 100');
      return { op: normalizeOccupancyOp(op), percent: n };
    }
    case 'DATE_RANGE':
      return { from: c.from || null, to: c.to || null, op: 'between' };
    case 'STAY_DATE': {
      const stayOp = normalizeOp(c.op, 'between');
      if (stayOp === 'between') {
        if (!c.from && !c.to) throw new Error('Indicá el rango de fechas de estadía');
        return { op: 'between', from: c.from || null, to: c.to || null };
      }
      const days = Array.isArray(c.days) ? c.days.map(Number) : [];
      if (!days.length) throw new Error('Elegí al menos un día');
      return { op: stayOp, days };
    }
    default:
      throw new Error(`Condición no soportada: ${CONDITION_TYPE_LABEL[c.type] || c.type}`);
  }
}

function formatBenefit(row) {
  const value = Number(row.benefitValue);
  if (row.benefitType === 'PERCENT') {
    return `${Number.isFinite(value) ? value : row.benefitValue}%`;
  }
  if (row.benefitType === 'FREE_NIGHTS') {
    const n = Number.isFinite(value) ? Math.floor(value) : row.benefitValue;
    return Number(n) === 1 ? '1 noche gratis' : `${n} noches gratis`;
  }
  if (row.benefitType === 'FIXED_PER_NIGHT') {
    return `${Number.isFinite(value) ? value : row.benefitValue} ARS / noche`;
  }
  return `${Number.isFinite(value) ? value : row.benefitValue} ARS`;
}

function conditionSummary(c, { methodsById, roomTypesById, serviceTypesById }) {
  const p = c.params || {};
  const ui = conditionFromApi(c);
  const op = OP_LABEL[ui.op] || ui.op;

  switch (ui.type) {
    case 'PAYMENT_METHOD': {
      const m = methodsById.get(Number(ui.paymentMethodConfigId || p.paymentMethodConfigId));
      const label = m ? m.label : p.paymentMethodCode || `#${p.paymentMethodConfigId}`;
      return `${op} ${label}`;
    }
    case 'NIGHTS':
      return `${op} ${ui.nights} noches`;
    case 'DATE_RANGE':
      return `${op} ${ui.from || '…'} y ${ui.to || '…'}`;
    case 'STAY_DATE': {
      if (ui.op === 'between') {
        return `${op} ${ui.from || '…'} y ${ui.to || '…'}`;
      }
      const set = new Set(ui.days);
      const labels = WEEKDAYS.filter((d) => set.has(d.value)).map((d) => d.label);
      return `${op} ${labels.length ? labels.join(' ') : '—'}`;
    }
    case 'ROOM_TYPE': {
      const ids = p.roomTypeIds || p.ids || (ui.roomTypeId ? [ui.roomTypeId] : []);
      const names = ids
        .map((id) => roomTypesById.get(Number(id))?.name || roomTypesById.get(Number(id))?.label || `#${id}`)
        .join(', ');
      return `${op} ${names || '—'}`;
    }
    case 'SERVICE_TYPE': {
      const ids = p.serviceTypeIds || p.ids || (ui.serviceTypeId ? [ui.serviceTypeId] : []);
      const names = ids
        .map((id) => {
          const st = serviceTypesById.get(String(id));
          return st?.name || st?.label || String(id);
        })
        .join(', ');
      return `${op} ${names || '—'}`;
    }
    case 'OCCUPANCY_HOTEL':
      return `${op} ${ui.percent}%`;
    default:
      return c.type;
  }
}

function operatorsForType(type) {
  if (type === 'OCCUPANCY_HOTEL') return OP_OCCUPANCY;
  if (type === 'NIGHTS') return OP_NUMERIC;
  if (type === 'DATE_RANGE') return [{ value: 'between', label: 'entre' }];
  if (type === 'STAY_DATE') return OP_STAY;
  return OP_EQUALITY;
}

/** Errores de campo para bloquear Guardar y marcar en rojo. */
function validateConditionFields(c) {
  const errors = {};
  switch (c.type) {
    case 'PAYMENT_METHOD':
      if (!Number(c.paymentMethodConfigId)) errors.value = 'Elegí un medio de pago';
      break;
    case 'ROOM_TYPE':
      if (!Number(c.roomTypeId)) errors.value = 'Elegí un tipo de habitación';
      break;
    case 'SERVICE_TYPE':
      if (!String(c.serviceTypeId || '').trim()) errors.value = 'Elegí un servicio';
      break;
    case 'NIGHTS': {
      const n = Number(c.nights);
      if (c.nights === '' || Number.isNaN(n) || n < 0) {
        errors.value = 'Indicá una cantidad de noches válida (≥ 0)';
      }
      break;
    }
    case 'OCCUPANCY_HOTEL': {
      const n = Number(c.percent);
      if (c.percent === '' || Number.isNaN(n)) {
        errors.value = 'Indicá el % de ocupación';
      } else if (n < 0 || n > 100) {
        errors.value = 'El % de ocupación debe estar entre 0 y 100';
      }
      break;
    }
    case 'DATE_RANGE':
      if (!c.from && !c.to) errors.value = 'Indicá el rango de fechas';
      else if (c.from && c.to && c.from > c.to) errors.value = 'La fecha desde no puede ser posterior a hasta';
      break;
    case 'STAY_DATE': {
      const stayOp = normalizeOp(c.op, 'between');
      if (stayOp === 'between') {
        if (!c.from && !c.to) errors.value = 'Indicá el rango de fechas de estadía';
        else if (c.from && c.to && c.from > c.to) {
          errors.value = 'La fecha desde no puede ser posterior a hasta';
        }
      } else if (!Array.isArray(c.days) || c.days.length === 0) {
        errors.value = 'Elegí al menos un día';
      }
      break;
    }
    default:
      break;
  }
  return errors;
}

function validatePromoForm(form) {
  const errors = { conditions: {} };
  if (!String(form.label || '').trim()) {
    errors.label = 'El nombre es obligatorio';
  }
  const benefit = Number(form.benefitValue);
  if (form.benefitValue === '' || Number.isNaN(benefit)) {
    errors.benefitValue = 'Indicá el valor del beneficio';
  } else if (form.benefitType === 'FREE_NIGHTS') {
    if (!Number.isInteger(benefit) || benefit < 1) {
      errors.benefitValue = 'Indicá cuántas noches gratis (entero ≥ 1)';
    }
  } else if (benefit < 0) {
    errors.benefitValue = 'El beneficio no puede ser negativo';
  } else if (form.benefitType === 'PERCENT' && benefit > 100) {
    errors.benefitValue = 'El porcentaje no puede ser mayor a 100';
  }
  if (form.benefitCapARS !== '' && form.benefitCapARS != null) {
    const cap = Number(form.benefitCapARS);
    if (Number.isNaN(cap) || cap < 0) {
      errors.benefitCapARS = 'El tope debe ser un número ≥ 0';
    }
  }
  (form.conditions || []).forEach((c, index) => {
    const ce = validateConditionFields(c);
    if (Object.keys(ce).length) errors.conditions[index] = ce;
  });
  const hasConditionErrors = Object.keys(errors.conditions).length > 0;
  const ok =
    !errors.label && !errors.benefitValue && !errors.benefitCapARS && !hasConditionErrors;
  return { ok, errors };
}

function networkErrorMessage(err, fallback) {
  const msg = err?.message || '';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'No se pudo conectar con el servidor. Verificá que la API esté en marcha.';
  }
  return msg || fallback;
}

function PromocionesTab() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const mouseDownOnOverlay = useRef(false);
  const [rows, setRows] = useState([]);
  const [methods, setMethods] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const methodsById = useMemo(() => {
    const map = new Map();
    for (const m of methods) map.set(m.id, m);
    return map;
  }, [methods]);

  const roomTypesById = useMemo(() => {
    const map = new Map();
    for (const rt of roomTypes) map.set(Number(rt.id), rt);
    return map;
  }, [roomTypes]);

  const serviceTypesById = useMemo(() => {
    const map = new Map();
    for (const st of serviceTypes) map.set(String(st.id), st);
    return map;
  }, [serviceTypes]);

  const catalogLookup = useMemo(
    () => ({ methodsById, roomTypesById, serviceTypesById }),
    [methodsById, roomTypesById, serviceTypesById]
  );

  const formValidation = useMemo(() => validatePromoForm(form), [form]);
  const formErrors = formValidation.errors;
  const canSave = formValidation.ok;

  const markTouched = (key) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const fieldErrorProps = (key, message) => {
    const show = Boolean(touched[key] && message);
    return {
      'aria-invalid': show || undefined,
      className: show ? styles.fieldInvalid : undefined,
      title: show ? message : undefined,
      onBlur: () => markTouched(key)
    };
  };

  const touchInvalidFields = () => {
    setTouched((prev) => {
      const next = { ...prev };
      if (formErrors.label) next.label = true;
      if (formErrors.benefitValue) next.benefitValue = true;
      if (formErrors.benefitCapARS) next.benefitCapARS = true;
      Object.entries(formErrors.conditions || {}).forEach(([idx, ce]) => {
        if (ce?.value) next[`condition:${idx}`] = true;
      });
      return next;
    });
  };

  const promoRows = useMemo(
    () => rows.filter((r) => (r.kind || 'DESCUENTO') === 'PROMO'),
    [rows]
  );
  const discountRows = useMemo(
    () => rows.filter((r) => (r.kind || 'DESCUENTO') === 'DESCUENTO'),
    [rows]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, medios, types, services] = await Promise.all([
        fetchPromotionRules({ all: true }),
        fetchPaymentMethodConfigs({ all: true }),
        fetchRoomTypes(),
        fetchServiceTypes()
      ]);
      setRows(Array.isArray(list) ? list : []);
      setMethods(Array.isArray(medios) ? medios : []);
      setRoomTypes(Array.isArray(types) ? types : []);
      setServiceTypes(Array.isArray(services) ? services : []);
    } catch (err) {
      setError(networkErrorMessage(err, 'Error cargando promociones'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTouched({});
    mouseDownOnOverlay.current = false;
  };

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      closeForm();
    }
    mouseDownOnOverlay.current = false;
  };

  const openCreate = (kind) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, kind, conditions: [] });
    setTouched({});
    setShowForm(true);
    setError(null);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      label: row.label || '',
      kind: row.kind || 'DESCUENTO',
      activo: row.activo !== false,
      modality: row.modality || 'AUTO',
      aplicaEnParcial: row.aplicaEnParcial !== false,
      benefitType: row.benefitType || 'PERCENT',
      benefitValue: String(row.benefitValue ?? 0),
      benefitCapARS: row.benefitCapARS != null ? String(row.benefitCapARS) : '',
      descripcionInterna: row.descripcionInterna || row.notas || '',
      conditions: (row.conditions || []).map(conditionFromApi)
    });
    setTouched({});
    setShowForm(true);
    setError(null);
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, emptyCondition()]
    }));
  };

  const updateCondition = (index, patch) => {
    setForm((prev) => {
      const next = [...prev.conditions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, conditions: next };
    });
  };

  const changeConditionType = (index, type) => {
    updateCondition(index, { ...emptyCondition(type) });
  };

  const toggleDay = (index, day) => {
    setForm((prev) => {
      const next = [...prev.conditions];
      const current = next[index];
      const set = new Set(current.days || []);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      next[index] = { ...current, days: Array.from(set).sort((a, b) => a - b) };
      return { ...prev, conditions: next };
    });
  };

  const removeCondition = (index) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const buildPayload = () => {
    const conditions = form.conditions.map((c) => ({
      type: c.type,
      params: paramsFromCondition(c)
    }));
    const isFreeNights = form.benefitType === 'FREE_NIGHTS';
    return {
      code: editingId ? undefined : slugCodeFromLabel(form.label),
      label: form.label,
      kind: form.kind,
      activo: Boolean(form.activo),
      prioridad: 100,
      modality: form.modality,
      layer: isFreeNights ? 'RATE' : 'SETTLEMENT',
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      vigenteDesde: null,
      vigenteHasta: null,
      aplicaEnParcial: Boolean(form.aplicaEnParcial),
      aplicaEnSeña: true,
      benefitType: form.benefitType,
      benefitValue: Number(form.benefitValue) || 0,
      benefitBase: isFreeNights ? 'RATE_NIGHT' : 'DEBT_CANCELLED',
      benefitCapARS: form.benefitCapARS === '' ? null : Number(form.benefitCapARS),
      descripcionInterna: String(form.descripcionInterna || '').trim() || null,
      conditions
    };
  };

  const handleSave = async () => {
    if (saving) return;
    if (!canSave) {
      touchInvalidFields();
      const first =
        formErrors.label ||
        formErrors.benefitValue ||
        formErrors.benefitCapARS ||
        Object.values(formErrors.conditions || {})
          .map((c) => c.value)
          .find(Boolean);
      setError(first || 'Revisá los campos marcados');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        const { code, ...rest } = payload;
        await updatePromotionRule(editingId, rest);
      } else {
        await createPromotionRule(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(networkErrorMessage(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    const next = !(row.activo !== false);
    if (!next) {
      const ok = await confirm({
        title: 'Desactivar',
        message: `¿Desactivar “${row.label}”? Deja de aplicarse a pagos futuros; se puede reactivar desde el mismo control.`,
        confirmText: 'Desactivar',
        type: 'danger'
      });
      if (!ok) return;
    }
    setTogglingId(row.id);
    setError(null);
    try {
      await updatePromotionRule(row.id, { activo: next });
      await load();
    } catch (err) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (row) => {
    const kindLabel = (row.kind || 'DESCUENTO') === 'PROMO' ? 'promoción' : 'descuento';
    const ok = await confirm({
      title: `Eliminar ${kindLabel}`,
      message: `¿Eliminar “${row.label}”? Se quita de la lista y deja de aplicarse. Los descuentos ya aplicados en cuentas quedan registrados.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    if (!ok) return;
    setError(null);
    try {
      await deletePromotionRule(row.id);
      if (editingId === row.id) closeForm();
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError(err.message || 'Error al eliminar');
    }
  };

  const renderOperator = (c, index) => {
    const ops = operatorsForType(c.type);
    const locked = c.type === 'DATE_RANGE';
    return (
      <select
        value={locked ? ops[0].value : c.op}
        onChange={(e) => {
          const nextOp = e.target.value;
          const patch = { op: nextOp };
          if (c.type === 'STAY_DATE') {
            if (nextOp === 'between') patch.days = [];
            else {
              patch.from = '';
              patch.to = '';
            }
          }
          updateCondition(index, patch);
        }}
        aria-label="Operador"
        disabled={locked}
        className={styles.opSelect}
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  };

  const renderValue = (c, index) => {
    const condKey = `condition:${index}`;
    const condMsg = formErrors.conditions?.[index]?.value;
    const invalid = Boolean(touched[condKey] && condMsg);
    const invalidClass = invalid ? styles.fieldInvalid : undefined;
    const markCondTouched = () => markTouched(condKey);
    switch (c.type) {
      case 'PAYMENT_METHOD':
        return (
          <select
            value={c.paymentMethodConfigId}
            onChange={(e) => updateCondition(index, { paymentMethodConfigId: e.target.value })}
            onBlur={markCondTouched}
            aria-label="Valor medio de pago"
            aria-invalid={invalid || undefined}
            className={invalidClass}
            title={invalid ? condMsg : undefined}
          >
            <option value="">Elegir medio…</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        );
      case 'ROOM_TYPE':
        return (
          <select
            value={c.roomTypeId}
            onChange={(e) => updateCondition(index, { roomTypeId: e.target.value })}
            onBlur={markCondTouched}
            aria-label="Valor tipo habitación"
            aria-invalid={invalid || undefined}
            className={invalidClass}
            title={invalid ? condMsg : undefined}
          >
            <option value="">Elegir tipo…</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name || rt.label || `Tipo #${rt.id}`}
              </option>
            ))}
          </select>
        );
      case 'SERVICE_TYPE':
        return (
          <select
            value={c.serviceTypeId}
            onChange={(e) => updateCondition(index, { serviceTypeId: e.target.value })}
            onBlur={markCondTouched}
            aria-label="Valor servicio"
            aria-invalid={invalid || undefined}
            className={invalidClass}
            title={invalid ? condMsg : undefined}
          >
            <option value="">Elegir servicio…</option>
            {serviceTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name || st.label || st.id}
              </option>
            ))}
          </select>
        );
      case 'NIGHTS':
        return (
          <input
            type="number"
            min="0"
            step="1"
            value={c.nights}
            onChange={(e) => updateCondition(index, { nights: e.target.value })}
            onBlur={markCondTouched}
            placeholder="Cantidad"
            aria-label="Cantidad de noches"
            aria-invalid={invalid || undefined}
            className={invalidClass}
            title={invalid ? condMsg : undefined}
          />
        );
      case 'OCCUPANCY_HOTEL':
        return (
          <span className={styles.valueWithSuffix}>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={c.percent}
              onChange={(e) => updateCondition(index, { percent: e.target.value })}
              onBlur={markCondTouched}
              placeholder="0–100"
              aria-label="Porcentaje de ocupación"
              aria-invalid={invalid || undefined}
              className={invalidClass}
              title={invalid ? condMsg : undefined}
            />
            <span className={styles.valueSuffix} aria-hidden="true">
              %
            </span>
          </span>
        );
      case 'DATE_RANGE':
        return (
          <div className={`${styles.datePair} ${invalid ? styles.fieldInvalidGroup : ''}`}>
            <input
              type="date"
              value={c.from}
              onChange={(e) => updateCondition(index, { from: e.target.value })}
              onBlur={markCondTouched}
              aria-label="Desde (creación reserva)"
              aria-invalid={invalid || undefined}
              className={invalidClass}
            />
            <input
              type="date"
              value={c.to}
              onChange={(e) => updateCondition(index, { to: e.target.value })}
              onBlur={markCondTouched}
              aria-label="Hasta (creación reserva)"
              aria-invalid={invalid || undefined}
              className={invalidClass}
              title={invalid ? condMsg : undefined}
            />
          </div>
        );
      case 'STAY_DATE':
        if (c.op === 'between') {
          return (
            <div className={`${styles.datePair} ${invalid ? styles.fieldInvalidGroup : ''}`}>
              <input
                type="date"
                value={c.from}
                onChange={(e) => updateCondition(index, { from: e.target.value })}
                onBlur={markCondTouched}
                aria-label="Desde (estadía)"
                aria-invalid={invalid || undefined}
                className={invalidClass}
              />
              <input
                type="date"
                value={c.to}
                onChange={(e) => updateCondition(index, { to: e.target.value })}
                onBlur={markCondTouched}
                aria-label="Hasta (estadía)"
                aria-invalid={invalid || undefined}
                className={invalidClass}
                title={invalid ? condMsg : undefined}
              />
            </div>
          );
        }
        return (
          <div
            className={`${styles.dayToggles} ${invalid ? styles.fieldInvalidGroup : ''}`}
            role="group"
            aria-label="Días de la semana de estadía"
            aria-invalid={invalid || undefined}
            title={invalid ? condMsg : undefined}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) markCondTouched();
            }}
          >
            {WEEKDAYS.map((d) => {
              const on = (c.days || []).includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  className={`${styles.dayToggle} ${on ? styles.dayToggleOn : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleDay(index, d.value)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const renderTable = (sectionRows, emptyLabel) => {
    if (sectionRows.length === 0) {
      return (
        <div className={styles.emptyInline}>
          <p className={styles.emptyTitle}>{emptyLabel}</p>
        </div>
      );
    }

    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Activo</th>
              <th>Nombre</th>
              <th>Descripción interna</th>
              <th>Beneficio</th>
              <th>Modalidad</th>
              <th>Condiciones</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sectionRows.map((row) => {
              const isOn = row.activo !== false;
              return (
                <tr key={row.id} className={isOn ? undefined : styles.inactiveRow}>
                  <td>
                    <button
                      type="button"
                      className={`${styles.switch} ${isOn ? styles.switchOn : ''}`}
                      onClick={() => handleToggle(row)}
                      disabled={togglingId === row.id}
                      title={isOn ? 'Desactivar' : 'Activar'}
                      aria-label={isOn ? `Desactivar ${row.label}` : `Activar ${row.label}`}
                      aria-pressed={isOn}
                    >
                      <span className={styles.switchThumb} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <div className={styles.nameCell}>{row.label}</div>
                  </td>
                  <td>
                    {row.descripcionInterna || row.notas ? (
                      <div className={styles.descCell}>{row.descripcionInterna || row.notas}</div>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.benefit}>{formatBenefit(row)}</div>
                  </td>
                  <td>
                    <span className={styles.meta}>{MODALITY_LABEL[row.modality] || row.modality}</span>
                  </td>
                  <td>
                    {(row.conditions || []).length === 0 ? (
                      <span className={styles.muted}>Sin condiciones</span>
                    ) : (
                      <ul className={styles.condList}>
                        {(row.conditions || []).map((c, i) => (
                          <li key={i}>
                            <span className={styles.condType}>
                              {CONDITION_TYPE_LABEL[c.type] || c.type}
                            </span>
                            {conditionSummary(c, catalogLookup)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openEdit(row)}
                        title="Editar"
                        aria-label={`Editar ${row.label}`}
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconDanger}`}
                        onClick={() => handleDelete(row)}
                        title="Eliminar"
                        aria-label={`Eliminar ${row.label}`}
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <p className={styles.muted}>Cargando promociones…</p>;
  }

  return (
    <div className={styles.wrap}>
      {confirmDialog}

      <div className={styles.toolbar}>
        <h2 className={styles.title}>Promociones y descuentos</h2>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.sectionBlock} aria-labelledby="promo-section-title">
        <div className={styles.sectionHead}>
          <h3 id="promo-section-title" className={styles.sectionHeading}>
            Promociones
          </h3>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => openCreate('PROMO')}
          >
            <FiPlus aria-hidden="true" />
            Promoción
          </button>
        </div>
        <p className={styles.sectionLead}>
          Ofertas de estadía: fechas, noches, ocupación u otras condiciones de la reserva.
        </p>
        {renderTable(promoRows, 'No hay promociones')}
      </section>

      <section className={styles.sectionBlock} aria-labelledby="desc-section-title">
        <div className={styles.sectionHead}>
          <h3 id="desc-section-title" className={styles.sectionHeading}>
            Descuentos
          </h3>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => openCreate('DESCUENTO')}
          >
            <FiPlus aria-hidden="true" />
            Descuento
          </button>
        </div>
        <p className={styles.sectionLead}>
          Rebajas al cobrar: por medio de pago u otras condiciones en el momento del pago.
        </p>
        {renderTable(discountRows, 'No hay descuentos')}
      </section>

      {showForm && (
        <div
          className={styles.formOverlay}
          role="presentation"
          onMouseDown={handleOverlayMouseDown}
          onMouseUp={handleOverlayMouseUp}
        >
          <div
            className={styles.form}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-form-title"
          >
            <div className={styles.formHeader}>
              <h3 id="promo-form-title">
                {editingId
                  ? form.kind === 'PROMO'
                    ? 'Editar promoción'
                    : 'Editar descuento'
                  : form.kind === 'PROMO'
                    ? 'Nueva promoción'
                    : 'Nuevo descuento'}
              </h3>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={closeForm}
                aria-label="Cerrar"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <label className={styles.field}>
              Nombre
              <input
                value={form.label}
                onChange={(e) => setField('label', e.target.value)}
                placeholder={form.kind === 'PROMO' ? 'Early bird 15%' : '10% efectivo'}
                autoFocus
                {...fieldErrorProps('label', formErrors.label)}
              />
            </label>

            <label className={styles.field}>
              Descripción interna
              <textarea
                className={styles.textarea}
                value={form.descripcionInterna}
                onChange={(e) => setField('descripcionInterna', e.target.value)}
                rows={2}
              />
            </label>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                Modalidad
                <select
                  value={form.modality}
                  onChange={(e) => setField('modality', e.target.value)}
                >
                  <option value="AUTO">Automática</option>
                  <option value="SUGERIDA">Manual (por defecto activado)</option>
                  <option value="MANUAL">Manual (por defecto desactivado)</option>
                </select>
              </label>
              <label className={styles.field}>
                Tope ARS
                <input
                  type="number"
                  value={form.benefitCapARS}
                  onChange={(e) => setField('benefitCapARS', e.target.value)}
                  placeholder="Opcional"
                  {...fieldErrorProps('benefitCapARS', formErrors.benefitCapARS)}
                />
              </label>
              <div className={styles.benefitRow}>
                <label className={styles.field}>
                  Beneficio
                  <select
                    value={form.benefitType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        benefitType: next,
                        benefitValue:
                          next === 'FREE_NIGHTS' && prev.benefitType !== 'FREE_NIGHTS'
                            ? '1'
                            : prev.benefitValue
                      }));
                    }}
                  >
                    <option value="PERCENT">Porcentaje</option>
                    <option value="FIXED">Fijo ARS</option>
                    <option value="FIXED_PER_NIGHT">Fijo / noche</option>
                    <option value="FREE_NIGHTS">Noches sin cargo</option>
                  </select>
                </label>
                <label
                  className={`${styles.field} ${styles.benefitValueField} ${
                    form.benefitType === 'FREE_NIGHTS' ? styles.benefitValueFreeNights : ''
                  }`}
                >
                  {form.benefitType === 'FREE_NIGHTS' ? 'Noches gratis' : 'Valor'}
                  <span className={styles.valueWithSuffix}>
                    <input
                      type="number"
                      step={form.benefitType === 'FREE_NIGHTS' ? '1' : '0.01'}
                      min={form.benefitType === 'FREE_NIGHTS' ? '1' : undefined}
                      value={form.benefitValue}
                      onChange={(e) => setField('benefitValue', e.target.value)}
                      aria-label={
                        form.benefitType === 'FREE_NIGHTS'
                          ? 'Cantidad de noches gratis'
                          : 'Valor del beneficio'
                      }
                      {...fieldErrorProps('benefitValue', formErrors.benefitValue)}
                    />
                    <span className={styles.valueSuffix} aria-hidden="true">
                      {form.benefitType === 'PERCENT'
                        ? '%'
                        : form.benefitType === 'FREE_NIGHTS'
                          ? Number(form.benefitValue) === 1
                            ? 'noche'
                            : 'noches'
                          : '$'}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.formFlags}>
              <button
                type="button"
                className={styles.switchRow}
                onClick={() => setField('activo', !form.activo)}
                aria-pressed={form.activo}
                aria-label={form.activo ? 'Marcar como inactiva' : 'Marcar como activa'}
              >
                <span
                  className={`${styles.switch} ${form.activo ? styles.switchOn : ''}`}
                  aria-hidden="true"
                >
                  <span className={styles.switchThumb} />
                </span>
                <span className={styles.switchLabel}>
                  {form.activo ? 'Activa' : 'Inactiva'}
                </span>
              </button>
              {form.kind === 'DESCUENTO' && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={form.aplicaEnParcial}
                    onChange={(e) => setField('aplicaEnParcial', e.target.checked)}
                  />
                  Aplica en parcial
                </label>
              )}
            </div>

            <section className={styles.section}>
              <div className={styles.conditionsHeader}>
                <h4 className={styles.sectionTitle}>Condiciones</h4>
                <button type="button" className={styles.ghostBtn} onClick={addCondition}>
                  <FiPlus aria-hidden="true" />
                  Agregar
                </button>
              </div>
              {form.conditions.length > 0 && (
                <div className={styles.conditions}>
                  {form.conditions.map((c, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <div className={styles.conditionAnd} aria-hidden="true">
                          y
                        </div>
                      )}
                      <div className={styles.conditionRow}>
                        <select
                          value={c.type}
                          onChange={(e) => changeConditionType(index, e.target.value)}
                          aria-label="Variable"
                        >
                          {CONDITION_VARS.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                        {renderOperator(c, index)}
                        {renderValue(c, index)}
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => removeCondition(index)}
                          aria-label="Quitar condición"
                          title="Quitar"
                        >
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </section>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleSave}
                disabled={saving}
                aria-disabled={saving || !canSave}
                data-looks-disabled={!canSave || saving ? 'true' : undefined}
                title={!canSave ? 'Corregí los campos en rojo para guardar' : undefined}
              >
                <FiCheck aria-hidden="true" />
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromocionesTab;
