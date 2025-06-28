import React, { useState, useEffect } from 'react';
import { fetchRooms, fetchRoomTypes, updateRoomOnServer } from '../../services/api';
import { getRoomTypeCapacity, getRoomTypeLabel } from '../../utils/roomTypeUtils';
import { useTags } from '../../hooks/useTags';
import '../../styles/variables.css';

function HabitacionesTab() {
  const { tags } = useTags();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomsData, roomTypesData] = await Promise.all([
        fetchRooms(),
        fetchRoomTypes()
      ]);
      setRooms(roomsData);
      setRoomTypes(roomTypesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room.id);
    setEditForm({
      name: room.name,
      description: room.description || '',
      roomTypeId: room.roomTypeId,
      tagIds: room.tags ? room.tags.map(tag => tag.id) : []
    });
  };

  const handleCancelEdit = () => {
    setEditingRoom(null);
    setEditForm({});
  };

  const handleSaveEdit = async (roomId) => {
    try {
      const updatedRoom = await updateRoomOnServer(roomId, editForm);
      setRooms(prev => prev.map(room => 
        room.id === roomId ? updatedRoom : room
      ));
      setEditingRoom(null);
      setEditForm({});
    } catch (error) {
      console.error('Error actualizando habitación:', error);
      alert('Error al actualizar la habitación');
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagToggle = (tagId) => {
    setEditForm(prev => {
      const currentTagIds = prev.tagIds || [];
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter(id => id !== tagId)
        : [...currentTagIds, tagId];
      
      return {
        ...prev,
        tagIds: newTagIds
      };
    });
  };

  const getRoomTypeById = (roomTypeId) => {
    return roomTypes.find(type => type.id === roomTypeId);
  };

  const renderTags = (roomTags) => {
    if (!roomTags || roomTags.length === 0) {
      return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-medium)' }}>Sin etiquetas</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {roomTags.map(tag => (
          <span
            key={tag.id}
            style={{
              padding: '4px 8px',
              backgroundColor: tag.color || 'var(--color-primary)',
              color: 'var(--color-text-light)',
              borderRadius: '12px',
              fontSize: 'var(--font-size-small)',
              fontWeight: '500'
            }}
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
  };

  const renderTagSelector = (selectedTagIds = []) => {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => handleTagToggle(tag.id)}
            style={{
              padding: '4px 8px',
              backgroundColor: selectedTagIds.includes(tag.id) 
                ? (tag.color || 'var(--color-primary)') 
                : 'var(--color-bg)',
              color: selectedTagIds.includes(tag.id) ? 'var(--color-text-light)' : 'var(--color-text-main)',
              border: `1px solid ${tag.color || 'var(--color-primary)'}`,
              borderRadius: '12px',
              fontSize: 'var(--font-size-small)',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tag.name}
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontSize: 'var(--font-size-large)' }}>
        <div>Cargando habitaciones...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        overflowX: 'auto',
        overflowY: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: '8px'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'var(--color-bg-white)'
        }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left', 
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Habitación
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left', 
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Tipo
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left', 
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Etiquetas
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left', 
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Descripción
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(room => {
              const roomType = getRoomTypeById(room.roomTypeId);
              
              return (
                <tr key={room.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '16px' }}>
                    {editingRoom === room.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      />
                    ) : (
                      <strong style={{ fontSize: 'var(--font-size-medium)' }}>{room.name}</strong>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {editingRoom === room.id ? (
                      <select
                        value={editForm.roomTypeId}
                        onChange={(e) => handleInputChange('roomTypeId', parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        {roomTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {getRoomTypeLabel(type.name)} ({getRoomTypeCapacity(type.name)} personas)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        fontSize: 'var(--font-size-medium)',
                        fontWeight: '500'
                      }}>
                        {roomType ? getRoomTypeLabel(roomType.name) : 'Sin tipo'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {editingRoom === room.id ? (
                      renderTagSelector(editForm.tagIds)
                    ) : (
                      renderTags(room.tags)
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {editingRoom === room.id ? (
                      <textarea
                        value={editForm.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: 'var(--font-size-medium)',
                          resize: 'vertical',
                          minHeight: '80px'
                        }}
                        placeholder="Descripción de la habitación..."
                      />
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-medium)' }}>
                        {room.description || 'Sin descripción'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    {editingRoom === room.id ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleSaveEdit(room.id)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--color-success)',
                            color: 'var(--color-text-light)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-medium)'
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--color-text-muted)',
                            color: 'var(--color-text-light)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-medium)'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(room)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-light)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botón de agregar habitación al final */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        marginTop: '24px'
      }}>
        <button
          style={{
            padding: '16px 32px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-light)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: 'var(--font-size-large)',
            fontWeight: '500'
          }}
          onClick={() => alert('Funcionalidad de agregar habitación estará disponible próximamente')}
        >
          + Agregar Habitación
        </button>
      </div>
    </div>
  );
}

export default HabitacionesTab; 