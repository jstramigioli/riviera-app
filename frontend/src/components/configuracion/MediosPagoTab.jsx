import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchPaymentMethodConfigs,
  updatePaymentMethodConfig
} from '../../services/api';
import styles from './MediosPagoTab.module.css';

function linkedPromoLabel(row) {
  const linked = (row.linkedPromotionRules || []).filter((r) => r.activo);
  if (!linked.length) return null;
  const primary = linked[0];
  const pct =
    primary.benefitType === 'PERCENT' && primary.benefitValue != null
      ? ` (−${Number(primary.benefitValue)}%)`
      : '';
  return `${primary.label || primary.code}${pct}`;
}

function MediosPagoTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPaymentMethodConfigs({ all: true });
      setRows(Array.isArray(list) ? list : []);
      const next = {};
      for (const row of list || []) {
        next[row.id] = {
          requiereFacturacion: Boolean(row.requiereFacturacion),
          activo: row.activo !== false,
          ordenIndex: String(row.ordenIndex ?? 0)
        };
      }
      setDrafts(next);
    } catch (err) {
      setError(err.message || 'Error cargando medios de pago');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
    setMessage(null);
    setError(null);
  };

  const handleSave = async (row) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setError(null);
    setMessage(null);
    try {
      const updated = await updatePaymentMethodConfig(row.id, {
        requiereFacturacion: Boolean(draft.requiereFacturacion),
        activo: Boolean(draft.activo),
        ordenIndex: Number(draft.ordenIndex) || 0
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...updated, linkedPromotionRules: r.linkedPromotionRules }
            : r
        )
      );
      setMessage(`Guardado: ${updated.label}`);
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className={styles.muted}>Cargando medios de pago…</p>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h3>Medios de pago</h3>
        <p className={styles.lead}>
          Catálogo de medios (activo, facturación, orden). Los descuentos y promociones se
          configuran solo en la pestaña Promociones; acá se muestra la regla ligada si existe.
        </p>
      </header>

      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.ok}>{message}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Medio</th>
              <th>Activo</th>
              <th>Facturación</th>
              <th>Promoción ligada</th>
              <th>Orden</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const d = drafts[row.id] || {};
              const promo = linkedPromoLabel(row);
              return (
                <tr key={row.id}>
                  <td>
                    <div className={styles.label}>{row.label}</div>
                    <div className={styles.code}>{row.code}</div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(d.activo)}
                      onChange={(e) => setDraft(row.id, 'activo', e.target.checked)}
                      aria-label={`Activo ${row.label}`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(d.requiereFacturacion)}
                      onChange={(e) =>
                        setDraft(row.id, 'requiereFacturacion', e.target.checked)
                      }
                      aria-label={`Facturación ${row.label}`}
                    />
                  </td>
                  <td>
                    {promo ? (
                      <span className={styles.promoLink}>{promo}</span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <input
                      className={styles.orden}
                      type="number"
                      value={d.ordenIndex ?? '0'}
                      onChange={(e) => setDraft(row.id, 'ordenIndex', e.target.value)}
                      aria-label={`Orden ${row.label}`}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      disabled={savingId === row.id}
                      onClick={() => handleSave(row)}
                    >
                      {savingId === row.id ? '…' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MediosPagoTab;
