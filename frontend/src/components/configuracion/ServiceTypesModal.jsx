import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiEdit2, FiTrash2, FiSave } from 'react-icons/fi';
import styles from './ServiceTypesModal.module.css';

export default function ServiceTypesModal({ isOpen, onClose, onSave, serviceTypes, hotelId }) {
  const [localServiceTypes, setLocalServiceTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    if (isOpen) {
      setLocalServiceTypes([...serviceTypes]);
      setEditingId(null);
      setIsCreating(false);
      setError(null);
    }
  }, [isOpen, serviceTypes]);

  // Debug effect para monitorear cambios en el número de servicios
  useEffect(() => {
    console.log('🔍 useEffect - localServiceTypes cambió:', localServiceTypes.length);
    console.log('🔍 useEffect - Servicios:', localServiceTypes.map(st => st.name));
  }, [localServiceTypes]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingData({ name: '', description: '' });
    setError(null);
  };

  const handleStartEdit = (serviceType) => {
    setEditingId(serviceType.id);
    setEditingData({ 
      name: serviceType.name, 
      description: serviceType.description || '' 
    });
    setIsCreating(false);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditingData({ name: '', description: '' });
    setError(null);
  };

  const handleSaveCreate = async () => {
    if (!editingData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/service-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingData.name.trim(),
          description: editingData.description.trim() || null,
          hotelId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setLocalServiceTypes([...localServiceTypes, result.data]);
        setIsCreating(false);
        setEditingData({ name: '', description: '' });
        setError(null);
      } else {
        const result = await response.json();
        setError(result.errors?.[0] || 'Error al crear el tipo de servicio');
      }
    } catch (error) {
      console.error('Error creating service type:', error);
      setError('Error al crear el tipo de servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/service-types/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingData.name.trim(),
          description: editingData.description.trim() || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setLocalServiceTypes(localServiceTypes.map(st => 
          st.id === editingId ? result.data : st
        ));
        setEditingId(null);
        setEditingData({ name: '', description: '' });
        setError(null);
      } else {
        const result = await response.json();
        setError(result.errors?.[0] || 'Error al actualizar el tipo de servicio');
      }
    } catch (error) {
      console.error('Error updating service type:', error);
      setError('Error al actualizar el tipo de servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serviceType) => {
    // 🚨 VALIDACIÓN ADICIONAL: No permitir eliminar si solo queda 1 servicio
    if (localServiceTypes.length <= 1) {
      setError('No se puede eliminar el último tipo de servicio. Debe existir al menos un tipo de servicio.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar "${serviceType.name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/service-types/${serviceType.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setLocalServiceTypes(localServiceTypes.filter(st => st.id !== serviceType.id));
      } else {
        const result = await response.json();
        setError(result.errors?.[0] || 'Error al eliminar el tipo de servicio');
      }
    } catch (error) {
      console.error('Error deleting service type:', error);
      setError('Error al eliminar el tipo de servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onSave();
    onClose();
  };

  // Debug log
  console.log('🔍 ServiceTypesModal render - Total servicios:', localServiceTypes.length);
  console.log('🔍 ServiceTypesModal render - Servicios:', localServiceTypes.map(st => st.name));

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2>Gestión de Tipos de Servicio</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
          >
            <FiX />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          {/* Create Form */}
          {isCreating && (
            <div className={styles.editForm}>
              <div className={styles.formGroup}>
                <label>Nombre *</label>
                <input
                  type="text"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                  placeholder="Ej: Con Desayuno"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  value={editingData.description}
                  onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                  placeholder="Descripción opcional del servicio"
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  className={styles.saveButton}
                  onClick={handleSaveCreate}
                  disabled={loading || !editingData.name.trim()}
                >
                  <FiSave />
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Add Button */}
          {!isCreating && (
            <button
              className={styles.addButton}
              onClick={handleStartCreate}
              disabled={loading}
            >
              <FiPlus />
              Agregar Tipo de Servicio
            </button>
          )}

          {/* Service Types List */}
          <div className={styles.serviceTypesList}>
            {localServiceTypes.map(serviceType => (
              <div key={`${serviceType.id}-${localServiceTypes.length}`} className={styles.serviceTypeItem}>
                {editingId === serviceType.id ? (
                  // Edit Form
                  <div className={styles.editForm}>
                    <div className={styles.formGroup}>
                      <label>Nombre *</label>
                      <input
                        type="text"
                        value={editingData.name}
                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Descripción</label>
                      <textarea
                        value={editingData.description}
                        onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                        className={styles.textarea}
                        rows={3}
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button
                        className={styles.cancelButton}
                        onClick={handleCancelEdit}
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                      <button
                        className={styles.saveButton}
                        onClick={handleSaveEdit}
                        disabled={loading || !editingData.name.trim()}
                      >
                        <FiSave />
                        {loading ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div className={styles.serviceTypeContent}>
                    <div className={styles.serviceTypeInfo}>
                      <h4 className={styles.serviceTypeName}>{serviceType.name}</h4>
                      {serviceType.description && (
                        <p className={styles.serviceTypeDescription}>
                          {serviceType.description}
                        </p>
                      )}
                      <div className={styles.serviceTypeMeta}>
                        Orden: {serviceType.orderIndex} | 
                        Estado: {serviceType.isActive ? 'Activo' : 'Inactivo'}
                      </div>
                    </div>
                    <div className={styles.serviceTypeActions}>
                      <button
                        className={styles.editButton}
                        onClick={() => handleStartEdit(serviceType)}
                        disabled={loading}
                        title="Editar"
                      >
                        <FiEdit2 />
                      </button>
                      {/* 🚨 VALIDACIÓN: Solo mostrar botón de eliminar si hay más de 1 servicio */}
                      {(() => {
                        const shouldShowDelete = localServiceTypes.length > 1;
                        console.log(`🔍 Botón eliminar para "${serviceType.name}": ${shouldShowDelete ? 'VISIBLE' : 'OCULTO'} (total: ${localServiceTypes.length})`);
                        return shouldShowDelete;
                      })() && (
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(serviceType)}
                          disabled={loading}
                          title="Eliminar"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {localServiceTypes.length === 0 && !isCreating && (
            <div className={styles.emptyState}>
              <p>No hay tipos de servicio configurados</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            className={styles.closeModalButton}
            onClick={handleClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
} 