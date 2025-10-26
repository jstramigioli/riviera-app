import React, { useState } from 'react';
import { FaPlus, FaTrash, FaTimes, FaCheck, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import styles from './ReservationTabs.module.css';

const CargosTab = ({ 
  cargos,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onAddCargo,
  onDeleteCargo
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCargo, setNewCargo] = useState({ 
    descripcion: '', 
    monto: '', 
    tipo: 'CONSUMO', 
    notas: '' 
  });
  const [expandedGroups, setExpandedGroups] = useState({});

  // Agrupar cargos por tipo y ordenar por fecha (más antiguos primero)
  const groupedCharges = cargos
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) // Ordenar por fecha ascendente
    .reduce((groups, cargo) => {
      const tipo = cargo.tipo || 'OTRO';
      if (!groups[tipo]) {
        groups[tipo] = {
          cargos: [],
          total: 0,
          count: 0
        };
      }
      groups[tipo].cargos.push(cargo);
      groups[tipo].total += parseFloat(cargo.monto);
      groups[tipo].count += 1;
      return groups;
    }, {});

  // Función para alternar la expansión de un grupo
  const toggleGroup = (tipo) => {
    setExpandedGroups(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  // Función para obtener el color del tipo de cargo
  const getTipoInfo = (tipo) => {
    const tiposInfo = {
      'ALOJAMIENTO': { color: '#4caf50', label: 'Alojamiento' },
      'SERVICIO': { color: '#2196f3', label: 'Servicios' },
      'CONSUMO': { color: '#ff9800', label: 'Consumos' },
      'OTRO': { color: '#9e9e9e', label: 'Otros' }
    };
    return tiposInfo[tipo] || tiposInfo['OTRO'];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAddCargo({
      descripcion: newCargo.descripcion,
      monto: parseFloat(newCargo.monto),
      tipo: newCargo.tipo,
      notas: newCargo.notas || null
    });
    
    setNewCargo({ descripcion: '', monto: '', tipo: 'CONSUMO', notas: '' });
    setShowAddModal(false);
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Cargos / Consumos</h3>
        <button 
          className={styles.addButton}
          onClick={() => setShowAddModal(true)}
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
                onClick={() => setShowAddModal(true)}
              >
                Agregar primer cargo
              </button>
            </div>
          ) : (
            <div className={styles.chargesGroupsContainer}>
              {Object.entries(groupedCharges).map(([tipo, group]) => {
                const tipoInfo = getTipoInfo(tipo);
                const isExpanded = expandedGroups[tipo];
                
                return (
                  <div key={tipo} className={styles.chargeGroup}>
                    {/* Header del grupo */}
                    <div 
                      className={styles.groupHeader}
                      onClick={() => toggleGroup(tipo)}
                      style={{ borderLeftColor: tipoInfo.color }}
                    >
                      <div className={styles.groupHeaderLeft}>
                        <div className={styles.groupInfo}>
                          <h4 className={styles.groupTitle}>{tipoInfo.label}</h4>
                          <span className={styles.groupSubtitle}>
                            Mostrar detalles
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
                                    <button
                                      className={styles.deleteIconButton}
                                      onClick={() => onDeleteCargo(cargo.id)}
                                      title="Eliminar cargo"
                                    >
                                      <FaTrash />
                                    </button>
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

      {/* Modal Agregar Cargo */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Agregar Cargo</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowAddModal(false)}
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
              <div className={styles.formGroup}>
                <label>Tipo de Cargo *</label>
                <select
                  value={newCargo.tipo}
                  onChange={(e) => setNewCargo({ ...newCargo, tipo: e.target.value })}
                  required
                >
                  <option value="ALOJAMIENTO">Alojamiento</option>
                  <option value="SERVICIO">Servicio</option>
                  <option value="CONSUMO">Consumo</option>
                  <option value="OTRO">Otro</option>
                </select>
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
                <button type="button" className={styles.cancelButton} onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  <FaCheck /> Guardar Cargo
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


