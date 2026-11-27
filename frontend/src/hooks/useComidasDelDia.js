import { useEffect, useState } from 'react';
import { fetchComidasDelDia } from '../services/api';

function toMealItem(row) {
  return {
    id: row.id,
    reservationId: row.reservationId,
    clientId: row.clientId,
    roomLabel: row.roomLabel,
    guestName: row.guestName,
    guests: row.pax,
    origen: row.origen,
    label: row.label
  };
}

/** Adapta la respuesta de /api/comidas a la forma que usan el dashboard y el panel del día. */
export function mapComidasResponse(data) {
  const desayunos = data?.desayunos || { total: 0, items: [] };
  const cenas = data?.cenas || { total: 0, items: [] };
  return {
    breakfastGuests: Number(desayunos.total) || 0,
    dinnerGuests: Number(cenas.total) || 0,
    breakfastItems: (desayunos.items || []).map(toMealItem),
    dinnerItems: (cenas.items || []).map(toMealItem)
  };
}

/**
 * Comidas previstas de un día (desayunos / cenas) desde el backend.
 * refreshKey: cambiarlo fuerza a recargar (p. ej. tras recargar reservas).
 */
export function useComidasDelDia(fechaIso, refreshKey) {
  const [state, setState] = useState({ comidas: null, loading: false, error: null });

  useEffect(() => {
    if (!fechaIso) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchComidasDelDia(fechaIso)
      .then((res) => {
        if (!cancelled) {
          setState({ comidas: mapComidasResponse(res?.data), loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            comidas: null,
            loading: false,
            error: err?.message || 'No se pudieron cargar las comidas'
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fechaIso, refreshKey]);

  return state;
}
