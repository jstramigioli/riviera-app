import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiPlus, FiX, FiCheck } from 'react-icons/fi';
import {
  fetchPromotionRules,
  createPromotionRule,
  updatePromotionRule,
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
  conditions: []
};

const MODALITY_LABEL = { AUTO: 'Automática', MANUAL: 'Manual', SUGERIDA: 'Sugerida' };
const CONDITION_TYPE_LABEL = {
  PAYMENT_METHOD: 'Medio de pago',
  DATE_RANGE: 'Rango de fechas',
  MIN_NIGHTS: 'Mín. noches',
  MAX_NIGHTS: 'Máx. noches',
  ROOM_TYPE: 'Tipo habitación',
  SERVICE_TYPE: 'Servicio',
  OCCUPANCY_HOTEL_MAX: 'Ocupación ≤',
  OCCUPANCY_HOTEL_MIN: 'Ocupación ≥'
};

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

function emptyCondition(type = 'PAYMENT_METHOD') {
  return {
    type,
    paymentMethodConfigId: '',
    roomTypeId: '',
    serviceTypeId: '',
    minNights: '',
    maxNights: '',
    from: '',
    to: '',
    maxPercent: '',
    minPercent: ''
  };
}

function firstIdFromParams(p, listKey, singleKey) {
  if (Array.isArray(p[listKey]) && p[listKey].length) return String(p[listKey][0]);
  if (Array.isArray(p.ids) && p.ids.length) return String(p.ids[0]);
  if (p[singleKey] != null && p[singleKey] !== '') return String(p[singleKey]);
  return '';
}

function conditionFromApi(c) {
  const p = c.params || {};
  const base = emptyCondition(c.type);
  switch (c.type) {
    case 'PAYMENT_METHOD':
      return {
        ...base,
        paymentMethodConfigId: String(p.paymentMethodConfigId ?? '')
      };
    case 'ROOM_TYPE':
      return { ...base, roomTypeId: firstIdFromParams(p, 'roomTypeIds', 'roomTypeId') };
    case 'SERVICE_TYPE':
      return { ...base, serviceTypeId: firstIdFromParams(p, 'serviceTypeIds', 'serviceTypeId') };
    case 'MIN_NIGHTS':
      return { ...base, minNights: String(p.minNights ?? p.value ?? '') };
    case 'MAX_NIGHTS':
      return { ...base, maxNights: String(p.maxNights ?? p.value ?? '') };
    case 'DATE_RANGE':
      return {
        ...base,
        from: String(p.from || p.desde || '').slice(0, 10),
        to: String(p.to || p.hasta || '').slice(0, 10)
      };
    case 'OCCUPANCY_HOTEL_MAX':
      return { ...base, maxPercent: String(p.maxPercent ?? p.value ?? '') };
    case 'OCCUPANCY_HOTEL_MIN':
      return { ...base, minPercent: String(p.minPercent ?? p.value ?? '') };
    default:
      return base;
  }
}

function paramsFromCondition(c) {
  switch (c.type) {
    case 'PAYMENT_METHOD': {
      const id = Number(c.paymentMethodConfigId);
      if (!id) throw new Error('Elegí un medio de pago en la condición');
      return { paymentMethodConfigId: id };
    }
    case 'ROOM_TYPE': {
      const id = Number(c.roomTypeId);
      if (!id) throw new Error('Elegí un tipo de habitación');
      return { roomTypeIds: [id] };
    }
    case 'SERVICE_TYPE': {
      const id = String(c.serviceTypeId || '').trim();
      if (!id) throw new Error('Elegí un servicio');
      return { serviceTypeIds: [id] };
    }
    case 'MIN_NIGHTS': {
      const n = Number(c.minNights);
      if (!n) throw new Error('Indicá el mínimo de noches');
      return { minNights: n };
    }
    case 'MAX_NIGHTS': {
      const n = Number(c.maxNights);
      if (!n) throw new Error('Indicá el máximo de noches');
      return { maxNights: n };
    }
    case 'DATE_RANGE':
      return { from: c.from || null, to: c.to || null };
    case 'OCCUPANCY_HOTEL_MAX': {
      const n = Number(c.maxPercent);
      if (Number.isNaN(n)) throw new Error('Indicá el tope de ocupación');
      return { maxPercent: n };
    }
    case 'OCCUPANCY_HOTEL_MIN': {
      const n = Number(c.minPercent);
      if (Number.isNaN(n)) throw new Error('Indicá el mínimo de ocupación');
      return { minPercent: n };
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
  if (row.benefitType === 'FIXED_PER_NIGHT') {
    return `${Number.isFinite(value) ? value : row.benefitValue} ARS / noche`;
  }
  return `${Number.isFinite(value) ? value : row.benefitValue} ARS`;
}

function conditionSummary(c, { methodsById, roomTypesById, serviceTypesById }) {
  const p = c.params || {};
  switch (c.type) {
    case 'PAYMENT_METHOD': {
      const m = methodsById.get(Number(p.paymentMethodConfigId));
      return m ? m.label : p.paymentMethodCode || `#${p.paymentMethodConfigId}`;
    }
    case 'MIN_NIGHTS':
      return `≥ ${p.minNights ?? p.value} noches`;
    case 'MAX_NIGHTS':
      return `≤ ${p.maxNights ?? p.value} noches`;
    case 'DATE_RANGE':
      return `${p.from || p.desde || '…'} → ${p.to || p.hasta || '…'}`;
    case 'ROOM_TYPE': {
      const ids = p.roomTypeIds || p.ids || (p.roomTypeId != null ? [p.roomTypeId] : []);
      if (!ids.length) return '—';
      return ids
        .map((id) => roomTypesById.get(Number(id))?.name || roomTypesById.get(Number(id))?.label || `#${id}`)
        .join(', ');
    }
    case 'SERVICE_TYPE': {
      const ids = p.serviceTypeIds || p.ids || (p.serviceTypeId != null ? [p.serviceTypeId] : []);
      if (!ids.length) return '—';
      return ids
        .map((id) => {
          const key = String(id);
          const st = serviceTypesById.get(key);
          return st?.name || st?.label || key;
        })
        .join(', ');
    }
    case 'OCCUPANCY_HOTEL_MAX':
      return `≤ ${p.maxPercent ?? p.value}%`;
    case 'OCCUPANCY_HOTEL_MIN':
      return `≥ ${p.minPercent ?? p.value}%`;
    default:
      return c.type;
  }
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
      setError(err.message || 'Error cargando promociones');
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
      conditions: (row.conditions || []).map(conditionFromApi)
    });
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
    return {
      code: editingId ? undefined : slugCodeFromLabel(form.label),
      label: form.label,
      kind: form.kind,
      activo: Boolean(form.activo),
      prioridad: 100,
      modality: form.modality,
      layer: 'SETTLEMENT',
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      vigenteDesde: null,
      vigenteHasta: null,
      aplicaEnParcial: Boolean(form.aplicaEnParcial),
      aplicaEnSeña: true,
      benefitType: form.benefitType,
      benefitValue: Number(form.benefitValue) || 0,
      benefitBase: 'DEBT_CANCELLED',
      benefitCapARS: form.benefitCapARS === '' ? null : Number(form.benefitCapARS),
      notas: null,
      conditions
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (!String(payload.label || '').trim()) {
        throw new Error('El nombre es obligatorio');
      }
      if (editingId) {
        const { code, ...rest } = payload;
        await updatePromotionRule(editingId, rest);
      } else {
        await createPromotionRule(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err.message || 'Error al guardar');
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

  const renderConditionFields = (c, index) => {
    switch (c.type) {
      case 'PAYMENT_METHOD':
        return (
          <select
            value={c.paymentMethodConfigId}
            onChange={(e) => updateCondition(index, { paymentMethodConfigId: e.target.value })}
            aria-label="Medio de pago"
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
            aria-label="Tipo de habitación"
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
            aria-label="Servicio"
          >
            <option value="">Elegir servicio…</option>
            {serviceTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name || st.label || st.id}
              </option>
            ))}
          </select>
        );
      case 'MIN_NIGHTS':
        return (
          <input
            type="number"
            min="1"
            value={c.minNights}
            onChange={(e) => updateCondition(index, { minNights: e.target.value })}
            placeholder="Noches mínimas"
            aria-label="Noches mínimas"
          />
        );
      case 'MAX_NIGHTS':
        return (
          <input
            type="number"
            min="1"
            value={c.maxNights}
            onChange={(e) => updateCondition(index, { maxNights: e.target.value })}
            placeholder="Noches máximas"
            aria-label="Noches máximas"
          />
        );
      case 'DATE_RANGE':
        return (
          <div className={styles.datePair}>
            <input
              type="date"
              value={c.from}
              onChange={(e) => updateCondition(index, { from: e.target.value })}
              aria-label="Desde"
            />
            <input
              type="date"
              value={c.to}
              onChange={(e) => updateCondition(index, { to: e.target.value })}
              aria-label="Hasta"
            />
          </div>
        );
      case 'OCCUPANCY_HOTEL_MAX':
        return (
          <span className={styles.valueWithSuffix}>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={c.maxPercent}
              onChange={(e) => updateCondition(index, { maxPercent: e.target.value })}
              placeholder="0–100"
              aria-label="Ocupación máxima"
            />
            <span className={styles.valueSuffix} aria-hidden="true">
              %
            </span>
          </span>
        );
      case 'OCCUPANCY_HOTEL_MIN':
        return (
          <span className={styles.valueWithSuffix}>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={c.minPercent}
              onChange={(e) => updateCondition(index, { minPercent: e.target.value })}
              placeholder="0–100"
              aria-label="Ocupación mínima"
            />
            <span className={styles.valueSuffix} aria-hidden="true">
              %
            </span>
          </span>
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
                  <option value="MANUAL">Manual</option>
                  <option value="SUGERIDA">Sugerida</option>
                </select>
              </label>
              <label className={styles.field}>
                Tope ARS
                <input
                  type="number"
                  value={form.benefitCapARS}
                  onChange={(e) => setField('benefitCapARS', e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <div className={styles.benefitRow}>
                <label className={styles.field}>
                  Beneficio
                  <select
                    value={form.benefitType}
                    onChange={(e) => setField('benefitType', e.target.value)}
                  >
                    <option value="PERCENT">Porcentaje</option>
                    <option value="FIXED">Fijo ARS</option>
                    <option value="FIXED_PER_NIGHT">Fijo / noche</option>
                  </select>
                </label>
                <label className={`${styles.field} ${styles.benefitValueField}`}>
                  Valor
                  <span className={styles.valueWithSuffix}>
                    <input
                      type="number"
                      step="0.01"
                      value={form.benefitValue}
                      onChange={(e) => setField('benefitValue', e.target.value)}
                      aria-label="Valor del beneficio"
                    />
                    <span className={styles.valueSuffix} aria-hidden="true">
                      {form.benefitType === 'PERCENT' ? '%' : '$'}
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
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={form.aplicaEnParcial}
                  onChange={(e) => setField('aplicaEnParcial', e.target.checked)}
                />
                Aplica en parcial
              </label>
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
                    <div key={index} className={styles.conditionRow}>
                      <select
                        value={c.type}
                        onChange={(e) => changeConditionType(index, e.target.value)}
                        aria-label="Tipo de condición"
                      >
                        {Object.entries(CONDITION_TYPE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {renderConditionFields(c, index)}
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
