import { useEffect, useState } from 'react';
import { updateReservation } from '../../services/api';
import styles from './RegimenTab.module.css';

/**
 * Submenú Régimen / Comidas de la vista reserva.
 * Flags de dieta (vegetariano / vegano / celíaco).
 * Las notas de estadía van en Reservation.notes (perfil de reserva).
 */
export default function RegimenTab({ reservation, onSaved }) {
  const [dietVegetariano, setDietVegetariano] = useState(
    Boolean(reservation?.dietVegetariano)
  );
  const [dietVegano, setDietVegano] = useState(Boolean(reservation?.dietVegano));
  const [dietCeliaco, setDietCeliaco] = useState(Boolean(reservation?.dietCeliaco));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDietVegetariano(Boolean(reservation?.dietVegetariano));
    setDietVegano(Boolean(reservation?.dietVegano));
    setDietCeliaco(Boolean(reservation?.dietCeliaco));
  }, [
    reservation?.id,
    reservation?.dietVegetariano,
    reservation?.dietVegano,
    reservation?.dietCeliaco
  ]);

  const handleSave = async () => {
    if (!reservation?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateReservation(reservation.id, {
        dietVegetariano,
        dietVegano,
        dietCeliaco
      });
      onSaved?.(updated);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el régimen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.root} data-testid="regimen-tab">
      <h3 className={styles.heading}>Régimen / Comidas</h3>
      <p className={styles.hint}>
        Preferencias alimentarias de la estadía. Las notas generales van en el panel
        de la reserva.
      </p>

      <fieldset className={styles.flags}>
        <legend className={styles.legend}>Dieta</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={dietVegetariano}
            onChange={(e) => setDietVegetariano(e.target.checked)}
          />
          Vegetariano
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={dietVegano}
            onChange={(e) => setDietVegano(e.target.checked)}
          />
          Vegano
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={dietCeliaco}
            onChange={(e) => setDietCeliaco(e.target.checked)}
          />
          Celíaco
        </label>
      </fieldset>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : 'Guardar régimen'}
        </button>
        {savedFlash ? <span className={styles.saved}>Guardado</span> : null}
      </div>
    </div>
  );
}
