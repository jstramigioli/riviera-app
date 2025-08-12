import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiEdit3, FiTrash2, FiCopy, FiSave, FiX, FiSettings, FiPercent, FiDollarSign, FiInfo } from 'react-icons/fi';
import { useSeasonBlockV2 } from '../../hooks/useSeasonBlockV2';
import BlockServiceSelectionManager from './BlockServiceSelectionManager';
import ConfirmationModal from '../ConfirmationModal';
import styles from './SeasonBlockBarV2.module.css';

const SeasonBlockBarV2 = ({ block, onDeleted, hotelId = 'default-hotel' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [editingCell, setEditingCell] = useState({ roomTypeId: null, serviceTypeId: null, value: '' });
  const [percentageAdjustments, setPercentageAdjustments] = useState({});

  const {
    loading,
    error,
    formData,
    roomTypes,
    prices,
    roundingConfig,
    validationErrors,
    updateFormData,
    updatePrice,
    getActiveServiceTypes,
    deleteSeasonBlock,
    cloneSeasonBlock,
    setError,
    toggleSelection
  } = useSeasonBlockV2(block?.id, hotelId);

  // Cargar porcentajes de ajuste desde el backend
  useEffect(() => {
    const loadPercentageAdjustments = async () => {
      if (!block?.id) return;
      
      try {
        console.log('=== DEBUG LOADING PERCENTAGES ===');
        console.log('block.id:', block.id);
        
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/block-service-selections/block/${block.id}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Selecciones cargadas:', data);
          
          const adjustments = {};
          
          data.forEach(selection => {
            if (selection.percentageAdjustment !== null && selection.percentageAdjustment !== undefined) {
              adjustments[selection.id] = selection.percentageAdjustment;
            }
          });
          
          console.log('Ajustes cargados:', adjustments);
          setPercentageAdjustments(adjustments);
        }
      } catch (error) {
        console.error('Error loading percentage adjustments:', error);
      }
    };

    loadPercentageAdjustments();
  }, [block?.id]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async () => {
    const result = await deleteSeasonBlock();
    if (result.success) {
      showNotification('Bloque eliminado correctamente');
      onDeleted?.();
    } else {
      showNotification(result.error, 'error');
    }
    setShowDeleteConfirmation(false);
  };

  const handleClone = () => {
    cloneSeasonBlock();
    setIsEditing(true);
    setIsExpanded(true);
    showNotification('Bloque clonado. Ajusta las fechas y guarda.', 'info');
  };

  const handleProportionToggle = (enabled) => {
    updateFormData('useProportions', enabled);
  };

  // Función para manejar el toggle de servicios
  const handleServiceToggle = async (serviceTypeId, isEnabled) => {
    try {
      // Buscar la selección del servicio
      const selection = getActiveServiceTypes().find(s => s.serviceTypeId === serviceTypeId || s.id === serviceTypeId);
      if (selection) {
        await toggleSelection(selection.id, !isEnabled);
      }
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  // Función para manejar cambios en porcentajes de ajuste
  const handlePercentageChange = (serviceTypeId, value) => {
    setPercentageAdjustments(prev => ({
      ...prev,
      [serviceTypeId]: value
    }));
  };

  // Función para guardar porcentaje cuando se presiona Enter
  const handlePercentageKeyPress = async (e, serviceTypeId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = parseFloat(e.target.value) || 0;
      
      console.log('=== DEBUG PERCENTAGE SAVE ===');
      console.log('serviceTypeId:', serviceTypeId);
      console.log('value:', value);
      console.log('getActiveServiceTypes():', getActiveServiceTypes());
      
      try {
        // Guardar el porcentaje en el backend
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/block-service-selections/${serviceTypeId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            percentageAdjustment: value
          })
        });

        if (response.ok) {
          // Actualizar el estado local
          setPercentageAdjustments(prev => ({
            ...prev,
            [serviceTypeId]: value
          }));
          
          // Quitar el foco del input
          e.target.blur();
          
          showNotification(`Porcentaje de ajuste guardado: ${value}%`, 'success');
        } else {
          const errorData = await response.json();
          console.error('Response error:', errorData);
          throw new Error(`Error al guardar el porcentaje: ${response.status}`);
        }
      } catch (error) {
        console.error('Error saving percentage:', error);
        showNotification('Error al guardar el porcentaje', 'error');
      }
    }
  };





  // Manejar inicio de edición de precio
  const handlePriceInputFocus = (roomTypeId, serviceTypeId) => {
    const currentPrice = prices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    );
    setEditingCell({
      roomTypeId,
      serviceTypeId,
      value: currentPrice?.basePrice?.toString() || '0'
    });
  };

  // Manejar cambio durante la edición
  const handlePriceInputChange = (e, roomTypeId, serviceTypeId) => {
    const newValue = e.target.value;
    
    // Actualizar el estado de edición local
    setEditingCell({ 
      roomTypeId, 
      serviceTypeId, 
      value: newValue 
    });
  };

  // Confirmar cambio de precio (aplicar proporciones)
  const handlePriceInputConfirm = (e) => {
    const roomTypeId = e.target.dataset.roomTypeId;
    const serviceTypeId = e.target.dataset.serviceTypeId;
    const value = e.target.value;
    
    if (roomTypeId && serviceTypeId && value !== '') {
      // Usar el tipo correcto para roomTypeId (puede ser string o number)
      const parsedRoomTypeId = isNaN(roomTypeId) ? roomTypeId : parseInt(roomTypeId);
      
      // Llamar directamente a updatePrice con applyProportions: true
      updatePrice(parsedRoomTypeId, serviceTypeId, value, true);
    }
    
    setEditingCell({ roomTypeId: null, serviceTypeId: null, value: '' });
  };

  // Manejar teclas en input de precio
  const handlePriceInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Función para determinar si una celda debe ser editable
  const isCellEditable = (serviceType) => {
    // El servicio "Solo Alojamiento" siempre es editable (es la tarifa base)
    if (serviceType.serviceType?.name === 'Solo Alojamiento' || 
        serviceType.name === 'Solo Alojamiento') {
      return true;
    }
    
    // Los servicios con modo "FIXED" son editables
    if (serviceType.pricingMode === 'FIXED') {
      return true;
    }
    
    // Los servicios con modo "PERCENTAGE" NO son editables (se calculan automáticamente)
    if (serviceType.pricingMode === 'PERCENTAGE') {
      return false;
    }
    
    // Por defecto, no editable
    return false;
  };

  const getPriceDisplayInfo = (roomTypeId, serviceTypeId) => {
    const currentPrice = prices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    );
    
    const basePrice = currentPrice?.basePrice || 0;
    
    // Aplicar porcentaje de ajuste si existe
    const percentageAdjustment = percentageAdjustments[serviceTypeId];
    let adjustedPrice = basePrice;
    
    if (percentageAdjustment && percentageAdjustment !== 0) {
      const adjustmentMultiplier = 1 + (percentageAdjustment / 100);
      adjustedPrice = Math.round(basePrice * adjustmentMultiplier);
    }
    
    const roundedPrice = adjustedPrice; // Por ahora sin redondeo adicional
    
    return {
      adjustedPrice: adjustedPrice,
      roundedPrice: roundedPrice,
      wasRounded: false,
      adjustment: percentageAdjustment ? {
        mode: 'PERCENTAGE',
        value: percentageAdjustment
      } : null
    };
  };

  if (loading) {
    return (
      <div className={styles.bar}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Cargando bloque...</span>
        </div>
      </div>
    );
  }

  if (error && !isEditing) {
    return (
      <div className={styles.bar}>
        <div className={styles.error}>
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} className={styles.errorClose}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.bar} ${isExpanded ? styles.expanded : ''} ${isEditing ? styles.editing : ''}`}>
      {/* Notificación */}
      {notification.show && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          {notification.message}
        </div>
      )}

      {/* Cabecera del bloque */}
      <div className={styles.header} onClick={handleToggleExpand}>
        <div className={styles.expandIcon}>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        <div className={styles.info}>
          <div className={styles.title}>
            {isEditing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                className={`${styles.titleInput} ${validationErrors.name ? styles.error : ''}`}
                placeholder="Nombre del bloque"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3>{formData.name || block?.name}</h3>
            )}
          </div>
          
          <div className={styles.subtitle}>
            {isEditing ? (
              <div className={styles.dateInputs} onClick={(e) => e.stopPropagation()}>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateFormData('startDate', e.target.value)}
                  className={`${styles.dateInput} ${validationErrors.startDate ? styles.error : ''}`}
                />
                <span> - </span>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateFormData('endDate', e.target.value)}
                  className={`${styles.dateInput} ${validationErrors.endDate ? styles.error : ''}`}
                />
              </div>
            ) : (
              <span>{formatDate(formData.startDate || block?.startDate)} - {formatDate(formData.endDate || block?.endDate)}</span>
            )}
          </div>
          
          <div className={styles.description}>
            {isEditing ? (
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                className={styles.descriptionInput}
                placeholder="Descripción del bloque"
                onClick={(e) => e.stopPropagation()}
                rows={2}
              />
            ) : (
              <p>{formData.description || block?.description}</p>
            )}
          </div>
        </div>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleClone}
            className={`${styles.actionBtn} ${styles.clone}`}
            title="Duplicar"
          >
            <FiCopy />
          </button>
          <button
            onClick={() => setShowDeleteConfirmation(true)}
            className={`${styles.actionBtn} ${styles.delete}`}
            title="Eliminar"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Panel de configuración */}
          <div className={styles.configPanel}>
            <h4><FiSettings /> Configuración</h4>
            
            {/* Toggle de proporciones */}
            <div className={styles.configRow}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={formData.useProportions}
                  onChange={(e) => handleProportionToggle(e.target.checked)}
                  disabled={!isEditing}
                />
                <span className={styles.toggleSlider}></span>
                Usar proporciones inteligentes
                {formData.useProportions && (
                  <span className={styles.activeIndicator} title="Proporciones activadas">✓</span>
                )}
              </label>
              
              {formData.useProportions ? (
                <div className={styles.proportionInfo}>
                  <FiInfo />
                  <span>🔗 Al cambiar cualquier precio, todos los demás se ajustarán proporcionalmente</span>
                </div>
              ) : (
                <div className={styles.proportionWarning}>
                  <FiInfo />
                  <span>⚠️ Proporciones desactivadas: solo se modificará el precio individual</span>
                </div>
              )}
            </div>

            {/* Modo de ajuste de servicios */}
            <div className={styles.configRow}>
              <label>Modo de ajuste de servicios:</label>
              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    value="PERCENTAGE"
                    checked={formData.serviceAdjustmentMode === 'PERCENTAGE'}
                    onChange={(e) => updateFormData('serviceAdjustmentMode', e.target.value)}
                    disabled={!isEditing}
                  />
                  <FiPercent /> Porcentaje
                </label>
                <label>
                  <input
                    type="radio"
                    value="FIXED"
                    checked={formData.serviceAdjustmentMode === 'FIXED'}
                    onChange={(e) => updateFormData('serviceAdjustmentMode', e.target.value)}
                    disabled={!isEditing}
                  />
                  <FiDollarSign /> Monto fijo
                </label>
              </div>
            </div>
          </div>







          {/* Botón de prueba temporal para verificar proporciones */}


          {/* Tabla de precios */}
          <div className={styles.pricesTable}>
            <h4><FiDollarSign /> Tabla de Precios</h4>
            
            {roundingConfig && roundingConfig.multiple > 1 && (
              <div className={styles.roundingInfo}>
                <FiInfo />
                <span>Redondeo activo: múltiplos de ${roundingConfig.multiple} ({roundingConfig.mode})</span>
              </div>
            )}

            <div className={styles.tableContainer}>
              <table className={styles.pricesGrid}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Habitación</th>
                    {getActiveServiceTypes().map(serviceType => {
                      const isServiceEnabled = serviceType.isEnabled;
                      const isBaseService = serviceType.serviceType?.name === 'Solo Alojamiento';
                      return (
                        <th 
                          key={serviceType.id} 
                          style={{ 
                            textAlign: 'center',
                            opacity: isServiceEnabled ? 1 : 0.6,
                            color: isServiceEnabled ? '#374151' : '#6c757d'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span>{serviceType.serviceType?.name || serviceType.name}</span>
                            {!isBaseService && (
                              <button
                                onClick={() => handleServiceToggle(serviceType.id, isServiceEnabled)}
                                style={{
                                  background: 'none',
                                  border: `1px solid ${isServiceEnabled ? '#dc3545' : '#28a745'}`,
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  color: isServiceEnabled ? '#dc3545' : '#28a745'
                                }}
                                title={isServiceEnabled ? 'Deshabilitar servicio' : 'Habilitar servicio'}
                              >
                                {isServiceEnabled ? 'Deshabilitar' : 'Habilitar'}
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  {formData.serviceAdjustmentMode === 'PERCENTAGE' && (
                    <tr>
                      <th style={{ textAlign: 'center', background: '#f8f9fa' }}>Porcentaje de Ajuste</th>
                      {getActiveServiceTypes().map(serviceType => {
                        const isServiceEnabled = serviceType.isEnabled;
                        const isBaseService = serviceType.serviceType?.name === 'Solo Alojamiento';
                        const currentPercentage = percentageAdjustments[serviceType.id] || '';
                        
                        return (
                          <th 
                            key={`percentage-${serviceType.id}`} 
                            style={{ 
                              textAlign: 'center',
                              background: '#f8f9fa',
                              opacity: isServiceEnabled ? 1 : 0.6
                            }}
                          >
                            {!isBaseService ? (
                              <input
                                type="number"
                                placeholder="0%"
                                value={currentPercentage}
                                onChange={(e) => handlePercentageChange(serviceType.id, e.target.value)}
                                onKeyPress={(e) => handlePercentageKeyPress(e, serviceType.id)}
                                style={{
                                  width: '60px',
                                  textAlign: 'center',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  padding: '4px',
                                  fontSize: '12px'
                                }}
                                disabled={!isServiceEnabled}
                              />
                            ) : (
                              <span style={{ color: '#6c757d', fontSize: '12px' }}>-</span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {roomTypes.map(roomType => (
                    <tr key={roomType.id}>
                      <td className={styles.roomTypeCell}>
                        <strong>{roomType.name}</strong>
                      </td>
                      {getActiveServiceTypes().map(serviceType => {
                        const serviceTypeId = serviceType.serviceTypeId || serviceType.id;
                        const priceInfo = getPriceDisplayInfo(roomType.id, serviceTypeId);
                        const currentPrice = prices.find(p => 
                          p.roomTypeId === roomType.id && p.serviceTypeId === serviceTypeId
                        );
                        const isCurrentlyEditing = editingCell.roomTypeId === roomType.id && 
                                                  editingCell.serviceTypeId === serviceTypeId;
                        const isEditable = isCellEditable(serviceType);
                        const isServiceEnabled = serviceType.isEnabled;
                        
                        return (
                          <td key={serviceTypeId} className={`${styles.priceCell} ${!isServiceEnabled ? styles.disabledService : ''}`}>
                            {isEditing && isEditable ? (
                              <input
                                type="number"
                                value={isCurrentlyEditing ? editingCell.value : (currentPrice?.basePrice?.toString() || '0')}
                                onChange={(e) => handlePriceInputChange(e, roomType.id, serviceTypeId)}
                                onFocus={() => handlePriceInputFocus(roomType.id, serviceTypeId)}
                                onBlur={(e) => handlePriceInputConfirm(e)}
                                onKeyPress={handlePriceInputKeyPress}
                                className={styles.priceInput}
                                step="1"
                                min="0"
                                data-room-type-id={roomType.id}
                                data-service-type-id={serviceTypeId}
                              />
                            ) : (
                              <div className={styles.priceDisplay}>
                                <div className={styles.finalPrice}>
                                  {formatCurrency(priceInfo.roundedPrice)}
                                </div>
                                {priceInfo.wasRounded && (
                                  <div className={styles.originalPrice} title={`Precio original: ${formatCurrency(priceInfo.adjustedPrice)}`}>
                                    (de {formatCurrency(priceInfo.adjustedPrice)})
                                  </div>
                                )}
                                {priceInfo.adjustment && priceInfo.adjustment.value !== 0 && (
                                  <div className={styles.adjustmentInfo}>
                                    {priceInfo.adjustment.mode === 'PERCENTAGE' ? 
                                      `${priceInfo.adjustment.value > 0 ? '+' : ''}${priceInfo.adjustment.value}%` :
                                      `${priceInfo.adjustment.value > 0 ? '+' : ''}${formatCurrency(priceInfo.adjustment.value)}`
                                    }
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirmation && (
        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={handleDelete}
          title="Eliminar Bloque de Temporada"
          message={`¿Estás seguro de que deseas eliminar el bloque "${formData.name || block?.name}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          confirmButtonClass="danger"
        />
      )}
    </div>
  );
};

export default SeasonBlockBarV2; 