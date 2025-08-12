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
        setBlockServiceSelections(selections);
      }
    } catch (error) {
      console.error('Error loading block service selections:', error);
    }
  };


  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, [blockId, hotelId]);



  const loadInitialData = async () => {
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

        setFormData({
          name: block.name,
          description: block.description || '',
          startDate: block.startDate.split('T')[0],
          endDate: block.endDate.split('T')[0],
          useProportions: block.useProportions,
          serviceAdjustmentMode: block.serviceAdjustmentMode,
          useBlockServices: block.useBlockServices || false
        });

        // Si el bloque no tiene precios, inicializar con datos por defecto
        if (!block.seasonPrices || block.seasonPrices.length === 0) {
          initializeDefaultData(roomTypesData, serviceTypesData.data || []);
        } else {
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
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    if (!formData.startDate) {
      errors.startDate = 'La fecha de inicio es requerida';
    }

    if (!formData.endDate) {
      errors.endDate = 'La fecha de fin es requerida';
    }

    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      errors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Guardar bloque de temporada
  const saveSeasonBlock = useCallback(async () => {
    if (!validateForm()) {
      return { success: false, error: 'Por favor, corrige los errores del formulario' };
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        prices: prices.map(p => ({
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
          orderIndex: selection.orderIndex
        }))
      };

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

  // Función de guardado automático
  const autoSave = useCallback(async () => {
    if (blockId) {
      const result = await saveSeasonBlock();
      if (!result.success) {
        console.error('Error en guardado automático:', result.error);
      }
    }
  }, [blockId, saveSeasonBlock]);

  // Actualizar datos del formulario con guardado automático
  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar errores de validación
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
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

  // Actualizar precio de una habitación-servicio con proporciones inteligentes y guardado automático
  const updatePrice = (roomTypeId, serviceTypeId, newPrice, applyProportions = true) => {
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
            // Actualizar todos los servicios con porcentaje para este tipo de habitación
            blockServiceSelections.forEach(selection => {
              if (selection.pricingMode === 'PERCENTAGE' && selection.percentage) {
                const servicePriceIndex = updated.findIndex(p => 
                  p.roomTypeId === roomTypeId && p.serviceTypeId === selection.serviceTypeId
                );
                
                if (servicePriceIndex >= 0) {
                  const newServicePrice = numericPrice * (1 + selection.percentage / 100);
                  updated[servicePriceIndex] = { 
                    ...updated[servicePriceIndex], 
                    basePrice: newServicePrice 
                  };
                }
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
      
      return updated;
    });

    // Guardado automático con debounce
    if (blockId) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      const newTimeout = setTimeout(autoSave, 2000); // Guardar después de 2 segundos de inactividad
      setSaveTimeout(newTimeout);
    }
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
    deleteSeasonBlock,
    cloneSeasonBlock,
    setError,
    applyRounding,
    getActiveServiceTypes,
    getActiveServiceAdjustments,
    initializePricesForNewService,
    removePricesForDeletedService,
    loadBlockServiceSelections
  };
}; 