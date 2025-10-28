import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaToggleOn, FaToggleOff, FaPalette } from 'react-icons/fa';
import styles from './CatalogosYTiposTab.module.css';

const CatalogosYTiposTab = () => {
  const [tiposCargo, setTiposCargo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: '#9e9e9e'
  });

  // Cargar tipos de cargo
  useEffect(() => {
    loadTiposCargo();
  }, []);

  const loadTiposCargo = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/tipo-cargo');
      if (!response.ok) throw new Error('Error al cargar tipos de cargo');
      
      const result = await response.json();
      setTiposCargo(result.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando tipos de cargo:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      color: '#9e9e9e'
    });
    setEditingTipo(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (tipo) => {
    if (tipo.esHardcoded) {
      alert('Los tipos hardcoded no pueden ser editados completamente');
      return;
    }
    
    setFormData({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      color: tipo.color
    });
    setEditingTipo(tipo);
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      const url = editingTipo 
        ? `http://localhost:3001/api/tipo-cargo/${editingTipo.id}`
        : 'http://localhost:3001/api/tipo-cargo';
      
      const method = editingTipo ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo: formData.codigo.toUpperCase().replace(/\s+/g, '_'),
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          color: formData.color
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar');
      }

      await loadTiposCargo();
      setShowAddModal(false);
      resetForm();
      
      const action = editingTipo ? 'actualizado' : 'creado';
      alert(`Tipo de cargo ${action} exitosamente`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggle = async (tipo) => {
    try {
      const response = await fetch(`http://localhost:3001/api/tipo-cargo/${tipo.id}/toggle`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cambiar estado');
      }

      await loadTiposCargo();
      const newState = !tipo.esActivo;
      alert(`Tipo ${newState ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (tipo) => {
    if (tipo.esHardcoded) {
      alert('Los tipos hardcoded no pueden ser eliminados');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar el tipo "${tipo.nombre}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/tipo-cargo/${tipo.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar');
      }

      await loadTiposCargo();
      alert('Tipo eliminado exitosamente');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando tipos de cargo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={loadTiposCargo} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Catálogos y Tipos</h2>
          <p>Gestión de tipos de cargo personalizables</p>
        </div>
        <button 
          className={styles.addButton}
          onClick={handleAddNew}
        >
          <FaPlus /> Nuevo Tipo
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h3>Tipos de Cargo</h3>
          <p className={styles.sectionDescription}>
            Los tipos hardcoded son parte del sistema y no pueden ser eliminados. 
            Los tipos personalizables pueden ser creados, editados y eliminados según tus necesidades.
          </p>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Color</th>
                  <th>Origen</th>
                  <th>Cargos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tiposCargo.map(tipo => (
                  <tr key={tipo.id} className={!tipo.esActivo ? styles.inactive : ''}>
                    <td>
                      <button
                        className={`${styles.toggleButton} ${tipo.esActivo ? styles.active : styles.inactive}`}
                        onClick={() => handleToggle(tipo)}
                        title={tipo.esActivo ? 'Desactivar' : 'Activar'}
                      >
                        {tipo.esActivo ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                    </td>
                    <td>
                      <div 
                        className={styles.colorIndicator}
                        style={{ backgroundColor: tipo.color }}
                      />
                    </td>
                    <td>
                      <code className={styles.code}>{tipo.codigo}</code>
                    </td>
                    <td className={styles.nombreCell}>
                      {tipo.nombre}
                    </td>
                    <td className={styles.descripcionCell}>
                      {tipo.descripcion || '-'}
                    </td>
                    <td>
                      <span className={styles.colorValue}>{tipo.color}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${tipo.esHardcoded ? styles.hardcoded : styles.custom}`}>
                        {tipo.esHardcoded ? '🔒 Sistema' : '✏️ Personalizable'}
                      </span>
                    </td>
                    <td className={styles.countCell}>
                      {tipo._count?.cargos || 0}
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEdit(tipo)}
                          disabled={tipo.esHardcoded}
                          title={tipo.esHardcoded ? 'Los tipos del sistema no son editables' : 'Editar tipo'}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(tipo)}
                          disabled={tipo.esHardcoded || (tipo._count?.cargos > 0)}
                          title={
                            tipo.esHardcoded 
                              ? 'Los tipos del sistema no se pueden eliminar' 
                              : tipo._count?.cargos > 0
                                ? 'No se puede eliminar: tiene cargos asociados'
                                : 'Eliminar tipo'
                          }
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal para agregar/editar tipo */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingTipo ? 'Editar Tipo de Cargo' : 'Nuevo Tipo de Cargo'}</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowAddModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Código *</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="ej: CONSUMO_BEBIDAS"
                    required
                    disabled={editingTipo} // No permitir editar código existente
                  />
                  <small>Se convertirá automáticamente a mayúsculas y espacios a guiones bajos</small>
                </div>

                <div className={styles.formGroup}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="ej: Consumo de Bebidas"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción opcional del tipo de cargo"
                  rows="3"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Color</label>
                <div className={styles.colorInputContainer}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className={styles.colorInput}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className={styles.colorText}
                    placeholder="#9e9e9e"
                  />
                  <div 
                    className={styles.colorPreview}
                    style={{ backgroundColor: formData.color }}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  <FaSave /> {editingTipo ? 'Guardar Cambios' : 'Crear Tipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogosYTiposTab;
