import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSave, FiTrash2, FiCopy, FiCalendar, FiDollarSign, FiSettings, FiPercent } from 'react-icons/fi';
import { useSeasonBlock } from '../../hooks/useSeasonBlock';
import ConfirmationModal from '../ConfirmationModal';
import styles from './SeasonBlockModal.module.css';

const SeasonBlockModal = ({ 
  isOpen, 
  onClose, 
  blockId = null, 
  hotelId, 
  onSaved,
  onDeleted 
}) => {
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);
  
  // Estados locales
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

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
    updateServiceAdjustment,
    copyValueToRow,
    copyValueToColumn,
    copyValueToAll,
    saveSeasonBlock,
    confirmSeasonBlock,
    deleteSeasonBlock,
    cloneSeasonBlock,
    setError,
    // Nuevas funciones para el diseño combinado
    updateServiceSelection,
    getEnabledServiceTypes,
    getCombinedPrice,
    updateCombinedPrice,
    getSeasonPrice,
    getServiceAdjustment
  } = useSeasonBlock(blockId, hotelId);

  // Focus management y accesibilidad
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Manejo del teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Trap focus dentro del modal
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen, loading]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  // Manejo correcto de eventos del overlay para evitar cierre accidental
  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      handleClose();
    }
    mouseDownOnOverlay.current = false;
  };

  const handleSave = async (force = false) => {
    const result = await saveSeasonBlock(force);
    
    if (result.success) {
      showNotification(
        blockId ? 'Cambios guardados en borrador' : 'Bloque de temporada creado exitosamente'
      );
      onSaved?.(result.data);
      if (!blockId) {
        onClose();
      }
    } else if (result.hasConflict) {
      setShowConflictModal(true);
    } else {
      showNotification(result.error || 'Error al guardar el bloque de temporada', 'error');
    }
  };

  const handleConfirm = async () => {
    const result = await confirmSeasonBlock();
    
    if (result.success) {
      showNotification(result.message || 'Cambios confirmados exitosamente');
      onSaved?.(result.data);
      onClose();
    } else {
      showNotification(result.error || 'Error al confirmar los cambios', 'error');
    }
  };

  const handleForcesSave = async () => {
    setShowConflictModal(false);
    await handleSave(true);
  };

  const handleDelete = async () => {
    const result = await deleteSeasonBlock();
    
    if (result.success) {
      showNotification('Bloque de temporada eliminado exitosamente');
      onDeleted?.(blockId);
      onClose();
    } else {
      showNotification(result.error || 'Error al eliminar el bloque de temporada', 'error');
    }
    
    setShowDeleteConfirmation(false);
  };

  const handleClone = () => {
    cloneSeasonBlock();
    showNotification('Bloque clonado. Modifica las fechas y guarda para crear una copia.');
  };



  const handleQuickCopyColumn = (serviceTypeId) => {
    const firstAdjustment = formData.serviceAdjustments.find(
      adj => adj.serviceTypeId === serviceTypeId && adj.value !== ''
    );
    
    if (firstAdjustment) {
      copyValueToColumn(serviceTypeId, firstAdjustment.value, firstAdjustment.mode);
      showNotification(`Valor copiado a toda la columna`, 'info');
    }
  };

  const handleQuickCopyRow = (roomTypeId) => {
    const firstAdjustment = formData.serviceAdjustments.find(
      adj => adj.roomTypeId === roomTypeId && adj.value !== ''
    );
    
    if (firstAdjustment) {
      copyValueToRow(roomTypeId, firstAdjustment.serviceTypeId, firstAdjustment.value, firstAdjustment.mode);
      showNotification(`Valor copiado a toda la fila`, 'info');
    }
  };

  const handleQuickCopyAll = () => {
    const firstAdjustment = formData.serviceAdjustments.find(adj => adj.value !== '');
    
    if (firstAdjustment) {
      copyValueToAll(firstAdjustment.value, firstAdjustment.mode);
      showNotification(`Valor copiado a toda la tabla`, 'info');
    }
  };

  if (!isOpen) return null;

  return (
    <>
              <div className={styles.modalOverlay} onMouseDown={handleOverlayMouseDown} onMouseUp={handleOverlayMouseUp}>
        <div 
          className={styles.modalContent}
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
        >
          {/* Header */}
          <div className={styles.modalHeader}>
            <div>
              <h2 id="modal-title">
                {blockId ? 'Editar Bloque de Temporada' : 'Nuevo Bloque de Temporada'}
              </h2>
              {blockId && formData.isDraft && (
                <div className={styles.draftIndicator}>
                  <span>📝 Cambios sin confirmar</span>
                </div>
              )}
            </div>
            <button
              className={styles.closeButton}
              onClick={handleClose}
              disabled={saving}
              aria-label="Cerrar modal"
            >
              <FiX />
            </button>
          </div>

          {/* Body */}
          <div className={styles.modalBody}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                <span>Cargando datos...</span>
              </div>
            ) : error ? (
              <div className={styles.error}>
                <span>⚠️</span>
                <div>
                  <h3>Error al cargar los datos</h3>
                  <p>{error}</p>
                  <button 
                    className={`${styles.button} ${styles.buttonCancel}`}
                    onClick={() => setError(null)}
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.bodyContent}>
                {/* Left Column - Configuration */}
                <div className={styles.leftColumn}>
                  {/* Basic Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      <FiSettings /> Información Básica
                    </h3>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="block-name" className={`${styles.label} ${styles.required}`}>
                        Nombre del Bloque
                      </label>
                      <input
                        id="block-name"
                        ref={firstInputRef}
                        type="text"
                        className={`${styles.input} ${validationErrors.name ? styles.error : ''}`}
                        value={formData.name}
                        onChange={(e) => updateFormData('name', e.target.value)}
                        placeholder="Ej: Temporada Alta 2025"
                        aria-invalid={!!validationErrors.name}
                        aria-describedby={validationErrors.name ? 'name-error' : undefined}
                      />
                      {validationErrors.name && (
                        <span id="name-error" className={styles.errorText}>
                          {validationErrors.name}
                        </span>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="block-description" className={styles.label}>
                        Descripción
                      </label>
                      <textarea
                        id="block-description"
                        className={styles.textarea}
                        value={formData.description}
                        onChange={(e) => updateFormData('description', e.target.value)}
                        placeholder="Descripción opcional del bloque de temporada"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      <FiCalendar /> Período de Vigencia
                    </h3>
                    
                    <div className={styles.dateGroup}>
                      <div className={styles.formGroup}>
                        <label htmlFor="start-date" className={`${styles.label} ${styles.required}`}>
                          Fecha de Inicio
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          className={`${styles.input} ${validationErrors.startDate ? styles.error : ''}`}
                          value={formData.startDate}
                          onChange={(e) => updateFormData('startDate', e.target.value)}
                          aria-invalid={!!validationErrors.startDate}
                          aria-describedby={validationErrors.startDate ? 'start-date-error' : undefined}
                        />
                        {validationErrors.startDate && (
                          <span id="start-date-error" className={styles.errorText}>
                            {validationErrors.startDate}
                          </span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="end-date" className={`${styles.label} ${styles.required}`}>
                          Fecha de Fin
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          className={`${styles.input} ${validationErrors.endDate ? styles.error : ''}`}
                          value={formData.endDate}
                          onChange={(e) => updateFormData('endDate', e.target.value)}
                          aria-invalid={!!validationErrors.endDate}
                          aria-describedby={validationErrors.endDate ? 'end-date-error' : undefined}
                        />
                        {validationErrors.endDate && (
                          <span id="end-date-error" className={styles.errorText}>
                            {validationErrors.endDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>


                </div>

                {/* Right Column - Service Selection and Combined Table */}
                <div className={styles.rightColumn}>
                  {/* Service Selection Panel */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      <FiSettings /> Servicios Incluidos
                    </h3>
                    <div className={styles.serviceSelectionGrid}>
                      {serviceTypes.map(serviceType => {
                        const isBaseService = serviceType.name === 'Solo Alojamiento';
                        const isEnabled = formData.blockServiceSelections?.find(
                          s => s.serviceTypeId === serviceType.id
                        )?.isEnabled ?? true;
                        
                        return (
                          <div key={serviceType.id} className={styles.serviceSelectionItem}>
                            <label className={styles.serviceToggle}>
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => updateServiceSelection(serviceType.id, e.target.checked)}
                                disabled={isBaseService} // El alojamiento siempre está habilitado
                              />
                              <span className={styles.serviceName}>
                                {serviceType.name}
                                {isBaseService && <span className={styles.baseServiceLabel}> (Base)</span>}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Combined Prices Table */}
                  <div className={styles.tableSection}>
                    <div className={styles.tableSectionHeader}>
                      <div className={styles.tableHeaderLeft}>
                        <h3 className={styles.tableSectionTitle}>
                          <FiDollarSign /> Establecer Tarifas
                        </h3>
                        <div className={styles.adjustmentModeSelector}>
                          <label className={styles.modeLabel}>Modo de ajuste:</label>
                          <div className={styles.modeButtons}>
                            <button
                              type="button"
                              className={`${styles.modeButton} ${formData.serviceAdjustmentMode === 'FIXED' ? styles.active : ''}`}
                              onClick={() => updateFormData('serviceAdjustmentMode', 'FIXED')}
                            >
                              <FiDollarSign /> Monto fijo
                            </button>
                            <button
                              type="button"
                              className={`${styles.modeButton} ${formData.serviceAdjustmentMode === 'PERCENTAGE' ? styles.active : ''}`}
                              onClick={() => updateFormData('serviceAdjustmentMode', 'PERCENTAGE')}
                            >
                              <FiPercent /> Porcentaje
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className={styles.quickActions}>
                        <button
                          type="button"
                          className={styles.quickActionButton}
                          onClick={handleQuickCopyAll}
                          title="Copiar primer valor a toda la tabla"
                        >
                          Copiar Todo
                        </button>
                      </div>
                    </div>
                    
                    <div className={styles.tableContainer}>
                      <table className={styles.table} role="table">
                        <thead>
                          <tr>
                            <th scope="col">Habitación</th>
                            {getEnabledServiceTypes().map(serviceType => (
                              <th key={serviceType.id} scope="col">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {serviceType.name}
                                  <button
                                    type="button"
                                    className={styles.copyButton}
                                    onClick={() => handleQuickCopyColumn(serviceType.id)}
                                    title={`Copiar primer valor a toda la columna ${serviceType.name}`}
                                    aria-label={`Copiar valor a columna ${serviceType.name}`}
                                  >
                                    <FiCopy />
                                  </button>
                                </div>
                              </th>
                            ))}
                          </tr>
                          {/* Percentage Adjustment Row */}
                          {formData.serviceAdjustmentMode === 'PERCENTAGE' && (
                            <tr>
                              <th scope="col" style={{ background: '#f8f9fa' }}>Ajuste (%)</th>
                              {getEnabledServiceTypes().map(serviceType => {
                                const isBaseService = serviceType.name === 'Solo Alojamiento';
                                const adjustment = getServiceAdjustment(null, serviceType.id);
                                
                                return (
                                  <th key={`adj-${serviceType.id}`} style={{ background: '#f8f9fa' }}>
                                    {!isBaseService ? (
                                      <div className={styles.adjustmentInputGroup}>
                                        <input
                                          type="number"
                                          className={styles.adjustmentInput}
                                          value={adjustment.value || ''}
                                          onChange={(e) => updateServiceAdjustment(
                                            null, 
                                            serviceType.id, 
                                            'value', 
                                            e.target.value
                                          )}
                                          placeholder="0"
                                          min="-100"
                                          max="500"
                                          step="1"
                                          aria-label={`Ajuste porcentual para ${serviceType.name}`}
                                        />
                                        <span>%</span>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#6c757d' }}>-</span>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <strong>{roomType.name}</strong>
                                  <button
                                    type="button"
                                    className={styles.copyButton}
                                    onClick={() => handleQuickCopyRow(roomType.id)}
                                    title={`Copiar primer valor a toda la fila ${roomType.name}`}
                                    aria-label={`Copiar valor a fila ${roomType.name}`}
                                  >
                                    <FiCopy />
                                  </button>
                                </div>
                              </td>
                              {getEnabledServiceTypes().map(serviceType => {
                                const isBaseService = serviceType.name === 'Solo Alojamiento';
                                const price = isBaseService ? 
                                  getSeasonPrice(roomType.id) : 
                                  getCombinedPrice(roomType.id, serviceType.id);
                                
                                return (
                                  <td key={serviceType.id} className={styles.priceCell}>
                                    <input
                                      type="number"
                                      className={styles.priceInput}
                                      value={price?.basePrice || price?.finalPrice || ''}
                                      onChange={(e) => updateCombinedPrice(roomType.id, serviceType.id, e.target.value)}
                                      placeholder="0"
                                      min="0"
                                      step="1"
                                      aria-label={`Precio para ${roomType.name} - ${serviceType.name}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {validationErrors.seasonPrices && (
                      <div className={styles.errorText} style={{ padding: '12px 16px' }}>
                        {validationErrors.seasonPrices}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <div className={styles.footerLeft}>
              {blockId && (
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonDelete}`}
                  onClick={() => setShowDeleteConfirmation(true)}
                  disabled={saving}
                >
                  <FiTrash2 />
                  Eliminar
                </button>
              )}
              {blockId && (
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonClone}`}
                  onClick={handleClone}
                  disabled={saving}
                >
                  <FiCopy />
                  Clonar
                </button>
              )}
            </div>

            <div className={styles.footerRight}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonCancel}`}
                onClick={handleClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSave}`}
                onClick={() => handleSave()}
                disabled={saving || loading}
              >
                {saving ? (
                  <>
                    <div className={styles.loadingSpinner}></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <FiSave />
                    {blockId ? 'Guardar Cambios' : 'Crear'}
                  </>
                )}
              </button>
              {blockId && (
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonConfirm}`}
                  onClick={handleConfirm}
                  disabled={saving || loading}
                >
                  {saving ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Confirmando...
                    </>
                  ) : (
                    <>
                      <FiSave />
                      Confirmar Cambios
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict Modal */}
      {showConflictModal && (
        <div className={styles.conflictModal}>
          <div className={styles.conflictContent}>
            <div className={styles.conflictIcon}>⚠️</div>
            <h3 className={styles.conflictTitle}>Conflicto de Fechas Detectado</h3>
            <p className={styles.conflictMessage}>
              Las fechas seleccionadas se solapan con otros bloques de temporada existentes. 
              ¿Deseas forzar el guardado de todas formas?
            </p>
            <div className={styles.conflictActions}>
              <button
                className={`${styles.button} ${styles.buttonCancel}`}
                onClick={() => setShowConflictModal(false)}
              >
                Cancelar
              </button>
              <button
                className={`${styles.button} ${styles.buttonSave}`}
                onClick={handleForcesSave}
              >
                Forzar Guardado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDelete}
        title="Confirmar Eliminación"
        message={`¿Estás seguro de que deseas eliminar el bloque "${formData.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Notification */}
      {notification.show && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: notification.type === 'success' ? '#28a745' : 
                     notification.type === 'error' ? '#dc3545' : '#17a2b8',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '6px',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: '400px'
        }}>
          {notification.message}
        </div>
      )}
    </>
  );
};

export default SeasonBlockModal; 