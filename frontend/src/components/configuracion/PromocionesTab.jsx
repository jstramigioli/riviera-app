import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiX, FiCheck } from 'react-icons/fi';
import { FaToggleOn, FaToggleOff } from 'react-icons/fa';
import {
  fetchPromotionRules,
  createPromotionRule,
  updatePromotionRule,
  fetchPaymentMethodConfigs
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
    minNights: '',
    maxNights: '',
    from: '',
    to: '',
    maxPercent: '',
    minPercent: '',
    paramsText: '{}'
  };
}

function conditionFromApi(c) {
  const p = c.params || {};
  const base = emptyCondition(c.type);
  switch (c.type) {
    case 'PAYMENT_METHOD':
      return {
        ...base,
        paymentMethodConfigId: String(p.paymentMethodConfigId ?? ''),
        paramsText: JSON.stringify(p)
      };
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
      return { ...base, paramsText: JSON.stringify(p || {}, null, 0) };
  }
}

function paramsFromCondition(c) {
  switch (c.type) {
    case 'PAYMENT_METHOD': {
      const id = Number(c.paymentMethodConfigId);
      if (!id) throw new Error('Elegí un medio de pago en la condición');
      return { paymentMethodConfigId: id };
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
    default: {
      try {
        return c.paramsText ? JSON.parse(c.paramsText) : {};
      } catch {
        throw new Error(`JSON inválido en condición ${CONDITION_TYPE_LABEL[c.type] || c.type}`);
      }
    }
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

function conditionSummary(c, methodsById) {
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
    case 'ROOM_TYPE':
      return 'tipos de habitación';
    case 'SERVICE_TYPE':
      return 'servicios';
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
  const [rows, setRows] = useState([]);
  const [methods, setMethods] = useState([]);
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
      const [list, medios] = await Promise.all([
        fetchPromotionRules({ all: true }),
        fetchPaymentMethodConfigs({ all: true })
      ]);
      setRows(Array.isArray(list) ? list : []);
      setMethods(Array.isArray(medios) ? medios : []);
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
          <input
            type="number"
            min="0"
            max="100"
            value={c.maxPercent}
            onChange={(e) => updateCondition(index, { maxPercent: e.target.value })}
            placeholder="% máximo"
            aria-label="Ocupación máxima"
          />
        );
      case 'OCCUPANCY_HOTEL_MIN':
        return (
          <input
            type="number"
            min="0"
            max="100"
            value={c.minPercent}
            onChange={(e) => updateCondition(index, { minPercent: e.target.value })}
            placeholder="% mínimo"
            aria-label="Ocupación mínima"
          />
        );
      default:
        return (
          <input
            value={c.paramsText}
            onChange={(e) => updateCondition(index, { paramsText: e.target.value })}
            placeholder='{"ids":[]}'
            aria-label="Parámetros JSON"
          />
        );
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
                      className={`${styles.toggleBtn} ${isOn ? styles.toggleOn : styles.toggleOff}`}
                      onClick={() => handleToggle(row)}
                      disabled={togglingId === row.id}
                      title={isOn ? 'Desactivar' : 'Activar'}
                      aria-label={isOn ? `Desactivar ${row.label}` : `Activar ${row.label}`}
                      aria-pressed={isOn}
                    >
                      {isOn ? (
                        <FaToggleOn aria-hidden="true" />
                      ) : (
                        <FaToggleOff aria-hidden="true" />
                      )}
                      <span>{isOn ? 'On' : 'Off'}</span>
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
                            {conditionSummary(c, methodsById)}
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
            <span className={styles.count}>{promoRows.length}</span>
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
        {renderTable(promoRows, 'No hay promociones')}
      </section>

      <section className={styles.sectionBlock} aria-labelledby="desc-section-title">
        <div className={styles.sectionHead}>
          <h3 id="desc-section-title" className={styles.sectionHeading}>
            Descuentos
            <span className={styles.count}>{discountRows.length}</span>
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
        {renderTable(discountRows, 'No hay descuentos')}
      </section>

      {showForm && (
        <div className={styles.formOverlay} role="presentation" onClick={closeForm}>
          <div
            className={styles.form}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.formHeader}>
              <div>
                <p className={styles.formEyebrow}>
                  {form.kind === 'PROMO' ? 'Promoción' : 'Descuento'}
                </p>
                <h3 id="promo-form-title">
                  {editingId
                    ? form.kind === 'PROMO'
                      ? 'Editar promoción'
                      : 'Editar descuento'
                    : form.kind === 'PROMO'
                      ? 'Nueva promoción'
                      : 'Nuevo descuento'}
                </h3>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={closeForm}
                aria-label="Cerrar"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            {!editingId && (
              <div className={styles.kindToggle} role="group" aria-label="Tipo">
                <button
                  type="button"
                  className={`${styles.kindBtn} ${
                    form.kind === 'PROMO' ? styles.kindBtnActive : ''
                  }`}
                  onClick={() => setField('kind', 'PROMO')}
                  aria-pressed={form.kind === 'PROMO'}
                >
                  Promoción
                </button>
                <button
                  type="button"
                  className={`${styles.kindBtn} ${
                    form.kind === 'DESCUENTO' ? styles.kindBtnActive : ''
                  }`}
                  onClick={() => setField('kind', 'DESCUENTO')}
                  aria-pressed={form.kind === 'DESCUENTO'}
                >
                  Descuento
                </button>
              </div>
            )}

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
              <label className={styles.field}>
                Valor
                <input
                  type="number"
                  step="0.01"
                  value={form.benefitValue}
                  onChange={(e) => setField('benefitValue', e.target.value)}
                />
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
            </div>

            <div className={styles.formFlags}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${styles.toggleLg} ${
                  form.activo ? styles.toggleOn : styles.toggleOff
                }`}
                onClick={() => setField('activo', !form.activo)}
                aria-pressed={form.activo}
              >
                {form.activo ? (
                  <FaToggleOn aria-hidden="true" />
                ) : (
                  <FaToggleOff aria-hidden="true" />
                )}
                <span>{form.activo ? 'Activa' : 'Inactiva'}</span>
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
              {form.conditions.length === 0 ? (
                <p className={styles.muted}>Sin condiciones (AND). Usá “Rango de fechas” para vigencia.</p>
              ) : (
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
