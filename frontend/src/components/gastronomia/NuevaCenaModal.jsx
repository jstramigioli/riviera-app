import { useEffect, useId, useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { crearCenaManual, fetchOccupiedRoomsToday, fetchTiposCena } from '../../services/api';
import { formatMoneyArs } from '../../utils/formatMoney';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import styles from './Comensales.module.css';

const COMENSAL = { HUESPED: 'HUESPED', EXTERNO: 'EXTERNO' };

function formatMoney(value) {
  return formatMoneyArs(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Reservas que pasan la noche de esa fecha (check-in ≤ fecha < check-out). */
function huespedesDeLaNoche(rows, fecha) {
  const seen = new Set();
  return (rows || []).filter((r) => {
    if (r.accountKind === 'EXTERNAL' || !r.reservationId) return false;
    if (!(r.startDate <= fecha && fecha < r.endDate)) return false;
    if (seen.has(r.reservationId)) return false;
    seen.add(r.reservationId);
    return true;
  });
}

/**
 * Registrar una cena no incluida en el régimen (huésped sin media pensión o
 * externo). Crea la comanda de Cena con el tipo elegido × comensales; las
 * bebidas se agregan después a esa misma comanda.
 */
export default function NuevaCenaModal({ open, fecha, onClose, onSaved }) {
  const titleId = useId();
  const [comensal, setComensal] = useState(COMENSAL.HUESPED);
  const [tipos, setTipos] = useState([]);
  const [huespedes, setHuespedes] = useState([]);
  const [reservationId, setReservationId] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [variedad, setVariedad] = useState('ALOJADO');
  const [pax, setPax] = useState('2');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const overlayDismiss = useOverlayDismiss(onClose, { enabled: !saving });

  useEffect(() => {
    if (!open) return;
    setComensal(COMENSAL.HUESPED);
    setReservationId('');
    setNombre('');
    setTelefono('');
    setVariedad('ALOJADO');
    setPax('2');
    setNotas('');
    setError(null);
    Promise.all([
      fetchTiposCena(),
      fetchOccupiedRoomsToday(fecha).catch(() => ({ data: [] }))
    ])
      .then(([tiposRes, roomsRes]) => {
        const list = tiposRes.data || [];
        setTipos(list);
        setTipoId(list[0] ? String(list[0].id) : '');
        setHuespedes(huespedesDeLaNoche(roomsRes.data || roomsRes || [], fecha));
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los datos'));
  }, [open, fecha]);

  const tipo = useMemo(() => tipos.find((t) => String(t.id) === tipoId) || null, [tipos, tipoId]);
  const precio = tipo ? (variedad === 'EXTERNO' ? tipo.precioExterno : tipo.precioAlojado) : null;
  const paxNum = Number(pax);
  const total = precio != null && Number.isFinite(paxNum) ? precio * paxNum : 0;

  const chooseComensal = (next) => {
    setComensal(next);
    // El precio sigue al tipo de comensal; se puede cambiar a mano.
    setVariedad(next === COMENSAL.EXTERNO ? 'EXTERNO' : 'ALOJADO');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!tipo) return setError('Elegí el tipo de cena');
    if (comensal === COMENSAL.HUESPED && !reservationId) return setError('Elegí la reserva');
    if (comensal === COMENSAL.EXTERNO && !nombre.trim()) return setError('Ingresá el nombre');
    if (!Number.isInteger(paxNum) || paxNum < 1) return setError('Indicá los comensales');
    setSaving(true);
    try {
      const res = await crearCenaManual({
        fecha,
        menuItemId: tipo.id,
        variedad,
        pax: paxNum,
        notas: notas.trim() || null,
        ...(comensal === COMENSAL.HUESPED
          ? { reservationId: Number(reservationId) }
          : { nombreExterno: nombre.trim(), telefono: telefono.trim() || null })
      });
      onSaved?.(res?.data);
      onClose?.();
    } catch (err) {
      setError(err.message || 'No se pudo registrar la cena');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" {...overlayDismiss}>
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
      >
        <header className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>
            Nueva cena · {fecha}
          </h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar" title="Cerrar">
            <FiX aria-hidden="true" />
          </button>
        </header>

        <div className={styles.modalBody}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.field}>
            <span className={styles.label} id={`${titleId}-comensal`}>Comensal</span>
            <div className={styles.segmented} role="radiogroup" aria-labelledby={`${titleId}-comensal`}>
              {[
                [COMENSAL.HUESPED, 'Huésped alojado'],
                [COMENSAL.EXTERNO, 'Externo']
              ].map(([value, label]) => (
                <label key={value} className={`${styles.segment} ${comensal === value ? styles.segmentActive : ''}`}>
                  <input
                    type="radio"
                    name={`${titleId}-comensal`}
                    className={styles.segmentInput}
                    checked={comensal === value}
                    onChange={() => chooseComensal(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {comensal === COMENSAL.HUESPED ? (
            <label className={styles.field}>
              <span className={styles.label}>Reserva</span>
              <select className={styles.input} value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
                <option value="">{huespedes.length ? 'Seleccionar…' : 'Sin huéspedes esa noche'}</option>
                {huespedes.map((h) => (
                  <option key={h.reservationId} value={h.reservationId}>
                    {h.label} · #{h.reservationId}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Nombre</span>
                <input className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Teléfono</span>
                <input className={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </label>
            </div>
          )}

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Tipo de cena</span>
              <select className={styles.input} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                {tipos.length === 0 ? <option value="">Sin tipos de cena</option> : null}
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Precio</span>
              <select className={styles.input} value={variedad} onChange={(e) => setVariedad(e.target.value)}>
                <option value="ALOJADO">
                  Alojado{tipo?.precioAlojado != null ? ` · ${formatMoney(tipo.precioAlojado)}` : ''}
                </option>
                <option value="EXTERNO">
                  Externo{tipo?.precioExterno != null ? ` · ${formatMoney(tipo.precioExterno)}` : ''}
                </option>
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldPax}`}>
              <span className={styles.label}>Comensales</span>
              <input
                className={styles.input}
                type="number"
                min="1"
                max="99"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Notas</span>
            <input className={styles.input} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </label>
        </div>

        <footer className={styles.modalFooter}>
          <span className={styles.total}>
            Comanda de cena: <strong>{formatMoney(total)}</strong>
          </span>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btn} onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar cena'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
