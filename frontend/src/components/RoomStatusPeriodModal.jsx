import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { setRoomStatusPeriod } from '../services/api';
import styles from './RoomStatusPeriodModal.module.css';

export const ROOM_STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'unavailable', label: 'No disponible' },
];

function RoomStatusPeriodModal({ isOpen, onClose, roomId, roomName, onSaved }) {
  const overlayDismiss = useOverlayDismiss(onClose);
  const [status, setStatus] = useState('maintenance');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setStatus('maintenance');
    setDesde('');
    setHasta('');
    setNote('');
    setError(null);
    setSaving(false);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!desde || !hasta) {
      setError('Indicá desde y hasta');
      return;
    }
    if (desde > hasta) {
      setError('La fecha desde no puede ser posterior a hasta');
      return;
    }

    try {
      setSaving(true);
      const result = await setRoomStatusPeriod(roomId, {
        status,
        desde,
        hasta,
        note: note.trim() || undefined,
      });
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      if (err.status === 409 || err.code === 'RESERVATIONS_IN_RANGE') {
        const conflictLines = (err.conflicts || [])
          .slice(0, 4)
          .map((c) => {
            const guest = c.guest ? ` · ${c.guest}` : '';
            return `#${c.reservationId} ${c.startDate}→${c.endDate}${guest}`;
          })
          .join('\n');
        setError(
          `${err.message || 'Hay reservas en ese rango'}${
            conflictLines ? `\n${conflictLines}` : ''
          }`
        );
      } else {
        setError(err.message || 'No se pudo guardar el estado');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} {...overlayDismiss} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-status-modal-title"
      >
        <div className={styles.header}>
          <h3 id="room-status-modal-title" className={styles.title}>
            Estado por fechas{roomName ? ` · ${roomName}` : ''}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <form className={styles.body} onSubmit={handleSubmit}>
          <p className={styles.hint}>
            Definí el estado operativo del rango. Si hay reservas en esas fechas, se
            rechaza el cambio.
          </p>

          <label className={styles.field}>
            <span>Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving}
            >
              {ROOM_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Desde</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                disabled={saving}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Hasta</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                disabled={saving}
                required
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Nota (opcional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              maxLength={200}
              placeholder="Ej. pintura, fuga, reforma"
            />
          </label>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.secondary}
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.primary} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar estado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RoomStatusPeriodModal;
