import { useNavigate } from 'react-router-dom';
import styles from '../styles/RoomNameChip.module.css';

function normalizeRooms({ name, roomId, roomIds, rooms }) {
  if (Array.isArray(rooms) && rooms.length) {
    return rooms
      .map((room) => ({
        name: room?.name != null ? String(room.name).trim() : '',
        roomId: room?.roomId ?? room?.id ?? null
      }))
      .filter((room) => room.name && room.name !== '—');
  }

  const raw = name == null ? '' : String(name).trim();
  if (!raw || raw === '—') return [];

  const parts = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];

  const ids = Array.isArray(roomIds)
    ? roomIds
    : roomId != null
      ? [roomId]
      : [];

  return parts.map((part, index) => ({
    name: part,
    roomId: ids[index] ?? (parts.length === 1 ? roomId ?? null : null)
  }));
}

/**
 * Nombre(s) de habitación en chip neutro (blanco/gris), misma forma que
 * ReservationIdChip pero sin color de canal. Siempre clickeable hacia
 * `/habitaciones/:id` cuando hay `roomId`.
 *
 * Acepta `rooms={[{ id, name }]}` o `name` (+ `roomId` / `roomIds`).
 * Labels unidos por `/` (como `movementRoomLabel`) se parten en chips.
 */
export default function RoomNameChip({
  name = null,
  roomId = null,
  roomIds = null,
  rooms = null,
  title = null,
  className = '',
  stopPropagation = true,
  'data-testid': dataTestId
}) {
  const navigate = useNavigate();
  const entries = normalizeRooms({ name, roomId, roomIds, rooms });

  if (!entries.length) {
    return <span className={className}>—</span>;
  }

  const openRoom = (id, event) => {
    if (stopPropagation && event) {
      event.stopPropagation();
      event.preventDefault?.();
    }
    if (id == null || id === '') return;
    navigate(`/habitaciones/${id}`);
  };

  const renderOne = (entry, index) => {
    const tip =
      title ||
      (entry.roomId != null
        ? `Ver habitación ${entry.name}`
        : `Habitación ${entry.name}`);
    const clickable = entry.roomId != null && entry.roomId !== '';
    const classNames = [
      styles.chip,
      clickable ? styles.clickable : '',
      entries.length === 1 ? className : ''
    ]
      .filter(Boolean)
      .join(' ');

    if (clickable) {
      return (
        <button
          key={`${entry.name}-${entry.roomId}-${index}`}
          type="button"
          className={classNames}
          onClick={(event) => openRoom(entry.roomId, event)}
          title={tip}
          data-testid={entries.length === 1 ? dataTestId : undefined}
        >
          {entry.name}
        </button>
      );
    }

    return (
      <span
        key={`${entry.name}-${index}`}
        className={classNames}
        title={tip}
        data-testid={entries.length === 1 ? dataTestId : undefined}
      >
        {entry.name}
      </span>
    );
  };

  if (entries.length === 1) {
    return renderOne(entries[0], 0);
  }

  return (
    <span className={`${styles.group} ${className}`.trim()} data-testid={dataTestId}>
      {entries.map((entry, index) => renderOne(entry, index))}
    </span>
  );
}
