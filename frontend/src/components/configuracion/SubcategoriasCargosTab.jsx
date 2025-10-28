import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import styles from './SubcategoriasCargosTab.module.css';

const SubcategoriasCargosTab = ({ tipo }) => {
  const [subcategorias, setSubcategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubcategoria, setEditingSubcategoria] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: ''
  });

  // Información por tipo
  const tipoInfo = {
    'SERVICIO': {
      nombre: 'Servicios',
      color: '#2196f3',
      descripcion: 'Configura las subcategorías de servicios adicionales del hotel',
      ejemplos: 'Spa, Lavandería, Transporte, etc.'
    },
    'CONSUMO': {
      nombre: 'Consumos',
      color: '#ff9800',
      descripcion: 'Define las categorías de consumos disponibles',
      ejemplos: 'Bebidas, Minutas, Cafetería, Minibar, etc.'
    },
    'OTRO': {
      nombre: 'Otros',
      color: '#9e9e9e',
      descripcion: 'Otros tipos de cargos no clasificados en las categorías principales',
      ejemplos: 'Multas, Daños, Depósitos, etc.'
    }
  };

  const currentTipoInfo = tipoInfo[tipo] || tipoInfo['OTRO'];

  useEffect(() => {
    loadSubcategorias();
  }, [tipo]);

  const loadSubcategorias = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/subcategoria-cargo?tipo=${tipo}`);
      if (!response.ok) throw new Error('Error al cargar subcategorías');
      
      const result = await response.json();
      setSubcategorias(result.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando subcategorías:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      color: currentTipoInfo.color
    });
    setEditingSubcategoria(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (subcategoria) => {
    setFormData({
      codigo: subcategoria.codigo,
      nombre: subcategoria.nombre,
      descripcion: subcategoria.descripcion || '',
      color: subcategoria.color
    });
    setEditingSubcategoria(subcategoria);
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      const url = editingSubcategoria 
        ? `http://localhost:3001/api/subcategoria-cargo/${editingSubcategoria.id}`
        : `http://localhost:3001/api/subcategoria-cargo/${tipo}`;
      
      const method = editingSubcategoria ? 'PUT' : 'POST';
      
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

      await loadSubcategorias();
      setShowAddModal(false);
      resetForm();
      
      const action = editingSubcategoria ? 'actualizada' : 'creada';
      alert(`Subcategoría ${action} exitosamente`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggle = async (subcategoria) => {
    try {
      const response = await fetch(`http://localhost:3001/api/subcategoria-cargo/${subcategoria.id}/toggle`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cambiar estado');
      }

      await loadSubcategorias();
      const newState = !subcategoria.esActivo;
      alert(`Subcategoría ${newState ? 'activada' : 'desactivada'} exitosamente`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (subcategoria) => {
    if (!confirm(`¿Estás seguro de eliminar la subcategoría "${subcategoria.nombre}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/subcategoria-cargo/${subcategoria.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar');
      }

      await loadSubcategorias();
      alert('Subcategoría eliminada exitosamente');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando subcategorías de {currentTipoInfo.nombre.toLowerCase()}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={loadSubcategorias} className={styles.retryButton}>
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
          <div className={styles.titleSection}>
            <h3 style={{ color: currentTipoInfo.color }}>
              Subcategorías de {currentTipoInfo.nombre}
            </h3>
            <p>{currentTipoInfo.descripcion}</p>
            <small className={styles.ejemplos}>
              <strong>Ejemplos:</strong> {currentTipoInfo.ejemplos}
            </small>
          </div>
        </div>
        <button 
          className={styles.addButton}
          onClick={handleAddNew}
        >
          <FaPlus /> Nueva Subcategoría
        </button>
      </div>

      <div className={styles.content}>
        {subcategorias.length === 0 ? (
          <div className={styles.emptyState}>
            <h4>No hay subcategorías configuradas</h4>
            <p>Crea subcategorías personalizadas para organizar mejor los cargos de {currentTipoInfo.nombre.toLowerCase()}.</p>
            <button 
              className={styles.primaryButton}
              onClick={handleAddNew}
            >
              Crear primera subcategoría
            </button>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Color</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Cargos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subcategorias.map(subcategoria => (
                  <tr key={subcategoria.id} className={!subcategoria.esActivo ? styles.inactive : ''}>
                    <td>
                      <button
                        className={`${styles.toggleButton} ${subcategoria.esActivo ? styles.active : styles.inactive}`}
                        onClick={() => handleToggle(subcategoria)}
                        title={subcategoria.esActivo ? 'Desactivar' : 'Activar'}
                      >
                        {subcategoria.esActivo ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                    </td>
                    <td>
                      <div 
                        className={styles.colorIndicator}
                        style={{ backgroundColor: subcategoria.color }}
                        title={subcategoria.color}
                      />
                    </td>
                    <td>
                      <code className={styles.code}>{subcategoria.codigo}</code>
                    </td>
                    <td className={styles.nombreCell}>
                      {subcategoria.nombre}
                    </td>
                    <td className={styles.descripcionCell}>
                      {subcategoria.descripcion || '-'}
                    </td>
                    <td className={styles.countCell}>
                      {subcategoria._count?.cargos || 0}
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEdit(subcategoria)}
                          title="Editar subcategoría"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(subcategoria)}
                          disabled={subcategoria._count?.cargos > 0}
                          title={
                            subcategoria._count?.cargos > 0
                              ? 'No se puede eliminar: tiene cargos asociados'
                              : 'Eliminar subcategoría'
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
        )}
      </div>

      {/* Modal para agregar/editar */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {editingSubcategoria ? 'Editar' : 'Nueva'} Subcategoría de {currentTipoInfo.nombre}
              </h3>
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
                    placeholder="ej: VINOS_PREMIUM"
                    required
                    disabled={editingSubcategoria} // No editar código existente
                  />
                  <small>Se convertirá automáticamente a mayúsculas</small>
                </div>

                <div className={styles.formGroup}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="ej: Vinos Premium"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción opcional de la subcategoría"
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
                    placeholder="#ff9800"
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
                  <FaSave /> {editingSubcategoria ? 'Guardar Cambios' : 'Crear Subcategoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubcategoriasCargosTab;
