import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiEdit3, FiTrash2, FiCopy, FiSave, FiX, FiSettings, FiPercent, FiDollarSign, FiInfo, FiCheck } from 'react-icons/fi';
import Switch from 'react-switch';
import { useSeasonBlockV2 } from '../../hooks/useSeasonBlockV2';
import BlockServiceSelectionManager from './BlockServiceSelectionManager';
import ConfirmationModal from '../ConfirmationModal';
import styles from './SeasonBlockBarV2.module.css';

const SeasonBlockBarV2 = ({ block, onDeleted, onSaved, onBlockUpdated, onResetBlock, hotelId = 'default-hotel', autoOpenEdit = false, onEditOpened }) => {
  console.log('SeasonBlockBarV2 - Component mounted/rendered with block:', block?.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [editingCell, setEditingCell] = useState({ roomTypeId: null, serviceTypeId: null, value: '' });
  const [percentageAdjustments, setPercentageAdjustments] = useState({});
  
  // Estados para campos editables individuales
  const [editingField, setEditingField] = useState({ name: false, startDate: false, endDate: false, description: false });
  
  // Estado para rastrear cambios en tarifas
  const [hasTariffChanges, setHasTariffChanges] = useState(false);
  const [originalPrices, setOriginalPrices] = useState([]);
  
  // Estado para rastrear cualquier tipo de cambio
  const [hasAnyChanges, setHasAnyChanges] = useState(false);
  const [originalFormData, setOriginalFormData] = useState({});
  const [originalBlockServiceSelections, setOriginalBlockServiceSelections] = useState([]);


  const {
    loading,
    error,
    formData,
    prices,
    roomTypes,

    blockServiceSelections,
    roundingConfig,
    validationErrors,
    updateFormData,
    updatePrice,
    getActiveServiceTypes,
    saveSeasonBlock,
    confirmSeasonBlock,
    deleteSeasonBlock,
    cloneSeasonBlock,
    setError,

    setBlockServiceSelections,
    setPrices,
    resetPrices,
    resetAllData
  } = useSeasonBlockV2(block?.id, hotelId);
  
  // Debug log para verificar el valor de serviceAdjustmentMode
  console.log('SeasonBlockBarV2 - formData.serviceAdjustmentMode:', formData.serviceAdjustmentMode, 'at', new Date().toISOString());
  console.log('SeasonBlockBarV2 - block received:', block);
  console.log('SeasonBlockBarV2 - block.blockServiceSelections:', block?.blockServiceSelections);

  // Abrir automáticamente en modo edición si autoOpenEdit es true
  useEffect(() => {
    if (autoOpenEdit && !isExpanded && !isEditing) {
      console.log('Auto-opening block in edit mode:', block?.id);
      setIsExpanded(true);
      setIsEditing(true);
      // Notificar al padre que se abrió el modo edición
      if (onEditOpened) {
        onEditOpened();
      }
    }
  }, [autoOpenEdit, isExpanded, isEditing, block?.id, onEditOpened]);

  // Cargar porcentajes de ajuste desde el backend
  useEffect(() => {
    const loadPercentageAdjustments = async () => {
      if (!block?.id) return;
      
      try {
        console.log('=== DEBUG LOADING PERCENTAGES ===');
        console.log('block.id:', block.id);
        console.log('block.isDraft:', block.isDraft);
        
        // Solo cargar desde el endpoint si el bloque no es un borrador
        if (!block.isDraft) {
          console.log('Loading from API endpoint (block is confirmed)');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/block-service-selections/block/${block.id}`);
        if (response.ok) {
          const data = await response.json();
            console.log('Selecciones cargadas desde API:', data);
          
          const adjustments = {};
            data.forEach(selection => {
              console.log(`Selection ${selection.id}:`, {
                serviceTypeId: selection.serviceTypeId,
                percentageAdjustment: selection.percentageAdjustment,
                isEnabled: selection.isEnabled
              });
              
            if (selection.percentageAdjustment !== null && selection.percentageAdjustment !== undefined) {
              adjustments[selection.id] = selection.percentageAdjustment;
            }
          });
          
            console.log('Ajustes cargados desde API:', adjustments);
          setPercentageAdjustments(adjustments);
          } else {
            console.error('Error loading from API:', response.status, response.statusText);
          }
        } else {
          console.log('Block is draft, not loading percentages from API');
        }
      } catch (error) {
        console.error('Error loading percentage adjustments:', error);
      }
    };

    loadPercentageAdjustments();
  }, [block?.id, block?.isDraft]);

  // Rastrear cambios en las tarifas
  useEffect(() => {
    if (prices.length > 0 && originalPrices.length === 0) {
      console.log('=== INITIALIZING ORIGINAL PRICES ===');
      console.log('prices to save as original:', prices);
      setOriginalPrices([...prices]);
    }
    
    if (originalPrices.length > 0 && prices.length > 0) {
      const hasChanges = prices.some((price, index) => {
        const original = originalPrices[index];
        return original && price.basePrice !== original.basePrice;
      });
      setHasTariffChanges(hasChanges);
    }
  }, [prices, originalPrices]);

  // Rastrear cualquier tipo de cambio
  useEffect(() => {
    // Inicializar datos originales cuando se cargan
    if (formData && Object.keys(formData).length > 0 && Object.keys(originalFormData).length === 0) {
      console.log('=== INITIALIZING ORIGINAL FORM DATA ===');
      setOriginalFormData({ ...formData });
    }
    
    if (blockServiceSelections.length > 0 && originalBlockServiceSelections.length === 0) {
      console.log('=== INITIALIZING ORIGINAL BLOCK SERVICE SELECTIONS ===');
      setOriginalBlockServiceSelections([...blockServiceSelections]);
    }
    
    // Detectar cambios en formData
    const hasFormDataChanges = Object.keys(originalFormData).length > 0 && 
      Object.keys(formData).some(key => formData[key] !== originalFormData[key]);
    
    // Detectar cambios en blockServiceSelections
    const hasServiceChanges = originalBlockServiceSelections.length > 0 && 
      blockServiceSelections.some((selection, index) => {
        const original = originalBlockServiceSelections[index];
        return original && (
          selection.isEnabled !== original.isEnabled ||
          selection.percentageAdjustment !== original.percentageAdjustment
        );
      });
    
    // Cualquier cambio (tarifas, formData, o servicios)
    const anyChanges = hasTariffChanges || hasFormDataChanges || hasServiceChanges;
    setHasAnyChanges(anyChanges);
    
    console.log('=== CHANGE DETECTION ===');
    console.log('hasTariffChanges:', hasTariffChanges);
    console.log('hasFormDataChanges:', hasFormDataChanges);
    console.log('hasServiceChanges:', hasServiceChanges);
    console.log('hasAnyChanges:', anyChanges);
  }, [prices, originalPrices, formData, originalFormData, blockServiceSelections, originalBlockServiceSelections, hasTariffChanges]);

  // Forzar actualización después de guardar exitosamente
  useEffect(() => {
    if (!hasTariffChanges && !isEditing) {
      // Si no hay cambios y no está en modo edición, asegurar que los toggles se oculten
      console.log('=== FORCING UI UPDATE AFTER SAVE ===');
    }
  }, [hasTariffChanges, isEditing]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Si es una fecha en formato YYYY-MM-DD, usarla directamente
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Si es una fecha ISO, convertirla a YYYY-MM-DD primero
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Usar UTC para evitar problemas de zona horaria
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${day}/${month}/${year}`;
  };

  // Función auxiliar para obtener fechas de manera consistente
  const getDisplayDate = (dateString) => {
    if (!dateString) return '';
    
    // Si es una fecha en formato YYYY-MM-DD, usarla directamente
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // Si es una fecha ISO, convertirla a YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Usar UTC para evitar problemas de zona horaria
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
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

  const handleClone = async () => {
    try {
      const result = await cloneSeasonBlock();
      if (result.success) {
        showNotification('Bloque clonado exitosamente', 'success');
        // Recargar la lista de bloques para mostrar el nuevo bloque
        if (onBlockUpdated) {
          onBlockUpdated();
        }
      } else {
        showNotification(result.error || 'Error al clonar el bloque', 'error');
      }
    } catch (error) {
      console.error('Error in handleClone:', error);
      showNotification('Error al clonar el bloque', 'error');
    }
  };

  const handleConfirm = async () => {
    try {
      // Primero sincronizar los porcentajes de ajuste con el estado del hook
      console.log('=== SAVING CHANGES - STEP 0: SYNC PERCENTAGES ===');
      console.log('Current percentageAdjustments:', percentageAdjustments);
      console.log('Current blockServiceSelections:', blockServiceSelections);
      
      // Crear una copia actualizada de blockServiceSelections con los porcentajes actualizados
      const updatedSelections = blockServiceSelections.map(selection => {
        const updatedPercentage = percentageAdjustments[selection.id] !== undefined 
          ? percentageAdjustments[selection.id] 
          : selection.percentageAdjustment || 0;
        
        console.log(`Selection ${selection.id}:`, {
          original: selection.percentageAdjustment,
          fromAdjustments: percentageAdjustments[selection.id],
          final: updatedPercentage
        });
        
        return {
          ...selection,
          percentageAdjustment: updatedPercentage
        };
      });
      
      console.log('Updated blockServiceSelections:', updatedSelections);
      
      // Actualizar el estado del hook ANTES de guardar
      setBlockServiceSelections(updatedSelections);
      
      // Esperar un momento para que el estado se actualice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Solo guardar los cambios (mantener el estado actual de borrador/activo)
      console.log('=== SAVING CHANGES - STEP 1: SAVE CHANGES ===');
      const saveResult = await saveSeasonBlock();
      
      if (saveResult.success) {
        showNotification('Cambios guardados exitosamente');
        onSaved?.(saveResult.data);
      } else {
        showNotification(saveResult.error || 'Error al guardar los cambios', 'error');
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      showNotification('Error al guardar los cambios', 'error');
    }
  };

  const handleProportionToggle = (enabled) => {
    updateFormData('useProportions', enabled);
  };

  const handlePercentageToggle = (enabled) => {
    const newMode = enabled ? 'PERCENTAGE' : 'FIXED';
    updateFormData('serviceAdjustmentMode', newMode);
  };

  // Funciones para manejar la edición individual de campos
  const handleFieldClick = (fieldName) => {
    if (!isEditing) return;
    setEditingField(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleFieldBlur = (fieldName) => {
    setEditingField(prev => ({ ...prev, [fieldName]: false }));
    // NO guardar automáticamente - los cambios se guardarán con el botón "Guardar"
  };

  const handleFieldKeyPress = (e, fieldName) => {
    if (e.key === 'Enter') {
      setEditingField(prev => ({ ...prev, [fieldName]: false }));
      // NO guardar automáticamente - los cambios se guardarán con el botón "Guardar"
    } else if (e.key === 'Escape') {
      setEditingField(prev => ({ ...prev, [fieldName]: false }));
      // No guardar al presionar Escape
    }
  };

  // Función para revertir cambios en tarifas
  const handleRevertChanges = () => {
    setPrices([...originalPrices]);
    setHasTariffChanges(false);
    showNotification('Cambios revertidos', 'info');
  };

  // Función para forzar recarga del bloque
  const forceReloadBlock = async () => {
    try {
      console.log('=== FORCE RELOADING BLOCK ===');
      
      // Primero, limpiar el estado local
      setHasTariffChanges(false);
      setEditingCell({ roomTypeId: null, serviceTypeId: null, value: '' });
      
      // Intentar recargar directamente desde la API
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/season-blocks/${block?.id}`);
      
      if (response.ok) {
        const blockData = await response.json();
        console.log('Reloaded block data from API:', blockData);
        
        // Si el bloque tiene precios, actualizar el estado local
        if (blockData.data && blockData.data.seasonPrices) {
          console.log('Updating prices with original data:', blockData.data.seasonPrices);
          setPrices(blockData.data.seasonPrices);
          setOriginalPrices(blockData.data.seasonPrices);
        }
      } else {
        console.error('Error reloading block:', response.status);
      }
      
      // Como último recurso, forzar recarga del componente padre
      if (onBlockUpdated) {
        console.log('Calling onBlockUpdated as fallback');
        setTimeout(() => {
          onBlockUpdated();
        }, 100);
      }
    } catch (error) {
      console.error('Error in forceReloadBlock:', error);
      
      // Si todo falla, intentar recargar el componente padre
      if (onBlockUpdated) {
        console.log('Calling onBlockUpdated after error');
        onBlockUpdated();
      }
    }
  };

  // Función para guardar cambios en tarifas
  const handleSaveTariffChanges = async () => {
    const saveResult = await saveSeasonBlock();
    if (saveResult.success) {
      console.log('=== SAVE SUCCESSFUL ===');
      
      setOriginalPrices([...prices]);
      setHasTariffChanges(false);
      setHasAnyChanges(false);
      setIsEditing(false); // Desactivar modo edición después de guardar
      setEditingCell({ roomTypeId: null, serviceTypeId: null, value: '' }); // Limpiar celda en edición
      
      showNotification('Cambios guardados exitosamente');
      
      // Recargar los datos del bloque para sincronizar
      if (onBlockUpdated) {
        onBlockUpdated();
      }
    } else {
      showNotification(saveResult.error || 'Error al guardar los cambios', 'error');
    }
  };

  // Función para manejar el toggle de servicios (solo localmente)
  const handleServiceToggle = async (serviceTypeId, isEnabled) => {
    try {
      console.log('=== TOGGLING SERVICE LOCALLY ===');
      console.log('serviceTypeId:', serviceTypeId);
      console.log('isEnabled:', isEnabled);
      
      // Buscar la selección del servicio
      const selection = getActiveServiceTypes().find(s => s.serviceTypeId === serviceTypeId || s.id === serviceTypeId);
      if (selection) {
        // Solo actualizar el estado local (NO guardar en el backend)
        setBlockServiceSelections(prev => 
          prev.map(s => 
            s.id === selection.id 
              ? { ...s, isEnabled: !isEnabled }
              : s
          )
        );
        
        showNotification(`Servicio ${isEnabled ? 'deshabilitado' : 'habilitado'} (se guardará al confirmar)`, 'info');
        console.log('=== SERVICE TOGGLED LOCALLY - WILL BE SAVED ON CONFIRM ===');
      }
    } catch (error) {
      console.error('Error toggling service locally:', error);
      showNotification('Error al cambiar el estado del servicio', 'error');
    }
  };

  // Función para manejar cambios en porcentajes de ajuste
  const handlePercentageChange = (serviceTypeId, value) => {
    const numericValue = parseFloat(value) || 0;
    
    // Actualizar percentageAdjustments
    const newAdjustments = {
      ...percentageAdjustments,
      [serviceTypeId]: numericValue
    };
    setPercentageAdjustments(newAdjustments);
    
    // También actualizar blockServiceSelections para que se recalculen los precios
    setBlockServiceSelections(prev => 
      prev.map(selection => 
        selection.id === serviceTypeId 
          ? { ...selection, percentageAdjustment: numericValue }
          : selection
      )
    );
  };

  // Función para guardar el porcentaje de ajuste (solo localmente)
  const handlePercentageSave = async (serviceTypeId, value) => {
    const numericValue = parseFloat(value) || 0;
    
    try {
      console.log('=== UPDATING PERCENTAGE LOCALLY ===');
      console.log('serviceTypeId:', serviceTypeId);
      console.log('percentageAdjustment:', numericValue);
      
      // Solo actualizar el estado local (NO guardar en el backend)
        setPercentageAdjustments(prev => ({
          ...prev,
          [serviceTypeId]: numericValue
        }));
        
      // También actualizar el estado blockServiceSelections localmente
        setBlockServiceSelections(prev => 
          prev.map(selection => 
          selection.id === serviceTypeId 
              ? { ...selection, percentageAdjustment: numericValue }
              : selection
          )
        );
        
      showNotification(`Porcentaje actualizado: ${numericValue}% (se guardará al confirmar)`, 'info');
      
      console.log('=== PERCENTAGE UPDATED LOCALLY - WILL BE SAVED ON CONFIRM ===');
    } catch (error) {
      console.error('Error updating percentage locally:', error);
      showNotification('Error al actualizar el porcentaje', 'error');
    }
  };

  // Función para manejar el evento onKeyPress del input de porcentaje
  const handlePercentageKeyPress = async (e, serviceTypeId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handlePercentageSave(serviceTypeId, e.target.value);
      e.target.blur();
    }
  };

  // Función para manejar el evento onBlur del input de porcentaje
  const handlePercentageBlur = async (e, serviceTypeId) => {
    await handlePercentageSave(serviceTypeId, e.target.value);
  };

  // Función para manejar el toggle de borrador/activo
  const handleDraftToggle = async () => {
    try {
      if (!block) return;
      
      const newDraftStatus = !block.isDraft;
      
      // Llamar a la API para actualizar solo el campo isDraft
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/season-blocks/${block.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isDraft: newDraftStatus
        }),
      });
      
      if (response.ok) {
        // Recargar los datos del bloque para sincronizar
        if (onBlockUpdated) {
          onBlockUpdated();
        }
      } else {
        const errorData = await response.json();
        showNotification(
          errorData.errors?.join(', ') || 'Error al cambiar el estado del bloque', 
          'error'
        );
      }
    } catch (error) {
      console.error('Error toggling draft status:', error);
      showNotification('Error al cambiar el estado del bloque', 'error');
    }
  };

  // Funciones para manejar deshacer/rehacer







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
    
    console.log('=== HANDLE PRICE INPUT CHANGE ===');
    console.log('roomTypeId:', roomTypeId);
    console.log('serviceTypeId:', serviceTypeId);
    console.log('newValue:', newValue);
    
    // Actualizar el estado de edición local
    setEditingCell({ 
      roomTypeId, 
      serviceTypeId, 
      value: newValue 
    });
    
    // Detectar cambios inmediatamente comparando con el precio original
    const originalPrice = originalPrices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    );
    
    const numericNewValue = parseFloat(newValue) || 0;
    const hasChanged = originalPrice && numericNewValue !== originalPrice.basePrice;
    
    if (hasChanged) {
      setHasTariffChanges(true);
    }
  };



  // Confirmar cambio de precio (aplicar proporciones)
  const handlePriceInputConfirm = (e) => {
    console.log('=== HANDLE PRICE INPUT CONFIRM ===');
    console.log('Event target:', e.target);
    console.log('Dataset:', e.target.dataset);
    console.log('Editing cell:', editingCell);
    
    const roomTypeId = e.target.dataset.roomTypeId;
    const serviceTypeId = e.target.dataset.serviceTypeId;
    const value = editingCell.value || e.target.value; // Usar editingCell.value como prioridad
    
    console.log('roomTypeId:', roomTypeId);
    console.log('serviceTypeId:', serviceTypeId);
    console.log('editingCell.value:', editingCell.value);
    console.log('e.target.value:', e.target.value);
    console.log('Final value to use:', value);
    
    if (roomTypeId && serviceTypeId && value !== '') {
      // Usar el tipo correcto para roomTypeId (puede ser string o number)
      const parsedRoomTypeId = isNaN(roomTypeId) ? roomTypeId : parseInt(roomTypeId);
      
      console.log('parsedRoomTypeId:', parsedRoomTypeId);
      console.log('Calling updatePrice with:', parsedRoomTypeId, serviceTypeId, value, true);
      
      // Llamar directamente a updatePrice con applyProportions: true
      updatePrice(parsedRoomTypeId, serviceTypeId, value, true);
    } else {
      console.log('Missing required data for price update');
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
    // El servicio "Tarifa base" siempre es editable (es la tarifa base)
    if (serviceType.serviceType?.name === 'Tarifa base' || 
        serviceType.name === 'Tarifa base') {
      return true;
    }
    
    // Si el modo de ajuste global es FIXED, todos los servicios habilitados son editables
    if (formData.serviceAdjustmentMode === 'FIXED') {
      // Verificar si el servicio está habilitado
      const isEnabled = getActiveServiceTypes().some(s => 
        (s.serviceTypeId === serviceType.serviceTypeId || s.id === serviceType.serviceTypeId) && s.isEnabled
      );
      return isEnabled;
    }
    
    // Si el modo de ajuste es PERCENTAGE, solo el servicio base es editable
    if (formData.serviceAdjustmentMode === 'PERCENTAGE') {
      // Solo el servicio "Tarifa base" es editable en modo PERCENTAGE
      // Los demás servicios se calculan automáticamente como porcentajes del base
      return false;
    }
    
    // Por defecto, no editable
    return false;
  };

  const getPriceDisplayInfo = (roomTypeId, serviceTypeId) => {
    const currentPrice = prices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    );
    
    // Buscar el ajuste de porcentaje para este servicio
    // Primero buscar por serviceTypeId directo
    let percentageAdjustment = percentageAdjustments[serviceTypeId];
    
    // Si no se encuentra, buscar en las selecciones de servicios
    if (percentageAdjustment === undefined) {
      const serviceSelection = getActiveServiceTypes().find(s => 
        s.serviceTypeId === serviceTypeId || s.id === serviceTypeId
      );
      if (serviceSelection && serviceSelection.id) {
        percentageAdjustment = percentageAdjustments[serviceSelection.id];
      }
    }
    
    let basePrice = currentPrice?.basePrice || 0;
    let adjustedPrice = basePrice;
    
    // Verificar si este servicio es el servicio base
    const isBaseService = getActiveServiceTypes().some(s => 
      (s.serviceTypeId === serviceTypeId || s.id === serviceTypeId) && 
      (s.serviceType?.name === 'Tarifa base' || s.name === 'Tarifa base')
    );

    if (formData.serviceAdjustmentMode === 'PERCENTAGE') {
      if (isBaseService) {
        // El servicio base siempre usa su precio directo
        adjustedPrice = basePrice;
        console.log('=== PRICE CALCULATION DEBUG (PERCENTAGE MODE - BASE SERVICE) ===');
        console.log('roomTypeId:', roomTypeId);
        console.log('serviceTypeId:', serviceTypeId);
        console.log('basePrice (direct):', basePrice);
        console.log('adjustedPrice (base service, no calculation):', adjustedPrice);
      } else {
        // Los demás servicios se calculan como porcentaje del servicio base
        const baseService = getActiveServiceTypes().find(s => 
          s.serviceType?.name === 'Tarifa base' || s.name === 'Tarifa base'
        );
      
        if (baseService && percentageAdjustment !== undefined && percentageAdjustment !== 0) {
          const baseServicePrice = prices.find(p => 
            p.roomTypeId === roomTypeId && p.serviceTypeId === baseService.serviceTypeId
          );
          
          if (baseServicePrice) {
            basePrice = baseServicePrice.basePrice;
            const adjustmentMultiplier = 1 + (percentageAdjustment / 100);
            adjustedPrice = Math.round(basePrice * adjustmentMultiplier);
            
            console.log('=== PRICE CALCULATION DEBUG (PERCENTAGE MODE - CALCULATED SERVICE) ===');
            console.log('roomTypeId:', roomTypeId);
            console.log('serviceTypeId:', serviceTypeId);
            console.log('baseServicePrice.basePrice:', baseServicePrice.basePrice);
            console.log('percentageAdjustment:', percentageAdjustment);
            console.log('adjustmentMultiplier:', adjustmentMultiplier);
            console.log('adjustedPrice:', adjustedPrice);
          }
        } else {
          // Si no hay porcentaje definido, usar el precio directo
          adjustedPrice = currentPrice?.basePrice || 0;
          console.log('=== PRICE CALCULATION DEBUG (PERCENTAGE MODE - NO PERCENTAGE) ===');
          console.log('roomTypeId:', roomTypeId);
          console.log('serviceTypeId:', serviceTypeId);
          console.log('basePrice (direct, no percentage set):', adjustedPrice);
          console.log('adjustedPrice:', adjustedPrice);
        }
      }
    } else if (formData.serviceAdjustmentMode === 'FIXED') {
      // En modo FIXED, usar el precio directo sin aplicar porcentajes
      adjustedPrice = basePrice;
      console.log('=== PRICE CALCULATION DEBUG (FIXED MODE) ===');
      console.log('roomTypeId:', roomTypeId);
      console.log('serviceTypeId:', serviceTypeId);
      console.log('basePrice (direct):', basePrice);
      console.log('adjustedPrice (no percentage applied):', adjustedPrice);
    }
    
    const roundedPrice = adjustedPrice; // Por ahora sin redondeo adicional
    
    return {
      adjustedPrice: adjustedPrice,
      roundedPrice: roundedPrice,
      wasRounded: false,
      adjustment: (formData.serviceAdjustmentMode === 'PERCENTAGE' && percentageAdjustment) ? {
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
    <div className={`${styles.bar} ${isExpanded ? styles.expanded : ''} ${isEditing ? styles.editing : ''} ${block?.isDraft ? styles.draft : styles.confirmed}`}>
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
          <div className={styles.titleSection}>
            <div className={styles.title}>
              {isEditing && editingField.name ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  onBlur={() => handleFieldBlur('name')}
                  onKeyPress={(e) => handleFieldKeyPress(e, 'name')}
                  className={`${styles.titleInput} ${validationErrors.name ? styles.error : ''}`}
                  placeholder="Nombre del bloque"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <h3 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFieldClick('name');
                  }}
                  className={isEditing ? styles.editableField : ''}
                >
                  {formData.name || block?.name}
                </h3>
              )}
            </div>
            
            <div className={styles.subtitle}>
              {isEditing && (editingField.startDate || editingField.endDate) ? (
                <div className={styles.dateInputs} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateFormData('startDate', e.target.value)}
                    onBlur={() => handleFieldBlur('startDate')}
                    onKeyPress={(e) => handleFieldKeyPress(e, 'startDate')}
                    onClick={(e) => e.stopPropagation()}
                    className={`${styles.dateInput} ${validationErrors.startDate ? styles.error : ''}`}
                  />
                  <span> - </span>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateFormData('endDate', e.target.value)}
                    onBlur={() => handleFieldBlur('endDate')}
                    onKeyPress={(e) => handleFieldKeyPress(e, 'endDate')}
                    onClick={(e) => e.stopPropagation()}
                    className={`${styles.dateInput} ${validationErrors.endDate ? styles.error : ''}`}
                  />
                </div>
              ) : (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFieldClick('startDate');
                    handleFieldClick('endDate');
                  }}
                  className={isEditing ? styles.editableField : ''}
                >
                  {formatDate(getDisplayDate(formData.startDate || block?.startDate))} - {formatDate(getDisplayDate(formData.endDate || block?.endDate))}
                </span>
              )}
            </div>
          </div>
          
          <div className={styles.description}>
            {isEditing && editingField.description ? (
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                onBlur={() => handleFieldBlur('description')}
                onKeyPress={(e) => handleFieldKeyPress(e, 'description')}
                className={styles.descriptionInput}
                placeholder="Descripción del bloque"
                onClick={(e) => e.stopPropagation()}
                rows={2}
                autoFocus
              />
            ) : (
              <p 
                onClick={(e) => {
                  e.stopPropagation();
                  handleFieldClick('description');
                }}
                className={isEditing ? styles.editableField : ''}
              >
                {formData.description || block?.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Toggle de borrador/activo */}
        <div 
          className={styles.draftToggleContainer} 
          onClick={(e) => e.stopPropagation()}
          title={
            block?.isDraft 
              ? "Modo Borrador: Los precios no están disponibles para nuevas reservas. Cambia a 'Activo' para que los precios estén vigentes para nuevas reservas."
              : "Modo Activo: Los precios están vigentes y disponibles para nuevas reservas. Cambia a 'Borrador' para desactivar temporalmente los precios."
          }
        >
          <div className={styles.toggleWrapper}>
            <div 
              className={`${styles.customToggle} ${!block?.isDraft ? styles.active : styles.draft}`}
              onClick={handleDraftToggle}
            >
              <span className={styles.toggleText}>
                {block?.isDraft ? 'Borrador' : 'Activo'}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de acción superiores */}
        <div className={styles.topActions} onClick={(e) => e.stopPropagation()}>
          <div className={styles.actionButtonsRow}>
            <button
              onClick={handleClone}
              className={`${styles.actionBtn} ${styles.clone}`}
              title="Duplicar bloque de temporada"
            >
              <FiCopy />
            </button>
            
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className={`${styles.actionBtn} ${styles.delete}`}
              title="Eliminar bloque de temporada"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {roundingConfig && roundingConfig.multiple > 1 && (
            <div className={styles.roundingInfo}>
              <FiInfo />
              <span>Redondeo activo: múltiplos de ${roundingConfig.multiple} ({roundingConfig.mode})</span>
            </div>
          )}
          

          <table className={styles.pricesGrid}>
            <thead>
              <tr>
                <th className={styles.roomTypeHeader}>Habitación</th>
                {getActiveServiceTypes().map(serviceType => {
                  const isServiceEnabled = serviceType.isEnabled;
                  const isBaseService = serviceType.serviceType?.name === 'Tarifa base';
                  return (
                    <th 
                      key={serviceType.id} 
                      style={{ 
                        textAlign: 'center',
                        opacity: isServiceEnabled ? 1 : 0.6,
                        color: isServiceEnabled ? '#374151' : '#6c757d'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>{serviceType.serviceType?.name || serviceType.name}</span>
                        {!isBaseService && isEditing && (
                          <div className={styles.serviceToggle}>
                            <Switch
                              checked={isServiceEnabled}
                              onChange={() => handleServiceToggle(serviceType.id, isServiceEnabled)}
                              onColor="#10b981"
                              offColor="#e5e7eb"
                              width={32}
                              height={18}
                              handleDiameter={14}
                              title={isServiceEnabled ? 'Deshabilitar servicio' : 'Habilitar servicio'}
                            />
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
              {formData.serviceAdjustmentMode === 'PERCENTAGE' && (
                <tr>
                  <th className={styles.roomTypeHeader} style={{ background: '#f8f9fa' }}>Porcentaje de Ajuste</th>
                  {getActiveServiceTypes().map(serviceType => {
                    const isServiceEnabled = serviceType.isEnabled;
                    const isBaseService = serviceType.serviceType?.name === 'Tarifa base';
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
                          isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                              <input
                                type="number"
                                placeholder="0"
                                value={currentPercentage}
                                onChange={(e) => handlePercentageChange(serviceType.id, e.target.value)}
                                onKeyPress={(e) => handlePercentageKeyPress(e, serviceType.id)}
                                onBlur={(e) => handlePercentageBlur(e, serviceType.id)}
                                style={{
                                  width: '60px',
                                  textAlign: 'center',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  padding: '6px',
                                  fontSize: '16px'
                                }}
                                disabled={!isServiceEnabled}
                              />
                              <span style={{ fontSize: '16px', color: '#6c757d' }}>%</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '16px', color: '#6c757d' }}>
                              {currentPercentage ? `${currentPercentage}%` : '-'}
                            </span>
                          )
                        ) : (
                          <span style={{ color: '#6c757d', fontSize: '16px' }}>-</span>
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
                            {/* Los ajustes se aplican automáticamente al precio, no se muestran indicadores */}
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
      )}

      {/* Botones de acción inferiores - cuando hay cualquier tipo de cambio Y estamos en modo edición */}
      {hasAnyChanges && isEditing && (
        <div className={styles.actionButtons}>
          <div className={styles.toggleControls}>
            <label 
              className={styles.toggleLabel}
              title="Mantener proporciones: Cuando está activado, al modificar el precio de un tipo de habitación, los precios de otros tipos se ajustan automáticamente manteniendo las proporciones relativas. Útil para ajustes por inflación o cambios generales de precios."
            >
              <Switch
                checked={formData.useProportions}
                onChange={handleProportionToggle}
                onColor="#3b82f6"
                offColor="#d1d5db"
                checkedIcon={false}
                uncheckedIcon={false}
                width={44}
                height={24}
                handleDiameter={18}
                disabled={!isEditing}
              />
              <span className={styles.toggleText}>Mantener proporciones</span>
            </label>
            
            <label 
              className={styles.toggleLabel}
              title="Usar porcentajes: Cuando está activado, los ajustes de servicios se aplican como porcentajes sobre el precio base. Cuando está desactivado, se usan montos fijos. Por ejemplo: +15% vs +$500."
            >
              <Switch
                checked={formData.serviceAdjustmentMode === 'PERCENTAGE'}
                onChange={handlePercentageToggle}
                onColor="#3b82f6"
                offColor="#d1d5db"
                checkedIcon={false}
                uncheckedIcon={false}
                width={44}
                height={24}
                handleDiameter={18}
                disabled={!isEditing}
              />
              <span className={styles.toggleText}>Usar porcentajes</span>
            </label>
          </div>
          
          <div className={styles.actionButtonsRight}>
            <button
              onClick={handleSaveTariffChanges}
              className={`${styles.actionButton} ${styles.saveButton}`}
            >
              Guardar
            </button>
            
            <button
              onClick={async () => {
                console.log('=== CANCEL BUTTON CLICKED ===');
                setIsEditing(false);
                
                // Resetear todos los datos a sus valores originales
                if (resetAllData) {
                  console.log('Calling resetAllData to restore all original data');
                  const success = await resetAllData();
                  if (success) {
                    setHasTariffChanges(false);
                    setHasAnyChanges(false);
                    setEditingCell({ roomTypeId: null, serviceTypeId: null, value: '' });
                    setEditingField({ name: false, startDate: false, endDate: false, description: false });
                    console.log('All data reset successfully');
                  } else {
                    console.log('Reset failed, using fallback');
                    // Fallback al key reset si resetAllData falla
                    if (onResetBlock) {
                      onResetBlock();
                    }
                  }
                } else {
                  console.log('No resetAllData available, using fallback');
                  // Fallback al key reset si resetAllData no está disponible
                  if (onResetBlock) {
                    onResetBlock();
                  }
                }
              }}
              className={`${styles.actionButton} ${styles.cancelButton}`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botón de editar/cancelar - cuando no hay cambios O no estamos en modo edición */}
      {(!hasAnyChanges || !isEditing) && (
        <button 
          className={styles.actionButtons}
          onClick={() => setIsEditing(!isEditing)}
          type="button"
        >
          {isEditing && (
            <div className={styles.toggleControls}>
              <label 
                className={styles.toggleLabel}
                title="Mantener proporciones: Cuando está activado, al modificar el precio de un tipo de habitación, los precios de otros tipos se ajustan automáticamente manteniendo las proporciones relativas. Útil para ajustes por inflación o cambios generales de precios."
                onClick={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={formData.useProportions}
                  onChange={handleProportionToggle}
                  onColor="#3b82f6"
                  offColor="#d1d5db"
                  checkedIcon={false}
                  uncheckedIcon={false}
                  width={44}
                  height={24}
                  handleDiameter={18}
                  disabled={!isEditing}
                />
                <span className={styles.toggleText}>Mantener proporciones</span>
              </label>
              
              <label 
                className={styles.toggleLabel}
                title="Usar porcentajes: Cuando está activado, los ajustes de servicios se aplican como porcentajes sobre el precio base. Cuando está desactivado, se usan montos fijos. Por ejemplo: +15% vs +$500."
                onClick={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={formData.serviceAdjustmentMode === 'PERCENTAGE'}
                  onChange={handlePercentageToggle}
                  onColor="#3b82f6"
                  offColor="#d1d5db"
                  checkedIcon={false}
                  uncheckedIcon={false}
                  width={44}
                  height={24}
                  handleDiameter={18}
                  disabled={!isEditing}
                />
                <span className={styles.toggleText}>Usar porcentajes</span>
              </label>
            </div>
          )}
          
          <div className={styles.actionButtonText}>
            {isEditing ? 'Cancelar' : 'Editar'}
          </div>
        </button>
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