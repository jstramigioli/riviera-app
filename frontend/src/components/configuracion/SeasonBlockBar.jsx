import React, { useState } from 'react';
import { FiEdit, FiTrash2, FiCopy, FiCalendar, FiChevronDown, FiChevronRight, FiSave, FiX } from 'react-icons/fi';
import { useSeasonBlock } from '../../hooks/useSeasonBlock';
import styles from './SeasonBlockBar.module.css';

export default function SeasonBlockBar({ block, onEdit, onDelete, onSaved, hotelId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Hook personalizado para manejar la lógica del season block
  const {
    loading,
    saving,
    error,
    formData,
    roomTypes,
    serviceTypes,
    validationErrors,
    updateFormData,
    updateSeasonPrice,
    updateServiceAdjustment,
    saveSeasonBlock,
    cloneSeasonBlock,
  } = useSeasonBlock(block.id, hotelId);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setIsExpanded(true);
    }
  };

  const handleSave = async () => {
    const result = await saveSeasonBlock();
    if (result.success) {
      setIsEditing(false);
      onSaved?.(result.data);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleClone = () => {
    cloneSeasonBlock();
    onEdit?.(block); // Abrir para editar el bloque clonado
  };

  const getSeasonPrice = (roomTypeId) => {
    return formData.seasonPrices.find(
      price => price.roomTypeId === roomTypeId
    ) || { basePrice: '' };
  };

  const getServiceAdjustment = (roomTypeId, serviceTypeId) => {
    return formData.serviceAdjustments.find(
      adj => adj.roomTypeId === roomTypeId && adj.serviceTypeId === serviceTypeId
    ) || { mode: 'PERCENTAGE', value: '' };
  };

  const calculateFinalPrice = (basePrice, adjustment) => {
    if (!basePrice || !adjustment.value) return basePrice || 0;
    
    if (adjustment.mode === 'FIXED') {
      return parseFloat(basePrice) + parseFloat(adjustment.value);
    } else {
      return parseFloat(basePrice) * (1 + parseFloat(adjustment.value) / 100);
    }
  };

  return (
    <div className={`${styles.bar} ${isExpanded ? styles.expanded : ''} ${isEditing ? styles.editing : ''}`}>
      {/* Header Bar */}
      <div className={styles.header} onClick={!isEditing ? handleToggleExpand : undefined}>
        <div className={styles.expandIcon}>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        <div className={styles.info}>
          <div className={styles.title}>{block.name}</div>
          <div className={styles.subtitle}>
            <FiCalendar className={styles.calendarIcon} />
            {formatDate(block.startDate)} - {formatDate(block.endDate)}
          </div>
          {block.description && (
            <div className={styles.description}>{block.description}</div>
          )}
        </div>

        <div className={styles.actions}>
          {isEditing ? (
            <>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={saving}
              >
                <FiSave />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancel}
              >
                <FiX />
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.editButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditToggle();
                }}
                title="Editar bloque"
              >
                <FiEdit />
              </button>
              <button
                className={styles.cloneButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClone();
                }}
                title="Duplicar bloque"
              >
                <FiCopy />
              </button>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(block);
                }}
                title="Eliminar bloque"
              >
                <FiTrash2 />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>Cargando datos...</span>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <span>⚠️ Error al cargar los datos: {error}</span>
            </div>
          ) : (
            <>
              {/* Form fields when editing */}
              {isEditing && (
                <div className={styles.editForm}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Nombre del Bloque</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateFormData('name', e.target.value)}
                        className={validationErrors.name ? styles.error : ''}
                      />
                      {validationErrors.name && (
                        <span className={styles.errorText}>{validationErrors.name}</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Descripción</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => updateFormData('description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Fecha de Inicio</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => updateFormData('startDate', e.target.value)}
                        className={validationErrors.startDate ? styles.error : ''}
                      />
                      {validationErrors.startDate && (
                        <span className={styles.errorText}>{validationErrors.startDate}</span>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label>Fecha de Fin</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => updateFormData('endDate', e.target.value)}
                        className={validationErrors.endDate ? styles.error : ''}
                      />
                      {validationErrors.endDate && (
                        <span className={styles.errorText}>{validationErrors.endDate}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tarifas Table */}
              <div className={styles.tableSection}>
                <h4 className={styles.tableTitle}>Tarifas por Tipo de Habitación y Servicio</h4>
                
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.roomTypeHeader}>Tipo de Habitación</th>
                        <th className={styles.basePriceHeader}>Precio Base</th>
                        {serviceTypes
                          .filter(serviceType => serviceType.name !== 'Solo Alojamiento')
                          .map(serviceType => (
                            <th key={serviceType.id} className={styles.serviceHeader}>
                              {serviceType.name}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roomTypes.map(roomType => {
                        const basePrice = getSeasonPrice(roomType.id);
                        return (
                          <tr key={roomType.id}>
                            <td className={styles.roomTypeCell}>
                              {roomType.name}
                            </td>
                            <td className={styles.basePriceCell}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  className={styles.priceInput}
                                  value={basePrice.basePrice || ''}
                                  onChange={(e) => updateSeasonPrice(roomType.id, e.target.value)}
                                  placeholder="0"
                                  min="0"
                                />
                              ) : (
                                <span className={styles.priceDisplay}>
                                  {basePrice.basePrice ? formatCurrency(basePrice.basePrice) : '-'}
                                </span>
                              )}
                            </td>
                            {serviceTypes
                              .filter(serviceType => serviceType.name !== 'Solo Alojamiento')
                              .map(serviceType => {
                                const adjustment = getServiceAdjustment(roomType.id, serviceType.id);
                                const finalPrice = calculateFinalPrice(basePrice.basePrice, adjustment);
                                
                                return (
                                  <td key={serviceType.id} className={styles.serviceCell}>
                                    {isEditing ? (
                                      <div className={styles.adjustmentInputGroup}>
                                        <select
                                          className={styles.modeSelect}
                                          value={adjustment.mode}
                                          onChange={(e) => updateServiceAdjustment(
                                            roomType.id, 
                                            serviceType.id, 
                                            'mode', 
                                            e.target.value
                                          )}
                                        >
                                          <option value="PERCENTAGE">%</option>
                                          <option value="FIXED">$</option>
                                        </select>
                                        <input
                                          type="number"
                                          className={styles.adjustmentInput}
                                          value={adjustment.value || ''}
                                          onChange={(e) => updateServiceAdjustment(
                                            roomType.id, 
                                            serviceType.id, 
                                            'value', 
                                            e.target.value
                                          )}
                                          placeholder="0"
                                          min={adjustment.mode === 'PERCENTAGE' ? -100 : 0}
                                          max={adjustment.mode === 'PERCENTAGE' ? 500 : undefined}
                                        />
                                      </div>
                                    ) : (
                                      <div className={styles.serviceDisplay}>
                                        <div className={styles.finalPrice}>
                                          {finalPrice ? formatCurrency(finalPrice) : '-'}
                                        </div>
                                        {adjustment.value && (
                                          <div className={styles.adjustmentInfo}>
                                            {adjustment.mode === 'FIXED' 
                                              ? `+${formatCurrency(adjustment.value)}`
                                              : `+${adjustment.value}%`
                                            }
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {validationErrors.seasonPrices && (
                  <div className={styles.errorText} style={{ marginTop: '12px' }}>
                    {validationErrors.seasonPrices}
                  </div>
                )}
                {validationErrors.serviceAdjustments && (
                  <div className={styles.errorText} style={{ marginTop: '12px' }}>
                    {validationErrors.serviceAdjustments}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 