import React, { useMemo, useState } from 'react';
import { createClientMultiPago } from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';

/**
 * Flujo B: cobro desde ficha cliente con distribución a N reservas.
 * Flujo A (PaymentForm con reservaId) no se modifica.
 */
function MultiPagoClientPanel({
  clientId,
  reservationsBalance = [],
  onCreated,
  formatPrice = (n) =>
    Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}) {
  const { notify, noticeDialog } = useAppNotice();
  const candidates = useMemo(
    () =>
      (reservationsBalance || [])
        .filter((r) => Number(r.saldo) > 0.009)
        .map((r) => ({
          reservationId: r.reservationId ?? r.id,
          saldo: Number(r.saldo) || 0,
          status: r.status,
          label: `Reserva #${r.reservationId ?? r.id}`
        })),
    [reservationsBalance]
  );

  const [selected, setSelected] = useState(() => new Set());
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [distribucion, setDistribucion] = useState({}); // reservationId -> monto string
  const [saving, setSaving] = useState(false);

  const selectedList = candidates.filter((c) => selected.has(c.reservationId));
  const recibido = Number(monto) || 0;
  const sumDist = selectedList.reduce(
    (s, c) => s + (Number(distribucion[c.reservationId]) || 0),
    0
  );
  const pendiente = Math.round((recibido - sumDist) * 100) / 100;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoOldestFirst = () => {
    let remaining = Math.round(Math.abs(recibido) * 100) / 100;
    if (remaining <= 0 || selectedList.length === 0) {
      notify({
        title: 'Validación',
        message: 'Ingresá el monto recibido y seleccioná al menos una reserva',
        type: 'warning'
      });
      return;
    }
    const ordered = [...selectedList].sort(
      (a, b) => Number(a.reservationId) - Number(b.reservationId)
    );
    const next = { ...distribucion };
    ordered.forEach((c) => {
      next[c.reservationId] = '';
    });
    for (let i = 0; i < ordered.length; i += 1) {
      if (remaining <= 0.009) break;
      const c = ordered[i];
      const take = Math.round(Math.min(c.saldo, remaining) * 100) / 100;
      next[c.reservationId] = String(take);
      remaining = Math.round((remaining - take) * 100) / 100;
    }
    if (remaining > 0.009 && ordered.length) {
      const last = ordered[ordered.length - 1];
      const cur = Number(next[last.reservationId]) || 0;
      next[last.reservationId] = String(Math.round((cur + remaining) * 100) / 100);
    }
    setDistribucion(next);
  };

  const handleSave = async () => {
    if (!clientId) return;
    if (recibido <= 0) {
      notify({ title: 'Validación', message: 'El monto recibido debe ser mayor a 0', type: 'warning' });
      return;
    }
    if (selectedList.length === 0) {
      notify({ title: 'Validación', message: 'Seleccioná al menos una reserva', type: 'warning' });
      return;
    }
    if (Math.abs(pendiente) > 0.009) {
      notify({
        title: 'Validación',
        message:
          pendiente > 0
            ? `Queda pendiente de imputar ${pendiente.toFixed(2)} ARS`
            : `La distribución supera el recibido en ${Math.abs(pendiente).toFixed(2)} ARS`,
        type: 'warning'
      });
      return;
    }

    const imputaciones = selectedList.map((c, index) => ({
      reservaId: c.reservationId,
      montoARS: Number(distribucion[c.reservationId]) || 0,
      ordenIndex: index
    }));

    try {
      setSaving(true);
      const pago = await createClientMultiPago(clientId, {
        monto: recibido,
        moneda: 'ARS',
        metodo,
        motivo: 'Pago',
        imputaciones
      });
      notify({
        title: 'Pago registrado',
        message: `Código ${pago.codigo || ''} · ${imputaciones.length} imputación(es)`,
        type: 'success'
      });
      setMonto('');
      setDistribucion({});
      setSelected(new Set());
      onCreated?.(pago);
    } catch (error) {
      notify({
        title: 'Error',
        message: error.message || 'No se pudo registrar el pago',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <div style={{ marginTop: 16, color: 'var(--color-text-muted)', fontSize: 14 }}>
        No hay reservas con saldo pendiente para imputar.
        {noticeDialog}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        background: 'var(--color-surface, #fff)'
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Cobro con imputaciones múltiples</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Seleccioná reservas, ingresá lo recibido y distribuí el monto (manual o auto más antigua
        primero). No es obligatorio saldar todo el saldo.
      </p>

      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Monto recibido (ARS)
          <input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Medio
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}
          >
            <option>Efectivo</option>
            <option>Transferencia</option>
            <option>Tarjeta Debito</option>
            <option>Tarjeta Credito</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 8 }} />
              <th style={{ padding: 8 }}>Reserva</th>
              <th style={{ padding: 8 }}>Saldo</th>
              <th style={{ padding: 8 }}>Imputar</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.reservationId} style={{ borderBottom: '1px solid var(--color-border-light, #eee)' }}>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.reservationId)}
                    onChange={() => toggle(c.reservationId)}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  {c.label}
                  <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>({c.status})</span>
                </td>
                <td style={{ padding: 8 }}>{formatPrice(c.saldo)}</td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!selected.has(c.reservationId)}
                    value={distribucion[c.reservationId] ?? ''}
                    onChange={(e) =>
                      setDistribucion((prev) => ({
                        ...prev,
                        [c.reservationId]: e.target.value
                      }))
                    }
                    style={{
                      width: 110,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border)'
                    }}
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          fontSize: 13
        }}
      >
        <span>
          Distribuido: <strong>{formatPrice(sumDist)}</strong>
        </span>
        <span>
          Pendiente: <strong>{formatPrice(pendiente)}</strong>
        </span>
        <button
          type="button"
          onClick={autoOldestFirst}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            cursor: 'pointer'
          }}
        >
          Auto (más antigua primero)
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: saving ? 'var(--color-text-muted)' : 'var(--color-success, #2e7d32)',
            color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Guardando…' : 'Registrar pago'}
        </button>
      </div>
      {noticeDialog}
    </div>
  );
}

export default MultiPagoClientPanel;
