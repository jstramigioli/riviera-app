import React, { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiMove, FiSave, FiX } from 'react-icons/fi';
import { useBlockServiceTypes } from '../../hooks/useBlockServiceTypes';
import styles from './BlockServiceTypeManager.module.css';

export const BlockServiceTypeManager = ({ seasonBlockId, isEditing }) => {
  const {
    blockServiceTypes,
    loading,
    error,
    createBlockServiceType,
    updateBlockServiceType,
    deleteBlockServiceType,
    toggleBlockServiceType
  } = useBlockServiceTypes(seasonBlockId);

  const [editingId, setEditingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    adjustmentMode: 'PERCENTAGE',
    adjustmentValue: 0
  });

  const handleCreate = async () => {
    try {
      await createBlockServiceType(formData);
      setFormData({
        name: '',
        description: '',
        adjustmentMode: 'PERCENTAGE',
        adjustmentValue: 0
      });
      setShowCreateForm(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdate = async (id) => {
    try {
      const serviceType = blockServiceTypes.find(st => st.id === id);
      await updateBlockServiceType(id, {
        ...serviceType,
        ...formData
      });
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        adjustmentMode: 'PERCENTAGE',
        adjustmentValue: 0
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este tipo de servicio?')) {
      try {
        await deleteBlockServiceType(id);
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const handleEdit = (serviceType) => {
    setEditingId(serviceType.id);
    setFormData({
      name: serviceType.name,
      description: serviceType.description || '',
      adjustmentMode: serviceType.adjustmentMode,
      adjustmentValue: serviceType.adjustmentValue
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowCreateForm(false);
    setFormData({
      name: '',
      description: '',
      adjustmentMode: 'PERCENTAGE',
      adjustmentValue: 0
    });
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await toggleBlockServiceType(id, !currentStatus);
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando tipos de servicio...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Tipos de Servicio del Bloque</h3>
        {isEditing && (
          <button
            className={styles.addButton}
            onClick={() => setShowCreateForm(true)}
            disabled={showCreateForm}
          >
            <FiPlus /> Agregar Servicio
          </button>
        )}
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className={styles.createForm}>
          <h4>Nuevo Tipo de Servicio</h4>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="Nombre del servicio"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.formRow}>
            <select
              value={formData.adjustmentMode}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustmentMode: e.target.value }))}
              className={styles.select}
            >
              <option value="PERCENTAGE">Porcentaje del precio base</option>
              <option value="FIXED">Precio fijo</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder={formData.adjustmentMode === 'PERCENTAGE' ? 'Porcentaje' : 'Precio fijo'}
              value={formData.adjustmentValue}
              onChange={(e) => setFormData(prev => ({ ...prev, adjustmentValue: parseFloat(e.target.value) || 0 }))}
              className={styles.input}
            />
          </div>
          <div className={styles.formActions}>
            <button onClick={handleCreate} className={styles.saveButton}>
              <FiSave /> Crear
            </button>
            <button onClick={handleCancel} className={styles.cancelButton}>
              <FiX /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de tipos de servicio */}
      <div className={styles.serviceTypesList}>
        {blockServiceTypes.length === 0 ? (
          <div className={styles.emptyState}>
            No hay tipos de servicio configurados para este bloque.
            {isEditing && ' Haz clic en "Agregar Servicio" para comenzar.'}
          </div>
        ) : (
          blockServiceTypes.map((serviceType) => (
            <div
              key={serviceType.id}
              className={`${styles.serviceTypeItem} ${!serviceType.isActive ? styles.inactive : ''}`}
            >
              <div className={styles.dragHandle}>
                <FiMove />
              </div>
              
              <div className={styles.serviceTypeInfo}>
                <div className={styles.serviceTypeHeader}>
                  <h4>{serviceType.name}</h4>
                  <span className={styles.adjustmentInfo}>
                    {serviceType.adjustmentMode === 'PERCENTAGE' 
                      ? `${serviceType.adjustmentValue}% del precio base`
                      : `+$${serviceType.adjustmentValue}`
                    }
                  </span>
                </div>
                {serviceType.description && (
                  <p className={styles.description}>{serviceType.description}</p>
                )}
              </div>

              <div className={styles.serviceTypeActions}>
                {isEditing && (
                  <>
                    <button
                      onClick={() => handleEdit(serviceType)}
                      className={styles.editButton}
                      disabled={editingId === serviceType.id}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => handleDelete(serviceType.id)}
                      className={styles.deleteButton}
                    >
                      <FiTrash2 />
                    </button>
                    <button
                      onClick={() => handleToggleActive(serviceType.id, serviceType.isActive)}
                      className={`${styles.toggleButton} ${serviceType.isActive ? styles.active : styles.inactive}`}
                    >
                      {serviceType.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </>
                )}
              </div>

              {/* Formulario de edición inline */}
              {editingId === serviceType.id && (
                <div className={styles.editForm}>
                  <div className={styles.formRow}>
                    <input
                      type="text"
                      placeholder="Nombre del servicio"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={styles.input}
                    />
                    <input
                      type="text"
                      placeholder="Descripción (opcional)"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <select
                      value={formData.adjustmentMode}
                      onChange={(e) => setFormData(prev => ({ ...prev, adjustmentMode: e.target.value }))}
                      className={styles.select}
                    >
                      <option value="PERCENTAGE">Porcentaje del precio base</option>
                      <option value="FIXED">Precio fijo</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={formData.adjustmentMode === 'PERCENTAGE' ? 'Porcentaje' : 'Precio fijo'}
                      value={formData.adjustmentValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, adjustmentValue: parseFloat(e.target.value) || 0 }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button onClick={() => handleUpdate(serviceType.id)} className={styles.saveButton}>
                      <FiSave /> Guardar
                    </button>
                    <button onClick={handleCancel} className={styles.cancelButton}>
                      <FiX /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 