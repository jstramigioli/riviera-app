import React, { useState, useEffect } from 'react';
import { fetchRooms, fetchRoomTypes, updateRoomOnServer, createRoom, deleteRoom } from '../../services/api';
import { getRoomTypeCapacity, getRoomTypeLabel } from '../../utils/roomTypeUtils';
import { defaultBedsForCapacity, formatBedsSummary, validateBedsAgainstCapacity } from '../../utils/bedConfig';
import { useTags } from '../../hooks/useTags';
import RoomTypesPanel from './RoomTypesPanel';
import EtiquetasTab from './EtiquetasTab';
import VirtualRoomsPanel from './VirtualRoomsPanel';
import RoomBedsEditor from './RoomBedsEditor';
import '../../styles/variables.css';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';

function HabitacionesTab() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
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
    tagIds: [],
    beds: []
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
    const capacity = room.maxPeople || getRoomTypeById(room.roomTypeId)?.maxPeople || 1;
    setEditForm({
      name: room.name,
      description: room.description || '',
      roomTypeId: room.roomTypeId,
      tagIds: room.tags ? room.tags.map(tag => tag.id) : [],
      beds: Array.isArray(room.beds) && room.beds.length > 0
        ? room.beds.map((b, i) => ({
            id: b.id,
            bedType: b.bedType,
            isSeparable: Boolean(b.isSeparable),
            orderIndex: b.orderIndex ?? i
          }))
        : defaultBedsForCapacity(capacity)
    });
  };

  const handleCancelEdit = () => {
    setEditingRoom(null);
    setEditForm({});
  };

  const handleSaveEdit = async (roomId) => {
    const roomType = getRoomTypeById(editForm.roomTypeId);
    const maxPeople = roomType?.maxPeople || 1;
    const bedsCheck = validateBedsAgainstCapacity(editForm.beds || [], maxPeople);
    if (!bedsCheck.ok) {
      notify({ title: 'Validación', message: bedsCheck.message, type: 'warning' });
      return;
    }
    try {
      const updatedRoom = await updateRoomOnServer(roomId, editForm);
      setRooms(prev => prev.map(room => 
        room.id === roomId ? updatedRoom : room
      ));
      setEditingRoom(null);
      setEditForm({});
    } catch (error) {
      console.error('Error actualizando habitación:', error);
      notify({ title: 'Error', message: error.message || 'Error al actualizar la habitación', type: 'error' });
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'roomTypeId') {
        const type = roomTypes.find(t => t.id === Number(value));
        const maxPeople = type?.maxPeople || 1;
        const current = prev.beds || [];
        const check = validateBedsAgainstCapacity(current, maxPeople);
        if (!check.ok || current.length === 0) {
          next.beds = defaultBedsForCapacity(maxPeople);
        }
      }
      return next;
    });
  };

  const handleNewRoomInputChange = (field, value) => {
    setNewRoomForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'roomTypeId') {
        const type = roomTypes.find(t => t.id === Number(value));
        next.beds = defaultBedsForCapacity(type?.maxPeople || 1);
      }
      return next;
    });
  };

  const handleAddRoom = () => {
    setShowAddModal(true);
    const initialTypeId = roomTypes.length > 0 ? roomTypes[0].id : '';
    const maxPeople = roomTypes.find(t => t.id === initialTypeId)?.maxPeople || 1;
    setNewRoomForm({
      name: '',
      description: '',
      roomTypeId: initialTypeId,
      tagIds: [],
      beds: defaultBedsForCapacity(maxPeople)
    });
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewRoomForm({
      name: '',
      description: '',
      roomTypeId: '',
      tagIds: [],
      beds: []
    });
  };

  const handleSaveNewRoom = async () => {
    if (!newRoomForm.name.trim() || !newRoomForm.roomTypeId) {
      notify({ title: 'Validación', message: 'El nombre y tipo de habitación son obligatorios', type: 'warning' });
      return;
    }
    const roomType = getRoomTypeById(newRoomForm.roomTypeId);
    const maxPeople = roomType?.maxPeople || 1;
    const bedsCheck = validateBedsAgainstCapacity(newRoomForm.beds || [], maxPeople);
    if (!bedsCheck.ok) {
      notify({ title: 'Validación', message: bedsCheck.message, type: 'warning' });
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
        tagIds: [],
        beds: []
      });
    } catch (error) {
      console.error('Error creando habitación:', error);
      notify({ title: 'Error', message: error.message || 'Error al crear la habitación', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (room) => {
    const ok = await confirm({
      title: 'Eliminar habitación',
      message: `¿Confirmás eliminar la habitación "${room.name}"?\n\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    try {
      await deleteRoom(room.id);
      setRooms(prev => prev.filter(r => r.id !== room.id));
    } catch (error) {
      console.error('Error eliminando habitación:', error);
      notify({ title: 'Error', message: 'No se pudo eliminar la habitación.', type: 'error' });
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
      return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}> Sin etiquetas</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {roomTags.map(tag => (
          <span
            key={tag.id}
            style={{
              padding: '2px 6px',
              backgroundColor: tag.color || 'var(--color-primary)',
              color: 'var(--color-text-light)',
              borderRadius: '8px',
              fontSize: '0.8rem',
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => handleTagToggle(tag.id)}
            style={{
              padding: '2px 6px',
              backgroundColor: selectedTagIds.includes(tag.id) 
                ? (tag.color || 'var(--color-primary)') 
                : 'var(--color-bg)',
              color: selectedTagIds.includes(tag.id) ? 'var(--color-text-light)' : 'var(--color-text-main)',
              border: `1px solid ${tag.color || 'var(--color-primary)'}`,
              borderRadius: '8px',
              fontSize: '0.8rem',
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
        <div> Cargando habitaciones...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '0'
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
          padding: '20px 20px 0 20px',
          borderBottom: '2px solid #e9ecef'
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            color: '#2c3e50', 
            fontSize: 'var(--font-size-base)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            Habitaciones
          </h2>
        </div>
        
        <div style={{ 
          padding: '20px'
        }}>
          <div style={{ 
            overflowX: 'auto',
            overflowY: 'visible',
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
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Habitación
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Tipo
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Camas
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Etiquetas
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Descripción
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
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
                      <td style={{ padding: '12px' }}>
                        {editingRoom === room.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-small)'
                            }}
                          />
                        ) : (
                          <strong style={{ fontSize: 'var(--font-size-small)' }}>{room.name}</strong>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingRoom === room.id ? (
                          <select
                            value={editForm.roomTypeId}
                            onChange={(e) => handleInputChange('roomTypeId', parseInt(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-small)'
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
                            padding: '4px 8px',
                            backgroundColor: 'var(--color-bg)',
                            color: 'var(--color-text-main)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            fontSize: 'var(--font-size-small)',
                            fontWeight: '500'
                          }}>
                            {roomType ? getRoomTypeLabel(roomType.name) : 'Sin tipo'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', minWidth: '220px' }}>
                        {editingRoom === room.id ? (
                          <RoomBedsEditor
                            beds={editForm.beds || []}
                            maxPeople={getRoomTypeById(editForm.roomTypeId)?.maxPeople || room.maxPeople || 1}
                            onChange={(beds) => handleInputChange('beds', beds)}
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>
                            {formatBedsSummary(room.beds)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingRoom === room.id ? (
                          renderTagSelector(editForm.tagIds)
                        ) : (
                          renderTags(room.tags)
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingRoom === room.id ? (
                          <textarea
                            value={editForm.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-small)',
                              resize: 'vertical',
                              minHeight: '60px'
                            }}
                            placeholder="Descripción de la habitación..."
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>
                            {room.description || 'Sin descripción'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {editingRoom === room.id ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleSaveEdit(room.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'var(--color-success)',
                                color: 'var(--color-text-light)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-small)'
                              }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'var(--color-text-muted)',
                                color: 'var(--color-text-light)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-small)'
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
                                padding: '6px 12px',
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text-light)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-small)'
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteRoom(room)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'var(--color-danger)',
                                color: 'var(--color-text-light)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-small)'
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
                padding: '12px 24px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-light)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: '500'
              }}
              onClick={handleAddRoom}
            >
              + Agregar Habitación
            </button>
          </div>
        </div>
      </div>

      {/* Panel de Habitaciones Virtuales */}
      <VirtualRoomsPanel />

      {/* Contenedor para Etiquetas y Tipos de Habitaciones */}
      <div style={{ 
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Panel de Etiquetas */}
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          flex: '1',
          minWidth: '350px',
          maxWidth: '500px'
        }}>
          <div style={{ 
            padding: '20px 20px 0 20px',
            borderBottom: '2px solid #e9ecef'
          }}>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              color: '#2c3e50', 
              fontSize: 'var(--font-size-base)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Etiquetas
            </h2>
          </div>
          
          <div style={{ 
            padding: '20px'
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
          minWidth: '500px'
        }}>
          <div style={{ 
            padding: '20px'
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
                fontSize: 'var(--font-size-base)',
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
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
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
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Nombre de la habitación"
                />
              </div>

              {/* Tipo de habitación */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
                }}>
                  Tipo de Habitación *
                </label>
                <select
                  value={newRoomForm.roomTypeId}
                  onChange={(e) => handleNewRoomInputChange('roomTypeId', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value=""> Seleccionar tipo...</option>
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
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
                }}>
                  Descripción
                </label>
                <textarea
                  value={newRoomForm.description}
                  onChange={(e) => handleNewRoomInputChange('description', e.target.value)}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Descripción de la habitación..."
                />
              </div>

              {/* Camas */}
              <RoomBedsEditor
                beds={newRoomForm.beds || []}
                maxPeople={getRoomTypeById(newRoomForm.roomTypeId)?.maxPeople || 1}
                onChange={(beds) => handleNewRoomInputChange('beds', beds)}
              />

              {/* Etiquetas */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
                }}>
                  Etiquetas
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleNewRoomTagToggle(tag.id)}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: newRoomForm.tagIds.includes(tag.id) 
                          ? (tag.color || 'var(--color-primary)') 
                          : 'var(--color-bg)',
                        color: newRoomForm.tagIds.includes(tag.id) ? 'var(--color-text-light)' : 'var(--color-text-main)',
                        border: `1px solid ${tag.color || 'var(--color-primary)'}`,
                        borderRadius: '8px',
                        fontSize: '0.8rem',
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
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-text-muted)',
                    color: 'var(--color-text-light)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-small)'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNewRoom}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: saving ? 'var(--color-text-muted)' : 'var(--color-success)',
                    color: 'var(--color-text-light)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 'var(--font-size-small)'
                  }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
      {noticeDialog}
    </div>
  );
}

export default HabitacionesTab; 