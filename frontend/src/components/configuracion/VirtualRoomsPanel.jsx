import React, { useState, useEffect } from 'react';
import { fetchVirtualRooms, fetchRooms, fetchRoomTypes, createVirtualRoom, updateVirtualRoom, deleteVirtualRoom } from '../../services/api';
import { getRoomTypeCapacity, getRoomTypeLabel } from '../../utils/roomTypeUtils';

function VirtualRoomsPanel() {
  const [virtualRooms, setVirtualRooms] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingVirtualRoom, setEditingVirtualRoom] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVirtualRoomForm, setNewVirtualRoomForm] = useState({
    name: '',
    description: '',
    roomTypeId: '',
    componentRoomIds: []
  });
  const [saving, setSaving] = useState(false);
  const [componentInputs, setComponentInputs] = useState([{ id: 1, roomId: '' }]); // Para inputs dinámicos

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [virtualRoomsData, roomsData, roomTypesData] = await Promise.all([
        fetchVirtualRooms(),
        fetchRooms(),
        fetchRoomTypes()
      ]);
      setVirtualRooms(virtualRoomsData);
      setRooms(roomsData);
      setRoomTypes(roomTypesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (virtualRoom) => {
    setEditingVirtualRoom(virtualRoom.id);
    setEditForm({
      name: virtualRoom.name,
      description: virtualRoom.description || '',
      roomTypeId: virtualRoom.roomTypeId,
      componentRoomIds: virtualRoom.components ? virtualRoom.components.map(comp => comp.roomId) : []
    });
  };

  const handleCancelEdit = () => {
    setEditingVirtualRoom(null);
    setEditForm({});
  };

  const handleSaveEdit = async (virtualRoomId) => {
    try {
      const updatedVirtualRoom = await updateVirtualRoom(virtualRoomId, editForm);
      setVirtualRooms(prev => prev.map(vr => 
        vr.id === virtualRoomId ? updatedVirtualRoom : vr
      ));
      setEditingVirtualRoom(null);
      setEditForm({});
    } catch (error) {
      console.error('Error actualizando habitación virtual:', error);
      alert('Error al actualizar la habitación virtual');
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewVirtualRoomInputChange = (field, value) => {
    setNewVirtualRoomForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddVirtualRoom = () => {
    setShowAddModal(true);
    setNewVirtualRoomForm({
      name: '',
      description: '',
      roomTypeId: roomTypes.length > 0 ? roomTypes[0].id : '',
      componentRoomIds: []
    });
    setComponentInputs([{ id: 1, roomId: '' }]); // Reiniciar inputs dinámicos
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewVirtualRoomForm({
      name: '',
      description: '',
      roomTypeId: '',
      componentRoomIds: []
    });
    setComponentInputs([{ id: 1, roomId: '' }]); // Reiniciar inputs dinámicos
  };

  const handleSaveNewVirtualRoom = async () => {
    if (!newVirtualRoomForm.name.trim() || !newVirtualRoomForm.roomTypeId || newVirtualRoomForm.componentRoomIds.length === 0) {
      alert('El nombre, tipo de habitación asignado y al menos una habitación componente son obligatorios');
      return;
    }

    try {
      setSaving(true);
      const newVirtualRoom = await createVirtualRoom(newVirtualRoomForm);
      setVirtualRooms(prev => [...prev, newVirtualRoom]);
      setShowAddModal(false);
      setNewVirtualRoomForm({
        name: '',
        description: '',
        roomTypeId: '',
        componentRoomIds: []
      });
      setComponentInputs([{ id: 1, roomId: '' }]); // Reiniciar inputs dinámicos
    } catch (error) {
      console.error('Error creando habitación virtual:', error);
      alert('Error al crear la habitación virtual');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVirtualRoom = async (virtualRoom) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar la habitación virtual "${virtualRoom.name}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      await deleteVirtualRoom(virtualRoom.id);
      setVirtualRooms(prev => prev.filter(vr => vr.id !== virtualRoom.id));
    } catch (error) {
      console.error('Error eliminando habitación virtual:', error);
      alert('Error al eliminar la habitación virtual');
    }
  };

  const handleComponentRoomToggle = (roomId) => {
    setEditForm(prev => {
      const currentRoomIds = prev.componentRoomIds || [];
      const newRoomIds = currentRoomIds.includes(roomId)
        ? currentRoomIds.filter(id => id !== roomId)
        : [...currentRoomIds, roomId];
      
      return {
        ...prev,
        componentRoomIds: newRoomIds
      };
    });
  };

  // Funciones para manejar inputs dinámicos de habitaciones componentes
  const addComponentInput = () => {
    const newId = Math.max(...componentInputs.map(input => input.id), 0) + 1;
    setComponentInputs(prev => [...prev, { id: newId, roomId: '' }]);
  };

  const removeComponentInput = (id) => {
    if (componentInputs.length > 1) {
      setComponentInputs(prev => prev.filter(input => input.id !== id));
      // También remover de componentRoomIds si existe
      setNewVirtualRoomForm(prev => {
        const removedInput = componentInputs.find(input => input.id === id);
        if (removedInput && removedInput.roomId) {
          return {
            ...prev,
            componentRoomIds: prev.componentRoomIds.filter(roomId => roomId !== parseInt(removedInput.roomId))
          };
        }
        return prev;
      });
    }
  };

  const updateComponentInput = (id, roomId) => {
    setComponentInputs(prev => 
      prev.map(input => 
        input.id === id ? { ...input, roomId } : input
      )
    );

    // Actualizar componentRoomIds
    setNewVirtualRoomForm(prev => {
      const oldInput = componentInputs.find(input => input.id === id);
      let newComponentRoomIds = [...prev.componentRoomIds];

      // Remover el valor anterior si existe
      if (oldInput && oldInput.roomId) {
        newComponentRoomIds = newComponentRoomIds.filter(roomId => roomId !== parseInt(oldInput.roomId));
      }

      // Agregar el nuevo valor si existe
      if (roomId) {
        newComponentRoomIds.push(parseInt(roomId));
      }

      return {
        ...prev,
        componentRoomIds: newComponentRoomIds
      };
    });
  };

  const getRoomTypeById = (roomTypeId) => {
    return roomTypes.find(type => type.id === roomTypeId);
  };

  const getRoomById = (roomId) => {
    return rooms.find(room => room.id === roomId);
  };

  const renderComponentRooms = (components) => {
    if (!components || components.length === 0) {
      return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Sin habitaciones</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {components.map(component => {
          const room = getRoomById(component.roomId);
          return (
            <span
              key={component.roomId}
              style={{
                padding: '2px 6px',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-light)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '500'
              }}
            >
              {room ? room.name : `Hab ${component.roomId}`}
            </span>
          );
        })}
      </div>
    );
  };

  const renderComponentRoomSelector = (selectedRoomIds = []) => {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => handleComponentRoomToggle(room.id)}
            style={{
              padding: '2px 6px',
              backgroundColor: selectedRoomIds.includes(room.id) 
                ? 'var(--color-primary)' 
                : 'var(--color-bg)',
              color: selectedRoomIds.includes(room.id) ? 'var(--color-text-light)' : 'var(--color-text-main)',
              border: '1px solid var(--color-primary)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {room.name}
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontSize: 'var(--font-size-large)' }}>
        <div>Cargando habitaciones virtuales...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Panel de Habitaciones Virtuales */}
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
            <span>🏗️</span>
            Habitaciones Virtuales
          </h2>
          <p style={{ 
            margin: '0 0 16px 0', 
            color: '#6c757d', 
            fontSize: 'var(--font-size-small)'
          }}>
            Configure habitaciones conectables que combinan múltiples habitaciones físicas. 
            El tipo de habitación asignado determina la capacidad y tarifa de la habitación virtual.
          </p>
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
                    Habitación Virtual
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Tipo de Habitación Asignado
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '2px solid var(--color-border)',
                    fontWeight: '600',
                    color: 'var(--color-text-main)',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Habitaciones Componentes
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
                {virtualRooms.map(virtualRoom => {
                  const roomType = getRoomTypeById(virtualRoom.roomTypeId);
                  
                  return (
                    <tr key={virtualRoom.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '12px' }}>
                        {editingVirtualRoom === virtualRoom.id ? (
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
                          <strong style={{ fontSize: 'var(--font-size-small)' }}>{virtualRoom.name}</strong>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingVirtualRoom === virtualRoom.id ? (
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
                      <td style={{ padding: '12px' }}>
                        {editingVirtualRoom === virtualRoom.id ? (
                          renderComponentRoomSelector(editForm.componentRoomIds)
                        ) : (
                          renderComponentRooms(virtualRoom.components)
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {editingVirtualRoom === virtualRoom.id ? (
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
                            placeholder="Descripción de la habitación virtual..."
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>
                            {virtualRoom.description || 'Sin descripción'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {editingVirtualRoom === virtualRoom.id ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleSaveEdit(virtualRoom.id)}
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
                              onClick={() => handleEdit(virtualRoom)}
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
                              onClick={() => handleDeleteVirtualRoom(virtualRoom)}
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

          {/* Botón de agregar habitación virtual */}
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
              onClick={handleAddVirtualRoom}
            >
              + Agregar Habitación Virtual
            </button>
          </div>
        </div>
      </div>

      {/* Modal para agregar nueva habitación virtual */}
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
            maxWidth: '600px',
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
                Agregar Nueva Habitación Virtual
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
              {/* Nombre de la habitación virtual */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
                }}>
                  Nombre de la Habitación Virtual *
                </label>
                <input
                  type="text"
                  name="name"
                  value={newVirtualRoomForm.name}
                  onChange={(e) => handleNewVirtualRoomInputChange('name', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ej: Suite Conectable"
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
                  Tipo de Habitación Asignado *
                </label>
                <p style={{
                  margin: '0 0 8px 0',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.8rem'
                }}>
                  Determina la capacidad y tarifa de la habitación virtual
                </p>
                <select
                  value={newVirtualRoomForm.roomTypeId}
                  onChange={(e) => handleNewVirtualRoomInputChange('roomTypeId', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)',
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

              {/* Habitaciones componentes */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)',
                  fontSize: 'var(--font-size-small)'
                }}>
                  Habitaciones Componentes *
                </label>
                <p style={{
                  margin: '0 0 8px 0',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.8rem'
                }}>
                  Selecciona las habitaciones físicas que formarán esta habitación virtual
                </p>
                
                {/* Inputs dinámicos para habitaciones componentes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {componentInputs.map((input) => (
                    <div key={input.id} style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      alignItems: 'center' 
                    }}>
                      <select
                        value={input.roomId}
                        onChange={(e) => updateComponentInput(input.id, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: 'var(--font-size-small)',
                          backgroundColor: 'var(--color-bg-white)'
                        }}
                      >
                        <option value="">Seleccionar habitación...</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name} ({getRoomTypeLabel(getRoomTypeById(room.roomTypeId)?.name || '')})
                          </option>
                        ))}
                      </select>
                      
                      {componentInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeComponentInput(input.id)}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: 'var(--color-danger)',
                            color: 'var(--color-text-light)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-small)',
                            minWidth: '32px'
                          }}
                          title="Eliminar habitación"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addComponentInput}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-light)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-small)',
                        alignSelf: 'flex-start'
                      }}
                  >
                    + Agregar Habitación
                  </button>
                </div>
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
                  value={newVirtualRoomForm.description}
                  onChange={(e) => handleNewVirtualRoomInputChange('description', e.target.value)}
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
                  placeholder="Descripción de la habitación virtual..."
                />
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
                  onClick={handleSaveNewVirtualRoom}
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
    </div>
  );
}

export default VirtualRoomsPanel; 