import { useEffect, useState } from 'react';
import { fetchReservationStatuses } from '../services/api';
import { FALLBACK_STATUS_OPTIONS } from '../utils/reservationStatusUtils';

let cachedStatuses = null;
let inflight = null;

async function loadStatuses() {
  if (cachedStatuses) return cachedStatuses;
  if (!inflight) {
    inflight = fetchReservationStatuses()
      .then((data) => {
        const statuses = Array.isArray(data?.statuses) && data.statuses.length
          ? data.statuses
          : FALLBACK_STATUS_OPTIONS;
        cachedStatuses = statuses;
        return statuses;
      })
      .catch((err) => {
        console.warn('No se pudieron cargar estados desde API; usando fallback', err);
        cachedStatuses = FALLBACK_STATUS_OPTIONS;
        return FALLBACK_STATUS_OPTIONS;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Consume GET /api/reservations/statuses (definición canónica del backend).
 */
export default function useReservationStatuses() {
  const [statuses, setStatuses] = useState(cachedStatuses || FALLBACK_STATUS_OPTIONS);
  const [loading, setLoading] = useState(!cachedStatuses);

  useEffect(() => {
    let cancelled = false;
    setLoading(!cachedStatuses);
    loadStatuses().then((list) => {
      if (!cancelled) {
        setStatuses(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { statuses, loading };
}
