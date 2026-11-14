import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPromotionRules,
  createPromotionRule,
  updatePromotionRule,
  deletePromotionRule,
  fetchPaymentMethodConfigs
} from '../../services/api';
import styles from './PromocionesTab.module.css';

const EMPTY_FORM = {
  code: '',
  label: '',
  kind: 'DESCUENTO',
  activo: true,
  prioridad: '100',
  modality: 'AUTO',
  layer: 'SETTLEMENT',
  stacking: 'EXCLUSIVE',
  stackingGroup: '',
  vigenteDesde: '',
  vigenteHasta: '',
  aplicaEnParcial: true,
  aplicaEnSeña: true,
  benefitType: 'PERCENT',
  benefitValue: '10',
  benefitBase: 'DEBT_CANCELLED',
  benefitCapARS: '',
  notas: '',
  conditions: []
};

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
      return `roomType ${JSON.stringify(p.roomTypeIds || p.roomTypeId || p.ids || [])}`;
    case 'SERVICE_TYPE':
      return `service ${JSON.stringify(p.serviceTypeIds || p.serviceTypeId || p.ids || [])}`;
    case 'OCCUPANCY_HOTEL_MAX':
      return `ocup. ≤ ${p.maxPercent ?? p.value}%`;
    case 'OCCUPANCY_HOTEL_MIN':
      return `ocup. ≥ ${p.minPercent ?? p.value}%`;
    default:
      return c.type;
  }
}

function PromocionesTab() {
  const [rows, setRows] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const methodsById = useMemo(() => {
    const map = new Map();
    for (const m of methods) map.set(m.id, m);
    return map;
  }, [methods]);

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

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, conditions: [] });
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      code: row.code || '',
      label: row.label || '',
      kind: row.kind || 'DESCUENTO',
      activo: row.activo !== false,
      prioridad: String(row.prioridad ?? 100),
      modality: row.modality || 'AUTO',
      layer: row.layer || 'SETTLEMENT',
      stacking: row.stacking || 'EXCLUSIVE',
      stackingGroup: row.stackingGroup || '',
      vigenteDesde: row.vigenteDesde ? String(row.vigenteDesde).slice(0, 10) : '',
      vigenteHasta: row.vigenteHasta ? String(row.vigenteHasta).slice(0, 10) : '',
      aplicaEnParcial: row.aplicaEnParcial !== false,
      aplicaEnSeña: row.aplicaEnSeña !== false,
      benefitType: row.benefitType || 'PERCENT',
      benefitValue: String(row.benefitValue ?? 0),
      benefitBase: row.benefitBase || 'DEBT_CANCELLED',
      benefitCapARS: row.benefitCapARS != null ? String(row.benefitCapARS) : '',
      notas: row.notas || '',
      conditions: (row.conditions || []).map((c) => ({
        type: c.type,
        paramsText: JSON.stringify(c.params || {}, null, 0)
      }))
    });
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { type: 'PAYMENT_METHOD', paramsText: '{}' }]
    }));
  };

  const updateCondition = (index, field, value) => {
    setForm((prev) => {
      const next = [...prev.conditions];
      next[index] = { ...next[index], [field]: value };
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
    const conditions = [];
    for (const c of form.conditions) {
      let params = {};
      try {
        params = c.paramsText ? JSON.parse(c.paramsText) : {};
      } catch {
        throw new Error(`JSON inválido en condición ${c.type}`);
      }
      conditions.push({ type: c.type, params });
    }
    return {
      code: form.code,
      label: form.label,
      kind: form.kind,
      activo: Boolean(form.activo),
      prioridad: Number(form.prioridad) || 100,
      modality: form.modality,
      layer: form.layer,
      stacking: form.stacking,
      stackingGroup: form.stackingGroup || null,
      vigenteDesde: form.vigenteDesde || null,
      vigenteHasta: form.vigenteHasta || null,
      aplicaEnParcial: Boolean(form.aplicaEnParcial),
      aplicaEnSeña: Boolean(form.aplicaEnSeña),
      benefitType: form.benefitType,
      benefitValue: Number(form.benefitValue) || 0,
      benefitBase:
        form.layer === 'RATE'
          ? form.benefitBase === 'DEBT_CANCELLED'
            ? 'RATE_NIGHT'
            : form.benefitBase
          : form.benefitBase,
      benefitCapARS: form.benefitCapARS === '' ? null : Number(form.benefitCapARS),
      notas: form.notas || null,
      conditions
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        const { code, ...rest } = payload;
        await updatePromotionRule(editingId, rest);
        setMessage(`Actualizada: ${payload.label}`);
      } else {
        await createPromotionRule(payload);
        setMessage(`Creada: ${payload.label}`);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    setError(null);
    try {
      await deletePromotionRule(row.id);
      setMessage(`Desactivada: ${row.label}`);
      await load();
    } catch (err) {
      setError(err.message || 'Error al desactivar');
    }
  };

  if (loading) {
    return <p className={styles.muted}>Cargando promociones…</p>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h3>Promociones y descuentos</h3>
          <p className={styles.lead}>
            Motor de reglas: condiciones AND (temporada, estadía, alojamiento, pago, ocupación),
            beneficio (%, fijo, fijo/noche), modalidad AUTO / MANUAL / SUGERIDA, capas settlement
            (pago) y rate (tarifa). Prioridad y acumulación por grupo. Cambios solo a futuro
            (snapshot en aplicaciones).
          </p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCreate}>
          Nueva regla
        </button>
      </header>

      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.ok}>{message}</p>}

      {showForm && (
        <div className={styles.form}>
          {!editingId && (
            <label>
              Código
              <input value={form.code} onChange={(e) => setField('code', e.target.value)} />
            </label>
          )}
          <label>
            Nombre
            <input value={form.label} onChange={(e) => setField('label', e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={form.kind} onChange={(e) => setField('kind', e.target.value)}>
              <option value="DESCUENTO">Descuento</option>
              <option value="PROMO">Promo</option>
            </select>
          </label>
          <label>
            Modalidad
            <select value={form.modality} onChange={(e) => setField('modality', e.target.value)}>
              <option value="AUTO">Automática</option>
              <option value="MANUAL">Manual</option>
              <option value="SUGERIDA">Sugerida</option>
            </select>
          </label>
          <label>
            Capa
            <select value={form.layer} onChange={(e) => setField('layer', e.target.value)}>
              <option value="SETTLEMENT">Pago (crédito folio)</option>
              <option value="RATE">Tarifa (baja cargo)</option>
            </select>
          </label>
          <label>
            Acumulación
            <select value={form.stacking} onChange={(e) => setField('stacking', e.target.value)}>
              <option value="EXCLUSIVE">Exclusiva (prioridad)</option>
              <option value="BEST_OF">Mejor beneficio</option>
              <option value="STACKABLE">Acumulable</option>
            </select>
          </label>
          <label>
            Grupo stacking
            <input
              value={form.stackingGroup}
              onChange={(e) => setField('stackingGroup', e.target.value)}
              placeholder="opcional"
            />
          </label>
          <label>
            Prioridad
            <input
              type="number"
              value={form.prioridad}
              onChange={(e) => setField('prioridad', e.target.value)}
            />
          </label>
          <label>
            Beneficio
            <select value={form.benefitType} onChange={(e) => setField('benefitType', e.target.value)}>
              <option value="PERCENT">Porcentaje</option>
              <option value="FIXED">Fijo ARS</option>
              <option value="FIXED_PER_NIGHT">Fijo / noche</option>
            </select>
          </label>
          <label>
            Valor
            <input
              type="number"
              step="0.01"
              value={form.benefitValue}
              onChange={(e) => setField('benefitValue', e.target.value)}
            />
          </label>
          <label>
            Base
            <select value={form.benefitBase} onChange={(e) => setField('benefitBase', e.target.value)}>
              <option value="DEBT_CANCELLED">Deuda cancelada</option>
              <option value="PAYMENT_RECEIVED">Dinero recibido</option>
              <option value="RATE_NIGHT">Tarifa noche</option>
              <option value="LODGING_TOTAL">Total alojamiento</option>
            </select>
          </label>
          <label>
            Tope ARS
            <input
              type="number"
              value={form.benefitCapARS}
              onChange={(e) => setField('benefitCapARS', e.target.value)}
              placeholder="opcional"
            />
          </label>
          <label>
            Vigente desde
            <input
              type="date"
              value={form.vigenteDesde}
              onChange={(e) => setField('vigenteDesde', e.target.value)}
            />
          </label>
          <label>
            Vigente hasta
            <input
              type="date"
              value={form.vigenteHasta}
              onChange={(e) => setField('vigenteHasta', e.target.value)}
            />
          </label>
          <label>
            Activa
            <select
              value={form.activo ? '1' : '0'}
              onChange={(e) => setField('activo', e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>
          <label>
            Parcial
            <select
              value={form.aplicaEnParcial ? '1' : '0'}
              onChange={(e) => setField('aplicaEnParcial', e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>
          <label>
            Seña
            <select
              value={form.aplicaEnSeña ? '1' : '0'}
              onChange={(e) => setField('aplicaEnSeña', e.target.value === '1')}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>
          <label>
            Notas
            <textarea value={form.notas} onChange={(e) => setField('notas', e.target.value)} />
          </label>

          <div className={styles.conditions}>
            <strong>Condiciones (AND)</strong>
            {form.conditions.map((c, index) => (
              <div key={index} className={styles.conditionRow}>
                <select
                  value={c.type}
                  onChange={(e) => updateCondition(index, 'type', e.target.value)}
                >
                  <option value="PAYMENT_METHOD">Medio de pago</option>
                  <option value="DATE_RANGE">Rango fechas</option>
                  <option value="MIN_NIGHTS">Mín. noches</option>
                  <option value="MAX_NIGHTS">Máx. noches</option>
                  <option value="ROOM_TYPE">Tipo habitación</option>
                  <option value="SERVICE_TYPE">Servicio</option>
                  <option value="OCCUPANCY_HOTEL_MAX">Ocupación ≤</option>
                  <option value="OCCUPANCY_HOTEL_MIN">Ocupación ≥</option>
                </select>
                <input
                  value={c.paramsText}
                  onChange={(e) => updateCondition(index, 'paramsText', e.target.value)}
                  placeholder='{"paymentMethodConfigId":1}'
                />
                <button type="button" className={styles.btn} onClick={() => removeCondition(index)}>
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" className={styles.btn} onClick={addCondition}>
              Agregar condición
            </button>
            {methods.length > 0 && (
              <p className={styles.muted}>
                Medios: {methods.map((m) => `${m.id}=${m.label}`).join(' · ')}
              </p>
            )}
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Modalidad</th>
              <th>Capa</th>
              <th>Beneficio</th>
              <th>Condiciones</th>
              <th>Prio</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.activo ? undefined : styles.inactive}>
                <td>{row.code}</td>
                <td>
                  {row.label}
                  <div>
                    <span className={styles.badge}>{row.kind}</span>
                    <span className={styles.badge}>{row.stacking}</span>
                  </div>
                </td>
                <td>{row.modality}</td>
                <td>{row.layer}</td>
                <td>
                  {row.benefitType} {row.benefitValue}
                  {row.benefitType === 'PERCENT' ? '%' : ''}
                  <div className={styles.muted}>{row.benefitBase}</div>
                </td>
                <td>
                  {(row.conditions || []).length === 0
                    ? '—'
                    : (row.conditions || []).map((c, i) => (
                        <div key={i}>
                          <span className={styles.badge}>{c.type}</span>
                          {conditionSummary(c, methodsById)}
                        </div>
                      ))}
                </td>
                <td>{row.prioridad}</td>
                <td>{row.activo ? 'Activa' : 'Off'}</td>
                <td>
                  <button type="button" className={styles.btn} onClick={() => openEdit(row)}>
                    Editar
                  </button>{' '}
                  {row.activo && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => handleDeactivate(row)}
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PromocionesTab;
