import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchClients, findAvailableRooms } from '../services/api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTags } from '../hooks/useTags';
import styles from '../styles/NuevaConsulta.module.css';

export default function NuevaConsulta() {
  const location = useLocation();
  const { tags } = useTags();

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
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Estado para tarifas por día
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [dailyRates, setDailyRates] = useState([]);
  
  // Estado para habitación seleccionada
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Estado para errores




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

  // Cargar clientes al montar el componente
  useEffect(() => {
    loadClients();
  }, []);

  // Buscar habitaciones disponibles cuando cambien las fechas, huéspedes o etiquetas
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && requirements.requiredGuests) {
      searchAvailableRooms();
    }
  }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags]);

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
    setLoadingRooms(true);
    try {
      const params = {
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        requiredGuests: requirements.requiredGuests,
        requiredTags: requirements.requiredTags
      };

      console.log('Buscando habitaciones con parámetros:', params);
      const result = await findAvailableRooms(params);
      console.log('Resultado de búsqueda de habitaciones:', result);
      
      if (result && result.availableRooms) {
        console.log(`Encontradas ${result.availableRooms.length} habitaciones disponibles`);
        
        // Filtrar habitaciones: primero capacidad exacta, luego mayor capacidad
        const exactCapacityRooms = result.availableRooms.filter(room => room.maxPeople === requirements.requiredGuests);
        const largerCapacityRooms = result.availableRooms.filter(room => room.maxPeople > requirements.requiredGuests);
        
        // Determinar qué habitaciones mostrar
        let roomsToShow = [];
        
        if (exactCapacityRooms.length > 0) {
          // Si hay habitaciones con capacidad exacta, mostrar solo esas
          roomsToShow = exactCapacityRooms;
        } else if (largerCapacityRooms.length > 0) {
          // Si no hay capacidad exacta pero sí mayor capacidad, mostrar esas
          roomsToShow = largerCapacityRooms;
        }
        
        setAvailableRooms(roomsToShow);
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
        
        // Obtener bloque activo para esta fecha
        const seasonBlockResponse = await fetch(`/api/season-blocks/active?hotelId=default-hotel&date=${dateStr}`);
        
        if (seasonBlockResponse.ok) {
          const seasonBlockData = await seasonBlockResponse.json();
          
          if (seasonBlockData.seasonBlock && seasonBlockData.seasonBlock.seasonPrices) {
            // Buscar precios para este tipo de habitación
            const roomTypePrices = seasonBlockData.seasonBlock.seasonPrices.filter(
              price => price.roomTypeId === selectedRoomType.id
            );
            
            if (roomTypePrices.length > 0) {
              // Obtener ajustes de porcentaje del bloque
              const serviceAdjustments = seasonBlockData.seasonBlock.blockServiceSelections || [];
              
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
          const errorData = await seasonBlockResponse.json();
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

    console.log('Datos de la consulta:', segments);
    console.log('Habitación seleccionada:', selectedRoom);
    console.log('Habitaciones disponibles:', availableRooms);
    
    // Aquí se abriría el modal de selección de habitaciones para crear la reserva
    // Por ahora, mostrar un mensaje con la habitación seleccionada
    alert(`🏨 Funcionalidad de reserva: Se procederá a crear la reserva para la habitación ${selectedRoom.name} (${selectedRoom.roomType?.name}).`);
  };





  const checkRequirementsCompliance = (room) => {
    // Obtener todas las etiquetas requeridas de todos los segmentos
    const allRequiredTagIds = segments.flatMap(segment => segment.requiredTags);
    
    if (allRequiredTagIds.length === 0) {
      return { complies: true, message: 'No hay etiquetas requeridas', score: 0 };
    }
    
    // Obtener las etiquetas de la habitación
    const roomTagIds = room.tags ? room.tags.map(tag => tag.id) : [];
    
    // Verificar si la habitación tiene todas las etiquetas requeridas
    const missingTags = allRequiredTagIds.filter(tagId => !roomTagIds.includes(tagId));
    const matchingTags = room.tags.filter(tag => allRequiredTagIds.includes(tag.id));
    
    const complianceScore = matchingTags.length / allRequiredTagIds.length;
    
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
    setSegments(prev => prev.map(segment => 
      segment.id === segmentId ? { ...segment, [field]: value } : segment
    ));
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
    if (segments.length === 0) return { checkIn: '', checkOut: '' };
    
    const checkIns = segments.map(s => s.checkIn).filter(date => date);
    const checkOuts = segments.map(s => s.checkOut).filter(date => date);
    
    if (checkIns.length === 0 || checkOuts.length === 0) {
      return { checkIn: '', checkOut: '' };
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

  return (
    <div className={styles.newLayout}>
      {/* Side Panel */}
      <div className={styles.sidePanel}>
        {/* Header del side panel */}
        <div className={styles.sidePanelHeader}>
          <h2>Consulta</h2>
          <div className={styles.guestInfo}>
            <div className={styles.guestName}>{getGuestName()}</div>
            <div className={styles.guestDates}>{getGlobalDates()}</div>
                </div>
            </div>

        {/* Contenido del side panel */}
        <div className={styles.sidePanelContent}>
          <form onSubmit={handleSubmit}>
            {/* Cliente principal */}
            <div className={styles.field}>
              <label>Cliente Principal</label>
              
              {showNewClientForm ? (
                <>
                    <div className={styles.field}>
                    <label>Nombre</label>
                      <input
                        type="text"
                        value={formData.mainClient.firstName}
                        onChange={(e) => handleClientInputChange('firstName', e.target.value)}
                        placeholder="Nombre"
                      required
                      />
                    </div>
                    
                    <div className={styles.field}>
                    <label>Apellido</label>
                      <input
                        type="text"
                        value={formData.mainClient.lastName}
                        onChange={(e) => handleClientInputChange('lastName', e.target.value)}
                        placeholder="Apellido"
                      required
                      />
                  </div>
                  
                    <div className={styles.field}>
                      <label>Email</label>
                      <input
                        type="email"
                        value={formData.mainClient.email}
                        onChange={(e) => handleClientInputChange('email', e.target.value)}
                        placeholder="email@ejemplo.com"
                      />
                    </div>
                    
                    <div className={styles.field}>
                      <label>Teléfono</label>
                      <input
                        type="tel"
                        value={formData.mainClient.phone}
                        onChange={(e) => handleClientInputChange('phone', e.target.value)}
                        placeholder="+54 9 11 1234-5678"
                      />
                    </div>
                  
                  <div className={styles.newClientButtons}>
                    <button
                      type="button"
                      className={styles.saveClientButton}
                      onClick={handleSaveNewClient}
                    >
                      💾 Guardar Cliente
                    </button>
                    <button
                      type="button"
                      className={styles.cancelClientButton}
                      onClick={handleNewSearch}
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                    <div className={styles.field}>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      onBlur={() => setTimeout(() => setSearchTerm(''), 200)}
                        placeholder="Buscar por nombre, email o teléfono..."
                      />
                    </div>
                    
                    {searchTerm && (
                      <div className={styles.clientResults}>
                        {filteredClients.map(client => (
                          <div
                            key={client.id}
                            className={styles.clientOption}
                            onClick={() => handleClientSelect(client)}
                          >
                            <strong>{client.firstName} {client.lastName}</strong>
                            {client.email && <div>{client.email}</div>}
                            {client.phone && <div>{client.phone}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      type="button"
                    className={styles.addSegmentButton}
                      onClick={() => setShowNewClientForm(true)}
                    >
                      + Crear Nuevo Cliente
                    </button>
                </>
              )}
            </div>

            {/* Segmentos */}
            <div className={styles.segmentsSection}>
              {segments.map((segment, index) => (
                <div key={segment.id} className={styles.segment}>
                  <div className={styles.segmentTitle}>
                    {segments.length > 1 ? `Segmento ${index + 1}` : 'Requerimientos'}
                  </div>
                  
                  {segments.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeSegmentButton}
                      onClick={() => handleRemoveSegment(segment.id)}
                    >
                      ×
            </button>
                  )}

                  {/* Fechas del segmento */}
                  <div className={styles.segmentDates}>
                    <div className={styles.field}>
                      <label>Check-in</label>
                      <input
                        type="date"
                        value={segment.checkIn}
                        onChange={(e) => handleSegmentChange(segment.id, 'checkIn', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Check-out</label>
                      <input
                        type="date"
                        value={segment.checkOut}
                        onChange={(e) => handleSegmentChange(segment.id, 'checkOut', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Huéspedes y Tipo de servicio */}
                  <div className={styles.segmentRow}>
                    <div className={styles.field}>
                      <label>Huéspedes</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={segment.requiredGuests}
                        onChange={(e) => handleSegmentChange(segment.id, 'requiredGuests', parseInt(e.target.value))}
                        required
                      />
                    </div>

                    <div className={styles.field}>
                      <label>Tipo de Servicio</label>
                      <select
                        value={segment.serviceType}
                        onChange={(e) => handleSegmentChange(segment.id, 'serviceType', e.target.value)}
                      >
                        <option value="con_desayuno">Con Desayuno</option>
                        <option value="sin_desayuno">Sin Desayuno</option>
                        <option value="media_pension">Media Pensión</option>
                        <option value="pension_completa">Pensión Completa</option>
                      </select>
                    </div>
                  </div>

                  {/* Etiquetas requeridas */}
                  <div className={styles.field}>
                    <label>Etiquetas Requeridas</label>
                    <div className={styles.tagsContainer}>
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          className={`${styles.tagButton} ${
                            segment.requiredTags.includes(tag.id) ? styles.tagSelected : ''
                          }`}
                          onClick={() => handleSegmentTagToggle(segment.id, tag.id)}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className={styles.addSegmentButton}
                onClick={handleAddSegment}
              >
                + Agregar Segmento
              </button>
            </div>


          </form>
        </div>

        {/* Footer con botones de acción */}
        <div className={styles.sidePanelFooter}>
          <div className={styles.actionButtons}>
            <button 
              type="button" 
              className={styles.saveButton}
              onClick={handleSaveQuery}
            >
              💾 Guardar Consulta
            </button>
            <button 
              type="submit" 
              className={styles.reserveButton}
              onClick={handleSubmit}
            >
              🏨 Reservar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Habitaciones disponibles */}
          <h2>Habitaciones Disponibles</h2>
          
          {loadingRooms ? (
            <div className={styles.loading}>
              Buscando habitaciones disponibles...
            </div>
          ) : availableRooms.length === 0 ? (
            <div className={styles.noRooms}>
              <p>No se encontraron habitaciones disponibles para los criterios especificados.</p>
              <p>Intenta con otras fechas o una cantidad diferente de huéspedes.</p>
            </div>
          ) : (
          <div className={styles.tableContainer}>
            <table className={styles.roomsTable}>
                  <thead>
                <tr>
                  <th></th>
                  <th>Habitación</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Cumple con los requerimientos</th>
                    </tr>
                  </thead>
                  <tbody>
                {availableRooms
                  .map((room) => {
                    const compliance = checkRequirementsCompliance(room);
                    return { room, compliance };
                  })
                  .sort((a, b) => {
                    // Primero las que cumplen completamente
                    if (a.compliance.complies && !b.compliance.complies) return -1;
                    if (!a.compliance.complies && b.compliance.complies) return 1;
                    
                    // Luego por score de cumplimiento
                    if (a.compliance.score !== b.compliance.score) {
                      return b.compliance.score - a.compliance.score;
                    }
                    
                    // Finalmente por capacidad exacta
                    const aExactCapacity = a.room.maxPeople === requirements.requiredGuests;
                    const bExactCapacity = b.room.maxPeople === requirements.requiredGuests;
                    if (aExactCapacity && !bExactCapacity) return -1;
                    if (!aExactCapacity && bExactCapacity) return 1;
                    
                    return 0;
                  })
                  .map(({ room, compliance }) => {
                    const isSelected = selectedRoom && selectedRoom.id === room.id;
                      
                      return (
                    <tr 
                      key={room.id} 
                      className={`${styles.roomRow} ${isSelected ? styles.roomSelected : ''}`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <td>
                        <div className={styles.radioButton}>
                          <input
                            type="radio"
                            name="selectedRoom"
                            id={`room-${room.id}`}
                            checked={isSelected}
                            onChange={() => setSelectedRoom(room)}
                            style={{ display: 'none' }}
                          />
                          <label 
                            htmlFor={`room-${room.id}`}
                            className={`${styles.radioLabel} ${isSelected ? styles.radioSelected : ''}`}
                          >
                            <span className={styles.radioCircle}></span>
                          </label>
                              </div>
                          </td>
                      <td><strong>{room.name}</strong></td>
                      <td>{room.roomType?.name}</td>
                      <td>
                        <span className={`${styles.capacityBadge} ${
                          room.maxPeople === requirements.requiredGuests ? styles.capacityExact : styles.capacityLarger
                        }`}>
                              {room.maxPeople} pers.
                            </span>
                          </td>
                      <td>
                        <div className={styles.complianceIndicator} title={compliance.message}>
                          <div className={styles.complianceIcon}>
                            {compliance.complies ? (
                              <span className={styles.complianceCheck}>✓</span>
                            ) : (
                              <span className={styles.complianceX}>✗</span>
                            )}
                          </div>
                        </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          )}

        {/* Tarifas por día */}
          <h2>Tarifas por Día</h2>
          
          {!formData.checkIn || !formData.checkOut ? (
          <div className={styles.noDataMessage}>
              Selecciona las fechas de entrada y salida para ver las tarifas
            </div>
          ) : availableRooms.length === 0 ? (
          <div className={styles.noDataMessage}>
              No hay habitaciones disponibles para las fechas seleccionadas
            </div>
          ) : !selectedRoomType ? (
          <div className={styles.noDataMessage}>
              Cargando tipos de habitación...
            </div>
          ) : (
            <>
              {/* Tabla de tarifas por día */}
              {dailyRates.length === 0 ? (
              <div className={styles.noDataMessage}>
                  No hay tarifas disponibles para las fechas seleccionadas
                </div>
              ) : (
              <div className={styles.tableContainer}>
                <table className={styles.ratesTable}>
                      <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo de Habitación</th>
                      <th>Servicio</th>
                      <th>Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRates.map((rate, index) => (
                      <tr key={index} className={rate.noRatesAvailable ? styles.noRatesRow : ''}>
                        <td>
                              {new Date(rate.date).toLocaleDateString('es-AR', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                        <td className={rate.noRatesAvailable ? styles.noRatesText : ''}>
                          {selectedRoomType?.name || 'Sin tipo'}
                            </td>
                        <td className={rate.noRatesAvailable ? styles.noRatesText : ''}>
                          {rate.serviceName}
                        </td>
                        <td className={rate.noRatesAvailable ? styles.noRatesText : ''}>
                                {rate.noRatesAvailable ? (
                            <span>Sin tarifa</span>
                                ) : (
                                  new Intl.NumberFormat('es-AR', {
                                    style: 'currency',
                                    currency: 'ARS'
                            }).format(rate.price || 0)
                                )}
                              </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                
                {/* Total */}
                <div className={styles.totalSection}>
                  <div className={styles.totalRow}>
                    <span>Total:</span>
                    <span className={styles.totalAmount}>
                      {new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS'
                      }).format(calculateTotal())}
                    </span>
                  </div>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
} 