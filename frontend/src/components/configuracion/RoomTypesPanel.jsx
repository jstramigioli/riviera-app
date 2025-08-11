import React, { useState, useEffect } from 'react';
import { fetchRoomTypes, createRoomType, updateRoomType, deleteRoomType, updateRoomTypesOrder } from '../../services/api';

const RoomTypesPanel = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    name: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Estados para drag and drop
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadRoomTypes();
  }, []);

  const loadRoomTypes = async () => {
    try {
      setLoading(true);
      const data = await fetchRoomTypes();
      setRoomTypes(data);
    } catch (error) {
      console.error('Error cargando tipos de habitaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (roomType) => {
    setEditingType(roomType.id);
    setEditForm({
      name: roomType.name,
      description: roomType.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingType(null);
    setEditForm({});
  };

  const handleSaveEdit = async (typeId) => {
    try {
      const updatedType = await updateRoomType(typeId, editForm);
      setRoomTypes(prev => prev.map(type => 
        type.id === typeId ? updatedType : type
      ));
      setEditingType(null);
      setEditForm({});
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new CustomEvent('roomTypesUpdated', {
        detail: { action: 'update', roomType: updatedType }
      }));
    } catch (error) {
      console.error('Error actualizando tipo de habitación:', error);
      alert('Error al actualizar el tipo de habitación');
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewTypeInputChange = (field, value) => {
    setNewTypeForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddType = () => {
    setShowAddModal(true);
    setNewTypeForm({
      name: '',
      description: ''
    });
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewTypeForm({
      name: '',
      description: ''
    });
  };

  const handleSaveNewType = async () => {
    if (!newTypeForm.name.trim()) {
      alert('El nombre del tipo de habitación es obligatorio');
      return;
    }

    try {
      setSaving(true);
      const newType = await createRoomType(newTypeForm);
      setRoomTypes(prev => [...prev, newType]);
      setShowAddModal(false);
      setNewTypeForm({
        name: '',
        description: '',
        multiplier: 1.0
      });
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new CustomEvent('roomTypesUpdated', {
        detail: { action: 'create', roomType: newType }
      }));
    } catch (error) {
      console.error('Error creando tipo de habitación:', error);
      alert('Error al crear el tipo de habitación');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (roomType) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar el tipo "${roomType.name}"?\n\nEsta acción no se puede deshacer y puede afectar a las habitaciones existentes.`
    );

    if (!confirmDelete) return;

    try {
      await deleteRoomType(roomType.id);
      setRoomTypes(prev => prev.filter(type => type.id !== roomType.id));
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new CustomEvent('roomTypesUpdated', {
        detail: { action: 'delete', roomType: roomType }
      }));
    } catch (error) {
      console.error('Error eliminando tipo de habitación:', error);
      alert('Error al eliminar el tipo de habitación');
    }
  };

  const getRoomTypeCapacity = (name) => {
    const capacityMap = {
      'single': 1,
      'doble': 2,
      'triple': 3,
      'cuadruple': 4,
      'quintuple': 5,
      'sextuple': 6,
      'departamento El Romerito': 4,
      'departamento El Tilo': 4,
      'departamento Via 1': 4,
      'departamento La Esquinita': 4
    };
    return capacityMap[name] || 1;
  };

  const getRoomTypeLabel = (name) => {
    const labelMap = {
      'single': 'Individual',
      'doble': 'Doble',
      'triple': 'Triple',
      'cuadruple': 'Cuádruple',
      'quintuple': 'Quíntuple',
      'sextuple': 'Séxtuple',
      'departamento El Romerito': 'Departamento El Romerito',
      'departamento El Tilo': 'Departamento El Tilo',
      'departamento Via 1': 'Departamento Via 1',
      'departamento La Esquinita': 'Departamento La Esquinita'
    };
    return labelMap[name] || name;
  };

  // Funciones de drag and drop
  const handleDragStart = (e, roomType) => {
    setDraggedItem(roomType);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  };

  const handleDragOver = (e, roomType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(roomType);
  };

  const handleDragEnter = (e, roomType) => {
    e.preventDefault();
    setDragOverItem(roomType);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e, targetRoomType) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetRoomType.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      setIsDragging(false);
      return;
    }

    // Reordenar los tipos de habitación
    const draggedIndex = roomTypes.findIndex(rt => rt.id === draggedItem.id);
    const targetIndex = roomTypes.findIndex(rt => rt.id === targetRoomType.id);
    
    const newRoomTypes = [...roomTypes];
    const [removed] = newRoomTypes.splice(draggedIndex, 1);
    newRoomTypes.splice(targetIndex, 0, removed);
    
    // Actualizar el estado local inmediatamente
    setRoomTypes(newRoomTypes);
    
    // Obtener los IDs en el nuevo orden
    const roomTypeIds = newRoomTypes.map(rt => rt.id);
    
    try {
      // Actualizar el orden en el servidor
      await updateRoomTypesOrder(roomTypeIds);
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new CustomEvent('roomTypesUpdated', {
        detail: { action: 'reorder', roomTypes: newRoomTypes }
      }));
    } catch (error) {
      console.error('Error actualizando orden de tipos de habitación:', error);
      alert('Error al actualizar el orden de los tipos de habitación');
      // Revertir cambios si hay error
      await loadRoomTypes();
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragging(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontSize: 'var(--font-size-large)' }}>
        <div>Cargando tipos de habitaciones...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        borderBottom: '2px solid var(--color-border)',
        marginBottom: '24px',
        paddingBottom: '16px'
      }}>
        <h3 style={{ 
          margin: '0', 
          color: 'var(--color-text-main)', 
          fontSize: 'var(--font-size-large)',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🛏️</span>
          Tipos de Habitaciones
        </h3>
        <p style={{ 
          margin: '8px 0 0 0', 
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-medium)'
        }}>
          Gestiona los tipos de habitaciones disponibles
        </p>
      </div>

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
                Capacidad
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
            <tr style={{ backgroundColor: 'var(--color-bg-light)' }}>
              <td colSpan="4" style={{ 
                padding: '8px 16px', 
                textAlign: 'center',
                fontSize: 'var(--font-size-small)',
                color: 'var(--color-text-muted)',
                fontStyle: 'italic'
              }}>
                💡 Arrastra las filas para reordenar los tipos de habitación
              </td>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map(roomType => (
              <tr
                key={roomType.id}
                style={{
                  borderBottom: '1px solid var(--color-border-light)',
                  backgroundColor: isDragging && draggedItem?.id === roomType.id 
                    ? 'var(--color-bg-light)' 
                    : dragOverItem?.id === roomType.id 
                      ? 'var(--color-primary-light)' 
                      : 'transparent',
                  opacity: isDragging && draggedItem?.id === roomType.id ? 0.5 : 1,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transition: 'all 0.2s ease'
                }}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, roomType)}
                onDragOver={(e) => handleDragOver(e, roomType)}
                onDragEnter={(e) => handleDragEnter(e, roomType)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, roomType)}
                onDragEnd={() => {
                  setIsDragging(false);
                  setDraggedItem(null);
                  setDragOverItem(null);
                }}
              >
                <td style={{ padding: '16px' }}>
                  {editingType === roomType.id ? (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        cursor: 'grab',
                        fontSize: '16px',
                        color: 'var(--color-text-muted)',
                        userSelect: 'none'
                      }}>
                        ⋮⋮
                      </span>
                      <strong style={{ fontSize: 'var(--font-size-medium)' }}>
                        {getRoomTypeLabel(roomType.name)}
                      </strong>
                    </div>
                  )}
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: 'var(--font-size-medium)',
                    fontWeight: '500'
                  }}>
                    {getRoomTypeCapacity(roomType.name)} personas
                  </span>
                </td>

                <td style={{ padding: '16px' }}>
                  {editingType === roomType.id ? (
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
                        minHeight: '60px'
                      }}
                      placeholder="Descripción del tipo..."
                    />
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-medium)' }}>
                      {roomType.description || 'Sin descripción'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  {editingType === roomType.id ? (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleSaveEdit(roomType.id)}
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
                        onClick={() => handleEdit(roomType)}
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
                        onClick={() => handleDeleteType(roomType)}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Botón de agregar tipo de habitación */}
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
          onClick={handleAddType}
        >
          + Agregar Tipo de Habitación
        </button>
      </div>

      {/* Modal para agregar nuevo tipo de habitación */}
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
                Agregar Nuevo Tipo de Habitación
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
              {/* Nombre del tipo */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: 'var(--color-text-main)'
                }}>
                  Nombre del Tipo *
                </label>
                <input
                  type="text"
                  value={newTypeForm.name}
                  onChange={(e) => handleNewTypeInputChange('name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-medium)',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ej: single, doble, triple..."
                />
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
                  value={newTypeForm.description}
                  onChange={(e) => handleNewTypeInputChange('description', e.target.value)}
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
                  placeholder="Descripción del tipo de habitación..."
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
                  onClick={handleSaveNewType}
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
};

export default RoomTypesPanel; 