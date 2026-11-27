import { useEffect, useId, useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import {
  actualizarComida,
  crearCenaManual,
  fetchOccupiedRoomsToday,
  fetchTiposCena,
  searchClients
} from '../../services/api';
import { formatMoneyArs } from '../../utils/formatMoney';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import { DIETAS } from '../../utils/dietas';
import styles from './Comensales.module.css';

const COMENSAL = { HUESPED: 'HUESPED', EXTERNO: 'EXTERNO' };
const CLIENTE_VACIO = { firstName: '', lastName: '', phone: '', email: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** NINO (5 a 10 años) paga la mitad; MENOR (menos de 5) no paga. */
const EDADES = [
  { value: 'ADULTO', label: 'Adulto', factor: 1 },
  { value: 'NINO', label: '5 a 10 años', factor: 0.5 },
  { value: 'MENOR', label: 'Menor de 5', factor: 0 }
];

function nuevoComensal() {
  return { edad: 'ADULTO', dietVegetariano: false, dietVegano: false, dietCeliaco: false };
}

function ajustarComensales(list, n) {
  const next = list.slice(0, n);
  while (next.length < n) next.push(nuevoComensal());
  return next;
}

function totalCena(precio, comensales) {
  if (precio == null) return null;
  return comensales.reduce(
    (sum, c) => sum + Math.round(precio * (EDADES.find((e) => e.value === c.edad)?.factor ?? 1) * 100) / 100,
    0
  );
}

function formatMoney(value) {
  return formatMoneyArs(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function nombreCliente(c) {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim();
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

function ComensalesTable({ comensales, onChange, disabled }) {
  const set = (idx, patch) => onChange(comensales.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  return (
    <table className={styles.comensalesTable}>
      <thead>
        <tr>
          <th>Comensal</th>
          <th>Edad</th>
          {DIETAS.map((d) => (
            <th key={d.key} className={styles.center}>
              {d.label}
            </th>
          ))}
          <th>Otra</th>
        </tr>
      </thead>
      <tbody>
        {comensales.map((c, idx) => (
          <tr key={idx}>
            <td>{idx + 1}</td>
            <td>
              <select
                className={styles.inputSm}
                value={c.edad}
                disabled={disabled}
                aria-label={`Edad del comensal ${idx + 1}`}
                onChange={(e) => set(idx, { edad: e.target.value })}
              >
                {EDADES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </td>
            {DIETAS.map((d) => (
              <td key={d.key} className={styles.center}>
                <input
                  type="checkbox"
                  checked={Boolean(c[d.key])}
                  disabled={disabled}
                  aria-label={`${d.label}, comensal ${idx + 1}`}
                  onChange={(e) => set(idx, { [d.key]: e.target.checked })}
                />
              </td>
            ))}
            <td>
              <input
                className={`${styles.inputSm} ${styles.inputOtra}`}
                value={c.dietOtra || ''}
                maxLength={120}
                disabled={disabled}
                aria-label={`Otra dieta, comensal ${idx + 1}`}
                onChange={(e) => set(idx, { dietOtra: e.target.value })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Cena no incluida en el régimen (huésped sin media pensión o externo): crea la
 * comanda de Cena con un precio por comensal según la edad. Con `cena` edita
 * los comensales de una cena ya registrada (y su comanda).
 */
export default function NuevaCenaModal({ open, fecha, cena = null, onClose, onSaved }) {
  const titleId = useId();
  const editing = Boolean(cena);
  const [comensal, setComensal] = useState(COMENSAL.HUESPED);
  const [tipos, setTipos] = useState([]);
  const [huespedes, setHuespedes] = useState([]);
  const [reservationId, setReservationId] = useState('');
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [clienteExistente, setClienteExistente] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [tipoId, setTipoId] = useState('');
  const [variedad, setVariedad] = useState('ALOJADO');
  const [comensales, setComensales] = useState(() => ajustarComensales([], 2));
  const [cantidadTxt, setCantidadTxt] = useState('2');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const overlayDismiss = useOverlayDismiss(onClose, { enabled: !saving });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (cena) {
      setComensales(
        Array.isArray(cena.comensales) && cena.comensales.length
          ? cena.comensales.map((c) => ({ ...nuevoComensal(), ...c }))
          : ajustarComensales([], cena.pax || 1)
      );
      setNotas(cena.notas || '');
      return;
    }
    setComensal(COMENSAL.HUESPED);
    setReservationId('');
    setCliente(CLIENTE_VACIO);
    setClienteExistente(null);
    setBusqueda('');
    setSugerencias([]);
    setVariedad('ALOJADO');
    setComensales(ajustarComensales([], 2));
    setNotas('');
    Promise.all([fetchTiposCena(), fetchOccupiedRoomsToday(fecha).catch(() => ({ data: [] }))])
      .then(([tiposRes, roomsRes]) => {
        const list = tiposRes.data || [];
        setTipos(list);
        setTipoId(list[0] ? String(list[0].id) : '');
        setHuespedes(huespedesDeLaNoche(roomsRes.data || roomsRes || [], fecha));
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los datos'));
  }, [open, fecha, cena]);

  useEffect(() => {
    setCantidadTxt(String(comensales.length));
  }, [comensales.length]);

  useEffect(() => {
    const q = busqueda.trim();
    if (!open || clienteExistente || q.length < 2) {
      setSugerencias([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchClients(q, { limit: 8, signal: ctrl.signal })
        .then((list) => setSugerencias(Array.isArray(list) ? list : []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [busqueda, open, clienteExistente]);

  const setCampo = (campo) => (e) => setCliente((c) => ({ ...c, [campo]: e.target.value }));

  const tipo = useMemo(() => tipos.find((t) => String(t.id) === tipoId) || null, [tipos, tipoId]);
  const precio = editing
    ? cena.precioBase
    : tipo
      ? variedad === 'EXTERNO'
        ? tipo.precioExterno
        : tipo.precioAlojado
      : null;
  const total = totalCena(precio, comensales);

  const chooseComensal = (next) => {
    setComensal(next);
    // El precio sigue al tipo de comensal; se puede cambiar a mano.
    setVariedad(next === COMENSAL.EXTERNO ? 'EXTERNO' : 'ALOJADO');
  };

  const setCantidad = (value) => {
    setCantidadTxt(value);
    const n = Number(value);
    if (value !== '' && Number.isInteger(n) && n >= 1 && n <= 99) {
      setComensales((list) => ajustarComensales(list, n));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!editing) {
      if (!tipo) return setError('Elegí el tipo de cena');
      if (comensal === COMENSAL.HUESPED && !reservationId) return setError('Elegí la reserva');
      if (comensal === COMENSAL.EXTERNO && !clienteExistente) {
        if (!cliente.firstName.trim() || !cliente.lastName.trim()) {
          return setError('Ingresá nombre y apellido del cliente');
        }
        if (!cliente.phone.trim() && !cliente.email.trim()) {
          return setError('Ingresá un teléfono o un email de contacto');
        }
        if (cliente.email.trim() && !EMAIL_RE.test(cliente.email.trim())) return setError('El email no es válido');
      }
    }
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await actualizarComida(cena.id, { comensales, notas: notas.trim() || null });
      } else {
        res = await crearCenaManual({
          fecha,
          menuItemId: tipo.id,
          variedad,
          comensales,
          notas: notas.trim() || null,
          ...(comensal === COMENSAL.HUESPED
            ? { reservationId: Number(reservationId) }
            : clienteExistente
              ? { clientId: clienteExistente.id }
              : {
                  cliente: {
                    firstName: cliente.firstName.trim(),
                    lastName: cliente.lastName.trim(),
                    phone: cliente.phone.trim() || null,
                    email: cliente.email.trim() || null
                  }
                })
        });
      }
      onSaved?.(res?.data);
      onClose?.();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cena');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" {...overlayDismiss}>
      <form className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <header className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>
            {editing ? `Editar cena · ${cena.guestName}` : `Nueva cena · ${fecha}`}
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

          {!editing ? (
            <>
              <div className={styles.field}>
                <span className={styles.label} id={`${titleId}-comensal`}>
                  Comensal
                </span>
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
              ) : clienteExistente ? (
                <div className={styles.field}>
                  <span className={styles.label}>Cliente</span>
                  <div className={styles.clienteSel}>
                    <span>
                      <strong>{nombreCliente(clienteExistente)}</strong>
                      {clienteExistente.phone || clienteExistente.email ? (
                        <span className={styles.muted}> · {clienteExistente.phone || clienteExistente.email}</span>
                      ) : null}
                    </span>
                    <button type="button" className={styles.btn} onClick={() => setClienteExistente(null)}>
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label className={`${styles.field} ${styles.clienteBuscar}`}>
                    <span className={styles.label}>Buscar cliente existente</span>
                    <input
                      className={styles.input}
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Nombre, documento, teléfono o email"
                    />
                    {sugerencias.length ? (
                      <ul className={styles.sugerencias} role="listbox" aria-label="Clientes encontrados">
                        {sugerencias.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={styles.sugerencia}
                              onClick={() => {
                                setClienteExistente(c);
                                setSugerencias([]);
                              }}
                            >
                              <strong>{nombreCliente(c)}</strong>
                              {c.phone || c.email || c.documentNumber ? (
                                <span className={styles.muted}> · {c.phone || c.email || c.documentNumber}</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </label>
                  <span className={styles.label}>O cliente nuevo</span>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Nombre</span>
                      <input className={styles.input} value={cliente.firstName} onChange={setCampo('firstName')} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Apellido</span>
                      <input className={styles.input} value={cliente.lastName} onChange={setCampo('lastName')} />
                    </label>
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span className={styles.label}>Teléfono</span>
                      <input className={styles.input} type="tel" value={cliente.phone} onChange={setCampo('phone')} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Email</span>
                      <input className={styles.input} type="email" value={cliente.email} onChange={setCampo('email')} />
                    </label>
                  </div>
                </>
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
              </div>
            </>
          ) : null}

          <label className={styles.cantidad}>
            <span className={styles.label}>Comensales</span>
            <input
              className={styles.input}
              type="number"
              min="1"
              max="99"
              value={cantidadTxt}
              onChange={(e) => setCantidad(e.target.value)}
              onBlur={() => setCantidadTxt(String(comensales.length))}
            />
          </label>
          <ComensalesTable comensales={comensales} onChange={setComensales} disabled={saving} />

          <label className={styles.field}>
            <span className={styles.label}>Notas</span>
            <input className={styles.input} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </label>
        </div>

        <footer className={styles.modalFooter}>
          <span className={styles.totalDestacado}>
            {total != null ? (
              <>
                Total <strong>{formatMoney(total)}</strong>
              </>
            ) : null}
          </span>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btn} onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar' : 'Registrar cena'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
