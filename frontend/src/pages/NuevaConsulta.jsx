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
    requiredTags: []
  });

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
  const [roomTypes, setRoomTypes] = useState([]);
  const [dailyRates, setDailyRates] = useState([]);

  // Estado para errores
  const [errors, setErrors] = useState({});

  // Obtener las funciones de limpieza del localStorage
  const [, , clearFormData] = useLocalStorage('nuevaConsulta_formData', {});
  const [, , clearRequirements] = useLocalStorage('nuevaConsulta_requirements', {});

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

  // Cargar clientes al montar el componente
  useEffect(() => {
    loadClients();
    loadRoomTypes();
  }, []);

  // Buscar habitaciones disponibles cuando cambien las fechas, huéspedes o etiquetas
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && requirements.requiredGuests) {
      searchAvailableRooms();
    }
  }, [formData.checkIn, formData.checkOut, requirements.requiredGuests, requirements.requiredTags]);

  // Seleccionar tipo de habitación por defecto cuando se carguen los tipos o cambien los huéspedes
  useEffect(() => {
    if (roomTypes.length > 0 && availableRooms.length > 0) {
      // Buscar el primer tipo de habitación con capacidad exacta
      const exactCapacityRoom = availableRooms.find(room => room.maxPeople === requirements.requiredGuests);
      
      if (exactCapacityRoom) {
        // Si hay habitación con capacidad exacta, seleccionar ese tipo
        const roomType = roomTypes.find(rt => rt.id === exactCapacityRoom.roomType.id);
        if (roomType && (!selectedRoomType || selectedRoomType.id !== roomType.id)) {
          setSelectedRoomType(roomType);
        }
      } else if (!selectedRoomType) {
        // Si no hay capacidad exacta, seleccionar el primer tipo disponible
        const firstAvailableType = roomTypes.find(rt => 
          availableRooms.some(room => room.roomType.id === rt.id)
        );
        if (firstAvailableType) {
          setSelectedRoomType(firstAvailableType);
        }
      }
    }
  }, [roomTypes, availableRooms, requirements.requiredGuests, selectedRoomType]);

  // Cargar tarifas por día cuando cambien las fechas o el tipo de habitación seleccionado
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && selectedRoomType) {
      loadDailyRates();
    }
  }, [formData.checkIn, formData.checkOut, selectedRoomType]);

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

  // Función para limpiar todos los datos guardados
  const clearAllSavedData = () => {
    clearFormData();
    clearRequirements();
    setSearchTerm('');
    setShowNewClientForm(false);
    setAvailableRooms([]);
    setSelectedRoomType(null);
    setDailyRates([]);
    setErrors({});
  };

  // Función para obtener los servicios habilitados del primer día (para generar columnas)
  const getEnabledServices = () => {
    if (dailyRates.length === 0) return [];
    
    // Obtener el primer día que tenga datos
    const firstDayWithData = dailyRates.find(rate => !rate.noRatesAvailable);
    if (!firstDayWithData) return [];
    
    // Obtener todas las claves excepto las que no son servicios
    const excludeKeys = ['date', 'blockName', 'noRatesAvailable'];
    const serviceKeys = Object.keys(firstDayWithData).filter(key => !excludeKeys.includes(key));
    
    // Si hay tanto 'baseRate' como 'Tarifa base', remover 'baseRate' para evitar duplicación
    if (serviceKeys.includes('baseRate') && serviceKeys.includes('Tarifa base')) {
      return serviceKeys.filter(key => key !== 'baseRate');
    }
    
    return serviceKeys;
  };

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

  const loadRoomTypes = async () => {
    try {
      const response = await fetch('/api/room-types');
      if (response.ok) {
        const data = await response.json();
        setRoomTypes(data);
      } else {
        console.error('Error en respuesta de room-types:', response.status);
      }
    } catch (error) {
      console.error('Error loading room types:', error);
    }
  };

  const loadDailyRates = async () => {
    if (!selectedRoomType || !formData.checkIn || !formData.checkOut) return;

    try {
      // Calcular días entre check-in y check-out
      const startDate = new Date(formData.checkIn);
      const endDate = new Date(formData.checkOut);
      const days = [];
      
      for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      const rates = [];
      
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
              
              // Obtener todos los servicios habilitados del bloque
              const enabledServices = serviceAdjustments.filter(selection => selection.isEnabled);
              
              // Crear objeto con precios para todos los servicios
              const servicePrices = {};
              
              // Agregar precio base
              const basePrice = roomTypePrices.find(price => 
                !price.serviceType || price.serviceType.name === 'Tarifa base'
              ) || roomTypePrices[0];
              
              // Solo agregar baseRate si no hay un servicio llamado "Tarifa base"
              const hasTarifaBaseService = enabledServices.some(service => 
                service.serviceType.name === 'Tarifa base'
              );
              
              if (!hasTarifaBaseService) {
                servicePrices.baseRate = Math.round(basePrice.basePrice);
              }
              
              // Agregar precios para cada servicio habilitado
              enabledServices.forEach(serviceSelection => {
                const serviceName = serviceSelection.serviceType.name;
                const servicePrice = roomTypePrices.find(price => 
                  price.serviceType && price.serviceType.name === serviceName
                );
                
                if (servicePrice) {
                  const adjustment = serviceSelection.percentageAdjustment || 0;
                  const adjustedPrice = servicePrice.basePrice * (1 + adjustment / 100);
                  servicePrices[serviceName] = Math.round(adjustedPrice);
                } else {
                  // Si no hay precio específico para el servicio, usar precio base
                  const adjustment = serviceSelection.percentageAdjustment || 0;
                  const adjustedPrice = basePrice.basePrice * (1 + adjustment / 100);
                  servicePrices[serviceName] = Math.round(adjustedPrice);
                }
              });
              
              rates.push({
                date: dateStr,
                blockName: seasonBlockData.seasonBlock.name,
                ...servicePrices
              });
            } else {
              rates.push({
                date: dateStr,
                baseRate: 0,
                withBreakfast: 0,
                withHalfBoard: 0,
                serviceType: 'Sin tarifa',
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
                  
                  // Obtener todos los servicios habilitados del bloque
                  const enabledServices = serviceAdjustments.filter(selection => selection.isEnabled);
                  
                  // Crear objeto con precios para todos los servicios
                  const servicePrices = {};
                  
                  // Agregar precio base
                  const basePrice = roomTypePrices.find(price => 
                    !price.serviceType || price.serviceType.name === 'Tarifa base'
                  ) || roomTypePrices[0];
                  
                  // Solo agregar baseRate si no hay un servicio llamado "Tarifa base"
                  const hasTarifaBaseService = enabledServices.some(service => 
                    service.serviceType.name === 'Tarifa base'
                  );
                  
                  if (!hasTarifaBaseService) {
                    servicePrices.baseRate = Math.round(basePrice.basePrice);
                  }
                  
                  // Agregar precios para cada servicio habilitado
                  enabledServices.forEach(serviceSelection => {
                    const serviceName = serviceSelection.serviceType.name;
                    const servicePrice = roomTypePrices.find(price => 
                      price.serviceType && price.serviceType.name === serviceName
                    );
                    
                    if (servicePrice) {
                      const adjustment = serviceSelection.percentageAdjustment || 0;
                      const adjustedPrice = servicePrice.basePrice * (1 + adjustment / 100);
                      servicePrices[serviceName] = Math.round(adjustedPrice);
                    } else {
                      // Si no hay precio específico para el servicio, usar precio base
                      const adjustment = serviceSelection.percentageAdjustment || 0;
                      const adjustedPrice = basePrice.basePrice * (1 + adjustment / 100);
                      servicePrices[serviceName] = Math.round(adjustedPrice);
                    }
                  });
                  
                  rates.push({
                    date: dateStr,
                    blockName: draftBlockData.data.name,
                    ...servicePrices
                  });
                } else {
                  rates.push({
                    date: dateStr,
                    blockName: 'Sin bloque',
                    baseRate: 0,
                    noRatesAvailable: true
                  });
                }
              } else {
                rates.push({
                  date: dateStr,
                  blockName: 'Sin bloque',
                  baseRate: 0,
                  noRatesAvailable: true
                });
              }
            } else {
              rates.push({
                date: dateStr,
                blockName: 'Sin bloque',
                baseRate: 0,
                noRatesAvailable: true
              });
            }
          } else {
            rates.push({
              date: dateStr,
              blockName: 'Sin bloque',
              baseRate: 0,
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

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [field]: value
      };
      
      // Si se está cambiando la fecha de entrada y es posterior a la fecha de salida
      if (field === 'checkIn' && value && prev.checkOut) {
        const checkInDate = new Date(value);
        const checkOutDate = new Date(prev.checkOut);
        
        // Si la fecha de entrada es posterior a la fecha de salida
        if (checkInDate > checkOutDate) {
          // Calcular la fecha de salida como el día siguiente a la entrada
          const nextDay = new Date(checkInDate);
          nextDay.setDate(nextDay.getDate() + 1);
          newFormData.checkOut = nextDay.toISOString().split('T')[0];
        }
      }
      
      return newFormData;
    });
    
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    const newErrors = {};
    
    if (!formData.checkIn) newErrors.checkIn = 'La fecha de entrada es requerida';
    if (!formData.checkOut) newErrors.checkOut = 'La fecha de salida es requerida';
    if (!requirements.requiredGuests) newErrors.requiredGuests = 'La cantidad de huéspedes es requerida';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    console.log('Datos de la consulta:', formData);
    console.log('Habitaciones disponibles:', availableRooms);
    
    // Por ahora, solo mostrar un mensaje
    alert('Consulta enviada correctamente');
  };



  const getMatchingTags = (room) => {
    if (!room.tags || room.tags.length === 0) return [];
    return room.tags.map(tag => tag.name);
  };

  return (
    <div className={`${styles.container} page-content`}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>Nueva Consulta</h1>
            <p>Completa los datos de la consulta y visualiza las tarifas disponibles</p>
          </div>
          <button
            type="button"
            onClick={clearAllSavedData}
            className={styles.clearButton}
            title="Limpiar todos los datos guardados"
          >
            🗑️ Limpiar Datos
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Formulario de consulta */}
        <div className={styles.formSection}>
          <h2>Datos de la Consulta</h2>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Fechas y huéspedes */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="checkIn">Fecha de Entrada *</label>
                <input
                  type="date"
                  id="checkIn"
                  value={formData.checkIn}
                  onChange={(e) => handleInputChange('checkIn', e.target.value)}
                  className={errors.checkIn ? styles.error : ''}
                />
                {errors.checkIn && <span className={styles.errorText}>{errors.checkIn}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="checkOut">Fecha de Salida *</label>
                <input
                  type="date"
                  id="checkOut"
                  value={formData.checkOut}
                  onChange={(e) => handleInputChange('checkOut', e.target.value)}
                  className={errors.checkOut ? styles.error : ''}
                />
                {errors.checkOut && <span className={styles.errorText}>{errors.checkOut}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="requiredGuests">Cantidad de Huéspedes *</label>
                <input
                  type="number"
                  id="requiredGuests"
                  min="1"
                  max="10"
                  value={requirements.requiredGuests}
                  onChange={(e) => setRequirements(prev => ({ ...prev, requiredGuests: parseInt(e.target.value) }))}
                  className={errors.requiredGuests ? styles.error : ''}
                />
                {errors.requiredGuests && <span className={styles.errorText}>{errors.requiredGuests}</span>}
              </div>
            </div>

            {/* Selección de Etiquetas */}
            <div className={styles.section}>
              <h3>Etiquetas Requeridas (Opcional)</h3>
              <p style={{
                margin: '0 0 16px 0',
                fontSize: 'var(--font-size-small)',
                color: 'var(--color-text-muted)'
              }}>
                Selecciona las etiquetas que deben tener las habitaciones para filtrar los resultados
              </p>
              
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const newTags = requirements.requiredTags.includes(tag.id.toString())
                        ? requirements.requiredTags.filter(id => id !== tag.id.toString())
                        : [...requirements.requiredTags, tag.id.toString()];
                      
                      setRequirements(prev => ({
                        ...prev,
                        requiredTags: newTags
                      }));
                    }}
                    style={{
                      padding: '8px 12px',
                      border: requirements.requiredTags.includes(tag.id.toString())
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      borderRadius: '16px',
                      backgroundColor: requirements.requiredTags.includes(tag.id.toString())
                        ? tag.color
                        : 'var(--color-bg-white)',
                      color: requirements.requiredTags.includes(tag.id.toString())
                        ? 'var(--color-text-light)'
                        : 'var(--color-text-main)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-medium)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              
              {requirements.requiredTags.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: '6px',
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--color-text-muted)'
                }}>
                  <strong>Etiquetas seleccionadas:</strong> {requirements.requiredTags.length}
                </div>
              )}
            </div>

            {/* Cliente */}
            <div className={styles.section}>
              <h3>Cliente Principal (Opcional)</h3>
              
              {showNewClientForm ? (
                <>
                  <div className={styles.newClientHeader}>
                    <h4>Nuevo Cliente</h4>
                    <button
                      type="button"
                      className={styles.backButton}
                      onClick={handleNewSearch}
                    >
                      ← Volver a buscar
                    </button>
                  </div>
                  
                  <div className={styles.nameGroup}>
                    <div className={styles.field}>
                      <label>Nombre *</label>
                      <input
                        type="text"
                        value={formData.mainClient.firstName}
                        onChange={(e) => handleClientInputChange('firstName', e.target.value)}
                        placeholder="Nombre"
                      />
                    </div>
                    
                    <div className={styles.field}>
                      <label>Apellido *</label>
                      <input
                        type="text"
                        value={formData.mainClient.lastName}
                        onChange={(e) => handleClientInputChange('lastName', e.target.value)}
                        placeholder="Apellido"
                      />
                    </div>
                  </div>
                  
                  <div className={styles.row}>
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
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.searchSection}>
                    <div className={styles.field}>
                      <label>Buscar Cliente Existente</label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                      className={styles.newClientButton}
                      onClick={() => setShowNewClientForm(true)}
                    >
                      + Crear Nuevo Cliente
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Botón de envío */}
            <button type="submit" className={styles.submitButton}>
              Crear Consulta
            </button>
          </form>
        </div>

        {/* Habitaciones disponibles */}
        <div className={styles.previewSection}>
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
            <div style={{ 
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                maxHeight: '400px'
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: 'var(--font-size-medium)'
                }}>
                  <thead>
                    <tr style={{ 
                      backgroundColor: '#f8f9fa',
                      borderBottom: '2px solid #dee2e6',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <th style={{ 
                        padding: '16px', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        fontSize: 'var(--font-size-medium)',
                        minWidth: '150px'
                      }}>
                        Habitación
                      </th>
                      <th style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        fontWeight: '600', 
                        color: '#495057',
                        fontSize: 'var(--font-size-medium)',
                        minWidth: '120px'
                      }}>
                        Tipo
                      </th>
                      <th style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        fontWeight: '600', 
                        color: '#495057',
                        fontSize: 'var(--font-size-medium)',
                        minWidth: '100px'
                      }}>
                        Capacidad
                      </th>
                      <th style={{ 
                        padding: '16px', 
                        textAlign: 'center', 
                        fontWeight: '600', 
                        color: '#495057',
                        fontSize: 'var(--font-size-medium)',
                        minWidth: '120px'
                      }}>
                        Etiquetas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableRooms.map((room) => {
                      const matchingTags = getMatchingTags(room);
                      
                      return (
                        <tr key={room.id} style={{ 
                          borderBottom: '1px solid #e9ecef',
                          backgroundColor: matchingTags.length > 0 ? '#f8fff8' : 'white'
                        }}>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'left', 
                            fontWeight: '500', 
                            color: '#495057',
                            fontSize: 'var(--font-size-medium)'
                          }}>
                            <strong>{room.name}</strong>
                            {room.description && (
                              <div style={{ 
                                fontSize: 'var(--font-size-small)', 
                                color: '#6c757d',
                                marginTop: '4px'
                              }}>
                                {room.description}
                              </div>
                            )}
                          </td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'center',
                            color: '#495057',
                            fontSize: 'var(--font-size-medium)'
                          }}>
                            {room.roomType?.name}
                          </td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'center',
                            color: '#495057',
                            fontSize: 'var(--font-size-medium)'
                          }}>
                            <span style={{
                              backgroundColor: room.maxPeople === requirements.requiredGuests ? '#d4edda' : '#fff3cd',
                              color: room.maxPeople === requirements.requiredGuests ? '#155724' : '#856404',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: 'var(--font-size-small)',
                              fontWeight: '500'
                            }}>
                              {room.maxPeople} pers.
                            </span>
                          </td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'center',
                            color: '#495057',
                            fontSize: 'var(--font-size-small)'
                          }}>
                            {matchingTags.length > 0 ? (
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                {matchingTags.map(tagName => (
                                  <span key={tagName} style={{
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: 'var(--font-size-small)'
                                  }}>
                                    {tagName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#6c757d' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Tarifas por día */}
        <div className={styles.previewSection}>
          <h2>Tarifas por Día</h2>
          
          {!formData.checkIn || !formData.checkOut ? (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              Selecciona las fechas de entrada y salida para ver las tarifas
            </div>
          ) : availableRooms.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              No hay habitaciones disponibles para las fechas seleccionadas
            </div>
          ) : !selectedRoomType ? (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              Cargando tipos de habitación...
            </div>
          ) : (
            <>
              {/* Selector de tipo de habitación */}
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#495057'
                }}>
                  Tipo de Habitación:
                </label>
                <select
                  value={selectedRoomType?.id || ''}
                  onChange={(e) => {
                    const roomType = roomTypes.find(rt => rt.id === parseInt(e.target.value));
                    setSelectedRoomType(roomType);
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: 'var(--font-size-medium)',
                    minWidth: '200px'
                  }}
                >
                  {roomTypes
                    .filter(roomType => availableRooms.some(room => room.roomType.id === roomType.id))
                    .map(roomType => {
                      const roomsOfThisType = availableRooms.filter(room => room.roomType.id === roomType.id);
                      const hasExactCapacity = roomsOfThisType.some(room => room.maxPeople === requirements.requiredGuests);
                      const capacityText = hasExactCapacity ? ' (Capacidad exacta)' : ' (Mayor capacidad)';
                      
                      return (
                        <option key={roomType.id} value={roomType.id}>
                          {roomType.name}{capacityText}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Tabla de tarifas por día */}
              {dailyRates.length === 0 ? (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#6c757d'
                }}>
                  No hay tarifas disponibles para las fechas seleccionadas
                </div>
              ) : (
                <div style={{ 
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    flex: 1, 
                    overflowX: 'auto',
                    maxHeight: '400px'
                  }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: 'var(--font-size-medium)'
                    }}>
                      <thead>
                        <tr style={{ 
                          backgroundColor: '#f8f9fa',
                          borderBottom: '2px solid #dee2e6',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10
                        }}>
                          <th style={{ 
                            padding: '16px', 
                            textAlign: 'center', 
                            fontWeight: '600', 
                            color: '#495057',
                            fontSize: 'var(--font-size-medium)',
                            minWidth: '120px'
                          }}>
                            Fecha
                          </th>
                          <th style={{ 
                            padding: '16px', 
                            textAlign: 'center', 
                            fontWeight: '600', 
                            color: '#495057',
                            fontSize: 'var(--font-size-medium)',
                            minWidth: '150px'
                          }}>
                            Bloque
                          </th>
                          {getEnabledServices().map(serviceName => (
                            <th key={serviceName} style={{ 
                              padding: '16px', 
                              textAlign: 'center', 
                              fontWeight: '600', 
                              color: '#495057',
                              fontSize: 'var(--font-size-medium)',
                              minWidth: '140px'
                            }}>
                              {serviceName === 'baseRate' ? 'Precio Base' : serviceName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRates.map((rate, index) => (
                          <tr key={index} style={{ 
                            borderBottom: '1px solid #e9ecef',
                            backgroundColor: rate.noRatesAvailable ? '#f8d7da' : 'white'
                          }}>
                            <td style={{ 
                              padding: '16px', 
                              textAlign: 'center',
                              color: '#495057',
                              fontSize: 'var(--font-size-medium)',
                              fontWeight: '500'
                            }}>
                              {new Date(rate.date).toLocaleDateString('es-AR', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td style={{ 
                              padding: '16px', 
                              textAlign: 'center',
                              color: rate.noRatesAvailable ? '#dc3545' : '#495057',
                              fontSize: 'var(--font-size-small)',
                              fontWeight: '500'
                            }}>
                              {rate.blockName || 'Sin bloque'}
                            </td>
                            {getEnabledServices().map(serviceName => (
                              <td key={serviceName} style={{ 
                                padding: '16px', 
                                textAlign: 'center',
                                color: rate.noRatesAvailable ? '#dc3545' : '#495057',
                                fontSize: 'var(--font-size-medium)',
                                fontWeight: '600'
                              }}>
                                {rate.noRatesAvailable ? (
                                  <span style={{ color: '#dc3545' }}>Sin tarifa</span>
                                ) : (
                                  new Intl.NumberFormat('es-AR', {
                                    style: 'currency',
                                    currency: 'ARS'
                                  }).format(rate[serviceName] || 0)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 