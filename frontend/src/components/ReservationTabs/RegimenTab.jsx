import { useCallback, useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import {
  cancelDiningReservation,
  listDiningReservations
} from '../../services/diningApi';
import DiningReservationForm from '../DiningReservationForm';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import { todayIsoLocal } from '../../utils/calendarDates';
import styles from './RegimenTab.module.css';

const DIET_LABELS = [
  { key: 'dietVegetariano', label: 'Vegetariano' },
  { key: 'dietVegano', label: 'Vegano' },
  { key: 'dietCeliaco', label: 'Celíaco' }
];

function guestDietLabels(guest) {
  return DIET_LABELS.filter((d) => Boolean(guest?.[d.key])).map((d) => d.label);
}

/**
 * Resumen de régimen por huésped + reservas de comedor vinculadas a la estadía.
 * Media pensión sigue automática (no se crean filas de comedor para MP).
 */
export default function RegimenTab({ reservation }) {
  const guests = Array.isArray(reservation?.guests) ? reservation.guests : [];
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [diningRows, setDiningRows] = useState([]);
  const [loadingDining, setLoadingDining] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadDining = useCallback(async () => {
    if (!reservation?.id) return;
    setLoadingDining(true);
    try {
      const rows = await listDiningReservations({
        reservationId: reservation.id
      });
      setDiningRows(Array.isArray(rows) ? rows : []);
    } catch {
      setDiningRows([]);
    } finally {
      setLoadingDining(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    loadDining();
  }, [loadDining]);

  async function handleCancelDining(row) {
    const ok = await confirm({
      title: 'Cancelar reserva de comedor',
      message: `¿Cancelar la reserva de comedor #${row.id}?`,
      confirmText: 'Cancelar reserva',
      cancelText: 'Volver',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await cancelDiningReservation(row.id);
      notify({ title: 'Comedor', message: 'Reserva cancelada', type: 'success' });
      loadDining();
    } catch (err) {
      notify({ title: 'Error', message: err.message, type: 'error' });
    }
  }

  return (
    <div className={styles.root} data-testid="regimen-tab">
      <h3 className={styles.heading}>Dieta y notas</h3>
      <p className={styles.hint}>
        Resumen por huésped. Para cargar o cambiar dietas, usá la pestaña Huéspedes o el
        check-in online.
      </p>

      {guests.length === 0 ? (
        <p className={styles.empty} data-testid="regimen-empty">
          Sin huéspedes cargados.
        </p>
      ) : (
        <ul className={styles.guestList} data-testid="regimen-guest-list">
          {guests.map((guest) => {
            const diets = guestDietLabels(guest);
            const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ') || 'Huésped';
            return (
              <li key={guest.id} className={styles.guestRow}>
                <span className={styles.guestName}>{name}</span>
                <span className={styles.guestDiets}>
                  {diets.length ? diets.join(' · ') : 'Sin preferencias'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.diningBlock} data-testid="regimen-dining-block">
        <div className={styles.diningHeader}>
          <h4 className={styles.diningHeading}>Reservas de comedor</h4>
          {!showForm ? (
            <button
              type="button"
              className={styles.diningAddBtn}
              onClick={() => setShowForm(true)}
              data-testid="regimen-dining-add"
            >
              <FiPlus aria-hidden />
              Nueva cena
            </button>
          ) : null}
        </div>

        {showForm ? (
          <DiningReservationForm
            mode="create"
            lockedReservation={reservation}
            defaultDate={todayIsoLocal()}
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              notify({ title: 'Comedor', message: 'Reserva creada', type: 'success' });
              loadDining();
            }}
          />
        ) : null}

        {loadingDining ? (
          <p className={styles.empty}>Cargando…</p>
        ) : diningRows.length === 0 && !showForm ? (
          <p className={styles.empty}>Sin reservas de comedor vinculadas.</p>
        ) : diningRows.length > 0 ? (
          <ul className={styles.diningList}>
            {diningRows.map((row) => (
              <li key={row.id} className={styles.diningRow}>
                <span>
                  {row.serviceDate} · {row.guestCount} comensal
                  {row.guestCount === 1 ? '' : 'es'} · {row.status}
                </span>
                {row.status !== 'CANCELADA' ? (
                  <button
                    type="button"
                    className={styles.diningCancelBtn}
                    onClick={() => handleCancelDining(row)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {confirmDialog}
      {noticeDialog}
    </div>
  );
}
