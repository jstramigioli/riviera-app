import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useSeasonBlockV2 = (blockId, hotelId = 'default-hotel') => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados principales
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    useProportions: true, // Activado por defecto para nuevos bloques
    serviceAdjustmentMode: 'PERCENTAGE',
    useBlockServices: false // Nuevo: usar servicios específicos del bloque
  });
  
  // Estados para datos relacionados
  const [roomTypes, setRoomTypes] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [blockServiceSelections, setBlockServiceSelections] = useState([]); // Selecciones de servicios del bloque
  const [prices, setPrices] = useState([]); // Precios por habitación y servicio
  const [roundingConfig, setRoundingConfig] = useState(null);
  
  // Estados para validación
  const [validationErrors, setValidationErrors] = useState({});

  // Función para aplicar redondeo
  const applyRounding = useCallback((price, config = roundingConfig) => {
    if (!config || !price) return price;
    
    const { multiple, mode } = config;
    
    switch (mode) {
      case 'ceil':
        return Math.ceil(price / multiple) * multiple;
      case 'floor':
        return Math.floor(price / multiple) * multiple;
      case 'nearest':
      default:
        return Math.round(price / multiple) * multiple;
    }
  }, [roundingConfig]);

  // Función helper para obtener todos los tipos de servicio (habilitados y deshabilitados)
  const getActiveServiceTypes = () => {
    // Si no hay selecciones, crear un servicio base por defecto
    if (blockServiceSelections.length === 0) {
      const baseService = {
        id: 'base-service',
        serviceTypeId: 'base-service',
        isEnabled: true,
        pricingMode: 'PERCENTAGE',
        value: 0,
        serviceType: {
          id: 'base-service',
          name: 'Tarifa Base',
          description: 'Tarifa base sin servicios adicionales'
        }
      };
      return [baseService];
    }
    
    // Retornar todos los servicios con su información completa
    return blockServiceSelections.map(selection => ({
      ...selection,
      serviceType: selection.serviceType || {
        id: selection.serviceTypeId,
        name: 'Servicio',
        description: 'Servicio del bloque'
      }
    }));
  };

  // Función helper para obtener ajustes de servicio activos
  const getActiveServiceAdjustments = () => {
    const enabledSelections = blockServiceSelections.filter(selection => selection.isEnabled);
    
    // Si no hay servicios habilitados, retornar ajuste base vacío
    if (enabledSelections.length === 0) {
      return [{
        serviceTypeId: 'base-service',
        mode: 'PERCENTAGE',
        value: 0,
        serviceType: {
          id: 'base-service',
          name: 'Tarifa Base',
          description: 'Tarifa base sin servicios adicionales'
        }
      }];
    }
    
    // Usar la configuración del bloque para todos los servicios
    const blockMode = formData.serviceAdjustmentMode || 'PERCENTAGE';
    
    return enabledSelections.map(selection => ({
      serviceTypeId: selection.serviceTypeId,
      mode: blockMode,
      value: 0, // Los valores se configuran individualmente en la tabla de precios
      serviceType: selection.serviceType
    }));
  };

  // Función para inicializar precios para un nuevo servicio
  const initializePricesForNewService = (serviceTypeId, serviceSelection) => {
    console.log('=== INICIO: Inicializando precios para servicio ===');
    console.log('serviceTypeId:', serviceTypeId);
    console.log('serviceSelection:', serviceSelection);
    console.log('serviceTypes disponibles:', serviceTypes);
    console.log('roomTypes disponibles:', roomTypes);
    console.log('prices actuales:', prices);
    
    // Verificar que todos los datos necesarios estén disponibles
    if (!serviceTypes || serviceTypes.length === 0) {
      console.error('serviceTypes no está disponible o está vacío');
      return;
    }
    
    if (!roomTypes || roomTypes.length === 0) {
      console.error('roomTypes no está disponible o está vacío');
      return;
    }
    
    if (!prices || prices.length === 0) {
      console.error('prices no está disponible o está vacío');
      return;
    }
    
    // Obtener el servicio base (Solo Alojamiento)
    const baseService = serviceTypes.find(st => 
      st.name.toLowerCase().includes('solo') || 
      st.name.toLowerCase().includes('alojamiento')
    );
    
    console.log('Servicio base encontrado:', baseService);
    
    if (!baseService) {
      console.error('No se encontró el servicio base (Solo Alojamiento)');
      console.log('=== FIN: Error - No se encontró servicio base ===');
      return;
    }
    
    // Obtener la información completa del nuevo servicio desde serviceTypes
    const newServiceType = serviceTypes.find(st => st.id === serviceTypeId);
    console.log('Nuevo servicio encontrado:', newServiceType);
    
    if (!newServiceType) {
      console.error('No se encontró el nuevo servicio:', serviceTypeId);
      console.log('=== FIN: Error - No se encontró nuevo servicio ===');
      return;
    }
    
    // Para cada tipo de habitación, crear un precio inicial basado en la tarifa base
    roomTypes.forEach(roomType => {
      const basePrice = prices.find(p => 
        p.roomTypeId === roomType.id && p.serviceTypeId === baseService.id
      )?.basePrice || 0;
      
      console.log(`Precio base para ${roomType.name}:`, basePrice);
      
      if (basePrice > 0) {
        let newPrice = basePrice;
        
        // Si el nuevo servicio tiene un ajuste de porcentaje, aplicarlo
        if (serviceSelection && serviceSelection.pricingMode === 'PERCENTAGE' && serviceSelection.percentage) {
          newPrice = basePrice * (1 + serviceSelection.percentage / 100);
          console.log(`Aplicando ${serviceSelection.percentage}% a ${roomType.name}: ${basePrice} -> ${newPrice}`);
        } else if (serviceSelection && serviceSelection.pricingMode === 'FIXED' && serviceSelection.fixedPrice) {
          newPrice = basePrice + serviceSelection.fixedPrice;
          console.log(`Aplicando +${serviceSelection.fixedPrice} a ${roomType.name}: ${basePrice} -> ${newPrice}`);
        }
        
        // Verificar si ya existe un precio para esta combinación
        const existingPrice = prices.find(p => 
          p.roomTypeId === roomType.id && p.serviceTypeId === serviceTypeId
        );
        
        if (!existingPrice) {
          const roomTypeData = roomTypes.find(rt => rt.id === roomType.id);
          
          console.log(`Creando precio para ${roomType.name} - ${newServiceType.name}: ${newPrice}`);
          
          setPrices(prev => {
            const newPrices = [...prev, {
              roomTypeId: roomType.id,
              serviceTypeId: serviceTypeId,
              basePrice: newPrice,
              roomType: roomTypeData,
              serviceType: newServiceType
            }];
            console.log('Nuevos precios después de agregar:', newPrices);
            return newPrices;
          });
        } else {
          console.log(`Precio ya existe para ${roomType.name} - ${newServiceType.name}`);
        }
      } else {
        console.log(`No hay precio base para ${roomType.name}`);
      }
    });
    
    console.log('=== FIN: Inicialización completada ===');
    console.log('Precios después de la inicialización:', prices);
    
    // Recargar las selecciones de servicios para actualizar la tabla
    loadBlockServiceSelections();
  };

  // Función para eliminar precios de un servicio eliminado
  const removePricesForDeletedService = (serviceTypeId) => {
    setPrices(prev => prev.filter(price => price.serviceTypeId !== serviceTypeId));
    // Recargar las selecciones de servicios para actualizar la tabla
    loadBlockServiceSelections();
  };

  // Función para cargar las selecciones de servicios del bloque
  const loadBlockServiceSelections = async () => {
    if (!blockId) return;
    
    try {
      const response = await fetch(`${API_URL}/block-service-selections/block/${blockId}`);
      if (response.ok) {
        const selections = await response.json();
        console.log('Block service selections loaded:', selections);
        setBlockServiceSelections(selections);
      }
    } catch (error) {
      console.error('Error loading block service selections:', error);
    }
  };


  // Cargar datos iniciales
  useEffect(() => {
    console.log('useSeasonBlockV2 - useEffect triggered with blockId:', blockId, 'hotelId:', hotelId);
    loadInitialData();
  }, [blockId, hotelId]);



  const loadInitialData = async () => {
    console.log('loadInitialData called with blockId:', blockId);
    setLoading(true);
    setError(null);
    
    try {
      // Cargar datos básicos en paralelo
      const [roomTypesRes, serviceTypesRes, roundingConfigRes] = await Promise.all([
        fetch(`${API_URL}/room-types`),
        fetch(`${API_URL}/service-types?hotelId=${hotelId}`),
        fetch(`${API_URL}/rounding-config?hotelId=${hotelId}`)
      ]);

      if (!roomTypesRes.ok) throw new Error('Error al cargar tipos de habitación');
      if (!serviceTypesRes.ok) throw new Error('Error al cargar tipos de servicio');
      if (!roundingConfigRes.ok) throw new Error('Error al cargar configuración de redondeo');

      const roomTypesData = await roomTypesRes.json();
      const serviceTypesData = await serviceTypesRes.json();
      const roundingConfigData = await roundingConfigRes.json();

      setRoomTypes(roomTypesData);
      setServiceTypes(serviceTypesData.data || []);
      setRoundingConfig(roundingConfigData.data);

      // Si hay blockId, cargar datos del bloque
      if (blockId) {
        const blockRes = await fetch(`${API_URL}/season-blocks/${blockId}`);
        if (!blockRes.ok) throw new Error('Error al cargar el bloque de temporada');
        
        const blockData = await blockRes.json();
        const block = blockData.data;
        console.log('Block data received from API:', block);

        console.log('=== LOADING BLOCK DATA ===');
        console.log('Block data from API:', {
          id: block.id,
          name: block.name,
          serviceAdjustmentMode: block.serviceAdjustmentMode,
          useProportions: block.useProportions
        });
        
        setFormData({
          name: block.name,
          description: block.description || '',
          startDate: new Date(block.startDate).toISOString().split('T')[0],
          endDate: new Date(block.endDate).toISOString().split('T')[0],
          useProportions: block.useProportions,
          serviceAdjustmentMode: block.serviceAdjustmentMode,
          useBlockServices: block.useBlockServices || false
        });
        
        console.log('FormData set to:', {
          serviceAdjustmentMode: block.serviceAdjustmentMode
        });
        console.log('Current formData state after setFormData:', formData);
        console.log('Block serviceAdjustmentMode from API:', block.serviceAdjustmentMode);
        console.log('Block data type:', typeof block.serviceAdjustmentMode);
        console.log('Block data value:', block.serviceAdjustmentMode);
        console.log('Block data comparison:', block.serviceAdjustmentMode === 'PERCENTAGE');
        console.log('Block data comparison with FIXED:', block.serviceAdjustmentMode === 'FIXED');
        console.log('Block data length:', block.serviceAdjustmentMode?.length);
        console.log('Block data JSON:', JSON.stringify(block.serviceAdjustmentMode));
        console.log('Block data char codes:', block.serviceAdjustmentMode?.split('').map(c => c.charCodeAt(0)));
        console.log('Block data trimmed:', block.serviceAdjustmentMode?.trim());
        console.log('Block data toUpperCase:', block.serviceAdjustmentMode?.toUpperCase());
        console.log('Block data toLowerCase:', block.serviceAdjustmentMode?.toLowerCase());
        console.log('Block data includes PERCENTAGE:', block.serviceAdjustmentMode?.includes('PERCENTAGE'));
        console.log('Block data includes FIXED:', block.serviceAdjustmentMode?.includes('FIXED'));
        console.log('Block data startsWith PERCENTAGE:', block.serviceAdjustmentMode?.startsWith('PERCENTAGE'));
        console.log('Block data startsWith FIXED:', block.serviceAdjustmentMode?.startsWith('FIXED'));
        console.log('Block data endsWith PERCENTAGE:', block.serviceAdjustmentMode?.endsWith('PERCENTAGE'));
        console.log('Block data endsWith FIXED:', block.serviceAdjustmentMode?.endsWith('FIXED'));
        console.log('Block data indexOf PERCENTAGE:', block.serviceAdjustmentMode?.indexOf('PERCENTAGE'));
        console.log('Block data indexOf FIXED:', block.serviceAdjustmentMode?.indexOf('FIXED'));
        console.log('Block data lastIndexOf PERCENTAGE:', block.serviceAdjustmentMode?.lastIndexOf('PERCENTAGE'));
        console.log('Block data lastIndexOf FIXED:', block.serviceAdjustmentMode?.lastIndexOf('FIXED'));
        console.log('Block data replace PERCENTAGE with FIXED:', block.serviceAdjustmentMode?.replace('PERCENTAGE', 'FIXED'));
        console.log('Block data replace FIXED with PERCENTAGE:', block.serviceAdjustmentMode?.replace('FIXED', 'PERCENTAGE'));
        console.log('Block data split by space:', block.serviceAdjustmentMode?.split(' '));
        console.log('Block data split by comma:', block.serviceAdjustmentMode?.split(','));
        console.log('Block data split by dot:', block.serviceAdjustmentMode?.split('.'));
        console.log('Block data split by underscore:', block.serviceAdjustmentMode?.split('_'));
        console.log('Block data split by dash:', block.serviceAdjustmentMode?.split('-'));
        console.log('Block data split by slash:', block.serviceAdjustmentMode?.split('/'));
        console.log('Block data split by backslash:', block.serviceAdjustmentMode?.split('\\'));
        console.log('Block data split by pipe:', block.serviceAdjustmentMode?.split('|'));
        console.log('Block data split by semicolon:', block.serviceAdjustmentMode?.split(';'));
        console.log('Block data split by colon:', block.serviceAdjustmentMode?.split(':'));
        console.log('Block data split by equals:', block.serviceAdjustmentMode?.split('='));
        console.log('Block data split by plus:', block.serviceAdjustmentMode?.split('+'));
        console.log('Block data split by minus:', block.serviceAdjustmentMode?.split('-'));
        console.log('Block data split by asterisk:', block.serviceAdjustmentMode?.split('*'));
        console.log('Block data split by question mark:', block.serviceAdjustmentMode?.split('?'));
        console.log('Block data split by exclamation mark:', block.serviceAdjustmentMode?.split('!'));

        // Si el bloque no tiene precios, inicializar con datos por defecto
        if (!block.seasonPrices || block.seasonPrices.length === 0) {
          initializeDefaultData(roomTypesData, serviceTypesData.data || []);
        } else {
          console.log('=== LOADING PRICES FROM BACKEND ===');
          console.log('Block seasonPrices:', block.seasonPrices);
          console.log('Prices count:', block.seasonPrices.length);
          setPrices(block.seasonPrices || []);
        }

        // Cargar selecciones de servicios del bloque
        try {
          const blockServiceSelectionsRes = await fetch(`${API_URL}/block-service-selections/block/${blockId}`);
          if (blockServiceSelectionsRes.ok) {
            const blockServiceSelectionsData = await blockServiceSelectionsRes.json();
            setBlockServiceSelections(blockServiceSelectionsData);
          } else {
            // Si no hay selecciones, inicializar por defecto
            initializeDefaultServiceSelections(serviceTypesData.data || []);
          }
        } catch (err) {
          console.error('Error loading block service selections:', err);
          // Si hay error, inicializar por defecto
          initializeDefaultServiceSelections(serviceTypesData.data || []);
        }
      } else {
        // Inicializar datos por defecto para nuevo bloque
        initializeDefaultData(roomTypesData, serviceTypesData.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultData = (roomTypesData, serviceTypesData) => {
    // Crear precios base por defecto para cada combinación habitación-servicio
    const defaultPrices = [];
    const basePrice = 50000; // $500 por defecto
    
    // Si no hay servicios, crear al menos un servicio base
    const servicesToUse = serviceTypesData && serviceTypesData.length > 0 
      ? serviceTypesData 
      : [{ id: 'base-service', name: 'Tarifa Base', description: 'Tarifa base sin servicios adicionales' }];
    
    roomTypesData.forEach(roomType => {
      servicesToUse.forEach(serviceType => {
        defaultPrices.push({
          roomTypeId: roomType.id,
          serviceTypeId: serviceType.id,
          basePrice: basePrice,
          roomType,
          serviceType
        });
      });
    });
    setPrices(defaultPrices);

    // Crear selecciones de servicios por defecto
    initializeDefaultServiceSelections(serviceTypesData);
  };

  const initializeDefaultServiceSelections = (serviceTypesData) => {
    // Si no hay tipos de servicio, crear al menos un servicio base
    if (!serviceTypesData || serviceTypesData.length === 0) {
      const baseService = {
        serviceTypeId: 'base-service',
        isEnabled: true,
        pricingMode: 'PERCENTAGE',
        fixedPrice: null,
        percentage: 0,
        orderIndex: 0,
        serviceType: {
          id: 'base-service',
          name: 'Tarifa Base',
          description: 'Tarifa base sin servicios adicionales'
        }
      };
      setBlockServiceSelections([baseService]);
      return;
    }

    // Crear selecciones por defecto para todos los servicios disponibles
    const defaultSelections = serviceTypesData.map(serviceType => ({
      serviceTypeId: serviceType.id,
      isEnabled: true,
      pricingMode: 'PERCENTAGE',
      fixedPrice: null,
      percentage: 0,
      orderIndex: serviceType.orderIndex,
      serviceType
    }));
    setBlockServiceSelections(defaultSelections);
  };

  // Debounce para guardado automático
  const [saveTimeout, setSaveTimeout] = useState(null);

  // Validar formulario
  const validateForm = (formDataToValidate, requireDates = false) => {
    const errors = {};

    console.log('=== VALIDATION DEBUG ===');
    console.log('Validating formData:', formDataToValidate);
    console.log('requireDates:', requireDates);
    console.log('name:', formDataToValidate.name, 'trimmed:', formDataToValidate.name?.trim());
    console.log('startDate:', formDataToValidate.startDate);
    console.log('endDate:', formDataToValidate.endDate);

    if (!formDataToValidate.name || !formDataToValidate.name.trim()) {
      errors.name = 'El nombre es requerido';
      console.log('❌ Name validation failed');
    } else {
      console.log('✅ Name validation passed');
    }

    // Solo validar fechas si se requieren
    if (requireDates) {
      if (!formDataToValidate.startDate) {
        errors.startDate = 'La fecha de inicio es requerida';
        console.log('❌ StartDate validation failed');
      } else {
        console.log('✅ StartDate validation passed');
      }

      if (!formDataToValidate.endDate) {
        errors.endDate = 'La fecha de fin es requerida';
        console.log('❌ EndDate validation failed');
      } else {
        console.log('✅ EndDate validation passed');
      }
    } else {
      console.log('📝 Date validation skipped (requireDates = false)');
    }

    if (formDataToValidate.startDate && formDataToValidate.endDate && formDataToValidate.startDate >= formDataToValidate.endDate) {
      errors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
      console.log('❌ Date range validation failed');
    } else if (formDataToValidate.startDate && formDataToValidate.endDate) {
      console.log('✅ Date range validation passed');
    }

    console.log('Validation errors:', errors);
    setValidationErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors: Object.values(errors) };
  };

  // Guardar bloque de temporada
  const saveSeasonBlock = useCallback(async (currentFormData = null) => {
    const dataToSave = currentFormData || formData; // Prioritize passed formData
    const pricesToSave = prices; // Use current prices state


    
    // Validar formulario (no requerir fechas para guardar en borrador)
    const validationResult = validateForm(dataToSave, false);
    if (!validationResult.isValid) {
      console.error('Validation failed:', validationResult.errors);
      setError(validationResult.errors.join(', '));
      return { success: false, error: validationResult.errors.join(', ') };
    }

    setSaving(true);
    setError(null);

    try {
      console.log('=== SAVE SEASON BLOCK DEBUG ===');
      console.log('Current prices state:', pricesToSave);
      console.log('Prices state length:', pricesToSave.length);
      
      // Buscar el precio específico que se modificó para debug
      const modifiedPrice = pricesToSave.find(p => 
        p.roomTypeId === 7 && p.serviceTypeId === 'cme7kpo5j0000nwnjj7vy418d'
      );
      console.log('Modified price in state:', modifiedPrice);

      const payload = {
        ...dataToSave,
        prices: pricesToSave.map(p => ({ // Use pricesToSave
          roomTypeId: p.roomTypeId,
          serviceTypeId: p.serviceTypeId,
          basePrice: p.basePrice
        })),
        blockServiceSelections: blockServiceSelections.map(selection => ({
          serviceTypeId: selection.serviceTypeId,
          isEnabled: selection.isEnabled,
          pricingMode: selection.pricingMode,
          fixedPrice: selection.fixedPrice,
          percentage: selection.percentage,
          orderIndex: selection.orderIndex,
          percentageAdjustment: selection.percentageAdjustment
        }))
      };
      
      console.log('Saving payload:', payload);
      console.log('=== DETAILED PAYLOAD DEBUG ===');
      console.log('Prices being sent:', payload.prices);
      console.log('Prices count:', payload.prices.length);
      payload.prices.forEach((price, index) => {
        console.log(`Price ${index + 1}:`, {
          roomTypeId: price.roomTypeId,
          serviceTypeId: price.serviceTypeId,
          basePrice: price.basePrice
        });
      });
      console.log('Block service selections:', payload.blockServiceSelections);
      console.log('Block service selections count:', payload.blockServiceSelections.length);
      
      // Log detallado de los porcentajes de ajuste
      console.log('=== PERCENTAGE ADJUSTMENTS DEBUG ===');
      payload.blockServiceSelections.forEach((selection, index) => {
        console.log(`Selection ${index + 1}:`, {
          serviceTypeId: selection.serviceTypeId,
          isEnabled: selection.isEnabled,
          percentageAdjustment: selection.percentageAdjustment,
          orderIndex: selection.orderIndex
        });
      });

      const url = blockId 
        ? `${API_URL}/season-blocks/${blockId}`
        : `${API_URL}/season-blocks`;
      
      const method = blockId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.[0] || 'Error al guardar el bloque');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('Error saving season block:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [blockId, formData, prices, blockServiceSelections, validateForm]);

  // Función de guardado automático (deshabilitada para guardado manual)
  const autoSave = useCallback(async (currentFormData = null) => {
    console.log('autoSave called with currentFormData:', currentFormData);
    // Deshabilitado para implementar guardado manual
    console.log('Auto-save disabled - using manual save system');
  }, [blockId, saveSeasonBlock]);

  // Función para confirmar cambios (guardado manual)
  const confirmSeasonBlock = useCallback(async () => {
    if (!blockId) {
      return { success: false, error: 'No hay bloque para confirmar' };
    }

    console.log('=== CONFIRMING SEASON BLOCK ===');
    console.log('Current formData before confirmation:', formData);

    // Asegurar que tenemos los datos más recientes del estado
    const currentFormData = {
      name: formData.name || '',
      description: formData.description || '',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      useProportions: formData.useProportions,
      serviceAdjustmentMode: formData.serviceAdjustmentMode,
      useBlockServices: formData.useBlockServices
    };

    console.log('Processed formData for validation:', currentFormData);

    // Validar que todas las fechas estén completas antes de confirmar
    const validationResult = validateForm(currentFormData, true); // Requerir fechas para confirmación
    if (!validationResult.isValid) {
      console.error('Validation failed for confirmation:', validationResult.errors);
      setError(validationResult.errors.join(', '));
      return { success: false, error: validationResult.errors.join(', ') };
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_URL}/season-blocks/${blockId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al confirmar los cambios');
      }

      const result = await response.json();
      return { success: true, data: result.data, message: result.message };

    } catch (err) {
      console.error('Error confirming season block:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }, [blockId, formData]);

  // Actualizar datos del formulario (sin guardado automático)
  const updateFormData = (field, value) => {
    console.log('updateFormData called:', { field, value, blockId });
    
    // Crear el nuevo formData con el cambio
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Limpiar errores de validación
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Si se cambió una fecha, validar ambas fechas y limpiar errores relacionados
    if (field === 'startDate' || field === 'endDate') {
      const startDate = field === 'startDate' ? value : newFormData.startDate;
      const endDate = field === 'endDate' ? value : newFormData.endDate;
      
      // Si ambas fechas están presentes, validar el rango
      if (startDate && endDate) {
        if (startDate >= endDate) {
          // Error en la fecha de fin
          setValidationErrors(prev => ({
            ...prev,
            endDate: 'La fecha de fin debe ser posterior a la fecha de inicio'
          }));
        } else {
          // Las fechas son válidas, limpiar errores de fechas
          setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.startDate;
            delete newErrors.endDate;
            return newErrors;
          });
        }
      } else {
        // Si falta una fecha, limpiar errores de rango pero mantener errores de campos requeridos
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.endDate; // Limpiar error de rango
          return newErrors;
        });
      }
    }

    // No guardado automático - los cambios se guardarán manualmente
    console.log('Form data updated - manual save required');
  };

  // Actualizar precio de una habitación-servicio con proporciones inteligentes y guardado automático
  const updatePrice = (roomTypeId, serviceTypeId, newPrice, applyProportions = true) => {
    console.log('=== UPDATE PRICE CALLED ===');
    console.log('roomTypeId:', roomTypeId);
    console.log('serviceTypeId:', serviceTypeId);
    console.log('newPrice:', newPrice);
    console.log('applyProportions:', applyProportions);
    console.log('formData.useProportions:', formData.useProportions);
    
    const numericPrice = parseFloat(newPrice) || 0;
    
    // Si las proporciones están desactivadas, solo actualizar el precio específico
    if (!formData.useProportions || !applyProportions) {
      setPrices(prev => {
        const existingPriceIndex = prev.findIndex(p => 
          p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
        );
        
        if (existingPriceIndex >= 0) {
          const updated = [...prev];
          updated[existingPriceIndex] = { ...updated[existingPriceIndex], basePrice: numericPrice };
          
          // Si se está actualizando la tarifa base (Solo Alojamiento), actualizar automáticamente los servicios con porcentaje
          const baseService = serviceTypes.find(st => 
            st.name.toLowerCase().includes('solo') || 
            st.name.toLowerCase().includes('alojamiento')
          );
          
          if (baseService && serviceTypeId === baseService.id) {
            console.log('=== UPDATING BASE PRICE - RECALCULATING PERCENTAGE SERVICES ===');
            console.log('Base service updated:', baseService.name);
            console.log('New base price:', numericPrice);
            console.log('Block service selections:', blockServiceSelections);
            
            // Actualizar los precios de servicios con porcentaje para este tipo de habitación
            const servicesWithPercentage = blockServiceSelections.filter(selection => 
              selection.isEnabled && selection.percentageAdjustment && selection.percentageAdjustment !== 0
            );
            
            console.log('Services with percentage to update:', servicesWithPercentage);
            
            servicesWithPercentage.forEach(selection => {
              const percentagePrice = Math.round(numericPrice * (1 + selection.percentageAdjustment / 100));
              console.log(`Updating ${selection.serviceTypeId} with percentage ${selection.percentageAdjustment}%: ${percentagePrice}`);
              
              const servicePriceIndex = updated.findIndex(p => 
                p.roomTypeId === roomTypeId && p.serviceTypeId === selection.serviceTypeId
              );
              
              if (servicePriceIndex >= 0) {
                updated[servicePriceIndex] = { 
                  ...updated[servicePriceIndex], 
                  basePrice: percentagePrice 
                };
              } else {
                // Si no existe el precio, crearlo
                const serviceType = serviceTypes.find(st => st.id === selection.serviceTypeId);
                const roomType = roomTypes.find(rt => rt.id === roomTypeId);
                updated.push({
                  roomTypeId,
                  serviceTypeId: selection.serviceTypeId,
                  basePrice: percentagePrice,
                  roomType,
                  serviceType
                });
              }
            });
          }
          
          return updated;
        } else {
          const roomType = roomTypes.find(rt => rt.id === roomTypeId);
          const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
          
          return [...prev, {
            roomTypeId,
            serviceTypeId,
            basePrice: numericPrice,
            roomType,
            serviceType
          }];
        }
      });
      
      // No auto-guardado - los cambios se guardarán manualmente
      console.log('Price updated - manual save required');
      
      return;
    }

    // LÓGICA SIMPLIFICADA DE PROPORCIONES
    
    // 1. Calcular el precio base del precio editado
            const serviceAdjustment = getActiveServiceAdjustments().find(adj => adj.serviceTypeId === serviceTypeId);
    let newBasePrice = numericPrice;
    
    if (serviceAdjustment && serviceAdjustment.value) {
      if (serviceAdjustment.mode === 'FIXED') {
        newBasePrice = numericPrice - serviceAdjustment.value;
      } else if (serviceAdjustment.mode === 'PERCENTAGE') {
        newBasePrice = numericPrice / (1 + serviceAdjustment.value / 100);
      }
    }
    


    // 2. Obtener el precio base anterior del tipo de habitación editado
    const baseServiceType = serviceTypes.find(st => 
      st.name.toLowerCase().includes('base') || 
      st.name.toLowerCase().includes('solo') ||
      st.name.toLowerCase().includes('habitación')
    ) || serviceTypes[0];
    
    const previousBasePrice = prices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === baseServiceType.id
    )?.basePrice || 0;

    // 3. Calcular el factor de cambio
    const changeFactor = previousBasePrice > 0 ? newBasePrice / previousBasePrice : 1;

    // 4. Aplicar el factor de cambio a TODOS los tipos de habitación
    setPrices(prev => {
      
      const updated = [];
      
      roomTypes.forEach(roomType => {
        serviceTypes.forEach(serviceType => {
          const existingPrice = prev.find(p => 
            p.roomTypeId === roomType.id && p.serviceTypeId === serviceType.id
          );
          
          let finalBasePrice;
          
          if (roomType.id === roomTypeId) {
            // Para el tipo de habitación editado, usar el nuevo precio base
            const serviceAdj = getActiveServiceAdjustments().find(adj => adj.serviceTypeId === serviceType.id);
            finalBasePrice = newBasePrice;
            
            if (serviceAdj && serviceAdj.value) {
              if (serviceAdj.mode === 'FIXED') {
                finalBasePrice = newBasePrice + serviceAdj.value;
              } else if (serviceAdj.mode === 'PERCENTAGE') {
                finalBasePrice = newBasePrice * (1 + serviceAdj.value / 100);
              }
            }
            

          } else {
            // Para otros tipos de habitación, aplicar el factor de cambio
            const currentBasePrice = existingPrice?.basePrice || 0;
            const serviceAdj = getActiveServiceAdjustments().find(adj => adj.serviceTypeId === serviceType.id);
            
            // Calcular el precio base actual (sin ajustes de servicio)
            let currentBase = currentBasePrice;
            if (serviceAdj && serviceAdj.value) {
              if (serviceAdj.mode === 'FIXED') {
                currentBase = currentBasePrice - serviceAdj.value;
              } else if (serviceAdj.mode === 'PERCENTAGE') {
                currentBase = currentBasePrice / (1 + serviceAdj.value / 100);
              }
            }
            
            // Aplicar el factor de cambio al precio base
            const newBase = currentBase * changeFactor;
            
            // Aplicar ajustes de servicio al nuevo precio base
            finalBasePrice = newBase;
            if (serviceAdj && serviceAdj.value) {
              if (serviceAdj.mode === 'FIXED') {
                finalBasePrice = newBase + serviceAdj.value;
              } else if (serviceAdj.mode === 'PERCENTAGE') {
                finalBasePrice = newBase * (1 + serviceAdj.value / 100);
              }
            }
            

          }
          
          updated.push({
            roomTypeId: roomType.id,
            serviceTypeId: serviceType.id,
            basePrice: Math.round(finalBasePrice * 100) / 100,
            roomType,
            serviceType
          });
        });
      });
      
      console.log('=== PRICES STATE UPDATED ===');
      console.log('New prices state will be set with the updated prices');
      console.log('Updated prices array:', updated);
      
      // Activar auto-guardado después de actualizar precios
      if (blockId) {
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        const newTimeout = setTimeout(autoSave, 2000); // Guardar después de 2 segundos de inactividad
        setSaveTimeout(newTimeout);
      }
      
      return updated;
    });

    // Guardado automático con debounce
    // No auto-guardado - los cambios se guardarán manualmente
    console.log('Service adjustment updated - manual save required');
  };



  // Actualizar ajuste de servicio con guardado automático
  const updateServiceAdjustment = (serviceTypeId, field, value) => {
    setBlockServiceSelections(prev => prev.map(selection => 
      selection.serviceTypeId === serviceTypeId 
        ? { 
            ...selection, 
            [field]: field === 'value' ? parseFloat(value) || 0 : value,
            ...(field === 'pricingMode' && { 
              fixedPrice: field === 'FIXED' ? value : null,
              percentage: field === 'PERCENTAGE' ? value : null
            })
          }
        : selection
    ));

    // Si se está actualizando el modo de pricing, recalcular automáticamente los precios
    if (field === 'pricingMode') {
      console.log('Cambiando modo de pricing para servicio:', serviceTypeId, 'a:', value);
      
      // Obtener el servicio base (Solo Alojamiento)
      const baseService = serviceTypes.find(st => 
        st.name.toLowerCase().includes('solo') || 
        st.name.toLowerCase().includes('alojamiento')
      );
      
      if (baseService) {
        // Para cada tipo de habitación, recalcular el precio según el nuevo modo
        roomTypes.forEach(roomType => {
          const basePrice = prices.find(p => 
            p.roomTypeId === roomType.id && p.serviceTypeId === baseService.id
          )?.basePrice || 0;
          
          if (basePrice > 0) {
            let newPrice;
            
            if (value === 'PERCENTAGE') {
              // Cambiar a porcentaje: usar el valor actual del servicio como porcentaje
              const currentServicePrice = prices.find(p => 
                p.roomTypeId === roomType.id && p.serviceTypeId === serviceTypeId
              )?.basePrice || 0;
              
              // Calcular el porcentaje basado en el precio actual vs el precio base
              const percentage = basePrice > 0 ? ((currentServicePrice - basePrice) / basePrice) * 100 : 0;
              
              // Aplicar el porcentaje calculado
              newPrice = basePrice * (1 + percentage / 100);
            } else if (value === 'FIXED') {
              // Cambiar a precio fijo: usar el precio actual como precio fijo
              const currentServicePrice = prices.find(p => 
                p.roomTypeId === roomType.id && p.serviceTypeId === serviceTypeId
              )?.basePrice || 0;
              
              // El precio fijo será la diferencia entre el precio actual y el precio base
              const fixedAmount = currentServicePrice - basePrice;
              newPrice = basePrice + fixedAmount;
            }
            
            if (newPrice !== undefined) {
              console.log(`Recalculando precio para ${roomType.name}: ${newPrice} (modo: ${value})`);
              updatePrice(roomType.id, serviceTypeId, newPrice, false); // No aplicar proporciones
            }
          }
        });
      }
    }

    // Si se está actualizando el valor de un servicio, recalcular automáticamente los precios
    if (field === 'value' && value) {
      const numericValue = parseFloat(value) || 0;
      const serviceSelection = blockServiceSelections.find(s => s.serviceTypeId === serviceTypeId);
      
      if (serviceSelection && serviceSelection.pricingMode === 'PERCENTAGE' && numericValue > 0) {
        // Obtener el servicio base (Solo Alojamiento)
        const baseService = serviceTypes.find(st => 
          st.name.toLowerCase().includes('solo') || 
          st.name.toLowerCase().includes('alojamiento')
        );
        
        if (baseService) {
          // Para cada tipo de habitación, calcular el nuevo precio basado en la tarifa base
          roomTypes.forEach(roomType => {
            const basePrice = prices.find(p => 
              p.roomTypeId === roomType.id && p.serviceTypeId === baseService.id
            )?.basePrice || 0;
            
            if (basePrice > 0) {
              const newPrice = basePrice * (1 + numericValue / 100);
              updatePrice(roomType.id, serviceTypeId, newPrice, false); // No aplicar proporciones
            }
          });
        }
      }
    }

    // Guardado automático con debounce
    if (blockId) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      const newTimeout = setTimeout(autoSave, 2000); // Guardar después de 2 segundos de inactividad
      setSaveTimeout(newTimeout);
    }
  };

  // Obtener precio con ajustes y redondeo
  const getCalculatedPrice = (roomTypeId, serviceTypeId) => {
    const basePrice = prices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    )?.basePrice || 0;

    const adjustment = getActiveServiceAdjustments().find(adj => adj.serviceTypeId === serviceTypeId);
    let finalPrice = basePrice;

    if (adjustment && adjustment.value) {
      if (adjustment.mode === 'FIXED') {
        finalPrice += adjustment.value;
      } else if (adjustment.mode === 'PERCENTAGE') {
        // Para servicios con porcentaje, el precio base ya incluye el cálculo del porcentaje
        // No necesitamos aplicar el porcentaje nuevamente
        finalPrice = basePrice;
      }
    }

    const roundedPrice = applyRounding(finalPrice);
    
    return {
      basePrice,
      adjustedPrice: finalPrice,
      roundedPrice,
      wasRounded: Math.abs(finalPrice - roundedPrice) > 0.01,
      adjustment
    };
  };

  // Eliminar bloque de temporada
  const deleteSeasonBlock = async () => {
    if (!blockId) return { success: false, error: 'No hay bloque para eliminar' };

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.[0] || 'Error al eliminar el bloque');
      }

      return { success: true, data: result.data };
    } catch (err) {
      console.error('Error deleting season block:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  };

  // Clonar bloque de temporada
  const cloneSeasonBlock = () => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setFormData(prev => ({
      ...prev,
      name: `${prev.name} (Copia)`,
      startDate: today.toISOString().split('T')[0],
      endDate: nextMonth.toISOString().split('T')[0]
    }));
  };

  // Función para actualizar precios desde el componente
  const updatePricesFromCalculated = (calculatedPrices) => {
    setPrices(calculatedPrices);
  };

  // Función para resetear precios a sus valores originales
  const resetPrices = async () => {
    if (!blockId) return;
    
    try {
      console.log('=== RESETTING PRICES TO ORIGINAL ===');
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`);
      
      if (response.ok) {
        const blockData = await response.json();
        if (blockData.data && blockData.data.seasonPrices) {
          console.log('Resetting prices with original data:', blockData.data.seasonPrices);
          setPrices(blockData.data.seasonPrices);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error resetting prices:', error);
      return false;
    }
  };

  // Función para resetear todos los datos del formulario a sus valores originales
  const resetAllData = async () => {
    if (!blockId) return false;
    
    try {
      console.log('=== RESETTING ALL DATA TO ORIGINAL ===');
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`);
      
      if (response.ok) {
        const blockData = await response.json();
        const block = blockData.data;
        
        console.log('Resetting all data with original block:', block);
        
        // Resetear formData
        setFormData({
          name: block.name,
          description: block.description || '',
          startDate: new Date(block.startDate).toISOString().split('T')[0],
          endDate: new Date(block.endDate).toISOString().split('T')[0],
          useProportions: block.useProportions,
          serviceAdjustmentMode: block.serviceAdjustmentMode,
          useBlockServices: block.useBlockServices || false
        });
        
        // Resetear precios
        if (block.seasonPrices) {
          setPrices(block.seasonPrices);
        }
        
        // Resetear selecciones de servicios
        try {
          const blockServiceSelectionsRes = await fetch(`${API_URL}/block-service-selections/block/${blockId}`);
          if (blockServiceSelectionsRes.ok) {
            const blockServiceSelectionsData = await blockServiceSelectionsRes.json();
            setBlockServiceSelections(blockServiceSelectionsData);
          }
        } catch (err) {
          console.error('Error resetting block service selections:', err);
        }
        
        // Limpiar errores de validación
        setValidationErrors({});
        
        console.log('All data reset successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error resetting all data:', error);
      return false;
    }
  };

  return {
    // Estados
    loading,
    saving,
    error,
    formData,
    roomTypes,
    serviceTypes,
    prices,
    blockServiceSelections,
    roundingConfig,
    validationErrors,
    
    // Funciones
    updateFormData,
    updatePrice,
    updateServiceAdjustment,
    getCalculatedPrice,
    saveSeasonBlock,
    confirmSeasonBlock,
    autoSave,
    deleteSeasonBlock,
    cloneSeasonBlock,
    setError,
    applyRounding,
    getActiveServiceTypes,
    getActiveServiceAdjustments,
    initializePricesForNewService,
    removePricesForDeletedService,
    loadBlockServiceSelections,
    updatePricesFromCalculated,
    setBlockServiceSelections,
    resetPrices,
    resetAllData
  };
}; 