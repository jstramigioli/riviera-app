import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  createDiningReservation,
  updateDiningReservation
} from '../services/diningApi';
import { searchClients, createExternalAccount, getAccountsWithBalances } from '../services/api';
import styles from './DiningReservationForm.module.css';

function clientLabel(c) {
  if (!c) return '';
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
  return name || `Cliente #${c.id}`;
}

/**
 * Formulario reutilizable: alta/edición de reserva de comedor.
 * Modos: vinculado a alojamiento (reservationId fijo) o libre (alojamiento / externo).
 */
export default function DiningReservationForm({
  mode = 'create',
  initial = null,
  /** Si viene de ficha de alojamiento, fija vínculo y cliente. */
  lockedReservation = null,
  defaultDate = null,
  onSaved,
  onCancel
}) {
  const locked = Boolean(lockedReservation?.id);
  const [serviceDate, setServiceDate] = useState(
    initial?.serviceDate || defaultDate || ''
  );
  const [guestCount, setGuestCount] = useState(
    initial?.guestCount != null ? String(initial.guestCount) : '1'
  );
  const [notes, setNotes] = useState(initial?.notes || '');
  const [linkMode, setLinkMode] = useState(
    locked || initial?.reservationId || lockedReservation
      ? 'lodging'
      : 'external'
  );
  const [reservationId, setReservationId] = useState(
    lockedReservation?.id != null
      ? String(lockedReservation.id)
      : initial?.reservationId != null
        ? String(initial.reservationId)
        : ''
  );
  const [client, setClient] = useState(
    initial?.client ||
      lockedReservation?.mainClient ||
      null
  );
  const [clientQuery, setClientQuery] = useState('');
  const [clientHits, setClientHits] = useState([]);
  const [clientBusy, setClientBusy] = useState(false);
  const [accountId, setAccountId] = useState(
    initial?.accountId != null ? String(initial.accountId) : ''
  );
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lockedReservation?.mainClient && !client) {
      setClient(lockedReservation.mainClient);
    }
  }, [lockedReservation, client]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getAccountsWithBalances('ALL');
        if (!cancelled) setAccounts(Array.isArray(rows) ? rows : rows?.data || []);
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = clientQuery.trim();
    if (q.length < 2) {
      setClientHits([]);
      return undefined;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setClientBusy(true);
      try {
        const list = await searchClients(q, { signal: controller.signal });
        setClientHits(Array.isArray(list) ? list : []);
      } catch (err) {
        if (err.name !== 'AbortError') setClientHits([]);
      } finally {
        setClientBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [clientQuery]);

  const accountOptions = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    if (linkMode === 'lodging' && reservationId) {
      const rid = parseInt(reservationId, 10);
      return list.filter(
        (a) =>
          a.kind === 'RESERVATION' &&
          (a.reservationId === rid || a.reservaId === rid)
      );
    }
    return list.filter((a) => a.kind === 'EXTERNAL');
  }, [accounts, linkMode, reservationId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const count = parseInt(guestCount, 10);
    if (!serviceDate) {
      setError('Indicá la fecha del servicio');
      return;
    }
    if (!Number.isFinite(count) || count < 1) {
      setError('La cantidad de comensales debe ser un entero ≥ 1');
      return;
    }

    const payload = {
      serviceDate,
      serviceType: 'CENA',
      guestCount: count,
      notes: notes.trim() || null
    };

    if (linkMode === 'lodging') {
      const rid = parseInt(reservationId || lockedReservation?.id, 10);
      if (!Number.isFinite(rid)) {
        setError('Indicá la reserva de alojamiento');
        return;
      }
      payload.reservationId = rid;
      payload.clientId =
        client?.id ||
        lockedReservation?.mainClientId ||
        lockedReservation?.mainClient?.id ||
        null;
    } else {
      payload.reservationId = null;
      if (!client?.id) {
        setError('Seleccioná el cliente responsable');
        return;
      }
      payload.clientId = client.id;
    }

    if (!payload.clientId) {
      setError('Seleccioná el cliente responsable');
      return;
    }

    if (accountId) {
      payload.accountId = parseInt(accountId, 10);
    } else if (linkMode === 'external' && !accountId) {
      // Sin cuenta: permitido (opcional).
    }

    setSaving(true);
    try {
      let saved;
      if (mode === 'edit' && initial?.id) {
        saved = await updateDiningReservation(initial.id, payload);
      } else {
        saved = await createDiningReservation(payload);
      }
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateExternalAccount() {
    if (!client?.id) {
      setError('Elegí un cliente antes de crear la cuenta externa');
      return;
    }
    try {
      const created = await createExternalAccount({
        label: `Comedor · ${clientLabel(client)}`,
        clientId: client.id
      });
      setAccounts((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setAccountId(String(created.id));
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta externa');
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} data-testid="dining-reservation-form">
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Fecha del servicio</span>
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            required
            data-testid="dining-form-date"
          />
        </label>

        <label className={styles.field}>
          <span>Servicio</span>
          <input type="text" value="Cena" disabled readOnly />
        </label>

        <label className={styles.field}>
          <span>Comensales</span>
          <input
            type="number"
            min={1}
            step={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            required
            data-testid="dining-form-guests"
          />
        </label>
      </div>

      {!locked ? (
        <fieldset className={styles.fieldset}>
          <legend>Tipo</legend>
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="linkMode"
                checked={linkMode === 'lodging'}
                onChange={() => setLinkMode('lodging')}
              />
              Huésped alojado
            </label>
            <label>
              <input
                type="radio"
                name="linkMode"
                checked={linkMode === 'external'}
                onChange={() => {
                  setLinkMode('external');
                  setReservationId('');
                }}
              />
              Cliente externo
            </label>
          </div>
        </fieldset>
      ) : null}

      {linkMode === 'lodging' ? (
        <label className={styles.field}>
          <span>Reserva de alojamiento</span>
          <input
            type="number"
            min={1}
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            disabled={locked}
            placeholder="Nº de reserva"
            data-testid="dining-form-reservation-id"
          />
        </label>
      ) : null}

      <div className={styles.field}>
        <span>Cliente responsable</span>
        {client ? (
          <div className={styles.selectedClient} data-testid="dining-form-client">
            <span>{clientLabel(client)}</span>
            {!locked ? (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => {
                  setClient(null);
                  setClientQuery('');
                }}
                aria-label="Quitar cliente"
              >
                <FiX />
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.searchWrap}>
            <FiSearch className={styles.searchIcon} aria-hidden />
            <input
              type="search"
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              placeholder="Buscar cliente…"
              data-testid="dining-form-client-search"
            />
            {clientBusy ? <span className={styles.hint}>Buscando…</span> : null}
            {clientHits.length > 0 ? (
              <ul className={styles.hits} role="listbox">
                {clientHits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClient(c);
                        setClientQuery('');
                        setClientHits([]);
                      }}
                    >
                      {clientLabel(c)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.field}>
        <span>Cuenta de cobro (opcional)</span>
        <div className={styles.accountRow}>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            data-testid="dining-form-account"
          >
            <option value="">Sin cuenta</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id}
                {a.label ? ` · ${a.label}` : ''}
                {a.kind ? ` (${a.kind})` : ''}
              </option>
            ))}
          </select>
          {linkMode === 'external' ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleCreateExternalAccount}
            >
              Nueva externa
            </button>
          ) : null}
        </div>
      </div>

      <label className={styles.field}>
        <span>Observaciones</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="dining-form-notes"
        />
      </label>

      {error ? (
        <p className={styles.error} role="alert" data-testid="dining-form-error">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={saving}
          data-testid="dining-form-submit"
        >
          {saving ? 'Guardando…' : mode === 'edit' ? 'Guardar' : 'Crear reserva'}
        </button>
      </div>
    </form>
  );
}
