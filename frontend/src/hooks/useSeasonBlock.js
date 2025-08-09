import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useSeasonBlock = (blockId = null, hotelId = null) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    seasonPrices: [],
    serviceAdjustments: []
  });

  // Datos de referencia
  const [roomTypes, setRoomTypes] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);

  // Estados de validación
  const [validationErrors, setValidationErrors] = useState({});

  // Cargar datos de referencia
  useEffect(() => {
    if (hotelId) {
      loadReferenceData();
    }
  }, [hotelId]);

  // Cargar bloque específico si está en modo edición
  useEffect(() => {
    if (blockId) {
      loadSeasonBlock();
    }
  }, [blockId]);

  const loadReferenceData = async () => {
    try {
      setLoading(true);
      const [roomTypesRes, serviceTypesRes] = await Promise.all([
        fetch(`${API_URL}/room-types`),
        fetch(`${API_URL}/service-types`)
      ]);

      if (!roomTypesRes.ok || !serviceTypesRes.ok) {
        throw new Error('Error al cargar datos de referencia');
      }

      const roomTypesData = await roomTypesRes.json();
      const serviceTypesResult = await serviceTypesRes.json();

      setRoomTypes(roomTypesData);
      setServiceTypes(serviceTypesResult.data || serviceTypesResult);

      // Inicializar estructuras de datos si no estamos editando
      if (!blockId) {
        initializeEmptyStructures(roomTypesData, serviceTypesResult.data || serviceTypesResult);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonBlock = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar el bloque de temporada');
      }

      const result = await response.json();
      const blockData = result.data;
      
      if (!blockData) {
        throw new Error('Bloque de temporada no encontrado');
      }
      
      // Mapear los datos del backend al formato del formulario
      setFormData({
        name: blockData.name || '',
        description: blockData.description || '',
        startDate: blockData.startDate ? blockData.startDate.split('T')[0] : '',
        endDate: blockData.endDate ? blockData.endDate.split('T')[0] : '',
        seasonPrices: blockData.seasonPrices || [],
        serviceAdjustments: blockData.seasonServiceAdjustments || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeEmptyStructures = (roomTypesData, serviceTypesData) => {
    // Inicializar precios base con valores vacíos
    const seasonPrices = roomTypesData.map(roomType => ({
      roomTypeId: roomType.id,
      basePrice: ''
    }));

    // Inicializar ajustes por servicio con valores vacíos
    const serviceAdjustments = [];
    roomTypesData.forEach(roomType => {
      serviceTypesData.forEach(serviceType => {
        serviceAdjustments.push({
          roomTypeId: roomType.id,
          serviceTypeId: serviceType.id,
          mode: 'PERCENTAGE',
          value: ''
        });
      });
    });

    setFormData(prev => ({
      ...prev,
      seasonPrices,
      serviceAdjustments
    }));
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar errores de validación para este campo
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const updateSeasonPrice = (roomTypeId, basePrice) => {
    setFormData(prev => ({
      ...prev,
      seasonPrices: prev.seasonPrices.map(price =>
        price.roomTypeId === roomTypeId
          ? { ...price, basePrice: parseFloat(basePrice) || 0 }
          : price
      )
    }));
  };

  const updateServiceAdjustment = (roomTypeId, serviceTypeId, field, value) => {
    setFormData(prev => ({
      ...prev,
      serviceAdjustments: prev.serviceAdjustments.map(adjustment =>
        adjustment.roomTypeId === roomTypeId && adjustment.serviceTypeId === serviceTypeId
          ? { ...adjustment, [field]: field === 'value' ? (parseFloat(value) || 0) : value }
          : adjustment
      )
    }));
  };

  const copyValueToRow = (roomTypeId, serviceTypeId, value, mode) => {
    setFormData(prev => ({
      ...prev,
      serviceAdjustments: prev.serviceAdjustments.map(adjustment =>
        adjustment.roomTypeId === roomTypeId
          ? { ...adjustment, value: parseFloat(value) || 0, mode }
          : adjustment
      )
    }));
  };

  const copyValueToColumn = (serviceTypeId, value, mode) => {
    setFormData(prev => ({
      ...prev,
      serviceAdjustments: prev.serviceAdjustments.map(adjustment =>
        adjustment.serviceTypeId === serviceTypeId
          ? { ...adjustment, value: parseFloat(value) || 0, mode }
          : adjustment
      )
    }));
  };

  const copyValueToAll = (value, mode) => {
    setFormData(prev => ({
      ...prev,
      serviceAdjustments: prev.serviceAdjustments.map(adjustment => ({
        ...adjustment,
        value: parseFloat(value) || 0,
        mode
      }))
    }));
  };

  const validateForm = () => {
    const errors = {};

    // Validar nombre
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    // Validar fechas
    if (!formData.startDate) {
      errors.startDate = 'La fecha de inicio es requerida';
    }
    if (!formData.endDate) {
      errors.endDate = 'La fecha de fin es requerida';
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (startDate >= endDate) {
        errors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }

    // Validar precios base
    const hasEmptyPrices = formData.seasonPrices.some(price => 
      !price.basePrice || price.basePrice <= 0
    );
    if (hasEmptyPrices) {
      errors.seasonPrices = 'Todos los precios base deben ser mayores a 0';
    }

    // Validar ajustes por servicio
    const invalidAdjustments = formData.serviceAdjustments.some(adjustment => {
      if (adjustment.mode === 'FIXED' && adjustment.value < 0) return true;
      if (adjustment.mode === 'PERCENTAGE' && (adjustment.value < -100 || adjustment.value > 500)) return true;
      return false;
    });

    if (invalidAdjustments) {
      errors.serviceAdjustments = 'Los ajustes por servicio tienen valores inválidos';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkOverlaps = async (force = false) => {
    try {
      const response = await fetch(`${API_URL}/season-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          seasonPrices: formData.seasonPrices.filter(p => p.basePrice > 0),
          serviceAdjustments: formData.serviceAdjustments.filter(a => a.value !== ''),
          force,
          ...(blockId && { excludeId: blockId })
        })
      });

      if (response.status === 409 && !force) {
        const conflictData = await response.json();
        return { hasConflict: true, conflictData };
      }

      return { hasConflict: false, response };
    } catch (error) {
      throw new Error('Error al verificar solapamientos: ' + error.message);
    }
  };

  const saveSeasonBlock = async (force = false) => {
    if (!validateForm()) {
      return { success: false, errors: validationErrors };
    }

    try {
      setSaving(true);
      setError(null);

      // Preparar payload
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        seasonPrices: formData.seasonPrices.filter(p => p.basePrice > 0),
        serviceAdjustments: formData.serviceAdjustments.filter(a => a.value !== ''),
        force
      };

      if (hotelId) {
        payload.hotelId = hotelId;
      }

      // Determinar método y URL
      const method = blockId ? 'PUT' : 'POST';
      const url = blockId ? `${API_URL}/season-blocks/${blockId}` : `${API_URL}/season-blocks`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.status === 409) {
        const conflictData = await response.json();
        return { success: false, hasConflict: true, conflictData };
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar el bloque de temporada');
      }

      const savedBlock = await response.json();
      return { success: true, data: savedBlock };

    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  };

  const deleteSeasonBlock = async () => {
    if (!blockId) return { success: false, error: 'No hay bloque para eliminar' };

    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar el bloque de temporada');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  };

  const cloneSeasonBlock = () => {
    const clonedData = {
      ...formData,
      name: `${formData.name} (Copia)`,
      startDate: '',
      endDate: ''
    };
    setFormData(clonedData);
  };

  return {
    // Estados
    loading,
    saving,
    error,
    formData,
    roomTypes,
    serviceTypes,
    validationErrors,

    // Acciones
    updateFormData,
    updateSeasonPrice,
    updateServiceAdjustment,
    copyValueToRow,
    copyValueToColumn,
    copyValueToAll,
    validateForm,
    saveSeasonBlock,
    deleteSeasonBlock,
    cloneSeasonBlock,
    checkOverlaps,

    // Utilidades
    setError
  };
}; 