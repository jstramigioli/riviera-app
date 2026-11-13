import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchPaymentMethodConfigs,
  updatePaymentMethodConfig
} from '../../services/api';
import styles from './MediosPagoTab.module.css';

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
          descuentoActivo: Boolean(row.descuentoActivo),
          descuentoValor: String(row.descuentoValor ?? 0),
          aplicaEnParcial: row.aplicaEnParcial !== false,
          aplicaEnSeña: row.aplicaEnSeña !== false,
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
    const valor = Number(draft.descuentoValor);
    if (!Number.isFinite(valor) || valor < 0 || valor >= 100) {
      setError('El % de descuento debe ser ≥ 0 y < 100');
      return;
    }
    setSavingId(row.id);
    setError(null);
    setMessage(null);
    try {
      const updated = await updatePaymentMethodConfig(row.id, {
        descuentoActivo: Boolean(draft.descuentoActivo),
        descuentoValor: valor,
        aplicaEnParcial: Boolean(draft.aplicaEnParcial),
        aplicaEnSeña: Boolean(draft.aplicaEnSeña),
        requiereFacturacion: Boolean(draft.requiereFacturacion),
        activo: Boolean(draft.activo),
        ordenIndex: Number(draft.ordenIndex) || 0,
        descuentoTipo: 'PERCENT'
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
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
        <h3>Medios de pago / Descuentos</h3>
        <p className={styles.lead}>
          El % se aplica sobre la deuda cancelada. En parciales el usuario ingresa el dinero
          recibido; el crédito a folio es recibido/(1−p). Editable por admin y gerencia.
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
              <th>Desc.</th>
              <th>%</th>
              <th>Parcial</th>
              <th>Seña</th>
              <th>Orden</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const d = drafts[row.id] || {};
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
                    <input
                      type="checkbox"
                      checked={Boolean(d.descuentoActivo)}
                      onChange={(e) =>
                        setDraft(row.id, 'descuentoActivo', e.target.checked)
                      }
                      aria-label={`Descuento activo ${row.label}`}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.pct}
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.01"
                      value={d.descuentoValor ?? '0'}
                      onChange={(e) => setDraft(row.id, 'descuentoValor', e.target.value)}
                      aria-label={`Porcentaje ${row.label}`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(d.aplicaEnParcial)}
                      onChange={(e) =>
                        setDraft(row.id, 'aplicaEnParcial', e.target.checked)
                      }
                      aria-label={`Aplica en parcial ${row.label}`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(d.aplicaEnSeña)}
                      onChange={(e) => setDraft(row.id, 'aplicaEnSeña', e.target.checked)}
                      aria-label={`Aplica en seña ${row.label}`}
                    />
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
