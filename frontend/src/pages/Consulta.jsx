import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { API_URL, fetchClients, findAvailableRooms, createReservation, getCalculatedRates, fetchRooms, fetchQueryByClient, fetchQuery, createQuery, createMultiSegmentQuery, updateMultiSegmentQuery, updateQuery, deleteQuery } from '../services/api';
import { useTags } from '../hooks/useTags';
import ReservationConfirmationModal from '../components/ReservationConfirmationModal';
import LoadExistingQueryModal from '../components/LoadExistingQueryModal';
import SelectQueryModal from '../components/SelectQueryModal';
import DeleteSegmentsModal from '../components/DeleteSegmentsModal';
import FEATURE_FLAGS from '../config/featureFlags';
import styles from '../styles/Consulta.module.css';

// Estados específicos para disponibilidad de habitaciones
const RoomAvailabilityStatus = {
  SUCCESS: 'success',
  PARTIAL_AVAILABILITY: 'partial_availability', 
  NO_AVAILABILITY: 'no_availability',
  SERVICE_NOT_AVAILABLE: 'service_not_available',
  ERROR: 'error'
};

export default function Consulta() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tags } = useTags();

  // Función para validar si el hotel está cerrado en el período solicitado
  const validateHotelAvailability = useCallback(async (checkIn, checkOut) => {
    // MVP manual: no depender de SeasonBlocks para operar
    if (!FEATURE_FLAGS.SEASON_BLOCK_AVAILABILITY) {
      setIsHotelClosed(false);
      return false;
    }

    try {
      // Validar que las fechas sean válidas
      if (!checkIn || !checkOut) {
        setIsHotelClosed(false);
        return false;
      }

      // Validar formato de fechas
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        setIsHotelClosed(false);
        return false;
      }

      // Validar que check-in sea anterior a check-out
      if (startDate >= endDate) {
        setIsHotelClosed(false);
        return false;
      }

      // Obtener bloques de temporada para el período
      const response = await fetch(`${API_URL}/season-blocks?hotelId=default-hotel`);
      
      if (response.ok) {
        const data = await response.json();
        const seasonBlocks = data.data || [];
        
        // Filtrar solo bloques activos (no draft)
        const activeBlocks = seasonBlocks.filter(block => !block.isDraft);
        
        // Si no hay bloques activos, el hotel está cerrado
        if (activeBlocks.length === 0) {
          setIsHotelClosed(true);
          return true;
        }
        
        // Verificar si el período solicitado está completamente cubierto por bloques activos
        let hasUncoveredDays = false;
        
        for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
          const dateString = date.toISOString().split('T')[0];
          
          // Verificar si esta fecha está cubierta por algún bloque activo
          const isCovered = activeBlocks.some(block => {
            // Normalizar fechas para comparación (sin zona horaria)
            const blockStart = new Date(block.startDate.split('T')[0] + 'T00:00:00');
            const blockEnd = new Date(block.endDate.split('T')[0] + 'T00:00:00');
            const currentDate = new Date(dateString + 'T00:00:00');
            
            // Nota: endDate es INCLUSIVO, debe usar <= para ser consistente con el backend
            return currentDate >= blockStart && currentDate <= blockEnd;
          });
          
          if (!isCovered) {
            hasUncoveredDays = true;
            break;
          }
        }
        
        // Actualizar estado basado en si hay días sin cobertura
        setIsHotelClosed(hasUncoveredDays);
        return hasUncoveredDays;
      }
      
      // Si hay error en la API, asumir que el hotel está disponible
      setIsHotelClosed(false);
      return false;
    } catch (error) {
      console.error('Error validando disponibilidad del hotel:', error);
      // En caso de error, asumir que el hotel está disponible
      setIsHotelClosed(false);
      return false;
    }
  }, []);

  // Función para obtener las fechas por defecto basadas en bloques de temporada
  const getDefaultDates = useCallback(async () => {
    // console.log('🎯 getDefaultDates iniciada');
    try {
      const today = new Date();
      const todayString = format(today, 'yyyy-MM-dd');
      // console.log('📅 Fecha de hoy:', { today: today, todayString: todayString, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      
      // Obtener todos los bloques de temporada
      // console.log('🔍 Buscando bloques de temporada...');
      const seasonBlocksResponse = await fetch(`${API_URL}/season-blocks?hotelId=default-hotel`);
      
      if (seasonBlocksResponse.ok) {
        const seasonBlocksData = await seasonBlocksResponse.json();
        const seasonBlocks = seasonBlocksData.data || [];
        
        // console.log('📋 Bloques de temporada encontrados:', seasonBlocks.length);
        
        // Buscar bloques que empiecen hoy o en el futuro
        const availableBlocks = seasonBlocks
          .filter(block => {
            if (block.isDraft) return false;
            // Extraer solo la parte de fecha para evitar problemas de zona horaria
            const blockStartDate = block.startDate.split('T')[0];
            return blockStartDate >= todayString; // El bloque debe empezar hoy o después
          })
          .sort((a, b) => {
            // Ordenar por fecha de inicio usando strings extraídos
            const startDateA = a.startDate.split('T')[0];
            const startDateB = b.startDate.split('T')[0];
            return startDateA.localeCompare(startDateB);
          });
        
        // console.log('📋 Bloques disponibles:', availableBlocks.map(b => ({ name: b.name, startDate: b.startDate.split('T')[0], endDate: b.endDate.split('T')[0] })));
        
        if (availableBlocks.length > 0) {
          // Usar el primer día del primer bloque disponible
          const firstBlock = availableBlocks[0];
          
          // Extraer solo la parte de fecha (YYYY-MM-DD) del string ISO para evitar problemas de zona horaria
          const startDateISO = firstBlock.startDate.split('T')[0]; // Obtener "2025-10-10" de "2025-10-10T00:00:00.000Z"
          const checkInDate = startDateISO;
          const checkOutDate = format(addDays(new Date(startDateISO + 'T12:00:00'), 1), 'yyyy-MM-dd');
          
          // console.log('✅ Usando fechas del primer bloque disponible:', { bloque: firstBlock.name, checkIn: checkInDate, checkOut: checkOutDate });
          return { checkIn: checkInDate, checkOut: checkOutDate };
        }
      } else {
        console.error('❌ Error en respuesta de API:', {
          status: seasonBlocksResponse.status,
          statusText: seasonBlocksResponse.statusText
        });
      }
      
      // Si no hay bloques de temporada o hay error, usar fechas por defecto (hoy y mañana)
      const checkInDate = todayString;
      const checkOutDate = format(addDays(today, 1), 'yyyy-MM-dd');
      console.log('⚠️ No se encontraron bloques de temporada o hay error. Usando fechas por defecto:', { checkIn: checkInDate, checkOut: checkOutDate });
      return { checkIn: checkInDate, checkOut: checkOutDate };
    } catch (error) {
      console.error('❌ Error obteniendo fechas por defecto:', error);
      // En caso de error, usar fechas por defecto
      const today = new Date();
      const checkInDate = format(today, 'yyyy-MM-dd');
      const checkOutDate = format(addDays(today, 1), 'yyyy-MM-dd');
      console.log('🔄 Usando fechas de fallback:', { checkIn: checkInDate, checkOut: checkOutDate });
      return { checkIn: checkInDate, checkOut: checkOutDate };
    }
  }, []);

  // Estado del formulario (sin persistencia - se reinicia al actualizar)
  const [formData, setFormData] = useState({
    checkIn: '',
    checkOut: '',
    mainClient: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    }
  });

  // Estado para tipos de servicio
  const [serviceTypes, setServiceTypes] = useState([]);
  
  // Estados para manejo de disponibilidad parcial de servicios
  const [isPartiallyAvailable, setIsPartiallyAvailable] = useState(false);
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [serviceName, setServiceName] = useState('');

  // Estado para manejar cuando el hotel está cerrado
  const [isHotelClosed, setIsHotelClosed] = useState(false);

  // Estado para requerimientos (sin persistencia - se reinicia al actualizar)
  const [requirements, setRequirements] = useState({
    requiredGuests: 1,
    requiredTags: [],
    requiredRoomId: null,
    serviceType: ''
  });

  // Estado para segmentos de consulta (sin persistencia - se reinicia al actualizar)
  const [segments, setSegments] = useState([
    {
      id: 1,
      checkIn: '',
      checkOut: '',
      requiredGuests: 1,
      requiredTags: [],
      requiredRoomId: null,
      serviceType: ''
    }
  ]);

  // Estado para clientes
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  // Estado para habitaciones (para el selector de habitación específica)
  const [allRooms, setAllRooms] = useState([]);
  const [loadingAllRooms, setLoadingAllRooms] = useState(false);

  // Estado para habitaciones disponibles (por bloque)
  const [availableRoomsPerBlock, setAvailableRoomsPerBlock] = useState({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [hasSearchedPerBlock, setHasSearchedPerBlock] = useState({}); // Rastrea si se buscó en cada bloque

  // Estado para tarifas por día
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [dailyRates, setDailyRates] = useState([]);

  // Estado para el modal de confirmación
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [showPastDateWarning, setShowPastDateWarning] = useState(false);
  const [pendingReservationStatus, setPendingReservationStatus] = useState('PENDIENTE');

  // Estados para el modal de eliminación de segmentos
  const [showDeleteSegmentsModal, setShowDeleteSegmentsModal] = useState(false);
  const [segmentsToDelete, setSegmentsToDelete] = useState([]);
  const [pendingSegmentChange, setPendingSegmentChange] = useState(null);

  // Estados para las secciones colapsables del nuevo diseño
  const [showSegments, setShowSegments] = useState(false);
  
  // Estado para mostrar detalles de habitaciones
  const [showRoomDetails, setShowRoomDetails] = useState({});
  
  // Estado para navegación de bloques de estadía
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [selectedRoomsPerBlock, setSelectedRoomsPerBlock] = useState({});
  // const [pricingError, setPricingError] = useState(null); // Ya no se usa

  // Estados para gestión de consultas
  const [currentQueryId, setCurrentQueryId] = useState(null);
  const [currentQueryGroupId, setCurrentQueryGroupId] = useState(null);
  const [showLoadQueryModal, setShowLoadQueryModal] = useState(false);
  const [existingQuery, setExistingQuery] = useState(null);
  const [lastClientId, setLastClientId] = useState(null);
  
  // Estados para selección de consultas múltiples
  const [showSelectQueryModal, setShowSelectQueryModal] = useState(false);
  const [recentQueries, setRecentQueries] = useState([]);
  
  // Estado para notas/observaciones
  const [notes, setNotes] = useState('');
  
  // Flag para evitar cargar datos múltiples veces
  const dataLoadedRef = useRef(false);
  
  // Ref para rastrear los valores previos de los segmentos
  const previousSegmentsRef = useRef({});

  // Función para toggle de detalles de habitación
  const toggleRoomDetails = (roomId) => {
    setShowRoomDetails(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  // Funciones para manejar bloques de estadía
  const addNewBlock = () => {
    const newBlockId = Date.now();
    const lastBlock = segments[segments.length - 1];
    
    // Calcular fechas del nuevo bloque
    let checkInDate;
    let checkOutDate;
    
    if (lastBlock?.checkOut) {
      // Usar el check-out del bloque anterior como check-in del nuevo bloque
      checkInDate = lastBlock.checkOut;
      // Check-out será el día siguiente al check-in
      checkOutDate = format(addDays(new Date(checkInDate + 'T00:00:00'), 1), 'yyyy-MM-dd');
    } else {
      // Si no hay bloque anterior, usar fechas por defecto
      const today = format(new Date(), 'yyyy-MM-dd');
      checkInDate = today;
      checkOutDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    }
    
    const newBlock = {
      id: newBlockId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      requiredGuests: requirements.requiredGuests, // Usar la cantidad global
      requiredTags: [],
      requiredRoomId: null,
      serviceType: lastBlock?.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
    };
    
    console.log('➕ Nuevo bloque agregado:', {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      diasEntreFechas: Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))
    });
    
    const newBlockIndex = segments.length;
    
    setSegments(prev => [...prev, newBlock]);
    setActiveBlockIndex(newBlockIndex);
    
    // El ref de valores previos se inicializará automáticamente en el useEffect
    // cuando se detecte el cambio de activeBlockIndex
  };

  // Función helper para obtener un servicio alternativo
  const getAlternativeServiceType = (excludeServiceType) => {
    if (!serviceTypes || serviceTypes.length === 0) return '';
    
    // Buscar un servicio diferente al excluido
    const alternative = serviceTypes.find(st => st.id !== excludeServiceType);
    if (alternative) return alternative.id;
    
    // Si no hay alternativas, usar el primer servicio disponible
    return serviceTypes[0].id;
  };

  // Función para crear segmentos automáticamente basados en períodos disponibles
  const createSegmentsFromAvailablePeriods = () => {
    if (availablePeriods.length === 0) return;
    
    const currentSegment = segments[activeBlockIndex];
    if (!currentSegment) return;
    
    // console.log('🔍 Debug createSegmentsFromAvailablePeriods:', { currentSegment, availablePeriods, serviceTypes });
    
    const originalStart = new Date(currentSegment.checkIn);
    const originalEnd = new Date(currentSegment.checkOut);
    
    // console.log('📅 Fechas originales:', { originalStart: originalStart.toISOString().split('T')[0], originalEnd: originalEnd.toISOString().split('T')[0] });
    
    // Ordenar períodos disponibles por fecha de inicio
    const sortedPeriods = [...availablePeriods].sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );
    
    // console.log('📅 Períodos ordenados:', sortedPeriods.map(p => ({ startDate: p.startDate, endDate: p.endDate, blockName: p.blockName })));
    
    const allSegments = [];
    let currentId = Math.max(...segments.map(s => s.id)) + 1;
    let currentDate = originalStart;
    
    // Procesar cada período disponible
    for (const period of sortedPeriods) {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      
      // console.log('🔄 Procesando período:', { periodStart: periodStart.toISOString().split('T')[0], periodEnd: periodEnd.toISOString().split('T')[0], currentDate: currentDate.toISOString().split('T')[0] });
      
      // Si hay un gap antes de este período, crear segmento con servicio base
      if (currentDate < periodStart) {
        // El gap termina el mismo día que empieza el siguiente período (cambio de servicio)
        const gapSegment = {
          id: currentId++,
          checkIn: currentDate.toISOString().split('T')[0],
          checkOut: periodStart.toISOString().split('T')[0],
          requiredGuests: currentSegment.requiredGuests || 1,
          requiredTags: currentSegment.requiredTags || [],
          requiredRoomId: currentSegment.requiredRoomId || null,
          serviceType: getAlternativeServiceType(currentSegment.serviceType) // Servicio alternativo
        };
        allSegments.push(gapSegment);
        // console.log('➕ Segmento de gap creado:', gapSegment);
        
        // Actualizar currentDate al inicio del período disponible
        currentDate = new Date(periodStart);
      }
      
      // Crear segmento para el período disponible (con el servicio solicitado)
      const availableSegment = {
        id: currentId++,
        checkIn: period.startDate,
        checkOut: period.endDate,
        requiredGuests: currentSegment.requiredGuests || 1,
        requiredTags: currentSegment.requiredTags || [],
        requiredRoomId: currentSegment.requiredRoomId || null,
        serviceType: currentSegment.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
      };
      allSegments.push(availableSegment);
      // console.log('➕ Segmento disponible creado:', availableSegment);
      
      // Actualizar la fecha actual al final del período (el siguiente segmento empezará en esta fecha)
      currentDate = new Date(periodEnd);
      // console.log('📅 Fecha actualizada a:', currentDate.toISOString().split('T')[0]);
    }
    
    // Si hay un gap después del último período, crear segmento con servicio base
    if (currentDate < originalEnd) {
      const finalSegment = {
        id: currentId++,
        checkIn: currentDate.toISOString().split('T')[0],
        checkOut: originalEnd.toISOString().split('T')[0],
        requiredGuests: currentSegment.requiredGuests || 1,
        requiredTags: currentSegment.requiredTags || [],
        requiredRoomId: currentSegment.requiredRoomId || null,
        serviceType: getAlternativeServiceType(currentSegment.serviceType) // Servicio alternativo
      };
      allSegments.push(finalSegment);
      // console.log('➕ Segmento final creado:', finalSegment);
    }
    
    console.log('📋 Segmentos creados:', allSegments.length);
    
    // Verificar si hay solapamientos (check-out == check-in es válido para cambio de servicio)
    for (let i = 0; i < allSegments.length - 1; i++) {
      const current = allSegments[i];
      const next = allSegments[i + 1];
      const currentEnd = new Date(current.checkOut);
      const nextStart = new Date(next.checkIn);
      
      // Solo es solapamiento si el check-out es DESPUÉS del check-in del siguiente
      if (currentEnd > nextStart) {
        console.error('❌ SOLAPAMIENTO DETECTADO:', {
          segmento1: `${current.checkIn} → ${current.checkOut}`,
          segmento2: `${next.checkIn} → ${next.checkOut}`,
          problema: `El segmento ${i+1} termina en ${current.checkOut} y el segmento ${i+2} empieza en ${next.checkIn}`
        });
      }
    }
    
    // Reemplazar el segmento actual con todos los nuevos segmentos
    const updatedSegments = [...segments];
    updatedSegments.splice(activeBlockIndex, 1, ...allSegments);
    
    setSegments(updatedSegments);
    setActiveBlockIndex(activeBlockIndex); // Mantener el índice activo
    
    // NO actualizar formData global - cada segmento tiene sus propias fechas
    // console.log('🔄 Segmentos actualizados correctamente - cada uno mantiene sus fechas individuales');
    
    // Limpiar estados de error
    setAvailablePeriods([]);
    
    console.log('✅ Segmentos creados automáticamente');
    
    // Buscar habitaciones disponibles automáticamente después de que se actualicen los segmentos
    if (allSegments.length > 0) {
      // console.log('🔍 Programando búsqueda automática de habitaciones para después de actualizar segmentos...');
      
      // Usar setTimeout para asegurar que la búsqueda se ejecute después de que React actualice el estado
      setTimeout(() => {
        // console.log('🔍 Ejecutando búsqueda automática de habitaciones...');
        
        // Buscar para el primer segmento (que ahora es el activo)
        const activeSegment = allSegments[0];
        // console.log('🔍 Segmento activo para búsqueda:', { id: activeSegment.id, checkIn: activeSegment.checkIn, checkOut: activeSegment.checkOut, serviceType: activeSegment.serviceType });
        
        if (activeSegment.checkIn && activeSegment.checkOut) {
          const params = {
            checkIn: activeSegment.checkIn,
            checkOut: activeSegment.checkOut,
            requiredGuests: activeSegment.requiredGuests,
            requiredTags: activeSegment.requiredTags,
            requiredRoomId: activeSegment.requiredRoomId
          };
          
          // console.log('🔍 Parámetros de búsqueda (después de actualizar segmentos):', params);
          
          // Verificar que no sea el servicio original que causó el problema
          // if (activeSegment.serviceType && serviceTypes.length > 0) {
          //   const serviceTypeName = serviceTypes.find(st => st.id === activeSegment.serviceType)?.name || 'Desconocido';
          //   console.log('🔍 Tipo de servicio del segmento:', serviceTypeName);
          // }
          
          searchAvailableRooms(params);
        }
      }, 100); // Pequeño delay para asegurar que el estado se haya actualizado
    }
  };

  const removeBlock = (blockId) => {
    if (segments.length <= 1) return; // No permitir eliminar el último bloque
    
    setSegments(prev => prev.filter(block => block.id !== blockId));
    
    // Ajustar el índice activo si es necesario
    if (activeBlockIndex >= segments.length - 1) {
      setActiveBlockIndex(Math.max(0, activeBlockIndex - 1));
    }
    
    // Limpiar el ref de valores previos ya que los índices cambiarán
    previousSegmentsRef.current = {};
  };

  const selectRoomForBlock = (blockIndex, room) => {
    setSelectedRoomsPerBlock(prev => {
      const previous = prev[blockIndex];
      // Conservar tarifa manual si se re-selecciona la misma habitación
      const preservedManual =
        previous && previous.id === room.id
          ? {
              manualNightlyRate: previous.manualNightlyRate,
              manualTotalAmount: previous.manualTotalAmount,
              price: previous.price,
              ratesData: previous.ratesData
            }
          : {};
      return {
        ...prev,
        [blockIndex]: {
          ...room,
          ...preservedManual,
          // En modo manual, price inicia vacío hasta que el usuario lo cargue
          price: preservedManual.price ?? (FEATURE_FLAGS.AUTO_RATES ? room.price : room.price || 0),
          ratesData: preservedManual.ratesData ?? room.ratesData ?? null
        }
      };
    });
    // NO actualizamos roomId en el segmento porque no queremos guardarlo
  };

  const updateManualRateForBlock = (blockIndex, nightlyRate) => {
    const parsed = parseFloat(nightlyRate);
    const safeRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const segment = segments[blockIndex];
    let nights = 1;
    if (segment?.checkIn && segment?.checkOut) {
      nights = Math.max(
        1,
        Math.ceil((new Date(segment.checkOut) - new Date(segment.checkIn)) / (1000 * 60 * 60 * 24))
      );
    }
    const total = safeRate * nights;

    setSelectedRoomsPerBlock(prev => {
      const current = prev[blockIndex];
      if (!current) return prev;
      return {
        ...prev,
        [blockIndex]: {
          ...current,
          manualNightlyRate: safeRate || '',
          manualTotalAmount: total || '',
          price: safeRate,
          ratesData: {
            totalAmount: total,
            rates: Array.from({ length: nights }, (_, i) => ({
              date: new Date(new Date(segment.checkIn).getTime() + i * 86400000).toISOString(),
              serviceRate: safeRate,
              baseRate: safeRate,
              source: 'manual'
            })),
            source: 'manual'
          }
        }
      };
    });
  };

  // Usar useRef para evitar loops infinitos con el queryGroupId
  const queryGroupIdRef = useRef(null);
  const isSavingRef = useRef(false);

  // Función para guardar/actualizar consulta automáticamente
  const saveQueryAutomatically = useCallback(async () => {
    const clientId = formData.mainClient.id;
    
    // Evitar guardados concurrentes
    if (isSavingRef.current) {
      console.log('⏭️ Ya hay un guardado en progreso, saltando...');
      return;
    }
    
    console.log('🔍 saveQueryAutomatically ejecutándose');
    console.log('🔍 currentQueryGroupId:', queryGroupIdRef.current);
    console.log('🔍 clientId:', clientId);
    console.log('🔍 Número de segmentos:', segments.length);
    
    // Solo guardar si hay un cliente seleccionado
    if (!clientId) return;

    // Validar que haya segmentos
    if (!segments || segments.length === 0) {
      console.log('⚠️ No hay segmentos para guardar');
      return;
    }

    // Validar que al menos un segmento tenga fechas
    const hasValidSegment = segments.some(seg => seg.checkIn && seg.checkOut);
    if (!hasValidSegment) {
      console.log('⚠️ No hay segmentos con fechas válidas para guardar');
      return;
    }

    isSavingRef.current = true;

    try {
      // Preparar todos los segmentos para guardar (solo requerimientos, NO resultados como roomId)
      const segmentsData = segments.map(segment => {
        console.log('🔍 Preparando segmento para guardar:', segment);
        return {
          checkIn: segment.checkIn || null, // Enviar como string, el backend lo convertirá a Date
          checkOut: segment.checkOut || null, // Enviar como string, el backend lo convertirá a Date
          requiredGuests: segment.requiredGuests || 1,
          requiredRoomId: segment.requiredRoomId || null,
          requiredTags: segment.requiredTags || [],
          serviceType: segment.serviceType || '',
          requirementsNotes: segment.requirementsNotes || '',
          // NO guardamos roomId porque es un resultado de búsqueda que puede cambiar
          totalAmount: segment.totalAmount || null,
          reservationType: segment.reservationType || 'con_desayuno',
          fixed: segment.fixed || false
        };
      });
      
      console.log('🔍 SegmentsData a enviar al backend:', segmentsData);

      const queryData = {
        mainClientId: clientId,
        segments: segmentsData,
        notes: notes
      };

      if (queryGroupIdRef.current) {
        // Actualizar consulta existente
        console.log('🔄 Actualizando consulta existente:', queryGroupIdRef.current);
        const result = await updateMultiSegmentQuery(queryGroupIdRef.current, queryData);
        console.log('✅ Consulta multi-segmento actualizada:', result.queryGroupId);
        console.log('✅ Segmentos actualizados:', result.segmentCount);
      } else {
        // Crear nueva consulta multi-segmento
        console.log('➕ Creando nueva consulta multi-segmento');
        const result = await createMultiSegmentQuery(queryData);
        
        // Guardar el queryGroupId para futuras actualizaciones
        if (result.queryGroupId) {
          queryGroupIdRef.current = result.queryGroupId;
          setCurrentQueryId(result.segments[0].id); // Solo para referencia en UI
          console.log('✅ Consulta multi-segmento creada:', result.queryGroupId);
          console.log('✅ Segmentos creados:', result.segmentCount);
        }
      }
    } catch (error) {
      console.error('Error guardando consulta automáticamente:', error);
      // No mostrar error al usuario, es guardado automático
    } finally {
      isSavingRef.current = false;
    }
  }, [formData.mainClient.id, segments, notes]);

  // Función para cargar clientes
  const loadClients = useCallback(async () => {
    try {
      const response = await fetchClients();
      setClients(response);
      setFilteredClients(response.slice(0, 10));
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []);

  // Función para cargar todas las habitaciones
  const loadAllRooms = useCallback(async () => {
    setLoadingAllRooms(true);
    try {
      const roomsData = await fetchRooms();
      setAllRooms(roomsData);
    } catch (error) {
      console.error('Error cargando habitaciones:', error);
    } finally {
      setLoadingAllRooms(false);
    }
  }, []);

  // Calcular la capacidad máxima de huéspedes basada en los tipos de habitación existentes
  const maxGuestCapacity = React.useMemo(() => {
    if (!allRooms || allRooms.length === 0) return 10; // Valor por defecto
    
    // Obtener la capacidad máxima de todos los tipos de habitación
    const maxCapacity = Math.max(
      ...allRooms.map(room => room.roomType?.maxPeople || room.maxPeople || 1)
    );
    
    return maxCapacity;
  }, [allRooms]);

  // Función para cargar las fechas por defecto
  const loadDefaultDates = useCallback(async () => {
    // console.log('🔄 loadDefaultDates llamada');
    // console.log('📋 formData actual:', formData);
    
    try {
      const defaultDates = await getDefaultDates();
      // console.log('✅ Fechas por defecto obtenidas:', defaultDates);
      
      setFormData(prev => ({
        ...prev,
        checkIn: defaultDates.checkIn,
        checkOut: defaultDates.checkOut
      }));
      
      // También actualizar el primer segmento, asegurando que siempre tenga valores definidos
      setSegments(prev => prev.map((segment, index) => 
        index === 0 ? {
          ...segment,
          checkIn: defaultDates.checkIn,
          checkOut: defaultDates.checkOut,
          requiredGuests: segment.requiredGuests || 1,
          requiredTags: segment.requiredTags || [],
          requiredRoomId: segment.requiredRoomId || null,
          serviceType: segment.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
        } : {
          ...segment,
          checkIn: segment.checkIn || '',
          checkOut: segment.checkOut || '',
          requiredGuests: segment.requiredGuests || 1,
          requiredTags: segment.requiredTags || [],
          requiredRoomId: segment.requiredRoomId || null,
          serviceType: segment.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
        }
      ));
      
      // console.log('✅ Fechas actualizadas en el estado');
    } catch (error) {
      console.error('❌ Error cargando fechas por defecto:', error);
    }
  }, [getDefaultDates, serviceTypes]);

  // Función para cargar tarifas diarias
  const loadDailyRates = useCallback(async () => {
    if (!selectedRoomType || segments.length === 0) return;
    
    const firstSegment = segments[0];
    if (!firstSegment.checkIn || !firstSegment.checkOut) return;

    try {
      // Calcular días entre check-in y check-out del primer segmento
      const startDate = new Date(firstSegment.checkIn);
      const endDate = new Date(firstSegment.checkOut);
      const days = [];
      
      for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      const rates = [];
      
      // Obtener el servicio seleccionado del primer segmento
      const selectedServiceType = segments[0]?.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '');
      
      // Obtener el nombre del tipo de servicio desde los tipos de servicio cargados
      const selectedService = serviceTypes.find(st => st.id === selectedServiceType);
      const selectedServiceName = selectedService ? selectedService.name : 'Servicio no encontrado';
      
      for (const day of days) {
        const dateStr = day.toISOString().split('T')[0];
        
        // Obtener bloque activo para esta fecha (simulamos la lógica del endpoint)
        const seasonBlocksResponse = await fetch(`${API_URL}/season-blocks?hotelId=default-hotel`);
        
        if (seasonBlocksResponse.ok) {
          const seasonBlocksData = await seasonBlocksResponse.json();
          const seasonBlocks = seasonBlocksData.data || [];
          
          // Buscar el bloque activo para esta fecha
          const activeBlockForDate = seasonBlocks.find(block => {
            const startDate = new Date(block.startDate);
            const endDate = new Date(block.endDate);
            const checkDate = new Date(dateStr);
            return !block.isDraft && checkDate >= startDate && checkDate <= endDate;
          });
          
          if (activeBlockForDate && activeBlockForDate.seasonPrices) {
            // Buscar precios para este tipo de habitación
            const roomTypePrices = activeBlockForDate.seasonPrices.filter(
              price => price.roomTypeId === selectedRoomType.id
            );
            
            if (roomTypePrices.length > 0) {
              const defaultPrice = roomTypePrices[0];
              
              // Buscar precio específico para el servicio seleccionado
              const servicePrice = activeBlockForDate.seasonPrices.find(
                price => price.roomTypeId === selectedRoomType.id && price.serviceTypeId === selectedServiceType
              );
              
              // Buscar ajuste de servicio si existe
              const serviceAdjustment = activeBlockForDate.serviceAdjustments?.find(
                adj => adj.serviceTypeId === selectedServiceType
              );
              
              let finalPrice = 0;
                
                if (servicePrice) {
                const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                finalPrice = servicePrice.basePrice * (1 + adjustment / 100);
              } else if (defaultPrice) {
                  // Si no hay precio específico para el servicio, usar precio por defecto
                const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                finalPrice = defaultPrice.basePrice * (1 + adjustment / 100);
                }
              
              rates.push({
                date: dateStr,
                blockName: activeBlockForDate.name,
                serviceName: selectedServiceName,
                price: Math.round(finalPrice)
              });
            } else {
              rates.push({
                date: dateStr,
                blockName: activeBlockForDate.name,
                serviceName: selectedServiceName,
                price: 0,
                noRatesAvailable: true
              });
            }
          } else {
            // Intentar obtener un bloque en borrador si no hay confirmados
            // Usar los datos que ya obtuvimos en lugar de leer el response nuevamente
            if (seasonBlocksData.reason === 'only_draft_blocks' && seasonBlocksData.draftBlocks && seasonBlocksData.draftBlocks.length > 0) {
              // Usar el primer bloque en borrador disponible
              const draftBlockResponse = await fetch(`/api/season-blocks/${seasonBlocksData.draftBlocks[0].id}`);
              if (draftBlockResponse.ok) {
                const draftBlockData = await draftBlockResponse.json();
                
                if (draftBlockData.data && draftBlockData.data.seasonPrices) {
                  const roomTypePrices = draftBlockData.data.seasonPrices.filter(
                    price => price.roomTypeId === selectedRoomType.id
                  );
                  
                  if (roomTypePrices.length > 0) {
                    const defaultPrice = roomTypePrices[0];
                    
                    const servicePrice = draftBlockData.data.seasonPrices.find(
                      price => price.roomTypeId === selectedRoomType.id && price.serviceTypeId === selectedServiceType
                    );
                    
                    const serviceAdjustment = draftBlockData.data.serviceAdjustments?.find(
                      adj => adj.serviceTypeId === selectedServiceType
                    );
                    
                    let finalPrice = 0;
                    
                    if (servicePrice) {
                      const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                      finalPrice = servicePrice.basePrice * (1 + adjustment / 100);
                    } else if (defaultPrice) {
                      const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                      finalPrice = defaultPrice.basePrice * (1 + adjustment / 100);
                    }
                    
                    rates.push({
                      date: dateStr,
                      blockName: draftBlockData.data.name + ' (Borrador)',
                      serviceName: selectedServiceName,
                      price: Math.round(finalPrice)
                    });
                  } else {
                    rates.push({
                      date: dateStr,
                      blockName: draftBlockData.data.name + ' (Borrador)',
                      serviceName: selectedServiceName,
                      price: 0,
                      noRatesAvailable: true
                    });
                  }
                } else {
                  rates.push({
                    date: dateStr,
                    blockName: draftBlockData.data.name + ' (Borrador)',
                    serviceName: selectedServiceName,
                    price: 0,
                    noRatesAvailable: true
                  });
                }
              } else {
                rates.push({
                  date: dateStr,
                  blockName: 'Sin bloque',
                  serviceName: selectedServiceName,
                  price: 0,
                  noRatesAvailable: true
                });
              }
            } else {
              rates.push({
                date: dateStr,
                blockName: 'Sin bloque',
                serviceName: selectedServiceName,
                price: 0,
                noRatesAvailable: true
              });
            }
          }
        }
      }
      
      setDailyRates(rates);
    } catch (error) {
      console.error('Error loading daily rates:', error);
      setDailyRates([]);
    }
  }, [selectedRoomType, segments, serviceTypes]);

  // Cargar datos de la consulta desde el modal o desde la tabla de consultas
  useEffect(() => {
    console.log('🔍 useEffect de carga ejecutándose');
    console.log('🔍 location.state:', location.state);
    console.log('🔍 dataLoaded:', dataLoadedRef.current);
    
    if (location.state?.queryData && !dataLoadedRef.current) {
      const queryData = location.state.queryData;
      console.log('🔍 queryData recibido:', queryData);
      console.log('🔍 isEditing:', location.state.isEditing);
      
      // Si es una consulta existente (tiene ID), hacer fetch completo para obtener todos los segmentos
      if (location.state.isEditing && queryData.id) {
        console.log('🔄 Haciendo fetch completo de la query ID:', queryData.id);
        
        fetchQuery(queryData.id)
          .then(fullQueryData => {
            console.log('📦 Query completa recibida:', fullQueryData);
            console.log('📦 Tiene segmentos?', fullQueryData.isMultiSegment, 'Cantidad:', fullQueryData.segments?.length);
            
            // Cargar datos del cliente en el formulario
            if (fullQueryData.mainClient) {
              setFormData(prev => ({
                ...prev,
                mainClient: {
                  id: fullQueryData.mainClient.id,
                  firstName: fullQueryData.mainClient.firstName || '',
                  lastName: fullQueryData.mainClient.lastName || '',
                  email: fullQueryData.mainClient.email || '',
                  phone: fullQueryData.mainClient.phone || ''
                }
              }));
            }
            
            // Si es multi-segmento, cargar TODOS los segmentos
            if (fullQueryData.isMultiSegment && fullQueryData.segments && fullQueryData.segments.length > 0) {
              console.log('✅ Cargando', fullQueryData.segments.length, 'segmentos');
              
              // Guardar el queryGroupId para futuras actualizaciones
              if (fullQueryData.queryGroupId) {
                queryGroupIdRef.current = fullQueryData.queryGroupId;
                console.log('📌 QueryGroupId guardado:', fullQueryData.queryGroupId);
              }
              
              const loadedSegments = fullQueryData.segments.map((seg, index) => ({
                id: seg.id || Date.now() + index,
                checkIn: seg.checkIn ? seg.checkIn.split('T')[0] : '',
                checkOut: seg.checkOut ? seg.checkOut.split('T')[0] : '',
                requiredGuests: seg.requiredGuests || 1,
                requiredTags: seg.requiredTags || [],
                requiredRoomId: seg.requiredRoomId || null,
                requirementsNotes: seg.requirementsNotes || '',
                serviceType: seg.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : ''),
                totalAmount: seg.totalAmount || null,
                reservationType: seg.reservationType || 'con_desayuno',
                fixed: seg.fixed || false
                // NO cargamos roomId porque no lo guardamos
              }));
              
              setSegments(loadedSegments);
              
              // NO sincronizamos roomId porque no lo guardamos
              // El usuario deberá buscar habitaciones manualmente si lo desea
              
              // Cargar notas globales
              setNotes(fullQueryData.notes || '');
              
              // Establecer el primer segmento como activo
              setActiveBlockIndex(0);
              
              // Cargar datos del primer segmento en formData
              const firstSegment = fullQueryData.segments[0];
              setFormData(prev => ({
                ...prev,
                checkIn: firstSegment.checkIn ? firstSegment.checkIn.split('T')[0] : '',
                checkOut: firstSegment.checkOut ? firstSegment.checkOut.split('T')[0] : ''
              }));
              
              setRequirements({
                requiredGuests: firstSegment.requiredGuests || 1,
                requiredTags: firstSegment.requiredTags || [],
                requiredRoomId: firstSegment.requiredRoomId || null,
                requirementsNotes: firstSegment.requirementsNotes || ''
              });
              
            } else {
              // Query antigua (single segment) - retrocompatibilidad
              console.log('📄 Cargando consulta de segmento único');
              
              if (fullQueryData.checkIn && fullQueryData.checkOut) {
                setFormData(prev => ({
                  ...prev,
                  checkIn: fullQueryData.checkIn.split('T')[0],
                  checkOut: fullQueryData.checkOut.split('T')[0]
                }));
              }
              
              setRequirements({
                requiredGuests: fullQueryData.requiredGuests || 1,
                requiredTags: fullQueryData.requiredTags || [],
                requiredRoomId: fullQueryData.requiredRoomId || null,
                requirementsNotes: fullQueryData.requirementsNotes || ''
              });
              
              // Crear segmento único
              if (fullQueryData.checkIn && fullQueryData.checkOut) {
                const singleSegment = {
                  id: fullQueryData.id || Date.now(),
                  checkIn: fullQueryData.checkIn.split('T')[0],
                  checkOut: fullQueryData.checkOut.split('T')[0],
                  requiredGuests: fullQueryData.requiredGuests || 1,
                  requiredTags: fullQueryData.requiredTags || [],
                  requiredRoomId: fullQueryData.requiredRoomId || null,
                  requirementsNotes: fullQueryData.requirementsNotes || '',
                  serviceType: fullQueryData.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
                  // NO cargamos roomId porque no lo guardamos
                };
                
                setSegments([singleSegment]);
                // NO sincronizamos roomId porque no lo guardamos
              }
              
              setNotes(fullQueryData.notes || '');
            }
            
            setCurrentQueryId(fullQueryData.id);
            
            // Marcar como cargado
            dataLoadedRef.current = true;
            window.history.replaceState({}, document.title);
          })
          .catch(error => {
            console.error('❌ Error cargando query completa:', error);
            alert('Error al cargar la consulta. Por favor, intenta de nuevo.');
            
            // Marcar como cargado para evitar loops
            dataLoadedRef.current = true;
            window.history.replaceState({}, document.title);
          });
        
      } else {
        // Si es una nueva consulta desde el modal
        const { checkIn, checkOut, requiredGuests, requiredTags } = queryData;
        
        setFormData(prev => ({
          ...prev,
          checkIn,
          checkOut
        }));
        
        setRequirements(prev => ({
          ...prev,
          requiredGuests,
          requiredTags
        }));
        
        // Marcar como cargado y limpiar el state para evitar que se recargue en futuras navegaciones
        dataLoadedRef.current = true;
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state?.queryData?.id, location.state?.isEditing]);

  // Debug: Log del formData cada vez que cambie
  useEffect(() => {
    console.log('🔍 FormData actualizado:', formData);
    console.trace('🔍 Stack trace del cambio de formData');
  }, [formData]);

  // Auto-guardado con debounce para evitar requests excesivos
  useEffect(() => {
    // Solo auto-guardar si hay un cliente seleccionado y hay segmentos válidos
    if (!formData.mainClient.id || segments.length === 0) {
      console.log('⏭️ Saltando auto-guardado: no hay cliente o segmentos');
      return;
    }

    // Validar que al menos un segmento tenga fechas
    const hasValidSegment = segments.some(seg => seg.checkIn && seg.checkOut);
    if (!hasValidSegment) {
      console.log('⏭️ Saltando auto-guardado: ningún segmento tiene fechas válidas');
      return;
    }

    console.log('⏱️ Auto-guardado programado en 2 segundos...');
    
    // Debounce: esperar 2 segundos después del último cambio
    const timer = setTimeout(() => {
      console.log('💾 Ejecutando auto-guardado...');
      saveQueryAutomatically();
    }, 2000);

    // Cleanup: cancelar el timer si hay un nuevo cambio antes de 2 segundos
    return () => {
      console.log('🔄 Cancelando auto-guardado anterior (nuevo cambio detectado)');
      clearTimeout(timer);
    };
  }, [segments, formData.mainClient.id, notes, saveQueryAutomatically]);

  // Cargar tipos de servicio desde la API
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/service-types?hotelId=default-hotel`);
        if (response.ok) {
          const data = await response.json();
          setServiceTypes(data.data || []);
        } else {
          console.error('Error al cargar tipos de servicio:', response.statusText);
        }
      } catch (error) {
        console.error('Error al cargar tipos de servicio:', error);
      }
    };

    loadServiceTypes();
  }, []);

  // Actualizar serviceType por defecto cuando se carguen los tipos de servicio
  useEffect(() => {
    if (serviceTypes.length > 0) {
      const defaultServiceId = serviceTypes[0].id;
      // console.log('🔄 Actualizando serviceType por defecto:', defaultServiceId);
      // console.log('📋 Requirements serviceType actual:', requirements.serviceType);
      // console.log('📋 Segments serviceType actual:', segments.map(s => s.serviceType));
      
      // Actualizar requirements si está vacío
      if (!requirements.serviceType) {
        // console.log('✅ Actualizando requirements vacío a:', defaultServiceId);
        setRequirements(prev => ({
          ...prev,
          serviceType: defaultServiceId
        }));
      }
      
      // Actualizar segments si están vacíos
      const segmentsToUpdate = segments.filter(s => !s.serviceType);
      if (segmentsToUpdate.length > 0) {
        // console.log('✅ Actualizando segments vacíos a:', defaultServiceId);
        setSegments(prev => prev.map(segment => 
          !segment.serviceType 
            ? { ...segment, serviceType: defaultServiceId }
            : segment
        ));
      }
    }
  }, [serviceTypes, requirements.serviceType, segments]);

  // Ya no se carga habitación seleccionada desde localStorage - se reinicia al actualizar

  // Validar disponibilidad del hotel cuando cambien las fechas
  useEffect(() => {
    const activeSegment = segments[activeBlockIndex];
    
    if (activeSegment?.checkIn && activeSegment?.checkOut) {
      validateHotelAvailability(activeSegment.checkIn, activeSegment.checkOut);
    } else {
      setIsHotelClosed(false);
    }
  }, [segments, activeBlockIndex, validateHotelAvailability]);

  // Cargar clientes y fechas por defecto al montar el componente
  useEffect(() => {
    console.log('🔍 useEffect de inicialización ejecutándose');
    console.log('🔍 isEditing en inicialización:', location.state?.isEditing);
    // console.log('🚀 NuevaConsulta montado - iniciando carga...');
    loadClients();
    loadAllRooms();
    
    // Solo cargar fechas por defecto si no estamos editando una consulta existente
    if (!location.state?.isEditing) {
      console.log('🔍 Cargando fechas por defecto');
      loadDefaultDates();
    } else {
      console.log('🔍 NO cargando fechas por defecto (editando)');
    }
  }, [loadClients, loadAllRooms, loadDefaultDates]);

  // NO sincronizamos roomId porque ya no lo guardamos en consultas
  // Las habitaciones se buscarán automáticamente con debouncing cuando se cumplan las condiciones

  // COMENTADO: Sincronización automática que causaba que todos los segmentos tuvieran las mismas fechas
  // useEffect(() => {
  //   if (formData.checkIn && formData.checkOut) {
  //     setSegments(prevSegments => 
  //       prevSegments.map(segment => ({
  //         ...segment,
  //         checkIn: formData.checkIn,
  //         checkOut: formData.checkOut
  //       }))
  //     );
  //   }
  // }, [formData.checkIn, formData.checkOut]);

  // Sincronizar segmentos con formData para la búsqueda de habitaciones (solo para nuevas consultas con 1 segmento)
  useEffect(() => {
    console.log('🔍 useEffect de sincronización ejecutándose');
    console.log('🔍 isEditing en sincronización:', location.state?.isEditing);
    console.log('🔍 Número de segmentos:', segments.length);
    
    // No sincronizar si estamos cargando datos de una consulta existente
    if (location.state?.isEditing) {
      console.log('🔍 NO sincronizando (editando)');
      return;
    }
    
    // Solo sincronizar si hay un único segmento (consulta simple)
    // Con múltiples segmentos, cada uno tiene sus propias fechas independientes
    if (segments.length === 1 && segments[0] && segments[0].checkIn && segments[0].checkOut) {
      console.log('🔍 Sincronizando segmento único con formData');
      setFormData(prev => ({
        ...prev,
        checkIn: segments[0].checkIn,
        checkOut: segments[0].checkOut
      }));
    }

  }, [activeBlockIndex, location.state?.isEditing]);

  // Sincronizar segments con formData cuando estamos editando (sincronización bidireccional)
  // DESACTIVADO: Con múltiples segmentos, cada uno mantiene sus propias fechas independientes
  // La sincronización se maneja exclusivamente a través de handleSegmentChange
  useEffect(() => {
    console.log('🔍 useEffect de sincronización bidireccional ejecutándose');
    console.log('🔍 isEditing:', location.state?.isEditing);
    console.log('🔍 Número de segmentos:', segments.length);
    
    // Solo sincronizar si es edición Y hay un único segmento
    // Con múltiples segmentos, handleSegmentChange maneja todo
    if (location.state?.isEditing && segments.length === 1) {
      console.log('🔍 Sincronizando segmento único con formData (editando)');
      console.log('🔍 formData actual:', formData);
      
      setSegments(prev => {
        if (prev.length > 0 && prev[0]) {
          return [{
            ...prev[0],
            checkIn: formData.checkIn,
            checkOut: formData.checkOut,
            requiredGuests: requirements.requiredGuests,
            requiredTags: requirements.requiredTags,
            requiredRoomId: requirements.requiredRoomId,
            requirementsNotes: requirements.requirementsNotes
          }];
        }
        return prev;
      });
    } else {
      console.log('🔍 NO sincronizando bidireccional - múltiples segmentos o no editando');
    }
  }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags, requirements.requiredRoomId, requirements.requirementsNotes, location.state?.isEditing, segments.length]);

  // Seleccionar automáticamente la primera habitación disponible si no hay ninguna seleccionada para el bloque activo
  useEffect(() => {
    const availableRooms = availableRoomsPerBlock[activeBlockIndex] || [];
    const selectedRoomForBlock = selectedRoomsPerBlock[activeBlockIndex];
    
    if (availableRooms.length > 0 && !selectedRoomForBlock) {
      // Buscar primero una habitación con capacidad exacta
      const exactCapacityRoom = availableRooms.find(room => room.maxPeople === requirements.requiredGuests);
      
      if (exactCapacityRoom) {
        setSelectedRoomsPerBlock(prev => ({
          ...prev,
          [activeBlockIndex]: exactCapacityRoom
        }));
        setSelectedRoomType(exactCapacityRoom.roomType);
        // NO actualizamos roomId en el segmento
      } else {
        // Si no hay capacidad exacta, seleccionar la primera disponible
        setSelectedRoomsPerBlock(prev => ({
          ...prev,
          [activeBlockIndex]: availableRooms[0]
        }));
        setSelectedRoomType(availableRooms[0].roomType);
        // NO actualizamos roomId en el segmento
      }
    }
  }, [availableRoomsPerBlock, activeBlockIndex, requirements.requiredGuests, selectedRoomsPerBlock]);

  // Actualizar tipo de habitación cuando cambie la habitación seleccionada del bloque activo
  useEffect(() => {
    const selectedRoomForBlock = selectedRoomsPerBlock[activeBlockIndex];
    if (selectedRoomForBlock && selectedRoomForBlock.roomType) {
      setSelectedRoomType(selectedRoomForBlock.roomType);
    }
  }, [selectedRoomsPerBlock, activeBlockIndex]);

  // Cargar tarifas por día cuando cambien las fechas del primer segmento, el tipo de habitación o el servicio seleccionado
  useEffect(() => {
    if (selectedRoomType && segments.length > 0 && segments[0].checkIn && segments[0].checkOut) {
      loadDailyRates();
    }
  }, [selectedRoomType, segments, loadDailyRates]);

  // Filtrar clientes cuando cambie el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients.slice(0, 10));
    } else {
      const filtered = clients.filter(client =>
        `${client.firstName} ${client.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
      );
      setFilteredClients(filtered.slice(0, 10));
    }
  }, [searchTerm, clients]);

  // Inicializar ref de valores previos cuando se cambia a un bloque nuevo o existente
  useEffect(() => {
    const currentSegment = segments[activeBlockIndex];
    if (currentSegment && !previousSegmentsRef.current[activeBlockIndex]) {
      // Este bloque no tiene valores previos guardados, inicializarlos
      previousSegmentsRef.current[activeBlockIndex] = {
        checkIn: currentSegment.checkIn,
        checkOut: currentSegment.checkOut,
        requiredTags: JSON.stringify(currentSegment.requiredTags),
        requiredRoomId: currentSegment.requiredRoomId,
        serviceType: currentSegment.serviceType
      };
    }
  }, [activeBlockIndex, segments]);

  // Resetear búsqueda cuando cambien los parámetros de CUALQUIER segmento
  // NO incluye requiredGuests porque ahora es global
  useEffect(() => {
    segments.forEach((segment, index) => {
      // Obtener valores previos de este segmento
      const prevSegment = previousSegmentsRef.current[index];
      
      const currentValues = {
        checkIn: segment.checkIn,
        checkOut: segment.checkOut,
        requiredTags: JSON.stringify(segment.requiredTags),
        requiredRoomId: segment.requiredRoomId,
        serviceType: segment.serviceType
      };
      
      if (!prevSegment) {
        // Primera vez que vemos este segmento, guardarlo sin resetear
        previousSegmentsRef.current[index] = currentValues;
        return;
      }
      
      // Comparar valores actuales con previos
      const hasChanged = 
        prevSegment.checkIn !== currentValues.checkIn ||
        prevSegment.checkOut !== currentValues.checkOut ||
        prevSegment.requiredTags !== currentValues.requiredTags ||
        prevSegment.requiredRoomId !== currentValues.requiredRoomId ||
        prevSegment.serviceType !== currentValues.serviceType;
      
      if (hasChanged) {
        // Actualizar valores previos inmediatamente
        previousSegmentsRef.current[index] = currentValues;
        
        // Solo resetear si ya se había realizado una búsqueda
        if (hasSearchedPerBlock[index]) {
          // Los parámetros cambiaron realmente, resetear este bloque
          setHasSearchedPerBlock(prev => ({
            ...prev,
            [index]: false
          }));
          setAvailableRoomsPerBlock(prev => ({
            ...prev,
            [index]: []
          }));
          setSelectedRoomsPerBlock(prev => {
            const newSelected = { ...prev };
            delete newSelected[index];
            return newSelected;
          });
          // NO limpiamos roomId porque ya no lo usamos
        }
      }
    });
  }, [segments, hasSearchedPerBlock]);

  // Resetear búsqueda en TODOS los bloques cuando cambie la cantidad global de huéspedes
  useEffect(() => {
    // Resetear todos los bloques que ya fueron buscados
    const blocksToReset = Object.keys(hasSearchedPerBlock).filter(index => hasSearchedPerBlock[index]);
    
    if (blocksToReset.length > 0) {
      console.log('🔄 Reseteando búsqueda por cambio de huéspedes');
      setHasSearchedPerBlock({});
      setAvailableRoomsPerBlock({});
      setSelectedRoomsPerBlock({});
      
      // Actualizar el ref para reflejar el nuevo valor de huéspedes sin perder otros datos
      Object.keys(previousSegmentsRef.current).forEach(index => {
        if (segments[index]) {
          previousSegmentsRef.current[index] = {
            checkIn: segments[index].checkIn,
            checkOut: segments[index].checkOut,
            requiredTags: JSON.stringify(segments[index].requiredTags),
            requiredRoomId: segments[index].requiredRoomId,
            serviceType: segments[index].serviceType
          };
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements.requiredGuests]);

  const searchAvailableRooms = async (customParams = null) => {
    // Guardar/actualizar consulta antes de buscar habitaciones
    if (formData.mainClient.id) {
      await saveQueryAutomatically();
    }
    
    setLoadingRooms(true);
    try {
      let params;
      
      if (customParams) {
        // Usar parámetros personalizados (para búsqueda automática después de crear segmentos)
        params = {
          ...customParams,
          serviceType: customParams.serviceType || getAlternativeServiceType(customParams.serviceType)
        };
        console.log('🔍 Usando parámetros personalizados para búsqueda:', params);
      } else {
        // Usar parámetros del segmento activo (búsqueda manual)
    if (!segments[activeBlockIndex]) {
      console.log('No hay bloque activo para buscar habitaciones');
          setLoadingRooms(false);
      return;
    }
    
      const activeBlock = segments[activeBlockIndex];
        params = {
        checkIn: activeBlock.checkIn,
        checkOut: activeBlock.checkOut,
        requiredGuests: activeBlock.requiredGuests,
          requiredTags: activeBlock.requiredTags,
          requiredRoomId: activeBlock.requiredRoomId,
          serviceType: activeBlock.serviceType || getAlternativeServiceType(activeBlock.serviceType)
      };
        // console.log('🔍 Usando parámetros del segmento activo:', params);
      }

      const result = await findAvailableRooms(params);
      
      if (result && result.availableRooms) {
        
        // Calcular tarifas para cada habitación (auto) o dejar tarifa manual
        const roomsWithRates = await Promise.all(
          result.availableRooms.map(async (room) => {
            // MVP: tarifas ingresadas a mano — no llamar a getCalculatedRates
            if (!FEATURE_FLAGS.AUTO_RATES) {
              return {
                ...room,
                price: 0,
                ratesData: null,
                requiresManualRate: true
              };
            }

            let totalRate = 0;
            let ratesResult = null; // Declarar ratesResult fuera del try-catch
            
            try {
              // Usar el endpoint correcto: /api/dynamic-pricing/calculated-rates/:hotelId/:roomTypeId
              ratesResult = await getCalculatedRates(
                'default-hotel',
                room.roomType?.id,
                params.checkIn,
                params.checkOut,
                params.serviceType
              );
              
              if (ratesResult && ratesResult.rates && ratesResult.rates.length > 0) {
                // Calcular el número de días basado en las fechas de check-in y check-out
                const checkInDate = new Date(params.checkIn);
                const checkOutDate = new Date(params.checkOut);
                const numberOfDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
                
                // console.log(`🔍 ${room.name}: Fechas ${params.checkIn} a ${params.checkOut} = ${numberOfDays} días`);
                
                // Sumar solo los primeros N días (donde N = numberOfDays)
                const ratesToSum = ratesResult.rates.slice(0, numberOfDays);
                // console.log(`🔍 Sumando ${ratesToSum.length} días:`, ratesToSum.map(r => r.serviceRate || r.baseRate));
                
                totalRate = ratesToSum.reduce((sum, rate) => {
                  return sum + (rate.serviceRate || rate.baseRate || 0);
                }, 0);
                
                // console.log(`🔍 Total calculado: $${totalRate}`);
              } else {
                totalRate = 0;
              }
            } catch (error) {
              // Manejar por estado específico en lugar de silenciar errores
              const availabilityStatus = error.availabilityStatus || RoomAvailabilityStatus.ERROR;
              
              switch (availabilityStatus) {
                case RoomAvailabilityStatus.PARTIAL_AVAILABILITY:
                  console.debug(`🔍 Servicio parcialmente disponible para ${room.name}`);
                totalRate = 0;
                room.serviceAvailabilityError = error.message;
                  room.availabilityStatus = availabilityStatus;
                  // Capturar información adicional para disponibilidad parcial
                  if (error.availableServices) room.availableServices = error.availableServices;
                  if (error.serviceAvailabilityMessages) room.serviceAvailabilityMessages = error.serviceAvailabilityMessages;
                  if (error.isPartiallyAvailable !== undefined) room.isPartiallyAvailable = error.isPartiallyAvailable;
                  if (error.suggestedAction) room.suggestedAction = error.suggestedAction;
                  if (error.availablePeriods) room.availablePeriods = error.availablePeriods;
                  if (error.serviceName) room.serviceName = error.serviceName;
                  break;
                  
                case RoomAvailabilityStatus.SERVICE_NOT_AVAILABLE:
                  console.debug(`🔍 Servicio no disponible para ${room.name}`);
                totalRate = 0;
                  room.serviceAvailabilityError = error.message;
                  room.availabilityStatus = availabilityStatus;
                  // Capturar servicios alternativos
                  if (error.availableServices) room.availableServices = error.availableServices;
                  if (error.serviceName) room.serviceName = error.serviceName;
                  break;
                  
                case RoomAvailabilityStatus.NO_AVAILABILITY:
                  console.debug(`🔍 Sin disponibilidad para ${room.name}`);
                totalRate = 0;
                  room.availabilityStatus = availabilityStatus;
                  break;
                  
                default:
                  // Errores inesperados - mostrar en consola
                  console.error(`❌ Error inesperado para ${room.name}:`, error.message);
                totalRate = 0;
                  room.availabilityStatus = RoomAvailabilityStatus.ERROR;
                  break;
              }
            }
            
            return {
              ...room,
              price: Math.round(totalRate),
              ratesData: ratesResult // Guardar los datos completos de tarifas
            };
          })
        );
        
        // Verificar si TODAS las habitaciones tienen tarifa $0 (precios no configurados)
        // En modo manual esto es esperado: el usuario carga el monto después de elegir habitación
        const allZeroRates = FEATURE_FLAGS.AUTO_RATES
          && roomsWithRates.length > 0
          && roomsWithRates.every(room => room.price === 0);
        const roomsWithAvailabilityErrors = roomsWithRates.filter(room => room.availabilityError);
        const roomsWithServiceAvailabilityErrors = roomsWithRates.filter(room => room.serviceAvailabilityError);
        
        // Limpiar errores previos
        setIsPartiallyAvailable(false);
        setAvailablePeriods([]);
        setServiceName('');
        
        if (allZeroRates) {
          if (roomsWithServiceAvailabilityErrors.length > 0) {
            // Verificar si hay disponibilidad parcial
            const firstServiceError = roomsWithServiceAvailabilityErrors[0];
            
            if (firstServiceError.isPartiallyAvailable && firstServiceError.availablePeriods) {
              // Servicio parcialmente disponible - mostrar opción de segmentación
              setIsPartiallyAvailable(true);
              setAvailablePeriods(firstServiceError.availablePeriods);
              setServiceName(firstServiceError.serviceName || 'el servicio solicitado');
              // setPricingError(null); // No mostrar error de precios si es parcialmente disponible
            } else {
              // Servicio no disponible en ninguna parte - solo mostrar error simple
              // setPricingError('No se encontraron habitaciones disponibles para los criterios especificados. Intenta con otras fechas o una cantidad diferente de huéspedes.');
            }
          } else if (roomsWithAvailabilityErrors.length > 0) {
            // Usar el mensaje específico del primer error
            // const firstError = roomsWithAvailabilityErrors[0].availabilityError;
            // setPricingError(firstError);
          } else {
            // setPricingError('No se encontraron precios para las fechas solicitadas. No hay bloques de temporada configurados para estas fechas.');
          }
        } else {
          // setPricingError(null);
        }
        
        // Filtrar habitaciones con errores de disponibilidad de servicios
        const roomsWithoutServiceErrors = roomsWithRates.filter(room => !room.serviceAvailabilityError);
        
        // Guardar todas las habitaciones disponibles con tarifas (solo las que no tienen errores de servicios)
        // setAllAvailableRooms(roomsWithoutServiceErrors); // No se usa actualmente
        
        // Filtrar habitaciones: primero capacidad exacta, luego mayor capacidad
        const exactCapacityRooms = roomsWithoutServiceErrors.filter(room => room.maxPeople === params.requiredGuests);
        const largerCapacityRooms = roomsWithoutServiceErrors.filter(room => room.maxPeople > params.requiredGuests);
        
        // Determinar qué habitaciones mostrar inicialmente
        let roomsToShow = [];
        
        if (exactCapacityRooms.length > 0) {
          // Si hay habitaciones con capacidad exacta, mostrar solo esas
          roomsToShow = exactCapacityRooms;
        } else if (largerCapacityRooms.length > 0) {
          // Si no hay capacidad exacta pero sí mayor capacidad, mostrar esas automáticamente
          roomsToShow = largerCapacityRooms;
        }
        
        // Si hay errores de disponibilidad de servicios, no mostrar habitaciones
        if (roomsWithServiceAvailabilityErrors.length > 0) {
          // console.log('Hay errores de disponibilidad de servicios, no se muestran habitaciones');
          setAvailableRoomsPerBlock(prev => ({
            ...prev,
            [activeBlockIndex]: []
          }));
        } else {
          setAvailableRoomsPerBlock(prev => ({
            ...prev,
            [activeBlockIndex]: roomsToShow
          }));
        }
      } else {
        console.log('No se encontraron habitaciones disponibles');
        setAvailableRoomsPerBlock(prev => ({
          ...prev,
          [activeBlockIndex]: []
        }));
      }
    } catch (error) {
      console.error('Error buscando habitaciones disponibles:', error);
      setAvailableRoomsPerBlock(prev => ({
        ...prev,
        [activeBlockIndex]: []
      }));
    } finally {
      setLoadingRooms(false);
      
      // Guardar los valores actuales del segmento en el ref ANTES de marcar como buscado
      const currentSegment = segments[activeBlockIndex];
      if (currentSegment) {
        previousSegmentsRef.current[activeBlockIndex] = {
          checkIn: currentSegment.checkIn,
          checkOut: currentSegment.checkOut,
          requiredTags: JSON.stringify(currentSegment.requiredTags),
          requiredRoomId: currentSegment.requiredRoomId,
          serviceType: currentSegment.serviceType
        };
      }
      
      // Marcar el bloque como buscado
      setHasSearchedPerBlock(prev => ({
        ...prev,
        [activeBlockIndex]: true
      }));
    }
  };

  // Búsqueda automática de habitaciones con debouncing
  useEffect(() => {
    const activeSegment = segments[activeBlockIndex];
    
    // Validaciones: debe haber segmento activo y datos válidos
    if (!activeSegment || !activeSegment.checkIn || !activeSegment.checkOut) {
      console.log('⏭️ Saltando búsqueda automática: segmento sin fechas válidas');
      return;
    }
    
    // Validar que checkIn < checkOut
    if (activeSegment.checkIn >= activeSegment.checkOut) {
      console.log('⏭️ Saltando búsqueda automática: fechas inválidas');
      return;
    }
    
    // Validar que haya cantidad de huéspedes
    if (!activeSegment.requiredGuests) {
      console.log('⏭️ Saltando búsqueda automática: sin cantidad de huéspedes');
      return;
    }
    
    // Si ya se buscó para este bloque, no buscar de nuevo automáticamente
    // (el usuario puede cambiar parámetros y buscar manualmente si quiere)
    if (hasSearchedPerBlock[activeBlockIndex]) {
      console.log('⏭️ Saltando búsqueda automática: ya se buscó para este bloque');
      return;
    }
    
    console.log('⏱️ Búsqueda automática programada en 600ms...');
    
    // Debounce: esperar 600ms después del último cambio (más rápido que guardado)
    const timer = setTimeout(() => {
      console.log('🔍 Ejecutando búsqueda automática de habitaciones...');
      searchAvailableRooms();
    }, 600);
    
    // Cleanup: cancelar el timer si hay un nuevo cambio antes de 600ms
    return () => {
      console.log('🔄 Cancelando búsqueda automática anterior (nuevo cambio detectado)');
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    segments, 
    activeBlockIndex, 
    hasSearchedPerBlock
  ]);

  const handleClientInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      mainClient: {
        ...prev.mainClient,
        [field]: value
      }
    }));
  };

  const handleClientSelect = async (client) => {
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        phone: client.phone || '',
        id: client.id
      }
    }));
    setSearchTerm('');
    setFilteredClients([]);
    setShowNewClientForm(false);
    
    // Verificar si el cliente tiene una consulta preexistente
    await checkForExistingQuery(client.id);
  };

  const handleNewSearch = () => {
    setSearchTerm('');
    setShowNewClientForm(false);
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      }
    }));
    // Limpiar consulta actual
    setCurrentQueryId(null);
    setCurrentQueryGroupId(null);
    queryGroupIdRef.current = null;
    setLastClientId(null);
  };

  // Función para verificar si existe una consulta para el cliente
  const checkForExistingQuery = async (clientId) => {
    try {
      // Solo verificar si el cliente cambió
      if (lastClientId === clientId) return;
      
      setLastClientId(clientId);
      const existingQueries = await fetchQueryByClient(clientId);
      
      if (existingQueries && existingQueries.length > 0) {
        // Tiene consultas recientes, mostrar modal de selección
        setRecentQueries(existingQueries);
        setShowSelectQueryModal(true);
      } else {
        // No hay consultas existentes, continuar con consulta nueva
        setCurrentQueryId(null);
      }
    } catch (error) {
      console.error('Error verificando consultas existentes:', error);
      // En caso de error, continuar sin mostrar modal
      setCurrentQueryId(null);
    }
  };

  // Función para cargar la consulta existente
  const handleLoadExistingQuery = (query) => {
    console.log('📥 Cargando consulta:', query);
    
    // Cargar datos del cliente en el formulario
    if (query.mainClient) {
      setFormData(prev => ({
        ...prev,
        mainClient: {
          id: query.mainClient.id,
          firstName: query.mainClient.firstName || '',
          lastName: query.mainClient.lastName || '',
          email: query.mainClient.email || '',
          phone: query.mainClient.phone || ''
        }
      }));
    }

    // Si es multi-segmento, cargar TODOS los segmentos
    if (query.isMultiSegment && query.segments && query.segments.length > 0) {
      console.log('📦 Cargando', query.segments.length, 'segmentos');
      
      // Guardar el queryGroupId para futuras actualizaciones
      if (query.queryGroupId) {
        queryGroupIdRef.current = query.queryGroupId;
        console.log('📌 QueryGroupId guardado:', query.queryGroupId);
      }
      
      setSegments(query.segments.map((seg, index) => ({
        id: seg.id || Date.now() + index,
        checkIn: seg.checkIn ? seg.checkIn.split('T')[0] : '',
        checkOut: seg.checkOut ? seg.checkOut.split('T')[0] : '',
        requiredGuests: seg.requiredGuests || 1,
        requiredTags: seg.requiredTags || [],
        requiredRoomId: seg.requiredRoomId || null,
        requirementsNotes: seg.requirementsNotes || '',
        serviceType: seg.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : ''),
        roomId: seg.roomId || null,
        totalAmount: seg.totalAmount || null,
        reservationType: seg.reservationType || 'con_desayuno',
        fixed: seg.fixed || false
      })));
      
      // Cargar notas globales
      setNotes(query.notes || '');
      
      // Establecer el primer segmento como activo
      setActiveBlockIndex(0);
    } else {
      // Query antigua (single segment) - retrocompatibilidad
      console.log('📄 Cargando consulta de segmento único (legacy)');
      
      if (query.checkIn && query.checkOut) {
        setFormData(prev => ({
          ...prev,
          checkIn: query.checkIn.split('T')[0],
          checkOut: query.checkOut.split('T')[0]
        }));
      }

      // Cargar requisitos
      setRequirements({
        requiredGuests: query.requiredGuests || 1,
        requiredTags: query.requiredTags || [],
        requiredRoomId: query.requiredRoomId || null,
        requirementsNotes: query.requirementsNotes || ''
      });

      // Crear segmento único
      if (query.checkIn && query.checkOut) {
        setSegments([{
          id: query.id || Date.now(),
          checkIn: query.checkIn.split('T')[0],
          checkOut: query.checkOut.split('T')[0],
          requiredGuests: query.requiredGuests || 1,
          requiredTags: query.requiredTags || [],
          requiredRoomId: query.requiredRoomId || null,
          requirementsNotes: query.requirementsNotes || '',
          serviceType: query.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : ''),
          roomId: query.roomId || null
        }]);
      }
      
      setNotes(query.notes || '');
    }

    setCurrentQueryId(query.id);
    setExistingQuery(null);
  };

  // Función para continuar sin cargar la consulta existente
  const handleContinueWithoutLoading = () => {
    setCurrentQueryId(null);
    setCurrentQueryGroupId(null);
    queryGroupIdRef.current = null;
    setExistingQuery(null);
  };

  // Funciones para el nuevo modal de selección de consultas
  const handleSelectQuery = (query) => {
    // Cargar la consulta seleccionada
    handleLoadExistingQuery(query);
    setShowSelectQueryModal(false);
    setRecentQueries([]);
  };

  const handleCreateNewQuery = () => {
    // Crear nueva consulta para el cliente
    setCurrentQueryId(null);
    setCurrentQueryGroupId(null);
    queryGroupIdRef.current = null;
    setShowSelectQueryModal(false);
    setRecentQueries([]);
  };

  // Función para mostrar habitaciones de mayor capacidad (no utilizada actualmente)
  // const handleShowLargerCapacity = () => {
  //   if (!segments[activeBlockIndex]) return;
  //   
  //   const activeBlock = segments[activeBlockIndex];
  //   const exactCapacityRooms = allAvailableRooms.filter(room => room.maxPeople === activeBlock.requiredGuests);
  //   const largerCapacityRooms = allAvailableRooms.filter(room => room.maxPeople > activeBlock.requiredGuests);
  //   
  //   // Combinar habitaciones de capacidad exacta con las de mayor capacidad
  //   const combinedRooms = [...exactCapacityRooms, ...largerCapacityRooms];
  //   setAvailableRooms(combinedRooms);
  // };

  const handleSaveNewClient = async () => {
    // Validar que los campos requeridos estén completos
    if (!formData.mainClient.firstName || !formData.mainClient.lastName) {
      alert('Por favor, completa al menos el nombre y apellido del cliente.');
      return;
    }

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.mainClient.firstName,
          lastName: formData.mainClient.lastName,
          email: formData.mainClient.email || null,
          phone: formData.mainClient.phone || null,
        }),
      });

      if (response.ok) {
        const newClient = await response.json();
        
        // Actualizar el cliente en el formulario con los datos del servidor (incluyendo el ID)
        setFormData(prev => ({
          ...prev,
          mainClient: {
            id: newClient.id,  // ✨ Agregar el ID para que se setee como cliente principal
            firstName: newClient.firstName,
            lastName: newClient.lastName,
            email: newClient.email || '',
            phone: newClient.phone || ''
          }
        }));
        
        // Cerrar el formulario de nuevo cliente
        setShowNewClientForm(false);
      } else {
        const errorData = await response.json();
        alert(`❌ Error al guardar el cliente: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error saving client:', error);
      alert('❌ Error al conectar con el servidor. Intenta nuevamente.');
    }
  };

  // Función de submit del formulario (no utilizada actualmente)
  // const handleSubmit = (e) => {
  //   e.preventDefault();
  //   
  //   // Validaciones básicas
  //   const newErrors = {};
  //   
  //   // Validar que todos los segmentos tengan fechas
  //   segments.forEach((segment, index) => {
  //     if (!segment.checkIn) {
  //       newErrors[`segment${index}CheckIn`] = `La fecha de entrada del segmento ${index + 1} es requerida`;
  //     }
  //     if (!segment.checkOut) {
  //       newErrors[`segment${index}CheckOut`] = `La fecha de salida del segmento ${index + 1} es requerida`;
  //     }
  //     if (!segment.requiredGuests) {
  //       newErrors[`segment${index}Guests`] = `La cantidad de huéspedes del segmento ${index + 1} es requerida`;
  //     }
  //   });
  //   
  //   if (!selectedRoom) newErrors.selectedRoom = 'Debe seleccionar una habitación';
  //   
  //   if (Object.keys(newErrors).length > 0) {
  //     alert('Por favor, completa todos los campos requeridos.');
  //     return;
  //   }

  //   // Abrir modal de confirmación
  //   setShowConfirmationModal(true);
  // };

  const checkRequirementsCompliance = (room) => {
    // Obtener las etiquetas requeridas del bloque activo
    const activeBlock = segments[activeBlockIndex];
    if (!activeBlock) {
      return { complies: true, message: 'No hay bloque activo', score: 0 };
    }
    
    const requiredTagIds = activeBlock.requiredTags || [];
    
    if (requiredTagIds.length === 0) {
      return { complies: true, message: 'No hay etiquetas requeridas', score: 0 };
    }
    
    // Obtener las etiquetas de la habitación
    const roomTagIds = room.tags ? room.tags.map(tag => tag.id) : [];
    
    // Verificar si la habitación tiene todas las etiquetas requeridas
    const missingTags = requiredTagIds.filter(tagId => !roomTagIds.includes(tagId));
    const matchingTags = room.tags.filter(tag => requiredTagIds.includes(tag.id));
    
    const complianceScore = matchingTags.length / requiredTagIds.length;
    
    if (missingTags.length === 0) {
      // La habitación cumple con todos los requerimientos
      const tagNames = matchingTags.map(tag => tag.name);
      return { 
        complies: true, 
        message: tagNames.length > 0 ? tagNames.join(', ') : 'Cumple con todos los requerimientos',
        score: complianceScore
      };
    } else {
      // La habitación no cumple con todos los requerimientos
      const tagNames = matchingTags.map(tag => tag.name);
      return { 
        complies: false, 
        message: tagNames.length > 0 ? tagNames.join(', ') : 'No cumple con los requerimientos',
        score: complianceScore
      };
    }
  };

  // Funciones para manejar segmentos
  const handleSegmentChange = (segmentId, field, value) => {
    console.log('🔍 handleSegmentChange ejecutándose:', { segmentId, field, value });
    
    // Si no es un cambio de fecha, aplicar directamente
    if (field !== 'checkIn' && field !== 'checkOut') {
      setSegments(prev => prev.map(seg => 
        seg.id === segmentId ? { ...seg, [field]: value } : seg
      ));
      
      // Actualizar formData si es segmento único
      if (segments.length === 1 && field === 'requiredGuests') {
        setRequirements(prev => ({ ...prev, requiredGuests: value }));
      }
      return;
    }
    
    // Para cambios de fecha, necesitamos detectar superposiciones
    const currentIndex = segments.findIndex(seg => seg.id === segmentId);
    if (currentIndex === -1) return;
    
    const updatedSegments = [...segments];
    const currentSegment = { ...updatedSegments[currentIndex] };
    currentSegment[field] = value;
    
    // Validar que checkOut > checkIn del segmento actual
    if (currentSegment.checkOut <= currentSegment.checkIn) {
      const checkInDate = new Date(currentSegment.checkIn + 'T00:00:00');
      currentSegment.checkOut = format(addDays(checkInDate, 1), 'yyyy-MM-dd');
    }
    
    updatedSegments[currentIndex] = currentSegment;
    
    // Detectar segmentos que se eliminarían
    const toDelete = [];
    
    if (field === 'checkOut') {
      // Hacia adelante: chequear segmentos siguientes
      if (currentIndex < updatedSegments.length - 1) {
        const nextSeg = updatedSegments[currentIndex + 1];
        
        if (currentSegment.checkOut >= nextSeg.checkOut) {
          // Superposición TOTAL: el siguiente segmento quedaría eliminado
          // Buscar todos los que quedarían eliminados
          for (let i = currentIndex + 1; i < updatedSegments.length; i++) {
            const seg = updatedSegments[i];
            if (currentSegment.checkOut >= seg.checkOut) {
              toDelete.push({ index: i, ...seg });
            } else {
              break;
            }
          }
        } else {
          // NO hay eliminación total, ajustar para mantener consecutividad
          // SIEMPRE ajustar el checkIn del siguiente para que sea = al checkOut actual
          updatedSegments[currentIndex + 1] = {
            ...nextSeg,
            checkIn: currentSegment.checkOut
          };
          
          // Verificar si el ajuste deja duración válida
          if (updatedSegments[currentIndex + 1].checkOut <= updatedSegments[currentIndex + 1].checkIn) {
            const newCheckOut = format(addDays(new Date(updatedSegments[currentIndex + 1].checkIn + 'T00:00:00'), 1), 'yyyy-MM-dd');
            updatedSegments[currentIndex + 1].checkOut = newCheckOut;
          }
        }
      }
    } else if (field === 'checkIn') {
      // Hacia atrás: chequear segmentos anteriores
      if (currentIndex > 0) {
        const prevSeg = updatedSegments[currentIndex - 1];
        
        if (currentSegment.checkIn <= prevSeg.checkIn) {
          // Superposición TOTAL: el anterior segmento quedaría eliminado
          // Buscar todos los que quedarían eliminados
          for (let i = currentIndex - 1; i >= 0; i--) {
            const seg = updatedSegments[i];
            if (currentSegment.checkIn <= seg.checkIn) {
              toDelete.push({ index: i, ...seg });
            } else {
              break;
            }
          }
        } else {
          // NO hay eliminación total, ajustar para mantener consecutividad
          // SIEMPRE ajustar el checkOut del anterior para que sea = al checkIn actual
          updatedSegments[currentIndex - 1] = {
            ...prevSeg,
            checkOut: currentSegment.checkIn
          };
          
          // Verificar si el ajuste deja duración válida
          if (updatedSegments[currentIndex - 1].checkIn >= updatedSegments[currentIndex - 1].checkOut) {
            const newCheckIn = format(addDays(new Date(updatedSegments[currentIndex - 1].checkOut + 'T00:00:00'), -1), 'yyyy-MM-dd');
            updatedSegments[currentIndex - 1].checkIn = newCheckIn;
          }
        }
      }
    }
    
    // Si hay segmentos a eliminar, mostrar modal
    if (toDelete.length > 0) {
      console.log('⚠️ Superposición total detectada. Segmentos a eliminar:', toDelete);
      setSegmentsToDelete(toDelete);
      setPendingSegmentChange({
        segmentId,
        field,
        value,
        updatedSegments: updatedSegments.filter((_, i) => !toDelete.some(d => d.index === i))
      });
      setShowDeleteSegmentsModal(true);
    } else {
      // No hay eliminaciones, aplicar cambios directamente
      console.log('✅ Superposición parcial o sin superposición. Aplicando cambios.');
      setSegments(updatedSegments);
      
      // Actualizar formData si es segmento único
      if (updatedSegments.length === 1 && location.state?.isEditing) {
        setFormData(prev => ({
          ...prev,
          checkIn: currentSegment.checkIn,
          checkOut: currentSegment.checkOut
        }));
      }
    }
  };

  // Handlers para el modal de eliminación de segmentos
  const handleConfirmDeleteSegments = () => {
    if (pendingSegmentChange) {
      console.log('✅ Usuario confirmó eliminación de segmentos');
      setSegments(pendingSegmentChange.updatedSegments);
      
      // Ajustar activeBlockIndex si es necesario
      if (activeBlockIndex >= pendingSegmentChange.updatedSegments.length) {
        setActiveBlockIndex(pendingSegmentChange.updatedSegments.length - 1);
      }
      
      // Actualizar formData si es segmento único
      if (pendingSegmentChange.updatedSegments.length === 1 && location.state?.isEditing) {
        const seg = pendingSegmentChange.updatedSegments[0];
        setFormData(prev => ({
          ...prev,
          checkIn: seg.checkIn,
          checkOut: seg.checkOut
        }));
      }
    }
    
    // Cerrar modal y limpiar estados
    setShowDeleteSegmentsModal(false);
    setSegmentsToDelete([]);
    setPendingSegmentChange(null);
  };
  
  const handleCancelDeleteSegments = () => {
    console.log('❌ Usuario canceló eliminación de segmentos');
    // Cerrar modal y limpiar estados sin aplicar cambios
    setShowDeleteSegmentsModal(false);
    setSegmentsToDelete([]);
    setPendingSegmentChange(null);
  };

  const handleSegmentTagToggle = (segmentId, tagId) => {
    console.log('🏷️ Toggle etiqueta:', { segmentId, tagId });
    setSegments(prev => {
      console.log('🏷️ Segments prev:', prev);
      const updated = prev.map(segment => {
        if (segment.id === segmentId) {
          const newTags = segment.requiredTags.includes(tagId)
            ? segment.requiredTags.filter(id => id !== tagId)
            : [...segment.requiredTags, tagId];
          console.log('🏷️ Tags anteriores:', segment.requiredTags);
          console.log('🏷️ Tags nuevos:', newTags);
          return { 
            ...segment, 
            requiredTags: newTags,
            requiredRoomId: null // Reset habitación específica al cambiar etiquetas
          };
        }
        return segment;
      });
      console.log('🏷️ Segments updated:', updated);
      return updated;
    });
  };

  const handleSegmentRoomChange = (segmentId, roomId) => {
    const selectedRoomId = roomId === '' ? null : parseInt(roomId);
    setSegments(prev => prev.map(segment => {
      if (segment.id === segmentId) {
        return { 
          ...segment, 
          requiredRoomId: selectedRoomId,
          requiredTags: selectedRoomId ? [] : segment.requiredTags // Reset etiquetas al seleccionar habitación específica, mantener si es "No"
        };
      }
      return segment;
    }));
  };

  // Funciones para manejar segmentos (no utilizadas actualmente)
  // const handleAddSegment = () => {
  //   const newSegment = {
  //     id: Date.now(),
  //     checkIn: '',
  //     checkOut: '',
  //     requiredGuests: 1,
  //     requiredTags: [],
  //     requiredRoomId: null,
  //     serviceType: serviceTypes.length > 0 ? serviceTypes[0].id : ''
  //   };
  //   setSegments(prev => [...prev, newSegment]);
  // };

  // const handleRemoveSegment = (segmentId) => {
  //   if (segments.length > 1) {
  //     setSegments(prev => prev.filter(segment => segment.id !== segmentId));
  //   }
  // };

  // Funciones de utilidad (no utilizadas actualmente)
  // const calculateTotal = () => {
  //   if (!dailyRates.length) return 0;
  //   
  //   return dailyRates.reduce((total, rate) => {
  //     if (rate.noRatesAvailable) return total;
  //     return total + (rate.price || 0);
  //   }, 0);
  // };

  // const getGlobalDates = () => {
  //   if (segments.length === 0) return 'Sin fechas';
  //   
  //   const checkIns = segments.map(s => s.checkIn).filter(date => date);
  //   const checkOuts = segments.map(s => s.checkOut).filter(date => date);
  //   
  //   if (checkIns.length === 0 || checkOuts.length === 0) {
  //     return 'Fechas incompletas';
  //   }
  //   
  //   const globalCheckIn = checkIns.sort()[0]; // Primera fecha de entrada
  //   const globalCheckOut = checkOuts.sort().reverse()[0]; // Última fecha de salida
  //   
  //   // Formatear fechas con barras en lugar de guiones
  //   const formatDate = (dateStr) => {
  //     return dateStr.replace(/-/g, '/');
  //   };
  //   
  //   return `${formatDate(globalCheckIn)} / ${formatDate(globalCheckOut)}`;
  // };

  // const getGuestName = () => {
  //   const firstName = formData.mainClient.firstName || '';
  //   const lastName = formData.mainClient.lastName || '';
  //   
  //   if (firstName || lastName) {
  //     return `${firstName} ${lastName}`.trim();
  //   }
  //   
  //   return 'Huésped';
  // };

  // Función para copiar datos de la consulta al portapapeles
  const handleCopyReservationData = async () => {
    try {
      const formatDate = (dateString) => {
        if (!dateString) return 'No especificada';
        const date = new Date(dateString);
        return format(date, 'dd/MM/yyyy', { locale: es });
      };

      const getServiceTypeName = (serviceTypeId) => {
        const service = serviceTypes.find(st => st.id === serviceTypeId);
        return service ? service.name : 'No especificado';
      };

      const getRoomName = (index) => {
        return selectedRoomsPerBlock[index]?.name || 'No seleccionada';
      };

      const getTotalAmount = (index) => {
        return selectedRoomsPerBlock[index]?.ratesData?.totalAmount || 0;
      };

      // Formatear datos para copiar
      let texto = '🏨 CONSULTA DE RESERVA\n';
      texto += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      // Cliente (si existe)
      if (formData.mainClient.firstName || formData.mainClient.lastName) {
        texto += '👤 CLIENTE\n';
        texto += `${formData.mainClient.firstName || ''} ${formData.mainClient.lastName || ''}`.trim() + '\n';
        if (formData.mainClient.email) texto += `📧 ${formData.mainClient.email}\n`;
        if (formData.mainClient.phone) texto += `📱 ${formData.mainClient.phone}\n`;
        texto += '\n';
      }

      // Información general
      const firstCheckIn = segments[0]?.checkIn;
      const lastCheckOut = segments[segments.length - 1]?.checkOut;
      const totalNights = firstCheckIn && lastCheckOut 
        ? Math.ceil((new Date(lastCheckOut) - new Date(firstCheckIn)) / (1000 * 60 * 60 * 24))
        : 0;

      texto += '📅 ESTANCIA\n';
      texto += `Check-in: ${formatDate(firstCheckIn)}\n`;
      texto += `Check-out: ${formatDate(lastCheckOut)}\n`;
      texto += `Noches: ${totalNights}\n`;
      texto += `Huéspedes: ${segments[0]?.requiredGuests || 1}\n\n`;

      // Segmentos
      if (segments.length === 1) {
        // Un solo segmento
        texto += '🏨 HABITACIÓN\n';
        texto += `${getRoomName(0)}\n`;
        texto += `Servicio: ${getServiceTypeName(segments[0].serviceType)}\n`;
        const total = getTotalAmount(0);
        if (total > 0) {
          texto += `Tarifa: $${total.toLocaleString('es-AR')}\n`;
        }
      } else {
        // Múltiples segmentos
        texto += '📦 SEGMENTOS DE ESTANCIA\n\n';
        segments.forEach((segment, index) => {
          texto += `  ${index + 1}. ${formatDate(segment.checkIn)} - ${formatDate(segment.checkOut)}\n`;
          texto += `     Habitación: ${getRoomName(index)}\n`;
          texto += `     Servicio: ${getServiceTypeName(segment.serviceType)}\n`;
          const total = getTotalAmount(index);
          if (total > 0) {
            texto += `     Tarifa: $${total.toLocaleString('es-AR')}\n`;
          }
          texto += '\n';
        });
      }

      // Requerimientos especiales
      const hasRequirements = segments.some(seg => 
        (seg.requiredTags && seg.requiredTags.length > 0) || seg.requiredRoomId
      );

      if (hasRequirements) {
        texto += '✨ REQUERIMIENTOS ESPECIALES\n';
        segments.forEach((segment, index) => {
          if (segment.requiredTags && segment.requiredTags.length > 0) {
            const tagNames = segment.requiredTags
              .map(tagId => tags.find(t => t.id === tagId)?.name)
              .filter(Boolean)
              .join(', ');
            if (tagNames) {
              texto += `${segments.length > 1 ? `Segmento ${index + 1}: ` : ''}${tagNames}\n`;
            }
          }
        });
        texto += '\n';
      }

      // Notas
      if (notes && notes.trim()) {
        texto += '📝 NOTAS\n';
        texto += notes + '\n\n';
      }

      // Total general
      const totalGeneral = Object.values(selectedRoomsPerBlock).reduce((sum, room) => 
        sum + (room.ratesData?.totalAmount || 0), 0
      );

      if (totalGeneral > 0) {
        texto += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        texto += `💰 TOTAL: $${totalGeneral.toLocaleString('es-AR')}\n`;
      }

      // Copiar al portapapeles
      await navigator.clipboard.writeText(texto);
      
      // Mostrar confirmación visual
      alert('✅ Datos copiados al portapapeles');
      
    } catch (error) {
      console.error('Error al copiar datos:', error);
      alert('❌ Error al copiar datos al portapapeles');
    }
  };

  // Función para crear la reserva
  const handleCreateReservation = async (status = 'PENDIENTE', skipPastDateWarning = false) => {
    setIsCreatingReservation(true);
    
    try {
      // Validaciones básicas
      if (Object.keys(selectedRoomsPerBlock).length === 0) {
        throw new Error('No se ha seleccionado ninguna habitación');
      }
      
      if (!formData.mainClient.firstName || !formData.mainClient.lastName) {
        throw new Error('El cliente debe tener nombre y apellido');
      }
      
      if (!segments || segments.length === 0) {
        throw new Error('Debe haber al menos un segmento de estancia');
      }
      
      // Validar que todos los segmentos tengan habitación seleccionada
      for (let i = 0; i < segments.length; i++) {
        if (!selectedRoomsPerBlock[i]) {
          throw new Error(`Falta seleccionar habitación para el segmento ${i + 1}`);
        }
      }
      
      // Verificar si hay fechas pasadas y mostrar advertencia (solo si no se está saltando la advertencia)
      if (!skipPastDateWarning) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const hasPastDates = segments.some(segment => {
          const checkIn = new Date(segment.checkIn);
          checkIn.setHours(0, 0, 0, 0);
          return checkIn < today;
        });
        
        if (hasPastDates) {
          setPendingReservationStatus(status);
          setShowPastDateWarning(true);
          setIsCreatingReservation(false);
          return; // Detener la ejecución para mostrar el modal
        }
      }
      
      let clientId = null;
      
      // Si el cliente no existe, crearlo primero
      if (!formData.mainClient.id) {
        console.log('Creando nuevo cliente...');
        try {
          const newClient = await fetch('/api/clients', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firstName: formData.mainClient.firstName,
              lastName: formData.mainClient.lastName,
              email: formData.mainClient.email || null,
              phone: formData.mainClient.phone || null,
            }),
          });

          if (newClient.ok) {
            const createdClient = await newClient.json();
            clientId = createdClient.id;
            console.log('Cliente creado con ID:', clientId);
          } else {
            const errorData = await newClient.json();
            throw new Error(`Error al crear el cliente: ${errorData.error || errorData.message || 'Error desconocido'}`);
          }
        } catch (clientError) {
          console.error('Error creando cliente:', clientError);
          alert(`❌ Error al crear el cliente: ${clientError.message}`);
          return;
        }
      } else {
        clientId = formData.mainClient.id;
        console.log('Usando cliente existente con ID:', clientId);
      }

      // Preparar datos de la reserva
      const reservationData = {
        mainClientId: clientId,
        segments: segments.map((segment, index) => {
          // Validar serviceType
          if (!segment.serviceType || segment.serviceType === '') {
            throw new Error(`El segmento ${index + 1} no tiene un tipo de servicio seleccionado. Por favor, selecciona un tipo de servicio.`);
          }
          
          // Validar fechas
          if (!segment.checkIn || !segment.checkOut) {
            throw new Error(`El segmento ${index + 1} no tiene fechas válidas.`);
          }
          
          const checkIn = new Date(segment.checkIn);
          const checkOut = new Date(segment.checkOut);
          const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
          
          if (nights <= 0) {
            throw new Error(`El segmento ${index + 1} tiene fechas inválidas (check-out debe ser después de check-in).`);
          }
          
          // Calcular baseRate - modo manual o auto
          const selectedRoom = selectedRoomsPerBlock[index];
          const totalAmount = selectedRoom?.ratesData?.totalAmount;
          const roomPrice = selectedRoom?.price;
          const manualNightly = selectedRoom?.manualNightlyRate;

          let baseRate = null;
          if (manualNightly && Number(manualNightly) > 0) {
            baseRate = Number(manualNightly);
          } else if (totalAmount && totalAmount > 0) {
            baseRate = totalAmount / nights;
          } else if (roomPrice && roomPrice > 0) {
            baseRate = roomPrice;
          }

          if (!baseRate || baseRate <= 0) {
            throw new Error(
              FEATURE_FLAGS.MANUAL_RATES
                ? `Ingresá la tarifa por noche del segmento ${index + 1} antes de crear la reserva.`
                : `No se pudo calcular la tarifa para el segmento ${index + 1}. La habitación debe tener una tarifa válida.`
            );
          }
          
          // Validar requiredGuests
          if (!segment.requiredGuests || segment.requiredGuests <= 0) {
            throw new Error(`El segmento ${index + 1} debe tener al menos 1 huésped.`);
          }
          
          return {
            roomId: selectedRoomsPerBlock[index].id,
            roomTypeId: selectedRoomsPerBlock[index].roomType?.id
              || selectedRoomsPerBlock[index].roomTypeId
              || null,
            startDate: segment.checkIn,
            endDate: segment.checkOut,
            requiredGuests: segment.requiredGuests,
            services: [segment.serviceType],
            requiredTags: segment.requiredTags || [],
            requiredRoomId: segment.requiredRoomId || null,
            baseRate: baseRate,
            guestCount: segment.requiredGuests
          };
        }),
        status: status,
        notes: notes,
        isMultiRoom: false
      };

      console.log('Datos de reserva a enviar:', reservationData);

      // Crear la reserva en el backend
      console.log('Enviando reserva a:', `${API_URL}/reservations/multi-segment`);
      console.log('Datos completos de la reserva:', JSON.stringify(reservationData, null, 2));
      
      const newReservation = await createReservation(reservationData);
      
      console.log('Reserva creada:', newReservation);
      
      // Eliminar la consulta si existe (ya se convirtió en reserva)
      if (queryGroupIdRef.current) {
        try {
          const response = await fetch(`${API_URL}/queries/multi-segment/${queryGroupIdRef.current}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            console.log('✅ Consulta eliminada después de crear reserva:', queryGroupIdRef.current);
            queryGroupIdRef.current = null;
            setCurrentQueryId(null);
          }
        } catch (deleteError) {
          console.error('Error al eliminar la consulta:', deleteError);
          // No mostrar error al usuario, la reserva ya se creó exitosamente
        }
      }
      
      // Mostrar mensaje de éxito
      alert('✅ Reserva creada exitosamente');
      
      // Cerrar modal y limpiar formulario
      setShowConfirmationModal(false);
      resetForm();
      
      // Navegar a los detalles de la reserva creada
      navigate(`/reservations/${newReservation.id}`);
      
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      alert(`❌ Error al crear la reserva: ${error.message}`);
    } finally {
      setIsCreatingReservation(false);
    }
  };

  // Función para resetear el formulario
  const resetForm = () => {
    setFormData({
      checkIn: '',
      checkOut: '',
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      }
    });
    setRequirements({
      requiredGuests: 1,
      requiredTags: [],
      requiredRoomId: null,
      serviceType: serviceTypes.length > 0 ? serviceTypes[0].id : ''
    });
    setSegments([
      {
        id: 1,
        checkIn: '',
        checkOut: '',
        requiredGuests: 1,
        requiredTags: [],
        requiredRoomId: null,
        serviceType: serviceTypes.length > 0 ? serviceTypes[0].id : ''
      }
    ]);
    setSelectedRoomsPerBlock({});
    setAvailableRoomsPerBlock({});
    setHasSearchedPerBlock({});
    setSelectedRoomType(null);
    setDailyRates([]);
    setSearchTerm('');
    setShowNewClientForm(false);
    setCurrentQueryId(null);
    setNotes('');
    setActiveBlockIndex(0);
    // Limpiar el ref de valores previos
    previousSegmentsRef.current = {};
  };

  return (
    <div className={styles.newLayout}>
      {/* Contenedor unificado: Cliente + Pestañas */}
      <div className={styles.unifiedContainer}>
        {/* 1. Título de la consulta / nueva reserva */}
        <div className={styles.sectionHeader}>
          <h2>
            {!formData.mainClient.id ? (
              FEATURE_FLAGS.MANUAL_RATES ? 'Nueva reserva' : 'Consulta rápida'
            ) : (
              FEATURE_FLAGS.MANUAL_RATES
                ? `Reserva — ${formData.mainClient.firstName} ${formData.mainClient.lastName}`
                : `Consulta ${currentQueryId ? `#${currentQueryId}` : 'nueva'}`
            )}
          </h2>
          {FEATURE_FLAGS.MANUAL_RATES && (
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
              Elegí habitación e ingresá la tarifa por noche manualmente. No se usa cotización automática.
            </p>
          )}
        </div>
        
        {/* Barra de búsqueda de cliente y cantidad de huéspedes lado a lado */}
        {!formData.mainClient.id && (
          <div className={styles.topFieldsRow}>
            {/* Campo de cliente */}
            <div className={styles.clientFieldContainer}>
              <div className={styles.formGroup}>
                <label>Cliente</label>
                {showNewClientForm ? (
                  <div className={styles.newClientForm}>
                    <div className={styles.newClientGrid}>
                      <input
                        type="text"
                        value={formData.mainClient.firstName || ''}
                        onChange={(e) => handleClientInputChange('firstName', e.target.value)}
                        placeholder="Nombre"
                        required
                      />
                      <input
                        type="text"
                        value={formData.mainClient.lastName || ''}
                        onChange={(e) => handleClientInputChange('lastName', e.target.value)}
                        placeholder="Apellido"
                        required
                      />
                      <input
                        type="email"
                        value={formData.mainClient.email || ''}
                        onChange={(e) => handleClientInputChange('email', e.target.value)}
                        placeholder="Email"
                      />
                      <input
                        type="tel"
                        value={formData.mainClient.phone || ''}
                        onChange={(e) => handleClientInputChange('phone', e.target.value)}
                        placeholder="Teléfono"
                      />
                    </div>
                    <div className={styles.newClientButtons}>
                      <button type="button" onClick={handleSaveNewClient}>Guardar</button>
                      <button type="button" onClick={handleNewSearch}>❌ Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.clientSelector}>
                    <div className={styles.searchInputContainer}>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onBlur={() => setTimeout(() => setSearchTerm(''), 200)}
                        placeholder="Buscar por nombre, email o teléfono..."
                        className={styles.searchInput}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewClientForm(true)}
                        className={styles.newClientButton}
                        title="Crear nuevo cliente"
                      >
                        + Nuevo Cliente
                      </button>
                    </div>
                    {searchTerm && (
                      <div className={styles.clientResults}>
                        {filteredClients.map(client => (
                          <div key={client.id} className={styles.clientOption} onClick={() => handleClientSelect(client)}>
                            <strong>{client.firstName} {client.lastName}</strong>
                            {client.email && <div>{client.email}</div>}
                            {client.phone && <div>{client.phone}</div>}
                          </div>
                        ))}
                        <div className={styles.addNewClientOption}>
                          <button 
                            type="button" 
                            onClick={() => setShowNewClientForm(true)}
                            className={styles.addNewClientButton}
                          >
                            + Crear Nuevo Cliente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Campo global de cantidad de huéspedes */}
            <div className={styles.guestsFieldContainer}>
              <div className={styles.formGroup}>
                <label>Cantidad de huéspedes</label>
                <select
                  value={requirements.requiredGuests || 1}
                  onChange={(e) => {
                    const newGuests = parseInt(e.target.value);
                    console.log('👥 Cambiando huéspedes de', requirements.requiredGuests, 'a', newGuests);
                    console.log('👥 Etiquetas actuales en requirements:', requirements.requiredTags);
                    console.log('👥 Etiquetas en segments[0]:', segments[0]?.requiredTags);
                    
                    // Actualizar el estado global (preservando etiquetas)
                    setRequirements(prev => ({
                      ...prev,
                      requiredGuests: newGuests
                    }));
                    
                    // Actualizar todos los segmentos (preservando sus etiquetas)
                    setSegments(prev => prev.map(segment => ({
                      ...segment,
                      requiredGuests: newGuests
                    })));
                    
                    console.log('👥 Después del cambio - requirements debe tener etiquetas');
                  }}
                >
                  {Array.from({ length: maxGuestCapacity }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* Fila con Cliente, Huéspedes y Notas cuando hay cliente seleccionado */}
        {formData.mainClient.id && (
          <div className={styles.topFieldsRow}>
            {/* Cliente seleccionado */}
            <div className={styles.selectedClientContainer}>
              <div className={styles.formGroup}>
                <label>Cliente</label>
                <div className={styles.selectedClientDisplay}>
                  <span className={styles.clientName}>
                    {formData.mainClient.firstName} {formData.mainClient.lastName}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      // Eliminar el cliente de la consulta
                      setFormData(prev => ({
                        ...prev,
                        mainClient: {
                          firstName: '',
                          lastName: '',
                          email: '',
                          phone: '',
                          id: null
                        }
                      }));
                      setSearchTerm('');
                      setFilteredClients([]);
                      setCurrentQueryId(null);
                    }}
                    className={styles.removeClientButton}
                    title="Eliminar cliente de la consulta"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Cantidad de huéspedes */}
            <div className={styles.guestsFieldContainer}>
              <div className={styles.formGroup}>
                <label>Cantidad de huéspedes</label>
                <select
                  value={requirements.requiredGuests || 1}
                  onChange={(e) => {
                    const newGuests = parseInt(e.target.value);
                    console.log('👥 Cambiando huéspedes de', requirements.requiredGuests, 'a', newGuests);
                    console.log('👥 Etiquetas actuales en requirements:', requirements.requiredTags);
                    console.log('👥 Etiquetas en segments[0]:', segments[0]?.requiredTags);
                    
                    // Actualizar el estado global (preservando etiquetas)
                    setRequirements(prev => ({
                      ...prev,
                      requiredGuests: newGuests
                    }));
                    
                    // Actualizar todos los segmentos (preservando sus etiquetas)
                    setSegments(prev => prev.map(segment => ({
                      ...segment,
                      requiredGuests: newGuests
                    })));
                    
                    console.log('👥 Después del cambio - requirements debe tener etiquetas');
                  }}
                >
                  {Array.from({ length: maxGuestCapacity }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notas globales */}
            <div className={styles.notesFieldContainer}>
              <div className={styles.formGroup}>
                <label>Notas</label>
                <textarea
                  className={styles.notesTextarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas"
                  rows={1}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Pestañas de Bloques de Estadía */}
        <div className={styles.tabsHeader}>
          {segments.map((block, index) => (
            <button
              key={block.id}
              className={`${styles.tab} ${activeBlockIndex === index ? styles.tabActive : ''}`}
              onClick={() => setActiveBlockIndex(index)}
            >
              <span className={styles.tabTitle}>
                {block.checkIn && block.checkOut 
                  ? (() => {
                      const checkInDate = new Date(block.checkIn + 'T00:00:00');
                      const checkOutDate = new Date(block.checkOut + 'T00:00:00');
                      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
                      return (
                        <>
                          {format(checkInDate, 'dd/MM')} – {format(checkOutDate, 'dd/MM')} 
                          <em style={{ fontStyle: 'italic', fontWeight: 'normal' }}> ({nights} noche{nights !== 1 ? 's' : ''})</em>
                        </>
                      );
                    })()
                  : 'Sin fechas'
                }
              </span>
              {segments.length > 1 && (
                <button
                  type="button"
                  className={styles.tabClose}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBlock(block.id);
                  }}
                >
                  ×
                </button>
              )}
            </button>
          ))}
          
          <button
            type="button"
            className={styles.addTabButton}
            onClick={addNewBlock}
            title="Agregar tramo a la reserva"
          >
            +
          </button>
        </div>
        
        {/* Contenido de la pestaña activa */}
        {segments[activeBlockIndex] && (
          <div className={styles.tabContent}>
            <div className={styles.blockForm}>
              {/* Fechas */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>
                    {activeBlockIndex === 0 ? 'Check-in' : 'Inicio del segmento'}
                  </label>
                  <input
                    type="date"
                    value={segments[activeBlockIndex]?.checkIn || ''}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'checkIn', e.target.value)}
                    required
                    title={activeBlockIndex > 0 ? 'Al cambiar esta fecha, se actualizará automáticamente el fin del segmento anterior' : ''}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    {activeBlockIndex === segments.length - 1 ? 'Check-out' : 'Fin del segmento'}
                  </label>
                  <input
                    type="date"
                    value={segments[activeBlockIndex]?.checkOut || ''}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'checkOut', e.target.value)}
                    required
                    title={activeBlockIndex < segments.length - 1 ? 'Al cambiar esta fecha, se actualizará automáticamente el inicio del siguiente segmento' : ''}
                  />
                </div>
              </div>

              {/* Tipo de servicio */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Tipo de Servicio</label>
                  <select
                    value={segments[activeBlockIndex]?.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'serviceType', e.target.value)}
                  >
                    {serviceTypes.map(serviceType => (
                      <option key={serviceType.id} value={serviceType.id}>
                        {serviceType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Requisitos Especiales (expandible) */}
              <div className={styles.expandableSection}>
                <button
                  type="button"
                  className={styles.expandableHeader}
                  onClick={() => setShowSegments(!showSegments)}
                >
                  <label>Requisitos Especiales</label>
                  <span className={styles.expandIcon}>{showSegments ? '▼' : '▶'}</span>
                </button>
                
                {showSegments && (
                  <div className={styles.expandableContent}>
                    <div className={styles.requirementsFlexContainer}>
                      {/* Habitación Específica */}
                      <div className={styles.formGroup}>
                        <label>Habitación Específica:</label>
                        <select
                          value={segments[activeBlockIndex]?.requiredRoomId || ''}
                          onChange={(e) => segments[activeBlockIndex] && handleSegmentRoomChange(segments[activeBlockIndex].id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="">No</option>
                          {loadingAllRooms ? (
                            <option disabled>Cargando habitaciones...</option>
                          ) : (
                            allRooms
                              .filter(room => room.maxPeople >= (segments[activeBlockIndex]?.requiredGuests || 1))
                              .map(room => (
                                <option key={room.id} value={room.id}>
                                  {room.name} - {room.roomType?.name} (Capacidad: {room.maxPeople})
                                </option>
                              ))
                          )}
                        </select>
                      </div>

                      {/* Requerimientos */}
                      <div className={styles.formGroup} style={{ flex: 2 }}>
                        <label style={{
                          opacity: segments[activeBlockIndex]?.requiredRoomId ? 0.5 : 1
                        }}>
                          Requerimientos:
                        </label>
                        <div className={styles.tagsContainer} style={{
                          opacity: segments[activeBlockIndex]?.requiredRoomId ? 0.5 : 1,
                          pointerEvents: segments[activeBlockIndex]?.requiredRoomId ? 'none' : 'auto'
                        }}>
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            className={`${styles.tagButton} ${
                              segments[activeBlockIndex]?.requiredTags.includes(tag.id) ? styles.tagSelected : ''
                            }`}
                            onClick={() => segments[activeBlockIndex] && handleSegmentTagToggle(segments[activeBlockIndex].id, tag.id)}
                              disabled={!!segments[activeBlockIndex]?.requiredRoomId}
                          >
                            {tag.name}
                          </button>
                        ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

              {/* Mensaje cuando el hotel está cerrado */}
              {isHotelClosed && (
                <div className={styles.errorMessage} style={{ 
                  marginTop: '10px', 
                  padding: '12px', 
                  backgroundColor: '#fee', 
                  border: '1px solid #fcc', 
                  borderRadius: '6px',
                  color: '#c33'
                }}>
                  ⚠️ El periodo solicitado incluye días en los que el establecimiento se encuentra cerrado
                </div>
              )}
            </div>

            {/* Habitaciones Disponibles - Se muestran cuando hay resultados de búsqueda */}
            {hasSearchedPerBlock[activeBlockIndex] === true && (
              <>
              <h3 className={styles.roomsSectionTitle}>Habitaciones Disponibles</h3>
              
              {loadingRooms ? (
                <div className={styles.loading}>
                  🔍 Buscando habitaciones disponibles...
                    </div>
              ) : (availableRoomsPerBlock[activeBlockIndex] || []).length === 0 ? (
                <div className={styles.noRooms}>
                  {/* Mostrar mensaje específico si hay disponibilidad parcial, sino mensaje genérico */}
                  {isPartiallyAvailable && availablePeriods.length > 0 ? (
                    <>
                      <p>El servicio <strong>"{serviceName}"</strong> no está disponible durante todo el período solicitado.</p>
                        
                        <button 
                          onClick={createSegmentsFromAvailablePeriods}
                          style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                          padding: '10px 20px',
                          borderRadius: '6px',
                            cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          marginTop: '15px'
                          }}
                        >
                        🔄 Dividir la reserva en tramos
                        </button>
                        
                        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                          Esto creará {availablePeriods.length} segmento{availablePeriods.length > 1 ? 's' : ''} de reserva para los períodos donde el servicio está disponible.
                        </p>
                    </>
                  ) : (
                  <p>No se encontraron habitaciones disponibles para los criterios especificados.</p>
                  )}
                </div>
              ) : (
                <div className={styles.roomsList}>
                  {(() => {
                    const roomsWithCompliance = (availableRoomsPerBlock[activeBlockIndex] || [])
                      .map((room) => {
                        const compliance = checkRequirementsCompliance(room);
                        const requiredGuests = segments[activeBlockIndex]?.requiredGuests || 1;
                        const isExactCapacity = room.maxPeople === requiredGuests;
                        return { room, compliance, isExactCapacity };
                      });
                    
                    // Categorizar habitaciones según prioridades
                    const category1 = roomsWithCompliance.filter(r => r.isExactCapacity && r.compliance.complies);
                    const category2 = roomsWithCompliance.filter(r => r.isExactCapacity && !r.compliance.complies);
                    const category3 = roomsWithCompliance.filter(r => !r.isExactCapacity && r.compliance.complies);
                    const category4 = roomsWithCompliance.filter(r => !r.isExactCapacity && !r.compliance.complies);
                    
                    // Aplicar lógica de filtrado según prioridades
                    let roomsToShow = [];
                    
                    if (category1.length > 0) {
                      // Si existe categoría 1, solo mostrar esas
                      roomsToShow = category1;
                    } else if (category2.length > 0 || category3.length > 0) {
                      // Si existe categoría 2 o 3, mostrar ambas (pero no 4)
                      roomsToShow = [...category2, ...category3];
                    } else {
                      // Si no hay 1, 2 o 3, mostrar 4
                      roomsToShow = category4;
                    }
                    
                    // Ordenar: primero las que cumplen, luego por capacidad
                    roomsToShow.sort((a, b) => {
                      // Primero las que cumplen completamente
                      if (a.compliance.complies && !b.compliance.complies) return -1;
                      if (!a.compliance.complies && b.compliance.complies) return 1;
                      
                      // Luego por capacidad exacta vs mayor capacidad
                      if (a.isExactCapacity && !b.isExactCapacity) return -1;
                      if (!a.isExactCapacity && b.isExactCapacity) return 1;
                      
                      return 0;
                    });
                    
                    return roomsToShow;
                  })().map(({ room, compliance }) => {
                      const isSelected = selectedRoomsPerBlock[activeBlockIndex] && selectedRoomsPerBlock[activeBlockIndex].id === room.id;
                      const showDetails = showRoomDetails[room.id] || false;
                      
                      return (
                        <div key={room.id} className={styles.roomListItem}>
                          <div 
                            className={`${styles.roomItem} ${isSelected ? styles.roomItemSelected : ''}`}
                            onClick={() => selectRoomForBlock(activeBlockIndex, room)}
                          >
                            <div className={styles.roomItemLeft}>
                              <div className={styles.roomSelection}>
                                <input
                                  type="radio"
                                  name={`selectedRoom-${activeBlockIndex}`}
                                  id={`room-${room.id}`}
                                  checked={isSelected}
                                  onChange={() => selectRoomForBlock(activeBlockIndex, room)}
                                />
                                <label htmlFor={`room-${room.id}`}>
                                  <span className={styles.radioCircle}></span>
                                </label>
                              </div>
                              
                              <div className={styles.roomMainInfo}>
                                <h3>{room.name}</h3>
                                <div className={styles.roomSecondaryInfo}>
                                  <span className={styles.roomType}>{room.roomType?.name}</span>
                                  <span className={`${styles.capacityBadge} ${
                                    room.maxPeople === segments[activeBlockIndex]?.requiredGuests ? styles.capacityExact : styles.capacityLarger
                                  }`}>
                                    {room.maxPeople} pers.
                                  </span>
                                </div>
                                <div className={styles.roomDescription}>
                                  {room.description || 'Descripción no disponible'}
                                </div>
                              </div>
                            </div>
                            
                            <div className={styles.roomItemRight}>
                              <div className={styles.complianceIndicator} title={compliance.message}>
                                {compliance.complies ? (
                                  <span className={styles.complianceCheck}>✓</span>
                                ) : (
                                  <span className={styles.complianceX}>✗</span>
                                )}
                              </div>
                              
                              <div className={styles.roomRate}>
                                {!FEATURE_FLAGS.AUTO_RATES ? (
                                  isSelected ? (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}
                                    >
                                      <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        Tarifa / noche (ARS)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={selectedRoomsPerBlock[activeBlockIndex]?.manualNightlyRate ?? ''}
                                        onChange={(e) => updateManualRateForBlock(activeBlockIndex, e.target.value)}
                                        placeholder="0.00"
                                        style={{
                                          padding: '6px 8px',
                                          border: '1px solid #d1d5db',
                                          borderRadius: 6,
                                          width: '100%',
                                          fontSize: '0.95rem'
                                        }}
                                      />
                                      {selectedRoomsPerBlock[activeBlockIndex]?.manualTotalAmount > 0 && (
                                        <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                                          Total: ${new Intl.NumberFormat('es-AR').format(
                                            selectedRoomsPerBlock[activeBlockIndex].manualTotalAmount
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className={styles.rateAmount} style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                      Tarifa manual
                                    </span>
                                  )
                                ) : (
                                  <span className={styles.rateAmount}>
                                    ${new Intl.NumberFormat('es-AR').format(room.price || 0)}
                                  </span>
                                )}
                              </div>
                              
                              <button 
                                className={styles.detailsButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRoomDetails(room.id);
                                }}
                              >
                                {showDetails ? 'Ocultar Detalle' : 'Ver Detalle'}
                              </button>
                            </div>
                          </div>
                          
                          {showDetails && (
                            <div className={styles.roomDetailsExpanded}>
                              <h4>{FEATURE_FLAGS.AUTO_RATES ? 'Detalle Tarifario por Día' : 'Detalle de tarifa'}</h4>
                              <div className={styles.dailyRatesTable}>
                                {room.ratesData && room.ratesData.rates ? (
                                  room.ratesData.rates.map((rate, index) => (
                                    <div key={index} className={styles.dailyRateRow}>
                                      <span>Noche del {rate.date.split('T')[0].split('-').reverse().join('/')}</span>
                                      <span>${new Intl.NumberFormat('es-AR').format(rate.serviceRate || rate.baseRate)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className={styles.noRatesMessage}>
                                    {FEATURE_FLAGS.AUTO_RATES
                                      ? 'No hay datos de tarifas disponibles para esta habitación'
                                      : 'Seleccioná la habitación e ingresá la tarifa por noche'}
                                  </div>
                                )}
                              </div>
                              {room.ratesData && room.ratesData.rates && (
                                <div className={styles.dailyRatesTotal}>
                                  <div className={styles.totalSeparator}></div>
                                  <div className={styles.dailyRateRow}>
                                    <span><strong>Total:</strong></span>
                                    <span><strong>${new Intl.NumberFormat('es-AR').format(room.ratesData.totalAmount)}</strong></span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Botones de acción */}
      {segments.length > 0 && segments[0].checkIn && segments[0].checkOut && (
        <div className={styles.createReservationButtonContainer}>
          {/* Botón de copiar datos - Siempre visible si hay segmentos con fechas */}
          <button 
            type="button" 
            className={styles.copyButton}
            onClick={handleCopyReservationData}
            title="Copiar datos de la consulta al portapapeles"
          >
            📋 Copiar Datos
          </button>

          {/* Botón de crear reserva - Solo si hay cliente */}
          {formData.mainClient.firstName && formData.mainClient.lastName && (
            <button 
              type="button" 
              className={styles.confirmButton}
              onClick={() => setShowConfirmationModal(true)}
              disabled={
                !segments.every((_, index) => {
                  const selected = selectedRoomsPerBlock[index];
                  if (!selected) return false;
                  if (FEATURE_FLAGS.MANUAL_RATES && !FEATURE_FLAGS.AUTO_RATES) {
                    const rate = Number(selected.manualNightlyRate || selected.price || 0);
                    return rate > 0;
                  }
                  return true;
                })
              }
              title={
                !segments.every((_, index) => selectedRoomsPerBlock[index])
                  ? 'Selecciona una habitación para cada segmento'
                  : (FEATURE_FLAGS.MANUAL_RATES && !FEATURE_FLAGS.AUTO_RATES &&
                     !segments.every((_, index) => Number(selectedRoomsPerBlock[index]?.manualNightlyRate || selectedRoomsPerBlock[index]?.price || 0) > 0))
                    ? 'Ingresá la tarifa manual por noche en cada segmento'
                    : 'Crear la reserva'
              }
            >
              ✅ Crear Reserva
            </button>
          )}
        </div>
      )}

      {/* Modal de confirmación de reserva */}
      <ReservationConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleCreateReservation}
        reservationData={{
          mainClient: formData.mainClient,
          selectedRoomsPerBlock: selectedRoomsPerBlock,
          selectedRoom: selectedRoomsPerBlock[activeBlockIndex],
          segments: segments,
          dailyRates: dailyRates,
          tags: tags,
          allRooms: allRooms,
          notes: notes
        }}
        isLoading={isCreatingReservation}
      />

      {/* Modal de advertencia de fecha pasada */}
      {showPastDateWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px' }}>⚠️</div>
              <h2 style={{ margin: 0, color: '#dc2626' }}>Advertencia: Fecha Pasada</h2>
            </div>
            <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '16px' }}>
              La reserva que estás creando incluye fechas anteriores a hoy. Esto normalmente indica un error.
            </p>
            <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
              ¿Estás seguro de que quieres continuar y crear esta reserva con fechas pasadas?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPastDateWarning(false);
                  setIsCreatingReservation(false);
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#f3f4f6',
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowPastDateWarning(false);
                  handleCreateReservation(pendingReservationStatus, true); // skipPastDateWarning = true
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Sí, Crear Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadExistingQueryModal
        isOpen={showLoadQueryModal}
        onClose={() => setShowLoadQueryModal(false)}
        onLoadQuery={handleLoadExistingQuery}
        onContinueWithoutLoading={handleContinueWithoutLoading}
        existingQuery={existingQuery}
      />

      {/* Modal de selección de consultas recientes */}
      <SelectQueryModal
        isOpen={showSelectQueryModal}
        onClose={() => {
          setShowSelectQueryModal(false);
          setRecentQueries([]);
        }}
        queries={recentQueries}
        clientName={formData.mainClient.firstName ? `${formData.mainClient.firstName} ${formData.mainClient.lastName}` : ''}
        onSelectQuery={handleSelectQuery}
        onCreateNew={handleCreateNewQuery}
      />

      {/* Modal de confirmación para eliminar segmentos */}
      <DeleteSegmentsModal
        isOpen={showDeleteSegmentsModal}
        segmentsToDelete={segmentsToDelete}
        onConfirm={handleConfirmDeleteSegments}
        onCancel={handleCancelDeleteSegments}
      />
    </div>
  );
}
