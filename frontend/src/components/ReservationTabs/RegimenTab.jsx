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
 * Resumen de dietas por huésped (solo lectura).
 * Las cenas adicionales se cargan desde Comedor → Comensales.
 */
export default function RegimenTab({ reservation }) {
  const guests = Array.isArray(reservation?.guests) ? reservation.guests : [];

  return (
    <div className={styles.root} data-testid="regimen-tab">
      <h3 className={styles.heading}>Dieta y notas</h3>

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
    </div>
  );
}
