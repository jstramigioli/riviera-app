import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { fetchClients, findAvailableRooms, createReservation, getCalculatedRates } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTags } from '../hooks/useTags';
import ReservationConfirmationModal from '../components/ReservationConfirmationModal';
import styles from '../styles/NuevaConsulta.module.css';

export default function NuevaConsulta() {
  const location = useLocation();
  const { tags } = useTags();

  // Función para obtener las fechas por defecto basadas en bloques de temporada
  const getDefaultDates = async () => {
    console.log('🎯 getDefaultDates iniciada');
    try {
      const today = new Date();
      const todayString = format(today, 'yyyy-MM-dd');
      console.log('📅 Fecha de hoy:', {
        today: today,
        todayString: todayString,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      // Obtener todos los bloques de temporada
      console.log('🔍 Buscando bloques de temporada...');
      const seasonBlocksResponse = await fetch(`http://localhost:3001/api/season-blocks?hotelId=default-hotel`);
      
      if (seasonBlocksResponse.ok) {
        const seasonBlocksData = await seasonBlocksResponse.json();
        const seasonBlocks = seasonBlocksData.data || [];
        
        console.log('📋 Bloques de temporada encontrados:', seasonBlocks.length);
        
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
        
        console.log('📋 Bloques disponibles:', availableBlocks.map(b => ({
          name: b.name,
          startDate: b.startDate.split('T')[0],
          endDate: b.endDate.split('T')[0]
        })));
        
        if (availableBlocks.length > 0) {
          // Usar el primer día del primer bloque disponible
          const firstBlock = availableBlocks[0];
          
          // Extraer solo la parte de fecha (YYYY-MM-DD) del string ISO para evitar problemas de zona horaria
          const startDateISO = firstBlock.startDate.split('T')[0]; // Obtener "2025-10-10" de "2025-10-10T00:00:00.000Z"
          const checkInDate = startDateISO;
          const checkOutDate = format(addDays(new Date(startDateISO + 'T12:00:00'), 1), 'yyyy-MM-dd');
          
          console.log('✅ Usando fechas del primer bloque disponible:', { 
            bloque: firstBlock.name,
            checkIn: checkInDate, 
            checkOut: checkOutDate
          });
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
  };

  // Estado del formulario con persistencia en localStorage
  const [formData, setFormData] = useLocalStorage('nuevaConsulta_formData', {
    checkIn: '',
    checkOut: '',
    mainClient: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    }
  });

  // Estado para requerimientos con persistencia en localStorage
  const [requirements, setRequirements] = useLocalStorage('nuevaConsulta_requirements', {
    requiredGuests: 1,
    requiredTags: [],
    serviceType: 'con_desayuno'
  });

  // Estado para segmentos de consulta
  const [segments, setSegments] = useLocalStorage('nuevaConsulta_segments', [
    {
      id: 1,
      checkIn: '',
      checkOut: '',
      requiredGuests: 1,
      requiredTags: [],
      serviceType: 'con_desayuno'
    }
  ]);

  // Estado para clientes
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  // Estado para habitaciones disponibles
  const [availableRooms, setAvailableRooms] = useState([]);
  const [allAvailableRooms, setAllAvailableRooms] = useState([]);
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
  
  // Estado para mostrar detalles de habitaciones
  const [showRoomDetails, setShowRoomDetails] = useState({});
  
  // Estado para navegación de bloques de estadía
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [selectedRoomsPerBlock, setSelectedRoomsPerBlock] = useState({});
  const [pricingError, setPricingError] = useState(null);

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
      serviceType: lastBlock?.serviceType || 'con_desayuno'
    };
    
    console.log('➕ Nuevo bloque agregado:', {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      diasEntreFechas: Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))
    });
    
    setSegments(prev => [...prev, newBlock]);
    setActiveBlockIndex(segments.length);
  };

  const removeBlock = (blockId) => {
    if (segments.length <= 1) return; // No permitir eliminar el último bloque
    
    const blockIndex = segments.findIndex(block => block.id === blockId);
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




  // Cargar datos de la consulta desde el modal si existen
  useEffect(() => {
    if (location.state?.queryData) {
      const { checkIn, checkOut, requiredGuests, requiredTags } = location.state.queryData;
      
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
      
      // Limpiar el state para evitar que se recargue en futuras navegaciones
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Cargar habitación seleccionada desde localStorage
  useEffect(() => {
    const savedSelectedRoom = localStorage.getItem('nuevaConsulta_selectedRoom');
    if (savedSelectedRoom) {
      try {
        const room = JSON.parse(savedSelectedRoom);
        setSelectedRoom(room);
      } catch (error) {
        console.error('Error parsing saved selected room:', error);
      }
    }
  }, []);

  // Cargar clientes y fechas por defecto al montar el componente
  useEffect(() => {
    console.log('🚀 NuevaConsulta montado - iniciando carga...');
    loadClients();
    loadDefaultDates();
  }, []);

  // Función para cargar las fechas por defecto
  const loadDefaultDates = async () => {
    console.log('🔄 loadDefaultDates llamada');
    console.log('📋 formData actual:', formData);
    
    try {
      const defaultDates = await getDefaultDates();
      console.log('✅ Fechas por defecto obtenidas:', defaultDates);
      
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
          serviceType: segment.serviceType || 'con_desayuno'
        } : {
          ...segment,
          checkIn: segment.checkIn || '',
          checkOut: segment.checkOut || '',
          requiredGuests: segment.requiredGuests || 1,
          requiredTags: segment.requiredTags || [],
          serviceType: segment.serviceType || 'con_desayuno'
        }
      ));
      
      console.log('✅ Fechas actualizadas en el estado');
    } catch (error) {
      console.error('❌ Error cargando fechas por defecto:', error);
    }
  };

  // Buscar habitaciones disponibles cuando cambien las fechas, huéspedes o etiquetas
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && requirements.requiredGuests) {
      searchAvailableRooms();
    }
  }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags]);

  // Sincronizar segmentos con las fechas del formulario principal
  useEffect(() => {
    if (formData.checkIn && formData.checkOut) {
      setSegments(prevSegments => 
        prevSegments.map(segment => ({
          ...segment,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut
        }))
      );
    }
  }, [formData.checkIn, formData.checkOut]);

  // Sincronizar segmentos con formData para la búsqueda de habitaciones
  useEffect(() => {
    if (segments.length > 0 && segments[0].checkIn && segments[0].checkOut) {
      setFormData(prev => ({
        ...prev,
        checkIn: segments[0].checkIn,
        checkOut: segments[0].checkOut
      }));
    }

    if (segments.length > 0 && segments[0].requiredGuests) {
      setRequirements(prev => ({
        ...prev,
        requiredGuests: segments[0].requiredGuests
      }));
    }
  }, [segments]);

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
  }, [selectedRoomType, segments]);

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





  const loadClients = async () => {
    try {
      const response = await fetchClients();
      setClients(response);
      setFilteredClients(response.slice(0, 10));
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const searchAvailableRooms = async () => {
    if (!segments[activeBlockIndex]) {
      console.log('No hay bloque activo para buscar habitaciones');
      return;
    }
    
    setLoadingRooms(true);
    try {
      const activeBlock = segments[activeBlockIndex];
      const params = {
        checkIn: activeBlock.checkIn,
        checkOut: activeBlock.checkOut,
        requiredGuests: activeBlock.requiredGuests,
        requiredTags: activeBlock.requiredTags
      };

      console.log('Buscando habitaciones con parámetros:', params);
      const result = await findAvailableRooms(params);
      console.log('Resultado de búsqueda de habitaciones:', result);
      
      if (result && result.availableRooms) {
        console.log(`Encontradas ${result.availableRooms.length} habitaciones disponibles`);
        
        // Calcular tarifas para cada habitación usando el endpoint correcto
        const roomsWithRates = await Promise.all(
          result.availableRooms.map(async (room) => {
            let totalRate = 0;
            
            console.log(`🏨 Procesando habitación: ${room.name}, tipo: ${room.roomType?.id}`);
            
            try {
              // Usar el endpoint correcto: /api/dynamic-pricing/calculated-rates/:hotelId/:roomTypeId
              const ratesResult = await getCalculatedRates(
                'default-hotel',
                room.roomType?.id,
                activeBlock.checkIn,
                activeBlock.checkOut,
                activeBlock.serviceType
              );
              
              console.log(`📊 Respuesta para habitación ${room.name}:`, ratesResult);
              
              if (ratesResult && ratesResult.totalAmount !== undefined) {
                totalRate = ratesResult.totalAmount;
                console.log(`✅ Habitación ${room.name}: Total del backend = $${totalRate}`);
              } else {
                console.log(`⚠️ Respuesta inesperada para habitación ${room.name}:`, ratesResult);
                totalRate = 0;
              }
            } catch (error) {
              console.error(`❌ Error obteniendo tarifa para habitación ${room.name}:`, error);
              
              // Verificar si es un error 404 (precios no configurados)
              if (error.message.includes('404') || error.message.includes('No se encontraron precios')) {
                console.log(`⚠️ No hay precios configurados para las fechas solicitadas`);
                totalRate = 0; // Mantener $0 cuando no hay precios configurados
              } else {
                console.log(`⚠️ Error del servidor al obtener precios para ${room.name}`);
                totalRate = 0; // Mantener $0 cuando hay error del servidor
              }
            }
            
            return {
              ...room,
              baseRate: Math.round(totalRate)
            };
          })
        );
        
        console.log('Habitaciones con tarifas calculadas:', roomsWithRates);
        
        // Verificar si alguna habitación tiene tarifa $0 (indicando problema con el backend)
        const hasZeroRates = roomsWithRates.some(room => room.baseRate === 0);
        if (hasZeroRates) {
          console.log('⚠️ Algunas habitaciones tienen tarifa $0 - posible problema con el backend');
        }
        
        // Verificar si TODAS las habitaciones tienen tarifa $0 (precios no configurados)
        const allZeroRates = roomsWithRates.length > 0 && roomsWithRates.every(room => room.baseRate === 0);
        if (allZeroRates) {
          console.log('⚠️ TODAS las habitaciones tienen tarifa $0 - precios no configurados');
          setPricingError('No se encontraron precios para las fechas solicitadas. No hay bloques de temporada configurados para estas fechas.');
        } else {
          setPricingError(null);
        }
        
        // Guardar todas las habitaciones disponibles con tarifas
        setAllAvailableRooms(roomsWithRates);
        
        // Filtrar habitaciones: primero capacidad exacta, luego mayor capacidad
        const exactCapacityRooms = roomsWithRates.filter(room => room.maxPeople === activeBlock.requiredGuests);
        const largerCapacityRooms = roomsWithRates.filter(room => room.maxPeople > activeBlock.requiredGuests);
        
        // Determinar qué habitaciones mostrar inicialmente
        let roomsToShow = [];
        let shouldShowLargerCapacityButton = false;
        
        if (exactCapacityRooms.length > 0) {
          // Si hay habitaciones con capacidad exacta, mostrar solo esas
          roomsToShow = exactCapacityRooms;
          // Solo mostrar el botón si también hay habitaciones de mayor capacidad
          shouldShowLargerCapacityButton = largerCapacityRooms.length > 0;
        } else if (largerCapacityRooms.length > 0) {
          // Si no hay capacidad exacta pero sí mayor capacidad, mostrar esas automáticamente
          roomsToShow = largerCapacityRooms;
          shouldShowLargerCapacityButton = false; // No mostrar botón porque ya se muestran
        }
        
        setAvailableRooms(roomsToShow);
      } else {
        console.log('No se encontraron habitaciones disponibles');
        setAvailableRooms([]);
        setAllAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error buscando habitaciones disponibles:', error);
      setAvailableRooms([]);
      setAllAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };



  const loadDailyRates = async () => {
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
      const selectedServiceType = segments[0]?.serviceType || 'con_desayuno';
      
      // Mapear el tipo de servicio a nombres de servicio
      const serviceTypeMap = {
        'con_desayuno': 'Con Desayuno',
        'sin_desayuno': 'Sin Desayuno',
        'media_pension': 'Media Pensión',
        'pension_completa': 'Pensión Completa'
      };
      
      const selectedServiceName = serviceTypeMap[selectedServiceType];
      
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
              // Obtener ajustes de porcentaje del bloque
              const serviceAdjustments = activeBlockForDate.blockServiceSelections || [];
              
              // Buscar el precio para el servicio seleccionado
              const servicePrice = roomTypePrices.find(price => 
                price.serviceType && price.serviceType.name === selectedServiceName
              );
              
              // Buscar precio base como fallback
              const basePrice = roomTypePrices.find(price => 
                !price.serviceType || price.serviceType.name === 'Tarifa base'
              ) || roomTypePrices[0];
              
              // Obtener el ajuste de porcentaje para el servicio seleccionado
              const serviceAdjustment = serviceAdjustments.find(selection => 
                selection.serviceType && selection.serviceType.name === selectedServiceName
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
                blockName: seasonBlockData.seasonBlock.name,
                serviceName: selectedServiceName,
                price: Math.round(finalPrice)
              });
            } else {
              rates.push({
                date: dateStr,
                blockName: seasonBlockData.seasonBlock.name,
                serviceName: selectedServiceName,
                price: 0,
                noRatesAvailable: true
              });
            }
          }
        } else {
          // Intentar obtener un bloque en borrador si no hay confirmados
          const errorData = await seasonBlocksResponse.json();
          if (errorData.reason === 'only_draft_blocks' && errorData.draftBlocks && errorData.draftBlocks.length > 0) {
            // Usar el primer bloque en borrador disponible
            const draftBlockResponse = await fetch(`/api/season-blocks/${errorData.draftBlocks[0].id}`);
            if (draftBlockResponse.ok) {
              const draftBlockData = await draftBlockResponse.json();
              
              if (draftBlockData.data && draftBlockData.data.seasonPrices) {
                const roomTypePrices = draftBlockData.data.seasonPrices.filter(
                  price => price.roomTypeId === selectedRoomType.id
                );
                
                if (roomTypePrices.length > 0) {
                  const serviceAdjustments = draftBlockData.data.blockServiceSelections || [];
                  
                  // Obtener el servicio seleccionado del primer segmento
                  const selectedServiceType = segments[0]?.serviceType || 'con_desayuno';
                  
                  // Mapear el tipo de servicio a nombres de servicio
                  const serviceTypeMap = {
                    'con_desayuno': 'Con Desayuno',
                    'sin_desayuno': 'Sin Desayuno',
                    'media_pension': 'Media Pensión',
                    'pension_completa': 'Pensión Completa'
                  };
                  
                  const selectedServiceName = serviceTypeMap[selectedServiceType];
                  
                  // Buscar el precio para el servicio seleccionado
                  const servicePrice = roomTypePrices.find(price => 
                    price.serviceType && price.serviceType.name === selectedServiceName
                  );
                  
                  // Buscar precio base como fallback
                  const basePrice = roomTypePrices.find(price => 
                    !price.serviceType || price.serviceType.name === 'Tarifa base'
                  ) || roomTypePrices[0];
                  
                  // Obtener el ajuste de porcentaje para el servicio seleccionado
                  const serviceAdjustment = serviceAdjustments.find(selection => 
                    selection.serviceType && selection.serviceType.name === selectedServiceName
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
                    blockName: draftBlockData.data.name,
                    serviceName: selectedServiceName,
                    price: Math.round(finalPrice)
                  });
                } else {
                  rates.push({
                    date: dateStr,
                    blockName: draftBlockData.data.name,
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
      
      setDailyRates(rates);
    } catch (error) {
      console.error('Error loading daily rates:', error);
      setDailyRates([]);
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

  const handleClientSelect = (client) => {
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        phone: client.phone || ''
      }
    }));
    setShowNewClientForm(false);
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
  };

  const handleShowLargerCapacity = () => {
    if (!segments[activeBlockIndex]) return;
    
    const activeBlock = segments[activeBlockIndex];
    const exactCapacityRooms = allAvailableRooms.filter(room => room.maxPeople === activeBlock.requiredGuests);
    const largerCapacityRooms = allAvailableRooms.filter(room => room.maxPeople > activeBlock.requiredGuests);
    
    // Combinar habitaciones de capacidad exacta con las de mayor capacidad
    const combinedRooms = [...exactCapacityRooms, ...largerCapacityRooms];
    setAvailableRooms(combinedRooms);
  };

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
        
        // Actualizar el cliente en el formulario con los datos del servidor
        setFormData(prev => ({
          ...prev,
          mainClient: {
            firstName: newClient.firstName,
            lastName: newClient.lastName,
            email: newClient.email || '',
            phone: newClient.phone || ''
          }
        }));
        
        // Cerrar el formulario de nuevo cliente
        setShowNewClientForm(false);
        
        alert('✅ Cliente guardado correctamente en la base de datos.');
      } else {
        const errorData = await response.json();
        alert(`❌ Error al guardar el cliente: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error saving client:', error);
      alert('❌ Error al conectar con el servidor. Intenta nuevamente.');
    }
  };

  const handleSaveQuery = () => {
    // Validaciones básicas
    const newErrors = {};
    
    // Validar que todos los segmentos tengan fechas
    segments.forEach((segment, index) => {
      if (!segment.checkIn) {
        newErrors[`segment${index}CheckIn`] = `La fecha de entrada del segmento ${index + 1} es requerida`;
      }
      if (!segment.checkOut) {
        newErrors[`segment${index}CheckOut`] = `La fecha de salida del segmento ${index + 1} es requerida`;
      }
      if (!segment.requiredGuests) {
        newErrors[`segment${index}Guests`] = `La cantidad de huéspedes del segmento ${index + 1} es requerida`;
      }
    });
    
    if (Object.keys(newErrors).length > 0) {
      alert('Por favor, completa todos los campos requeridos.');
      return;
    }

    // Los datos ya se guardan automáticamente en localStorage gracias a useLocalStorage
    // También guardar la habitación seleccionada
    if (selectedRoom) {
      localStorage.setItem('nuevaConsulta_selectedRoom', JSON.stringify(selectedRoom));
    }
    
    // Solo mostrar confirmación
    alert('✅ Consulta guardada correctamente. Los datos se han guardado y estarán disponibles cuando vuelvas a esta página.');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    const newErrors = {};
    
    // Validar que todos los segmentos tengan fechas
    segments.forEach((segment, index) => {
      if (!segment.checkIn) {
        newErrors[`segment${index}CheckIn`] = `La fecha de entrada del segmento ${index + 1} es requerida`;
      }
      if (!segment.checkOut) {
        newErrors[`segment${index}CheckOut`] = `La fecha de salida del segmento ${index + 1} es requerida`;
      }
      if (!segment.requiredGuests) {
        newErrors[`segment${index}Guests`] = `La cantidad de huéspedes del segmento ${index + 1} es requerida`;
      }
    });
    
    if (!selectedRoom) newErrors.selectedRoom = 'Debe seleccionar una habitación';
    
    if (Object.keys(newErrors).length > 0) {
      alert('Por favor, completa todos los campos requeridos.');
      return;
    }

    // Abrir modal de confirmación
    setShowConfirmationModal(true);
  };





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
    setSegments(prev => prev.map(segment => {
      if (segment.id === segmentId) {
        const updatedSegment = { ...segment, [field]: value };
        
        // Lógica especial para fechas
        if (field === 'checkIn') {
          // Comparar fechas como strings para evitar problemas de zona horaria
          const checkInString = value; // formato: YYYY-MM-DD
          const checkOutString = segment.checkOut; // formato: YYYY-MM-DD
          
          console.log('📅 Modificando check-in:', {
            nuevoCheckIn: checkInString,
            checkOutActual: checkOutString,
            esAnteriorOIgual: checkOutString <= checkInString
          });
          
          if (checkOutString <= checkInString) {
            // Si el check-out es anterior o igual al check-in, ajustarlo al día siguiente
            // Crear fecha local para evitar problemas de zona horaria
            const checkInDateLocal = new Date(checkInString + 'T00:00:00');
            const nextDay = addDays(checkInDateLocal, 1);
            const nextDayString = format(nextDay, 'yyyy-MM-dd');
            updatedSegment.checkOut = nextDayString;
            console.log('🔄 Check-out ajustado al día siguiente del check-in:', {
              checkIn: checkInString,
              checkOutAnterior: checkOutString,
              checkOutNuevo: nextDayString
            });
          }
        } else if (field === 'checkOut') {
          // Comparar fechas como strings para evitar problemas de zona horaria
          const checkInString = segment.checkIn; // formato: YYYY-MM-DD
          const checkOutString = value; // formato: YYYY-MM-DD
          
          console.log('📅 Modificando check-out:', {
            checkInActual: checkInString,
            nuevoCheckOut: checkOutString,
            esAnteriorOIgual: checkOutString <= checkInString
          });
          
          if (checkOutString <= checkInString) {
            // Si el check-out es anterior o igual al check-in, ajustarlo al día siguiente
            // Crear fecha local para evitar problemas de zona horaria
            const checkInDateLocal = new Date(checkInString + 'T00:00:00');
            const nextDay = addDays(checkInDateLocal, 1);
            const nextDayString = format(nextDay, 'yyyy-MM-dd');
            updatedSegment.checkOut = nextDayString;
            console.log('🔄 Check-out ajustado al día siguiente del check-in:', {
              checkIn: checkInString,
              checkOutAnterior: checkOutString,
              checkOutNuevo: nextDayString
            });
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
        return { ...segment, requiredTags: newTags };
      }
      return segment;
    }));
  };

  const handleAddSegment = () => {
    const newSegment = {
      id: Date.now(),
      checkIn: '',
      checkOut: '',
      requiredGuests: 1,
      requiredTags: [],
      serviceType: 'con_desayuno'
    };
    setSegments(prev => [...prev, newSegment]);
  };

  const handleRemoveSegment = (segmentId) => {
    if (segments.length > 1) {
      setSegments(prev => prev.filter(segment => segment.id !== segmentId));
    }
  };

  // Función para calcular el total
  const calculateTotal = () => {
    if (!dailyRates.length) return 0;
    
    return dailyRates.reduce((total, rate) => {
      if (rate.noRatesAvailable) return total;
      return total + (rate.price || 0);
    }, 0);
  };

  // Función para obtener las fechas globales
  const getGlobalDates = () => {
    if (segments.length === 0) return 'Sin fechas';
    
    const checkIns = segments.map(s => s.checkIn).filter(date => date);
    const checkOuts = segments.map(s => s.checkOut).filter(date => date);
    
    if (checkIns.length === 0 || checkOuts.length === 0) {
      return 'Fechas incompletas';
    }
    
    const globalCheckIn = checkIns.sort()[0]; // Primera fecha de entrada
    const globalCheckOut = checkOuts.sort().reverse()[0]; // Última fecha de salida
    
    // Formatear fechas con barras en lugar de guiones
    const formatDate = (dateStr) => {
      return dateStr.replace(/-/g, '/');
    };
    
    return `${formatDate(globalCheckIn)} / ${formatDate(globalCheckOut)}`;
  };

  // Función para obtener el nombre del huésped
  const getGuestName = () => {
    const firstName = formData.mainClient.firstName || '';
    const lastName = formData.mainClient.lastName || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return 'Huésped';
  };



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
          baseRate: 100, // Tarifa base por defecto - esto debería calcularse dinámicamente
          guestCount: segment.requiredGuests
        })),
        status: 'pendiente',
        notes: '',
        isMultiRoom: false
      };

      console.log('Datos de reserva a enviar:', reservationData);

      // Crear la reserva en el backend
      console.log('Enviando reserva a:', `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/reservations/multi-segment`);
      console.log('Datos completos de la reserva:', JSON.stringify(reservationData, null, 2));
      
      const newReservation = await createReservation(reservationData);
      
      console.log('Reserva creada:', newReservation);
      
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
      serviceType: 'con_desayuno'
    });
    setSegments([
      {
        id: 1,
        checkIn: '',
        checkOut: '',
        requiredGuests: 1,
        requiredTags: [],
        serviceType: 'con_desayuno'
      }
    ]);
    setSelectedRoom(null);
    setSelectedRoomType(null);
    setDailyRates([]);
    setSearchTerm('');
    setShowNewClientForm(false);
  };

  return (
    <div className={styles.newLayout}>
      {/* 1. Cliente Principal */}
      <div className={styles.clientSection}>
        <div className={styles.sectionHeader}>
          <h2>👤 Cliente Principal</h2>
        </div>
        
        <div className={styles.clientContent}>
          <div className={styles.formGroup}>
            <label>Cliente Principal</label>
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
            ) : (
              <div className={styles.clientSelector}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onBlur={() => setTimeout(() => setSearchTerm(''), 200)}
                  placeholder="Buscar por nombre, email o teléfono..."
                />
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
                {!searchTerm && !formData.mainClient.id && (
                  <button 
                    type="button" 
                    onClick={() => setShowNewClientForm(true)}
                    className={styles.addNewClientButton}
                  >
                    + Nuevo Cliente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* 2. Pestañas de Bloques de Estadía */}
      <div className={styles.tabsContainer}>
        {/* Pestañas */}
        <div className={styles.tabsHeader}>
          {segments.map((block, index) => (
            <button
              key={block.id}
              className={`${styles.tab} ${activeBlockIndex === index ? styles.tabActive : ''}`}
              onClick={() => setActiveBlockIndex(index)}
            >
              <span className={styles.tabTitle}>
                {format(new Date(block.checkIn), 'dd/MM')} – {format(new Date(block.checkOut), 'dd/MM')}
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
            title="Agregar Bloque"
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
                    value={segments[activeBlockIndex]?.serviceType || 'con_desayuno'}
                    onChange={(e) => segments[activeBlockIndex] && handleSegmentChange(segments[activeBlockIndex].id, 'serviceType', e.target.value)}
                  >
                    <option value="sin_desayuno">Solo Alojamiento</option>
                    <option value="con_desayuno">Desayuno</option>
                    <option value="media_pension">Media Pensión</option>
                    <option value="pension_completa">Pensión Completa</option>
                  </select>
                </div>
              </div>

              {/* Requisitos Especiales (expandible) */}
              <div className={styles.formGroup}>
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
                      <div className={styles.tagsContainer}>
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            className={`${styles.tagButton} ${
                              segments[activeBlockIndex]?.requiredTags.includes(tag.id) ? styles.tagSelected : ''
                            }`}
                            onClick={() => segments[activeBlockIndex] && handleSegmentTagToggle(segments[activeBlockIndex].id, tag.id)}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de búsqueda */}
              <div className={styles.formGroup}>
                <button 
                  type="button" 
                  className={styles.searchButton}
                  onClick={() => searchAvailableRooms()}
                  disabled={!segments[activeBlockIndex]?.checkIn || !segments[activeBlockIndex]?.checkOut}
                >
                  🔍 Buscar Habitaciones para este Bloque
                </button>
              </div>
            </div>

            {/* Habitaciones Disponibles dentro de la pestaña */}
            <div className={styles.roomsSection}>
              <div className={styles.sectionHeader}>
                <h3>🏨 Habitaciones Disponibles</h3>
              </div>
              
              {/* Alerta si hay problemas con las tarifas */}
              {pricingError && (
                <div className={styles.alertWarning}>
                  ⚠️ <strong>Precios no configurados:</strong> {pricingError} 
                  Las habitaciones se muestran con tarifa $0. 
                  <strong>No se pueden generar reservas sin precios válidos.</strong> Por favor, configure los precios en el sistema de gestión.
                </div>
              )}
              
              {loadingRooms ? (
                <div className={styles.loading}>
                  🔍 Buscando habitaciones disponibles...
                </div>
              ) : availableRooms.length === 0 ? (
                <div className={styles.noRooms}>
                  <p>No se encontraron habitaciones disponibles para los criterios especificados.</p>
                  <p>Intenta con otras fechas o una cantidad diferente de huéspedes.</p>
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
                                {dailyRates.map((rate, index) => (
                                  <div key={index} className={styles.dailyRateRow}>
                                    <span>{format(new Date(rate.date), 'dd/MM/yyyy')}</span>
                                    <span>${new Intl.NumberFormat('es-AR').format(rate.amount)}</span>
                                  </div>
                                ))}
                              </div>
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

      {/* 4. Resumen Global (sección fija abajo) */}
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
                      {selectedRoom.name} | {format(new Date(block.checkIn), 'dd/MM')} – {format(new Date(block.checkOut), 'dd/MM')} | {block.serviceType} | ${new Intl.NumberFormat('es-AR').format(selectedRoom.baseRate || 0)}
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
                className={styles.draftButton}
                onClick={handleSaveQuery}
              >
                💾 Guardar Borrador
              </button>
              
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
    </div>
  );
}
