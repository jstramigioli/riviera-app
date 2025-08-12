import React, { useState } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiMove, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { useBlockServiceSelections } from '../../hooks/useBlockServiceSelections';
import styles from './BlockServiceSelectionManager.module.css';

const BlockServiceSelectionManager = ({ seasonBlockId, onServiceAdded }) => {
  const {
    selections,
    availableServices,
    loading,
    error,
    createSelection,
    updateSelection,
    toggleSelection,
    refreshSelections
  } = useBlockServiceSelections(seasonBlockId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSelection, setEditingSelection] = useState(null);
  const [formData, setFormData] = useState({
    serviceTypeId: '',
    isEnabled: true
  });

  const handleAddService = async (e) => {
    e.preventDefault();
    
    try {
      const selectionData = {
        serviceTypeId: formData.serviceTypeId,
        isEnabled: formData.isEnabled
      };

      const newSelection = await createSelection(selectionData);
      setShowAddForm(false);
      resetForm();
      
      // Inicializar precios para el nuevo servicio
      if (onServiceAdded && newSelection) {
        onServiceAdded(newSelection.serviceTypeId, newSelection);
      }
    } catch (error) {
      console.error('Error adding service:', error);
    }
  };

  const handleEditService = async (e) => {
    e.preventDefault();
    
    try {
      const updateData = {
        isEnabled: formData.isEnabled
      };

      console.log('Editando selección:', editingSelection);
      console.log('ID de la selección:', editingSelection.id);
      console.log('Enviando datos de actualización:', updateData);

      // Verificar que la selección existe en el estado actual
      const currentSelection = selections.find(s => s.id === editingSelection.id);
      if (!currentSelection) {
        console.error('La selección no se encuentra en el estado actual:', editingSelection.id);
        console.log('Selecciones disponibles:', selections.map(s => ({ id: s.id, name: s.serviceType.name })));
        alert('Error: La selección de servicio no se encuentra. Intentando recargar...');
        await reloadSelections();
        return;
      }

      await updateSelection(editingSelection.id, updateData);
      setEditingSelection(null);
      resetForm();
    } catch (error) {
      console.error('Error updating service:', error);
    }
  };



  const handleToggleService = async (id, isEnabled) => {
    // Verificar si es el servicio base (no se puede desactivar)
    const selection = selections.find(s => s.id === id);
    if (selection && (selection.serviceTypeId === 'base-service' || selection.serviceType.name === 'Tarifa Base')) {
      alert('No se puede desactivar el servicio base. Este servicio es obligatorio para todos los bloques.');
      return;
    }

    // Verificar si es el servicio "Solo Alojamiento" (no se puede desactivar)
    if (selection && selection.serviceType.name === 'Solo Alojamiento') {
      alert('No se puede desactivar el servicio "Solo Alojamiento". Este servicio debe permanecer siempre activo.');
      return;
    }

    try {
      await toggleSelection(id, !isEnabled);
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceTypeId: '',
      isEnabled: true
    });
  };



  const cancelEdit = () => {
    setEditingSelection(null);
    resetForm();
  };

  // Función para recargar las selecciones
  const reloadSelections = async () => {
    try {
      console.log('Recargando selecciones de servicio...');
      await refreshSelections();
      console.log('Selecciones recargadas exitosamente');
    } catch (error) {
      console.error('Error al recargar selecciones:', error);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando servicios...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Servicios del Bloque</h3>
        <button
          className={styles.addButton}
          onClick={() => setShowAddForm(true)}
          disabled={availableServices.length === 0}
        >
          <FiPlus /> Agregar Servicio
        </button>
      </div>

      {/* Formulario para agregar servicio */}
      {showAddForm && (
        <div className={styles.formOverlay}>
          <div className={styles.form}>
            <h4>Agregar Servicio</h4>
            <form onSubmit={handleAddService}>
              <div className={styles.formGroup}>
                <label>Servicio:</label>
                <select
                  value={formData.serviceTypeId}
                  onChange={(e) => setFormData({ ...formData, serviceTypeId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar servicio</option>
                  {availableServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveButton}>
                  Agregar
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulario para editar servicio */}
      {editingSelection && (
        <div className={styles.formOverlay}>
          <div className={styles.form}>
            <h4>Editar Servicio: {editingSelection.serviceType.name}</h4>
            <form onSubmit={handleEditService}>
              <div className={styles.formGroup}>
                <label>Habilitado:</label>
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                />
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveButton}>
                  Guardar
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista compacta de servicios */}
      <div className={styles.servicesList}>
        {selections.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay servicios configurados. Agrega servicios para ver la tabla de precios.</p>
          </div>
        ) : (
          <div className={styles.servicesGrid}>
            {selections.map((selection) => (
              <div
                key={selection.id}
                className={`${styles.serviceChip} ${!selection.isEnabled ? styles.disabled : ''}`}
              >
                <span className={styles.serviceName}>{selection.serviceType.name}</span>
                <div className={styles.serviceActions}>
                  {(selection.serviceTypeId !== 'base-service' && 
                    selection.serviceType.name !== 'Tarifa Base' &&
                    selection.serviceType.name !== 'Solo Alojamiento') && (
                    <button
                      className={styles.toggleButton}
                      onClick={() => handleToggleService(selection.id, selection.isEnabled)}
                      title={selection.isEnabled ? 'Deshabilitar' : 'Habilitar'}
                    >
                      {selection.isEnabled ? <FiToggleRight /> : <FiToggleLeft />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


    </div>
  );
};

export default BlockServiceSelectionManager; 