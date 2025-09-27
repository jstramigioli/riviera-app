import React, { useState, useEffect } from 'react';
import { useTags } from '../hooks/useTags';
import { fetchRooms } from '../services/api';
import '../styles/variables.css';

function ReservationRequirements({ 
  requirements, 
  onRequirementsChange
}) {
  const { tags } = useTags();
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Cargar habitaciones al montar el componente
  useEffect(() => {
    const loadRooms = async () => {
      setLoadingRooms(true);
      try {
        const roomsData = await fetchRooms();
        setRooms(roomsData);
      } catch (error) {
        console.error('Error cargando habitaciones:', error);
      } finally {
        setLoadingRooms(false);
      }
    };
    loadRooms();
  }, []);

  // Filtrar habitaciones por capacidad mínima
  const filteredRooms = rooms.filter(room => 
    room.maxPeople >= (requirements.requiredGuests || 1)
  );

  const handleGuestsChange = (guests) => {
    const newRequirements = {
      ...requirements,
      requiredGuests: parseInt(guests) || 1,
      requiredRoomId: null // Reset habitación específica al cambiar cantidad de huéspedes
    };
    onRequirementsChange(newRequirements);
  };

  const handleTagToggle = (tagId) => {
    const newTags = requirements.requiredTags.includes(tagId)
      ? requirements.requiredTags.filter(id => id !== tagId)
      : [...requirements.requiredTags, tagId];
    
    onRequirementsChange({
      ...requirements,
      requiredTags: newTags,
      requiredRoomId: null // Reset habitación específica al cambiar etiquetas
    });
  };

  const handleRoomChange = (roomId) => {
    const selectedRoomId = roomId === '' ? null : parseInt(roomId);
    onRequirementsChange({
      ...requirements,
      requiredRoomId: selectedRoomId,
      requiredTags: selectedRoomId ? [] : requirements.requiredTags // Reset etiquetas al seleccionar habitación específica, mantener si es "No"
    });
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-bg)',
      padding: '20px',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      marginBottom: '20px'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        color: 'var(--color-text-main)',
        fontSize: 'var(--font-size-large)',
        fontWeight: '600'
      }}>
        Requerimientos de la Reserva
      </h3>

      {/* Cantidad de Huéspedes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-medium)'
        }}>
          Cantidad de Huéspedes *:
        </label>
        <select
          value={requirements.requiredGuests || 1}
          onChange={(e) => handleGuestsChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: 'var(--font-size-medium)',
            backgroundColor: 'var(--color-bg-white)'
          }}
        >
          <option value={1}>1 huésped</option>
          <option value={2}>2 huéspedes</option>
          <option value={3}>3 huéspedes</option>
          <option value={4}>4 huéspedes</option>
          <option value={5}>5 huéspedes</option>
          <option value={6}>6 huéspedes</option>
          <option value={7}>7 huéspedes</option>
          <option value={8}>8 huéspedes</option>
        </select>
      </div>

      {/* Habitación Específica */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-medium)'
        }}>
          Habitación Específica:
        </label>
        <select
          value={requirements.requiredRoomId || ''}
          onChange={(e) => handleRoomChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: 'var(--font-size-medium)',
            backgroundColor: 'var(--color-bg-white)'
          }}
        >
          <option value="">No</option>
          {loadingRooms ? (
            <option disabled>Cargando habitaciones...</option>
          ) : (
            filteredRooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name} - {room.roomType?.name} (Capacidad: {room.maxPeople})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Requerimientos */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-medium)',
          opacity: requirements.requiredRoomId ? 0.5 : 1
        }}>
          Requerimientos:
        </label>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          opacity: requirements.requiredRoomId ? 0.5 : 1,
          pointerEvents: requirements.requiredRoomId ? 'none' : 'auto'
        }}>
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagToggle(tag.id.toString())}
              disabled={!!requirements.requiredRoomId}
              style={{
                padding: '8px 12px',
                border: requirements.requiredTags.includes(tag.id.toString())
                  ? '2px solid var(--color-primary)'
                  : '1px solid var(--color-border)',
                borderRadius: '16px',
                backgroundColor: requirements.requiredTags.includes(tag.id.toString())
                  ? tag.color
                  : 'var(--color-bg-white)',
                color: requirements.requiredTags.includes(tag.id.toString())
                  ? 'var(--color-text-light)'
                  : 'var(--color-text-main)',
                cursor: requirements.requiredRoomId ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-medium)',
                transition: 'all 0.2s'
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Notas de Requerimientos */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-medium)'
        }}>
          Notas Adicionales:
        </label>
        <textarea
          value={requirements.requirementsNotes || ''}
          onChange={(e) => onRequirementsChange({
            ...requirements,
            requirementsNotes: e.target.value
          })}
          placeholder="Notas adicionales sobre los requerimientos..."
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: 'var(--font-size-medium)',
            backgroundColor: 'var(--color-bg-white)',
            minHeight: '80px',
            resize: 'vertical'
          }}
        />
      </div>
    </div>
  );
}

export default ReservationRequirements; 