import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { fetchClients, findAvailableRooms, createReservation, getCalculatedRates, fetchRooms, fetchQueryByClient, createQuery, updateQuery, deleteQuery } from '../services/api';
import { useTags } from '../hooks/useTags';
import ReservationConfirmationModal from '../components/ReservationConfirmationModal';
import LoadExistingQueryModal from '../components/LoadExistingQueryModal';
import SelectQueryModal from '../components/SelectQueryModal';
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
  const { tags } = useTags();

  // Función para validar si el hotel está cerrado en el período solicitado
  const validateHotelAvailability = useCallback(async (checkIn, checkOut) => {
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
      const response = await fetch(`http://localhost:3001/api/season-blocks?hotelId=default-hotel`);
      
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
            
            return currentDate >= blockStart && currentDate < blockEnd;
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
      const seasonBlocksResponse = await fetch(`http://localhost:3001/api/season-blocks?hotelId=default-hotel`);
      
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

  // Estado para habitaciones disponibles
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Estado para tarifas por día
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [dailyRates, setDailyRates] = useState([]);
  
  // Estado para habitación seleccionada
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Estado para el modal de confirmación
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);

  // Estados para las secciones colapsables del nuevo diseño
  const [showSegments, setShowSegments] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  // Estado para mostrar detalles de habitaciones
  const [showRoomDetails, setShowRoomDetails] = useState({});
  
  // Estado para navegación de bloques de estadía
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [selectedRoomsPerBlock, setSelectedRoomsPerBlock] = useState({});
  // const [pricingError, setPricingError] = useState(null); // Ya no se usa

  // Estados para gestión de consultas
  const [currentQueryId, setCurrentQueryId] = useState(null);
  const [showLoadQueryModal, setShowLoadQueryModal] = useState(false);
  const [existingQuery, setExistingQuery] = useState(null);
  const [lastClientId, setLastClientId] = useState(null);
  
  // Estados para selección de consultas múltiples
  const [showSelectQueryModal, setShowSelectQueryModal] = useState(false);
  const [recentQueries, setRecentQueries] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Estado para notas/observaciones
  const [notes, setNotes] = useState('');
  
  // Flag para evitar cargar datos múltiples veces
  const dataLoadedRef = useRef(false);

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
      requiredGuests: lastBlock?.requiredGuests || 1,
      requiredTags: [],
      requiredRoomId: null,
      serviceType: lastBlock?.serviceType || (serviceTypes.length > 0 ? serviceTypes[0].id : '')
    };
    
    console.log('➕ Nuevo bloque agregado:', {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      diasEntreFechas: Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))
    });
    
    setSegments(prev => [...prev, newBlock]);
    setActiveBlockIndex(segments.length);
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
        const gapEndDate = new Date(periodStart.getTime() - 24 * 60 * 60 * 1000); // Un día antes del período disponible
        
        const gapSegment = {
          id: currentId++,
          checkIn: currentDate.toISOString().split('T')[0],
          checkOut: gapEndDate.toISOString().split('T')[0],
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
      
      // Actualizar la fecha actual al día siguiente del final del período para evitar solapamiento
      currentDate = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);
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
    
    // Verificar si hay solapamientos
    for (let i = 0; i < allSegments.length - 1; i++) {
      const current = allSegments[i];
      const next = allSegments[i + 1];
      const currentEnd = new Date(current.checkOut);
      const nextStart = new Date(next.checkIn);
      
      if (currentEnd >= nextStart) {
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
  };

  const selectRoomForBlock = (blockIndex, room) => {
    setSelectedRoomsPerBlock(prev => ({
      ...prev,
      [blockIndex]: room
    }));
  };




  // Función para guardar/actualizar consulta automáticamente
  const saveQueryAutomatically = useCallback(async () => {
    const clientId = formData.mainClient.id;
    
    console.log('🔍 saveQueryAutomatically ejecutándose');
    console.log('🔍 currentQueryId:', currentQueryId);
    console.log('🔍 clientId:', clientId);
    
    // Solo guardar si hay un cliente seleccionado
    if (!clientId) return;

    // Usar datos del segmento activo
    const activeSegment = segments[activeBlockIndex] || segments[0];
    if (!activeSegment) {
      console.log('⚠️ No hay segmento activo para guardar');
      return;
    }

    try {
      const queryData = {
        mainClientId: clientId,
        checkIn: activeSegment.checkIn ? new Date(activeSegment.checkIn + 'T00:00:00') : null,
        checkOut: activeSegment.checkOut ? new Date(activeSegment.checkOut + 'T00:00:00') : null,
        requiredGuests: activeSegment.requiredGuests,
        requiredRoomId: activeSegment.requiredRoomId,
        requiredTags: activeSegment.requiredTags || [],
        serviceType: activeSegment.serviceType || '',
        requirementsNotes: activeSegment.requirementsNotes || '',
        notes: notes
      };

      console.log('🔍 Datos del segmento activo a guardar:', queryData);

      if (currentQueryId) {
        // Actualizar consulta existente
        console.log('🔍 Actualizando consulta existente:', currentQueryId);
        await updateQuery(currentQueryId, queryData);
        console.log('✅ Consulta actualizada exitosamente');
      } else {
        // Crear consulta
        console.log('🔍 Creando nueva consulta');
        const newQuery = await createQuery(queryData);
        setCurrentQueryId(newQuery.id);
        console.log('✅ Nueva consulta creada:', newQuery.id);
      }
    } catch (error) {
      console.error('Error guardando consulta automáticamente:', error);
      // No mostrar error al usuario, es guardado automático
    }
  }, [formData.mainClient.id, segments, activeBlockIndex, notes, currentQueryId]);

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
        const seasonBlocksResponse = await fetch(`http://localhost:3001/api/season-blocks?hotelId=default-hotel`);
        
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
              const basePrice = roomTypePrices[0];
              
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
              } else if (basePrice) {
                  // Si no hay precio específico para el servicio, usar precio base
                const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                finalPrice = basePrice.basePrice * (1 + adjustment / 100);
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
                    const basePrice = roomTypePrices[0];
                    
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
                    } else if (basePrice) {
                      const adjustment = serviceAdjustment?.percentageAdjustment || 0;
                      finalPrice = basePrice.basePrice * (1 + adjustment / 100);
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
      
      // Si es una consulta existente (tiene ID), cargar todos los datos
      if (location.state.isEditing && queryData.id) {
        setCurrentQueryId(queryData.id);
        
        // Si mainClient es null pero mainClientId existe, buscar el cliente en la lista de clientes
        let clientData = queryData.mainClient;
        if (!clientData && queryData.mainClientId) {
          // Buscar el cliente en la lista de clientes cargados
          const foundClient = clients.find(client => client.id === queryData.mainClientId);
          if (foundClient) {
            clientData = foundClient;
          } else {
            clientData = {
              id: queryData.mainClientId,
              firstName: '',
              lastName: '',
              email: '',
              phone: ''
            };
          }
        }
        
        const formDataToSet = {
          checkIn: queryData.checkIn ? format(new Date(queryData.checkIn), 'yyyy-MM-dd') : '',
          checkOut: queryData.checkOut ? format(new Date(queryData.checkOut), 'yyyy-MM-dd') : '',
          mainClient: {
            id: queryData.mainClientId || null,
            firstName: clientData?.firstName || '',
            lastName: clientData?.lastName || '',
            email: clientData?.email || '',
            phone: clientData?.phone || ''
          }
        };
        const requirementsToSet = {
          requiredGuests: queryData.requiredGuests || 1,
          requiredTags: queryData.requiredTags || [],
          requiredRoomId: queryData.requiredRoomId || null,
          requirementsNotes: queryData.requirementsNotes || ''
        };
        
        console.log('🔍 FormData a setear:', formDataToSet);
        console.log('🔍 Requirements a setear:', requirementsToSet);
        
        // Establecer todos los estados de una vez
        setFormData(formDataToSet);
        setRequirements(requirementsToSet);
        setSelectedRoomType(queryData.reservationType || 'con_desayuno');
        setNotes(queryData.notes || '');
        
        // Sincronizar los segmentos con los datos de la consulta
        if (formDataToSet.checkIn && formDataToSet.checkOut) {
          setSegments([{
            id: 1,
            checkIn: formDataToSet.checkIn,
            checkOut: formDataToSet.checkOut,
            requiredGuests: requirementsToSet.requiredGuests,
            requiredTags: requirementsToSet.requiredTags,
            requiredRoomId: requirementsToSet.requiredRoomId,
            requirementsNotes: requirementsToSet.requirementsNotes
          }]);
        }
        
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
      }
      
      // Marcar como cargado y limpiar el state para evitar que se recargue en futuras navegaciones
      dataLoadedRef.current = true;
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.queryData?.id, location.state?.isEditing]);

  // Debug: Log del formData cada vez que cambie
  useEffect(() => {
    console.log('🔍 FormData actualizado:', formData);
    console.trace('🔍 Stack trace del cambio de formData');
  }, [formData]);

  // Auto-guardado removido - ahora se guarda solo al buscar habitaciones

  // Cargar tipos de servicio desde la API
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/service-types?hotelId=default-hotel');
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


  // Buscar habitaciones disponibles cuando cambien las fechas, huéspedes o etiquetas
  // COMENTADO: No debe ejecutarse automáticamente, solo al presionar el botón de búsqueda
  // useEffect(() => {
  //   if (formData.checkIn && formData.checkOut && requirements.requiredGuests) {
  //     searchAvailableRooms();
  //   }
  // }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags]);

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

  // Sincronizar segmentos con formData para la búsqueda de habitaciones (solo para nuevas consultas)
  useEffect(() => {
    console.log('🔍 useEffect de sincronización ejecutándose');
    console.log('🔍 isEditing en sincronización:', location.state?.isEditing);
    // No sincronizar si estamos cargando datos de una consulta existente
    if (location.state?.isEditing) {
      console.log('🔍 NO sincronizando (editando)');
      return;
    }
    
    if (segments.length > 0 && segments[activeBlockIndex] && segments[activeBlockIndex].checkIn && segments[activeBlockIndex].checkOut) {
      console.log('🔍 Sincronizando segmentos con formData');
      setFormData(prev => ({
        ...prev,
        checkIn: segments[activeBlockIndex].checkIn,
        checkOut: segments[activeBlockIndex].checkOut
      }));
    }

    if (segments.length > 0 && segments[activeBlockIndex] && segments[activeBlockIndex].requiredGuests) {
      setRequirements(prev => ({
        ...prev,
        requiredGuests: segments[activeBlockIndex].requiredGuests
      }));
    }
  }, [segments, activeBlockIndex, location.state?.isEditing]);

  // Sincronizar segments con formData cuando estamos editando (sincronización bidireccional)
  useEffect(() => {
    console.log('🔍 useEffect de sincronización bidireccional ejecutándose');
    console.log('🔍 isEditing:', location.state?.isEditing);
    
    if (location.state?.isEditing) {
      console.log('🔍 Sincronizando segments con formData (editando)');
      console.log('🔍 formData actual:', formData);
      
      setSegments(prev => {
        if (prev.length > 0 && prev[activeBlockIndex]) {
          return prev.map((segment, index) => 
            index === activeBlockIndex 
              ? {
                  ...segment,
                  checkIn: formData.checkIn,
                  checkOut: formData.checkOut,
                  requiredGuests: requirements.requiredGuests,
                  requiredTags: requirements.requiredTags,
                  requiredRoomId: requirements.requiredRoomId,
                  requirementsNotes: requirements.requirementsNotes
                }
              : segment
          );
        }
        return prev;
      });
    } else {
      console.log('🔍 NO sincronizando bidireccional - no está editando');
    }
  }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags, requirements.requiredRoomId, requirements.requirementsNotes, location.state?.isEditing, activeBlockIndex]);

  // Seleccionar automáticamente la primera habitación disponible si no hay ninguna seleccionada
  useEffect(() => {
    if (availableRooms.length > 0 && !selectedRoom) {
      // Buscar primero una habitación con capacidad exacta
      const exactCapacityRoom = availableRooms.find(room => room.maxPeople === requirements.requiredGuests);
      
      if (exactCapacityRoom) {
        setSelectedRoom(exactCapacityRoom);
        setSelectedRoomType(exactCapacityRoom.roomType);
      } else {
        // Si no hay capacidad exacta, seleccionar la primera disponible
        setSelectedRoom(availableRooms[0]);
        setSelectedRoomType(availableRooms[0].roomType);
      }
    }
  }, [availableRooms, requirements.requiredGuests, selectedRoom]);

  // Actualizar tipo de habitación cuando cambie la habitación seleccionada
  useEffect(() => {
    if (selectedRoom && selectedRoom.roomType) {
      setSelectedRoomType(selectedRoom.roomType);
    }
  }, [selectedRoom]);

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
        
        // Calcular tarifas para cada habitación usando el endpoint correcto
        const roomsWithRates = await Promise.all(
          result.availableRooms.map(async (room) => {
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
              baseRate: Math.round(totalRate),
              ratesData: ratesResult // Guardar los datos completos de tarifas
            };
          })
        );
        
        // Verificar si TODAS las habitaciones tienen tarifa $0 (precios no configurados)
        const allZeroRates = roomsWithRates.length > 0 && roomsWithRates.every(room => room.baseRate === 0);
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
          setAvailableRooms([]);
        } else {
          setAvailableRooms(roomsToShow);
        }
      } else {
        console.log('No se encontraron habitaciones disponibles');
        setAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error buscando habitaciones disponibles:', error);
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };






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
    // Cargar datos de la consulta en el formulario
    if (query.checkIn && query.checkOut) {
      setFormData(prev => ({
        ...prev,
        checkIn: query.checkIn.split('T')[0], // Convertir a formato YYYY-MM-DD
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

    // Cargar segmentos (si existen)
    if (query.checkIn && query.checkOut) {
      setSegments([{
        checkIn: query.checkIn.split('T')[0],
        checkOut: query.checkOut.split('T')[0],
        requiredGuests: query.requiredGuests || 1,
        requiredTags: query.requiredTags || [],
        requiredRoomId: query.requiredRoomId || null,
        requirementsNotes: query.requirementsNotes || '',
        serviceType: query.reservationType || 'base'
      }]);
    }

    setCurrentQueryId(query.id);
    setExistingQuery(null);
  };

  // Función para continuar sin cargar la consulta existente
  const handleContinueWithoutLoading = () => {
    setCurrentQueryId(null);
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
    console.log('🔍 handleSegmentChange ejecutándose:', { segmentId, field, value, isEditing: location.state?.isEditing });
    
    setSegments(prev => prev.map(segment => {
      if (segment.id === segmentId) {
        const updatedSegment = { ...segment, [field]: value };
        
        // Lógica especial para fechas
        if (field === 'checkIn') {
          // Comparar fechas como strings para evitar problemas de zona horaria
          const checkInString = value; // formato: YYYY-MM-DD
          const checkOutString = segment.checkOut; // formato: YYYY-MM-DD
          
          // console.log('📅 Modificando check-in:', { nuevoCheckIn: checkInString, checkOutActual: checkOutString, esAnteriorOIgual: checkOutString <= checkInString });
          
          if (checkOutString <= checkInString) {
            // Si el check-out es anterior o igual al check-in, ajustarlo al día siguiente
            // Crear fecha local para evitar problemas de zona horaria
            const checkInDateLocal = new Date(checkInString + 'T00:00:00');
            const nextDay = addDays(checkInDateLocal, 1);
            const nextDayString = format(nextDay, 'yyyy-MM-dd');
            updatedSegment.checkOut = nextDayString;
            // console.log('🔄 Check-out ajustado al día siguiente del check-in:', { checkIn: checkInString, checkOutAnterior: checkOutString, checkOutNuevo: nextDayString });
          }
        } else if (field === 'checkOut') {
          // Comparar fechas como strings para evitar problemas de zona horaria
          const checkInString = segment.checkIn; // formato: YYYY-MM-DD
          const checkOutString = value; // formato: YYYY-MM-DD
          
          // console.log('📅 Modificando check-out:', { checkInActual: checkInString, nuevoCheckOut: checkOutString, esAnteriorOIgual: checkOutString <= checkInString });
          
          if (checkOutString <= checkInString) {
            // Si el check-out es anterior o igual al check-in, ajustarlo al día siguiente
            // Crear fecha local para evitar problemas de zona horaria
            const checkInDateLocal = new Date(checkInString + 'T00:00:00');
            const nextDay = addDays(checkInDateLocal, 1);
            const nextDayString = format(nextDay, 'yyyy-MM-dd');
            updatedSegment.checkOut = nextDayString;
            // console.log('🔄 Check-out ajustado al día siguiente del check-in:', { checkIn: checkInString, checkOutAnterior: checkOutString, checkOutNuevo: nextDayString });
          }
        }
        
        // Validación final: asegurar que check-out siempre sea al menos un día después de check-in
        if (updatedSegment.checkIn && updatedSegment.checkOut) {
          const finalCheckInString = updatedSegment.checkIn;
          const finalCheckOutString = updatedSegment.checkOut;
          
          if (finalCheckOutString <= finalCheckInString) {
            // Ajustar check-out al día siguiente del check-in
            const checkInDateLocal = new Date(finalCheckInString + 'T00:00:00');
            const nextDay = addDays(checkInDateLocal, 1);
            const nextDayString = format(nextDay, 'yyyy-MM-dd');
            updatedSegment.checkOut = nextDayString;
            console.log('🔒 Validación final: Check-out ajustado:', {
              checkIn: finalCheckInString,
              checkOutNuevo: nextDayString
            });
          }
        }
        
        // Si estamos editando, también actualizar formData para que se dispare el guardado automático
        if (location.state?.isEditing && (field === 'checkIn' || field === 'checkOut' || field === 'requiredGuests')) {
          console.log('🔍 Actualizando formData desde handleSegmentChange');
          setFormData(prev => ({
            ...prev,
            checkIn: updatedSegment.checkIn,
            checkOut: updatedSegment.checkOut
          }));
          
          if (field === 'requiredGuests') {
            setRequirements(prev => ({
              ...prev,
              requiredGuests: value
            }));
          }
        }
        
        return updatedSegment;
      }
      return segment;
    }));
  };

  const handleSegmentTagToggle = (segmentId, tagId) => {
    setSegments(prev => prev.map(segment => {
      if (segment.id === segmentId) {
        const newTags = segment.requiredTags.includes(tagId)
          ? segment.requiredTags.filter(id => id !== tagId)
          : [...segment.requiredTags, tagId];
        return { 
          ...segment, 
          requiredTags: newTags,
          requiredRoomId: null // Reset habitación específica al cambiar etiquetas
        };
      }
      return segment;
    }));
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



  // Función para crear la reserva
  const handleCreateReservation = async () => {
    setIsCreatingReservation(true);
    
    try {
      // Validaciones básicas
      if (!selectedRoom) {
        throw new Error('No se ha seleccionado una habitación');
      }
      
      if (!formData.mainClient.firstName || !formData.mainClient.lastName) {
        throw new Error('El cliente debe tener nombre y apellido');
      }
      
      if (!segments || segments.length === 0) {
        throw new Error('Debe haber al menos un segmento de estancia');
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
        segments: segments.map(segment => ({
          roomId: selectedRoom.id,
          startDate: segment.checkIn, // El backend espera startDate
          endDate: segment.checkOut,  // El backend espera endDate
          requiredGuests: segment.requiredGuests,
          serviceType: segment.serviceType,
          requiredTags: segment.requiredTags || [],
          requiredRoomId: segment.requiredRoomId,
          baseRate: 100, // Tarifa base por defecto - esto debería calcularse dinámicamente
          guestCount: segment.requiredGuests
        })),
        status: 'pendiente',
        notes: notes,
        isMultiRoom: false
      };

      console.log('Datos de reserva a enviar:', reservationData);

      // Crear la reserva en el backend
      console.log('Enviando reserva a:', `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/reservations/multi-segment`);
      console.log('Datos completos de la reserva:', JSON.stringify(reservationData, null, 2));
      
      const newReservation = await createReservation(reservationData);
      
      console.log('Reserva creada:', newReservation);
      
      // Eliminar la consulta si existe (ya se convirtió en reserva)
      if (currentQueryId) {
        try {
          await deleteQuery(currentQueryId);
          console.log('✅ Consulta eliminada después de crear reserva:', currentQueryId);
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
    setSelectedRoom(null);
    setSelectedRoomType(null);
    setDailyRates([]);
    setSearchTerm('');
    setShowNewClientForm(false);
    setCurrentQueryId(null);
    setNotes('');
  };

  return (
    <div className={styles.newLayout}>
      {/* Contenedor unificado: Cliente + Pestañas */}
      <div className={styles.unifiedContainer}>
        {/* 1. Sección de Cliente */}
        <div className={styles.sectionHeader}>
          <h2>
            {!formData.mainClient.id ? (
              'Consulta rápida'
            ) : (
              `Consulta ${currentQueryId ? `#${currentQueryId}` : 'nueva'} - ${formData.mainClient.firstName} ${formData.mainClient.lastName}`
            )}
          </h2>
          {formData.mainClient.id && (
            <button 
              type="button" 
              onClick={() => {
                // Eliminar el cliente de la consulta (mantener consulta original intacta)
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
                // Limpiar el ID de la consulta actual para crear una nueva consulta temporal
                setCurrentQueryId(null);
              }}
              className={styles.deleteClientButton}
              title="Eliminar cliente de la consulta"
            >
              ✕
            </button>
          )}
        </div>
        
        {!formData.mainClient.id && (
          <div className={styles.clientContent}>
            <div className={styles.formGroup}>
            {showNewClientForm ? (
              <div className={styles.newClientForm}>
                <div className={styles.newClientGrid}>
                  <input
                    type="text"
                    value={formData.mainClient.firstName}
                    onChange={(e) => handleClientInputChange('firstName', e.target.value)}
                    placeholder="Nombre"
                    required
                  />
                  <input
                    type="text"
                    value={formData.mainClient.lastName}
                    onChange={(e) => handleClientInputChange('lastName', e.target.value)}
                    placeholder="Apellido"
                    required
                  />
                  <input
                    type="email"
                    value={formData.mainClient.email}
                    onChange={(e) => handleClientInputChange('email', e.target.value)}
                    placeholder="Email"
                  />
                  <input
                    type="tel"
                    value={formData.mainClient.phone}
                    onChange={(e) => handleClientInputChange('phone', e.target.value)}
                    placeholder="Teléfono"
                  />
                </div>
                <div className={styles.newClientButtons}>
                  <button type="button" onClick={handleSaveNewClient}>💾 Guardar</button>
                  <button type="button" onClick={handleNewSearch}>❌ Cancelar</button>
                </div>
              </div>
            ) : formData.mainClient.id ? (
              // Cliente seleccionado - no mostrar nada aquí, el nombre ya está en el título
              null
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
                  <label>Check-in</label>
                  <input
                    type="date"
                    value={segments[activeBlockIndex]?.checkIn || ''}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'checkIn', e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Check-out</label>
                  <input
                    type="date"
                    value={segments[activeBlockIndex]?.checkOut || ''}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'checkOut', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Huéspedes y Tipo de servicio */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Huéspedes</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={segments[activeBlockIndex]?.requiredGuests || 1}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'requiredGuests', parseInt(e.target.value))}
                    required
                  />
                </div>

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

              {/* Contenedor para Requisitos y Notas lado a lado */}
              <div className={styles.sideBySideContainer}>
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
                      <div className={styles.formGroup}>
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
                  )}
                </div>

                {/* Notas (expandible) */}
                <div className={styles.expandableSection}>
                  <button
                    type="button"
                    className={styles.expandableHeader}
                    onClick={() => setShowNotes(!showNotes)}
                  >
                    <label>Notas</label>
                    <span className={styles.expandIcon}>{showNotes ? '▼' : '▶'}</span>
                  </button>
                  
                  {showNotes && (
                    <textarea
                      className={styles.notesTextareaExpanded}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Agregar notas, comentarios especiales, solicitudes del cliente, etc..."
                      rows={4}
                    />
                  )}
                </div>
              </div>

              {/* Botón de búsqueda */}
              <div className={styles.formGroup}>
                <button 
                  type="button" 
                  className={styles.searchButton}
                  onClick={() => searchAvailableRooms()}
                  disabled={!segments[activeBlockIndex]?.checkIn || !segments[activeBlockIndex]?.checkOut || isHotelClosed}
                >
                  Buscar Habitaciones
                </button>
                
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
            </div>

            {/* Habitaciones Disponibles dentro de la pestaña */}
            <div className={styles.roomsSection}>
              <div className={styles.sectionHeader}>
                <h3>Habitaciones Disponibles</h3>
              </div>
              
              {/* Alerta si hay problemas con las tarifas */}
              {/* Mensaje de precios no configurados eliminado - redundante con el mensaje principal */}
              
              
              {loadingRooms ? (
                <div className={styles.loading}>
                  🔍 Buscando habitaciones disponibles...
                    </div>
              ) : availableRooms.length === 0 ? (
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
                  {availableRooms
                    .map((room) => {
                      const compliance = checkRequirementsCompliance(room);
                      return { room, compliance };
                    })
                    .sort((a, b) => {
                      // Primero las que cumplen completamente
                      if (a.compliance.complies && !b.compliance.complies) return -1;
                      if (!a.compliance.complies && b.compliance.complies) return 1;
                      
                      // Luego por capacidad exacta vs mayor capacidad
                      const aExactCapacity = a.room.capacity === segments[activeBlockIndex]?.requiredGuests;
                      const bExactCapacity = b.room.capacity === segments[activeBlockIndex]?.requiredGuests;
                      
                      if (aExactCapacity && !bExactCapacity) return -1;
                      if (!aExactCapacity && bExactCapacity) return 1;
                      
                      return 0;
                    })
                    .map(({ room, compliance }) => {
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
                                <span className={styles.rateAmount}>
                                  ${new Intl.NumberFormat('es-AR').format(room.baseRate || 0)}
                                </span>
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
                              <h4>Detalle Tarifario por Día</h4>
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
                                    No hay datos de tarifas disponibles para esta habitación
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
            </div>
          </div>
        )}
      </div>


      {/* 5. Resumen Global (sección fija abajo) */}
      {Object.keys(selectedRoomsPerBlock).length > 0 && (
        <div className={styles.summarySection}>
          <div className={styles.sectionHeader}>
            <h2>📋 Resumen Global de la Reserva</h2>
          </div>
          
          <div className={styles.summaryContent}>
            <div className={styles.summaryHeader}>
              <div className={styles.summaryItem}>
                <label>Cliente:</label>
                <span>{formData.mainClient.firstName} {formData.mainClient.lastName}</span>
              </div>
            </div>
            
            <div className={styles.blocksSummary}>
              <h4>Bloques de Estadía:</h4>
              {segments.map((block, index) => {
                const selectedRoom = selectedRoomsPerBlock[index];
                if (!selectedRoom) return null;
                
                return (
                  <div key={block.id} className={styles.blockSummaryItem}>
                    <span className={styles.blockSummaryLabel}>
                      Bloque {index + 1}:
                    </span>
                    <span className={styles.blockSummaryDetails}>
                      {selectedRoom.name} | {block.checkIn && block.checkOut 
                        ? `${format(new Date(block.checkIn + 'T00:00:00'), 'dd/MM')} – ${format(new Date(block.checkOut + 'T00:00:00'), 'dd/MM')}`
                        : 'Sin fechas'
                      } | {block.serviceType} | ${new Intl.NumberFormat('es-AR').format(selectedRoom.baseRate || 0)}
                    </span>
                  </div>
                );
              })}
              
              <div className={styles.totalSection}>
                <div className={styles.totalSeparator}></div>
                <div className={styles.summaryItem}>
                  <label>Total General:</label>
                  <span className={styles.totalAmount}>
                    ${new Intl.NumberFormat('es-AR').format(
                      Object.values(selectedRoomsPerBlock).reduce((total, room) => total + (room.baseRate || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            <div className={styles.summaryActions}>
              <button 
                type="button" 
                className={styles.confirmButton}
                onClick={() => setShowConfirmationModal(true)}
                disabled={Object.keys(selectedRoomsPerBlock).length === 0}
              >
                ✅ Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de reserva */}
      <ReservationConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleCreateReservation}
        reservationData={{
          mainClient: formData.mainClient,
          selectedRoom: selectedRoom,
          segments: segments,
          dailyRates: dailyRates,
          tags: tags
        }}
        isLoading={isCreatingReservation}
      />

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
    </div>
  );
}
