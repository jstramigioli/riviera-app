import React, { useState, useEffect } from 'react';
import { fetchRooms, fetchRoomTypes, updateRoomOnServer, createRoom, deleteRoom } from '../../services/api';
import { getRoomTypeCapacity, getRoomTypeLabel } from '../../utils/roomTypeUtils';
import { useTags } from '../../hooks/useTags';
import RoomTypesPanel from './RoomTypesPanel';
import EtiquetasTab from './EtiquetasTab';
import '../../styles/variables.css';

function HabitacionesTab() {
  const { tags } = useTags();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({
    name: '',
    description: '',
    roomTypeId: '',
    tagIds: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Recargar datos cuando las etiquetas cambien
  useEffect(() => {
    loadData();
  }, [tags]);

  // Función para forzar actualización de datos
  const refreshData = () => {
    loadData();
  };

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

  const handleNewRoomInputChange = (field, value) => {
    setNewRoomForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddRoom = () => {
    setShowAddModal(true);
    setNewRoomForm({
      name: '',
      description: '',
      roomTypeId: roomTypes.length > 0 ? roomTypes[0].id : '',
      tagIds: []
    });
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewRoomForm({
      name: '',
      description: '',
      roomTypeId: '',
      tagIds: []
    });
  };

  const handleSaveNewRoom = async () => {
    if (!newRoomForm.name.trim() || !newRoomForm.roomTypeId) {
      alert('El nombre y tipo de habitación son obligatorios');
      return;
    }

    try {
      setSaving(true);
      const newRoom = await createRoom(newRoomForm);
      setRooms(prev => [...prev, newRoom]);
      setShowAddModal(false);
      setNewRoomForm({
        name: '',
        description: '',
        roomTypeId: '',
        tagIds: []
      });
    } catch (error) {
      console.error('Error creando habitación:', error);
      alert('Error al crear la habitación');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (room) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar la habitación "${room.name}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      await deleteRoom(room.id);
      setRooms(prev => prev.filter(r => r.id !== room.id));
    } catch (error) {
      console.error('Error eliminando habitación:', error);
      alert('Error al eliminar la habitación');
    }
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

  const handleNewRoomTagToggle = (tagId) => {
    setNewRoomForm(prev => {
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
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      minHeight: 'calc(100vh - 300px)'
    }}>
      {/* Panel de Habitaciones */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        minWidth: '800px'
      }}>
        <div style={{ 
          padding: '24px 24px 0 24px',
          borderBottom: '2px solid #e9ecef'
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            color: '#2c3e50', 
            fontSize: '1.5rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🏨</span>
            Habitaciones
          </h2>
        </div>
        
        <div style={{ 
          padding: '24px',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 400px)'
        }}>
          <div style={{ 
            overflowX: 'auto',
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
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
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
                            <button
                              onClick={() => handleDeleteRoom(room)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: 'var(--color-danger)',
                                color: 'var(--color-text-light)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-medium)'
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Botón de agregar habitación */}
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
              onClick={handleAddRoom}
            >
              + Agregar Habitación
            </button>
          </div>
        </div>
      </div>

      {/* Contenedor para Etiquetas y Tipos de Habitaciones */}
      <div style={{ 
        display: 'flex',
        gap: '32px',
        flexWrap: 'wrap'
      }}>
        {/* Panel de Etiquetas */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          flex: '1',
          minWidth: '400px'
        }}>
          <div style={{ 
            padding: '24px 24px 0 24px',
            borderBottom: '2px solid #e9ecef'
          }}>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              color: '#2c3e50', 
              fontSize: '1.5rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🏷️</span>
              Etiquetas
            </h2>
          </div>
          
          <div style={{ 
            padding: '24px',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 400px)'
          }}>
            <EtiquetasTab onDataChange={refreshData} />
          </div>
        </div>

        {/* Panel de Tipos de Habitaciones */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          flex: '2',
          minWidth: '600px'
        }}>
          <div style={{ 
            padding: '24px',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 400px)'
          }}>
            <RoomTypesPanel />
          </div>
        </div>
      </div>

      {/* Modal para agregar nueva habitación */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-white)',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              borderBottom: '2px solid var(--color-border)',
              paddingBottom: '16px'
            }}>
              <h3 style={{
                margin: 0,
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-large)',
                fontWeight: '600'
              }}>
                Agregar Nueva Habitación
              </h3>
              <button
                onClick={handleCancelAdd}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Nombre de la habitación */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)'
                }}>
                  Nombre de la Habitación *
                </label>
                <input
                  type="text"
                  name="name"
                  value={newRoomForm.name}
                  onChange={(e) => handleNewRoomInputChange('name', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-medium)',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Nombre de la habitación"
                />
              </div>

              {/* Tipo de habitación */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)'
                }}>
                  Tipo de Habitación *
                </label>
                <select
                  value={newRoomForm.roomTypeId}
                  onChange={(e) => handleNewRoomInputChange('roomTypeId', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-medium)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Seleccionar tipo...</option>
                  {roomTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {getRoomTypeLabel(type.name)} ({getRoomTypeCapacity(type.name)} personas)
                    </option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)'
                }}>
                  Descripción
                </label>
                <textarea
                  value={newRoomForm.description}
                  onChange={(e) => handleNewRoomInputChange('description', e.target.value)}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-medium)',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Descripción de la habitación..."
                />
              </div>

              {/* Etiquetas */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)'
                }}>
                  Etiquetas
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleNewRoomTagToggle(tag.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: newRoomForm.tagIds.includes(tag.id) 
                          ? (tag.color || 'var(--color-primary)') 
                          : 'var(--color-bg)',
                        color: newRoomForm.tagIds.includes(tag.id) ? 'var(--color-text-light)' : 'var(--color-text-main)',
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
              </div>

              {/* Botones de acción */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                marginTop: '20px'
              }}>
                <button
                  onClick={handleCancelAdd}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--color-text-muted)',
                    color: 'var(--color-text-light)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-medium)'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNewRoom}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: saving ? 'var(--color-text-muted)' : 'var(--color-success)',
                    color: 'var(--color-text-light)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--font-size-medium)'
                  }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HabitacionesTab; 