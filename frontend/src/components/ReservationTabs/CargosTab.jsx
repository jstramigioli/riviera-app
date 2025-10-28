import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaTimes, FaCheck, FaChevronDown, FaChevronRight, FaEdit } from 'react-icons/fa';
import styles from './ReservationTabs.module.css';

const CargosTab = ({ 
  cargos,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onAddCargo,
  onUpdateCargo,
  onDeleteCargo
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null); // Cargo siendo editado
  const [newCargo, setNewCargo] = useState({ 
    descripcion: '', 
    monto: '', 
    subcategoriaCargoId: null,
    notas: '' 
  });
  const [expandedGroups, setExpandedGroups] = useState({});

  // Cargar categorías híbridas al montar el componente
  useEffect(() => {
    loadCategoriasHibridas();
  }, []);

  const loadCategoriasHibridas = async () => {
    try {
      setLoadingCategorias(true);
      
      // Cargar solo subcategorías personalizables (SERVICIO, CONSUMO, OTRO)
      const subcategoriasRes = await fetch('http://localhost:3001/api/subcategoria-cargo');
      
      if (!subcategoriasRes.ok) throw new Error('Error al cargar subcategorías');
      
      const subcategoriasResult = await subcategoriasRes.json();
      
      // Procesar subcategorías personalizables (solo SERVICIO, CONSUMO, OTRO)
      const todasSubcategorias = [];
      for (const [tipo, subcats] of Object.entries(subcategoriasResult.data || {})) {
        for (const subcat of subcats) {
          todasSubcategorias.push({
            ...subcat,
            tipoNombre: {
              'SERVICIO': 'Servicios', 
              'CONSUMO': 'Consumos',
              'OTRO': 'Otros'
            }[tipo] || tipo
          });
        }
      }
      
      setSubcategorias(todasSubcategorias);
      
      // Establecer default si hay subcategorías disponibles
      if (todasSubcategorias.length > 0) {
        setNewCargo(prev => ({ 
          ...prev, 
          subcategoriaCargoId: todasSubcategorias[0].id 
        }));
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      setLoadingCategorias(false);
    }
  };

  // Agrupar cargos híbridamente
  const groupedCharges = cargos
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) // Ordenar por fecha ascendente
    .reduce((groups, cargo) => {
      let tipoPrincipal, subcategoriaNombre, subcategoriaColor;
      
      // ENFOQUE HÍBRIDO: Detectar si es alojamiento o subcategoría
      if (cargo.roomTypeId && cargo.serviceTypeId) {
        // Es alojamiento (campos directos)
        tipoPrincipal = 'ALOJAMIENTO';
        const roomName = cargo.roomType?.name || 'Habitación';
        const serviceName = cargo.serviceType?.name || 'Servicio';
        subcategoriaNombre = `${roomName} - ${serviceName}`;
        subcategoriaColor = '#4caf50'; // Color fijo para alojamiento
      } else if (cargo.subcategoriaCargo) {
        // Es otro tipo (subcategoría personalizable)
        tipoPrincipal = cargo.subcategoriaCargo.tipo;
        subcategoriaNombre = cargo.subcategoriaCargo.nombre;
        subcategoriaColor = cargo.subcategoriaCargo.color;
      } else {
        // Cargo sin categoría
        tipoPrincipal = 'OTRO';
        subcategoriaNombre = 'Sin categoría';
        subcategoriaColor = '#9e9e9e';
      }
      
      // Información de tipos principales hardcoded
      const tiposInfo = {
        'ALOJAMIENTO': { nombre: 'Alojamiento', color: '#4caf50' },
        'SERVICIO': { nombre: 'Servicios', color: '#2196f3' },
        'CONSUMO': { nombre: 'Consumos', color: '#ff9800' },
        'OTRO': { nombre: 'Otros', color: '#9e9e9e' }
      };
      
      const tipoInfo = tiposInfo[tipoPrincipal] || tiposInfo['OTRO'];
      
      if (!groups[tipoPrincipal]) {
        groups[tipoPrincipal] = {
          nombre: tipoInfo.nombre,
          codigo: tipoPrincipal,
          color: tipoInfo.color,
          subcategorias: {},
          cargos: [],
          total: 0,
          count: 0
        };
      }
      
      // Agrupar por subcategoría dentro del tipo
      if (!groups[tipoPrincipal].subcategorias[subcategoriaNombre]) {
        groups[tipoPrincipal].subcategorias[subcategoriaNombre] = {
          nombre: subcategoriaNombre,
          color: subcategoriaColor,
          cargos: [],
          total: 0,
          count: 0
        };
      }
      
      // Agregar cargo al tipo principal
      groups[tipoPrincipal].cargos.push(cargo);
      groups[tipoPrincipal].total += parseFloat(cargo.monto);
      groups[tipoPrincipal].count += 1;
      
      // Agregar cargo a la subcategoría
      groups[tipoPrincipal].subcategorias[subcategoriaNombre].cargos.push(cargo);
      groups[tipoPrincipal].subcategorias[subcategoriaNombre].total += parseFloat(cargo.monto);
      groups[tipoPrincipal].subcategorias[subcategoriaNombre].count += 1;
      
      return groups;
    }, {});

  // Función para alternar la expansión de un grupo
  const toggleGroup = (tipo) => {
    setExpandedGroups(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newCargo.subcategoriaCargoId) {
      alert('Debe seleccionar una subcategoría');
      return;
    }
    
    let cargoData = {
      descripcion: newCargo.descripcion,
      monto: parseFloat(newCargo.monto),
      notas: newCargo.notas || null,
      subcategoriaCargoId: parseInt(newCargo.subcategoriaCargoId)
    };
    
    // Determinar si es crear o editar
    if (editingCargo) {
      // Es edición
      await onUpdateCargo(editingCargo.id, cargoData);
      resetForm();
    } else {
      // Es creación nueva
      await onAddCargo(cargoData);
      
      // Reset form pero mantener la subcategoría seleccionada para facilitar múltiples entradas
      const subcategoriaActual = newCargo.subcategoriaCargoId;
      
      setNewCargo({ 
        descripcion: '', 
        monto: '', 
        subcategoriaCargoId: subcategoriaActual,
        notas: '' 
      });
    }
    
    setShowAddModal(false);
  };

  // Función para resetear el formulario
  const resetForm = () => {
    setNewCargo({ 
      descripcion: '', 
      monto: '', 
      subcategoriaCargoId: subcategorias.length > 0 ? subcategorias[0].id : null,
      notas: '' 
    });
    setEditingCargo(null);
  };

  // Función para iniciar la edición de un cargo
  const handleEditCargo = (cargo) => {
    // Solo permitir editar cargos que tengan subcategoriaCargoId
    if (!cargo.subcategoriaCargoId) {
      alert('Los cargos de alojamiento no se pueden editar manualmente. Se generan automáticamente con las reservas.');
      return;
    }

    setEditingCargo(cargo);

    setNewCargo({
      descripcion: cargo.descripcion,
      monto: cargo.monto.toString(),
      subcategoriaCargoId: cargo.subcategoriaCargoId,
      notas: cargo.notas || ''
    });
    
    setShowAddModal(true);
  };

  // Función para cancelar la edición
  const handleCancelEdit = () => {
    resetForm();
    setShowAddModal(false);
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Cargos / Consumos</h3>
        <button 
          className={styles.addButton}
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          <FaPlus /> Agregar Cargo
        </button>
      </div>

      {loadingFinancial ? (
        <div className={styles.loading}>Cargando cargos...</div>
      ) : (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Cargos</div>
              <div className={styles.summaryValue}>
                {formatCurrency(financialSummary?.resumen.totalCargos || 0)}
              </div>
            </div>
          </div>

          {cargos.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay cargos registrados</p>
              <button 
                className={styles.primaryButton}
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
              >
                Agregar primer cargo
              </button>
            </div>
          ) : (
            <div className={styles.chargesGroupsContainer}>
              {Object.entries(groupedCharges).map(([tipoCodigo, group]) => {
                const isExpanded = expandedGroups[tipoCodigo];
                
                return (
                  <div key={tipoCodigo} className={styles.chargeGroup}>
                    {/* Header del grupo */}
                    <div 
                      className={styles.groupHeader}
                      onClick={() => toggleGroup(tipoCodigo)}
                      style={{ borderLeftColor: group.color }}
                    >
                      <div className={styles.groupHeaderLeft}>
                        <div className={styles.groupInfo}>
                          <h4 className={styles.groupTitle}>{group.nombre}</h4>
                          <span className={styles.groupSubtitle}>
                            {group.count} {group.count === 1 ? 'cargo' : 'cargos'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.groupHeaderRight}>
                        <span className={styles.groupTotal}>
                          {formatCurrency(group.total)}
                        </span>
                        <span className={styles.expandIcon}>
                          {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                        </span>
                      </div>
                    </div>

                    {/* Detalles del grupo (expandible) */}
                    {isExpanded && (
                      <div className={styles.groupDetails}>
                        <div className={styles.tableContainer}>
                          <table className={styles.dataTable}>
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                                <th>Notas</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.cargos.map(cargo => (
                                <tr key={cargo.id}>
                                  <td>{formatDate(cargo.fecha)}</td>
                                  <td>{cargo.descripcion}</td>
                                  <td className={styles.montoCell}>
                                    {formatCurrency(parseFloat(cargo.monto))}
                                  </td>
                                  <td className={styles.notasCell}>
                                    {cargo.notas || '-'}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      {cargo.subcategoriaCargoId ? (
                                        // Cargo editable (tiene subcategoría)
                                        <>
                                          <button
                                            className={styles.editIconButton}
                                            onClick={() => handleEditCargo(cargo)}
                                            title="Editar cargo"
                                          >
                                            <FaEdit />
                                          </button>
                                          <button
                                            className={styles.deleteIconButton}
                                            onClick={() => onDeleteCargo(cargo.id)}
                                            title="Eliminar cargo"
                                          >
                                            <FaTrash />
                                          </button>
                                        </>
                                      ) : (
                                        // Cargo de alojamiento (no editable)
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span 
                                            style={{ 
                                              fontSize: '0.8rem', 
                                              color: '#6c757d', 
                                              fontStyle: 'italic' 
                                            }}
                                          >
                                            Automático
                                          </span>
                                          <button
                                            className={styles.deleteIconButton}
                                            onClick={() => onDeleteCargo(cargo.id)}
                                            title="Eliminar cargo"
                                          >
                                            <FaTrash />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Agregar/Editar Cargo */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={handleCancelEdit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingCargo ? 'Editar Cargo' : 'Agregar Cargo'}</h3>
              <button 
                className={styles.closeButton}
                onClick={handleCancelEdit}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Descripción *</label>
                <input
                  type="text"
                  required
                  value={newCargo.descripcion}
                  onChange={(e) => setNewCargo({ ...newCargo, descripcion: e.target.value })}
                  placeholder="Ej: Minuta, Bebidas, Lavandería"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newCargo.monto}
                  onChange={(e) => setNewCargo({ ...newCargo, monto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              {/* Selector de categoría de cargo */}
              <div className={styles.formGroup}>
                <label>Categoría *</label>
                <select
                  value={newCargo.subcategoriaCargoId || ''}
                  onChange={(e) => setNewCargo({ 
                    ...newCargo, 
                    subcategoriaCargoId: e.target.value ? parseInt(e.target.value) : null
                  })}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {['SERVICIO', 'CONSUMO', 'OTRO'].map(tipoPrincipal => {
                    const subcatsDelTipo = subcategorias.filter(sub => sub.tipo === tipoPrincipal);
                    if (subcatsDelTipo.length === 0) return null;
                    
                    return (
                      <optgroup key={tipoPrincipal} label={subcatsDelTipo[0].tipoNombre}>
                        {subcatsDelTipo.map(subcat => (
                          <option key={subcat.id} value={subcat.id}>
                            {subcat.nombre}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>

                {loadingCategorias && (
                  <small style={{ color: '#6c757d' }}>Cargando opciones...</small>
                )}
                
                <small style={{ color: '#6c757d', marginTop: '4px', display: 'block' }}>
                  Los cargos de alojamiento se generan automáticamente con las reservas
                </small>
              </div>
              <div className={styles.formGroup}>
                <label>Notas</label>
                <textarea
                  value={newCargo.notas}
                  onChange={(e) => setNewCargo({ ...newCargo, notas: e.target.value })}
                  placeholder="Observaciones opcionales"
                  rows="3"
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={handleCancelEdit}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  <FaCheck /> {editingCargo ? 'Actualizar Cargo' : 'Guardar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CargosTab;


