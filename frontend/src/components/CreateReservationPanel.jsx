import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import SidePanel from './SidePanel';
import ReservationRequirements from './ReservationRequirements';
import RoomSelectionModal from './RoomSelectionModal';
import LocationSelector from './LocationSelector';
import api from '../services/api';
import styles from '../styles/CreateReservationPanel.module.css';

export default function CreateReservationPanel({ 
  isOpen, 
  onClose, 
  onCreateReservation,
  operationalPeriods = []
}) {
  const [formData, setFormData] = useState({
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    reservationType: 'con_desayuno', // Tipo de servicio por defecto
    mainClient: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      documentType: 'DNI',
      documentNumber: '',
      country: 'AR',
      province: '',
      city: ''
    },
    notes: ''
  });

  const [requirements, setRequirements] = useState({
    requiredGuests: 1,
    requiredRoomId: null,
    requiredTags: [],
    requirementsNotes: ''
  });

  const [errors, setErrors] = useState({});
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isRoomSelectionModalOpen, setIsRoomSelectionModalOpen] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [hotelAvailability, setHotelAvailability] = useState(null);
  const searchInputRef = useRef(null);

  // Función para determinar si un día está en un período cerrado
  const isDayClosed = (day) => {
    if (!operationalPeriods || operationalPeriods.length === 0) {
      return false; // Si no hay períodos configurados, el hotel está siempre abierto
    }

    const dayDate = new Date(day);
    dayDate.setHours(0, 0, 0, 0);

    // Verificar si el día está dentro de algún período operacional
    for (const period of operationalPeriods) {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);

      if (dayDate >= periodStart && dayDate <= periodEnd) {
        return false; // El día está dentro de un período abierto
      }
    }

    return true; // El día no está dentro de ningún período abierto, está cerrado
  };

  // Función para verificar si hay días cerrados en el rango de fechas
  const checkClosedDaysInRange = (startDate, endDate) => {
    const closedDays = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
      if (isDayClosed(day)) {
        closedDays.push(new Date(day));
      }
    }
    
    return closedDays;
  };

  // Cargar clientes al abrir el panel
  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  // Verificar disponibilidad del hotel cuando cambian las fechas
  useEffect(() => {
    if (isOpen && formData.checkIn && formData.checkOut) {
      checkHotelAvailability();
    }
  }, [isOpen, formData.checkIn, formData.checkOut]);

  // Filtrar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients([]);
    } else {
      const filtered = clients.filter(client => 
        client.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.documentNumber?.includes(searchTerm)
      );
      
      // Ordenar por relevancia y tomar solo los primeros 5
      const sortedClients = filtered.sort((a, b) => {
        // Priorizar coincidencias exactas en nombre
        const aNameMatch = `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        const bNameMatch = `${b.firstName} ${b.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        // Si ambos coinciden en nombre, priorizar por orden alfabético
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
      
      setFilteredClients(sortedClients.slice(0, 5));
    }
  }, [searchTerm, clients]);

  // Manejar clics fuera del buscador para cerrar el desplegable
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadClients = async () => {
    try {
      setIsLoadingClients(true);
      const clientsData = await api.fetchClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleClientSelect = (client) => {
    console.log('=== handleClientSelect llamado ===');
    console.log('Cliente recibido:', client);
    console.log('Estado actual antes de actualizar:', { selectedClient, showNewClientForm });
    
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      mainClient: {
        ...client,
        id: client.id // Mantener el ID del cliente existente
      }
    }));
    setShowNewClientForm(false);
    setSearchTerm('');
    setIsSearchFocused(false);
    
    console.log('Estados actualizados, selectedClient debería ser:', client);
  };

  const handleAddNewClient = () => {
    setSelectedClient(null);
    setShowNewClientForm(true);
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        documentType: 'DNI',
        documentNumber: '',
        country: 'AR',
        province: '',
        city: ''
      }
    }));
    setIsSearchFocused(false);
  };

  const handleNewSearch = () => {
    setSelectedClient(null);
    setSearchTerm('');
    setIsSearchFocused(false);
    setShowNewClientForm(false);
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        documentType: 'DNI',
        documentNumber: '',
        country: 'AR',
        province: '',
        city: ''
      }
    }));
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsSearchFocused(true);
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const checkHotelAvailability = async () => {
    if (!formData.checkIn || !formData.checkOut) return;
    
    setIsCheckingAvailability(true);
    try {
      const response = await api.checkHotelAvailability(
        'default-hotel', // Por ahora hardcodeado
        formData.checkIn,
        formData.checkOut
      );
      setHotelAvailability(response);
    } catch (error) {
      console.error('Error al verificar disponibilidad del hotel:', error);
      setHotelAvailability({ isAvailable: false, error: 'Error al verificar disponibilidad' });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar fechas
    if (!formData.checkIn) {
      newErrors.checkIn = 'Debe seleccionar fecha de entrada';
    }
    if (!formData.checkOut) {
      newErrors.checkOut = 'Debe seleccionar fecha de salida';
    }
    if (formData.checkIn && formData.checkOut && formData.checkIn >= formData.checkOut) {
      newErrors.checkOut = 'La fecha de salida debe ser posterior a la de entrada';
    }

    // Validar que no haya días cerrados en el rango de fechas
    if (formData.checkIn && formData.checkOut) {
      const closedDays = checkClosedDaysInRange(formData.checkIn, formData.checkOut);
      if (closedDays.length > 0) {
        const closedDates = closedDays.map(day => format(day, 'dd/MM/yyyy')).join(', ');
        newErrors.closedDays = `No se pueden crear reservas en días cerrados: ${closedDates}`;
      }
    }

    // Validar disponibilidad del hotel
    if (hotelAvailability && !hotelAvailability.isAvailable) {
      newErrors.hotelAvailability = 'El hotel no está abierto en las fechas seleccionadas';
    }

    // Validar cliente
    if (!selectedClient && !showNewClientForm) {
      newErrors.client = 'Debe seleccionar un cliente o agregar uno nuevo';
    }
    
    if (showNewClientForm) {
      if (!formData.mainClient.firstName.trim()) {
        newErrors['mainClient.firstName'] = 'El nombre es obligatorio';
      }
      if (!formData.mainClient.lastName.trim()) {
        newErrors['mainClient.lastName'] = 'El apellido es obligatorio';
      }
      if (!formData.mainClient.documentNumber.trim()) {
        newErrors['mainClient.documentNumber'] = 'El número de documento es obligatorio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Abrir modal de selección de habitaciones
      setIsRoomSelectionModalOpen(true);
    }
  };

  const handleRoomSelected = (roomId, totalAmount) => {
    // Actualizar los requerimientos con la habitación seleccionada
    setRequirements(prev => ({
      ...prev,
      requiredRoomId: roomId
    }));

    // Crear la reserva con la habitación seleccionada
    const newReservation = {
      ...formData,
      roomId: roomId,
      totalAmount: totalAmount, // Guardar el monto calculado al momento de crear la reserva
      // Incluir requerimientos en la reserva
      requiredGuests: requirements.requiredGuests,
      requiredRoomId: roomId,
      requiredTags: requirements.requiredTags,
      requirementsNotes: requirements.requirementsNotes,
      id: Date.now().toString(), // ID temporal
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onCreateReservation(newReservation);
    onClose();
    
    // Resetear formulario
    resetForm();
  };

  const handleCancel = () => {
    onClose();
    resetForm();
  };

  const handleRequirementsChange = (newRequirements) => {
    setRequirements(newRequirements);
    
    // Si se asignó una habitación automáticamente, actualizar el formulario
    if (newRequirements.requiredRoomId && newRequirements.requiredRoomId !== formData.roomId) {
      setFormData(prev => ({
        ...prev,
        roomId: newRequirements.requiredRoomId
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      checkIn: format(new Date(), 'yyyy-MM-dd'),
      checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      reservationType: 'con_desayuno',
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        documentType: 'DNI',
        documentNumber: '',
        country: 'AR',
        province: '',
        city: ''
      },
      notes: ''
    });
    setRequirements({
      requiredGuests: 1,
      requiredRoomId: null,
      requiredTags: [],
      requirementsNotes: ''
    });
    setSelectedClient(null);
    setShowNewClientForm(false);
    setSearchTerm('');
    setErrors({});
    setIsRoomSelectionModalOpen(false);
    setHotelAvailability(null);
  };

  return (
    <SidePanel
      open={isOpen}
      onClose={handleCancel}
      title="Nueva Reserva"
      width={500}
    >
      <div className={styles.content}>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Información de la Reserva */}
          <div className={styles.section}>
            <h3>Información de la Reserva</h3>
            
            <div className={styles.dateGroup}>
              <div className={styles.formGroup}>
                <label htmlFor="checkIn">Fecha de Entrada *</label>
                <input
                  type="date"
                  id="checkIn"
                  value={formData.checkIn}
                  onChange={(e) => handleInputChange('checkIn', e.target.value)}
                  className={errors.checkIn ? styles.error : ''}
                  pattern="\d{2}/\d{2}/\d{4}"
                />
                {errors.checkIn && <span className={styles.errorText}>{errors.checkIn}</span>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="checkOut">Fecha de Salida *</label>
                <input
                  type="date"
                  id="checkOut"
                  value={formData.checkOut}
                  onChange={(e) => handleInputChange('checkOut', e.target.value)}
                  className={errors.checkOut ? styles.error : ''}
                  pattern="\d{2}/\d{2}/\d{4}"
                />
                {errors.checkOut && <span className={styles.errorText}>{errors.checkOut}</span>}
              </div>
            </div>

            {/* Selector de tipo de servicio */}
            <div className={styles.formGroup}>
              <label htmlFor="reservationType">Tipo de Servicio *</label>
              <select
                id="reservationType"
                value={formData.reservationType}
                onChange={(e) => handleInputChange('reservationType', e.target.value)}
                className={styles.select}
              >
                <option value="base">Solo alojamiento</option>
                <option value="con_desayuno">Con desayuno</option>
                <option value="media_pension">Media pensión</option>
              </select>
            </div>

            {/* Estado de disponibilidad del hotel */}
            {isCheckingAvailability && (
              <div className={styles.availabilityStatus}>
                <span>Verificando disponibilidad del hotel...</span>
              </div>
            )}
            
            {hotelAvailability && !isCheckingAvailability && (
              <div className={`${styles.availabilityStatus} ${hotelAvailability.isAvailable ? styles.available : styles.unavailable}`}>
                {hotelAvailability.isAvailable ? (
                  <span>✅ Hotel abierto en las fechas seleccionadas</span>
                ) : (
                  <div>
                    <span>❌ Hotel cerrado en las fechas seleccionadas</span>
                    {hotelAvailability.uncoveredRanges && hotelAvailability.uncoveredRanges.length > 0 && (
                      <div className={styles.uncoveredRanges}>
                        <small>Períodos no cubiertos:</small>
                        {hotelAvailability.uncoveredRanges.map((range, index) => (
                          <div key={index} className={styles.range}>
                            {format(new Date(range.start), 'dd/MM/yyyy')} - {format(new Date(range.end), 'dd/MM/yyyy')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.hotelAvailability && (
              <span className={styles.errorText}>{errors.hotelAvailability}</span>
            )}

            {errors.closedDays && (
              <span className={styles.errorText}>{errors.closedDays}</span>
            )}
          </div>

          {/* Requerimientos de la Reserva */}
          <ReservationRequirements
            requirements={requirements}
            onRequirementsChange={handleRequirementsChange}
          />

          {/* Información del Cliente */}
          <div className={styles.section}>
            <h3>Información del Cliente</h3>
            
            
            
            {showNewClientForm ? (
              <>
                {/* Formulario para nuevo cliente */}
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
                
                {console.log('Renderizando formulario de nuevo cliente')}
                
                <div className={styles.nameGroup}>
                  <div className={styles.formGroup}>
                    <label htmlFor="firstName">Nombre *</label>
                    <input
                      type="text"
                      id="firstName"
                      value={formData.mainClient.firstName}
                      onChange={(e) => handleInputChange('mainClient.firstName', e.target.value)}
                      className={errors['mainClient.firstName'] ? styles.error : ''}
                      placeholder="Nombre del cliente"
                    />
                    {errors['mainClient.firstName'] && <span className={styles.errorText}>{errors['mainClient.firstName']}</span>}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="lastName">Apellido *</label>
                    <input
                      type="text"
                      id="lastName"
                      value={formData.mainClient.lastName}
                      onChange={(e) => handleInputChange('mainClient.lastName', e.target.value)}
                      className={errors['mainClient.lastName'] ? styles.error : ''}
                      placeholder="Apellido del cliente"
                    />
                    {errors['mainClient.lastName'] && <span className={styles.errorText}>{errors['mainClient.lastName']}</span>}
                  </div>
                </div>

                <div className={styles.contactGroup}>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      value={formData.mainClient.email}
                      onChange={(e) => handleInputChange('mainClient.email', e.target.value)}
                      placeholder="email@ejemplo.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="phone">Teléfono</label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.mainClient.phone}
                      onChange={(e) => handleInputChange('mainClient.phone', e.target.value)}
                      placeholder="+54 9 11 1234-5678"
                    />
                  </div>
                </div>

                <div className={styles.documentGroup}>
                  <div className={styles.formGroup}>
                    <label htmlFor="documentType">Tipo de Documento</label>
                    <select
                      id="documentType"
                      value={formData.mainClient.documentType}
                      onChange={(e) => handleInputChange('mainClient.documentType', e.target.value)}
                    >
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Cédula">Cédula</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="documentNumber">Número de Documento *</label>
                    <input
                      type="text"
                      id="documentNumber"
                      value={formData.mainClient.documentNumber}
                      onChange={(e) => handleInputChange('mainClient.documentNumber', e.target.value)}
                      className={errors['mainClient.documentNumber'] ? styles.error : ''}
                      placeholder="12345678"
                    />
                    {errors['mainClient.documentNumber'] && <span className={styles.errorText}>{errors['mainClient.documentNumber']}</span>}
                  </div>
                </div>

                {/* Selector de ubicación */}
                <div className={styles.locationGroup}>
                  <h4>Ubicación</h4>
                  <LocationSelector
                    country={formData.mainClient.country}
                    province={formData.mainClient.province}
                    city={formData.mainClient.city}
                    onCountryChange={(value) => handleInputChange('mainClient.country', value)}
                    onProvinceChange={(value) => handleInputChange('mainClient.province', value)}
                    onCityChange={(value) => handleInputChange('mainClient.city', value)}
                  />
                </div>
              </>
            ) : selectedClient ? (
              <div className={styles.selectedClientSection}>
                <div className={styles.selectedClientHeader}>
                  <h4>Cliente Seleccionado</h4>
                  <button
                    type="button"
                    className={styles.newSearchButton}
                    onClick={handleNewSearch}
                  >
                    Cambiar Cliente
                  </button>
                </div>
                <div className={styles.selectedClientCard}>
                  <div className={styles.clientName}>
                    {selectedClient.firstName} {selectedClient.lastName}
                  </div>
                  <div className={styles.clientDetails}>
                    {selectedClient.email && <div>Email: {selectedClient.email}</div>}
                    {selectedClient.phone && <div>Teléfono: {selectedClient.phone}</div>}
                    {selectedClient.documentNumber && (
                      <div>{selectedClient.documentType}: {selectedClient.documentNumber}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="clientSearch">Buscar Cliente</label>
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    id="clientSearch"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={handleSearchFocus}
                    placeholder="Buscar por nombre, apellido, email o documento..."
                    className={errors.client ? styles.error : ''}
                    ref={searchInputRef}
                  />
                  
                  {/* Desplegable de resultados */}
                  {isSearchFocused && (
                    <div className={styles.dropdown}>
                      {isLoadingClients ? (
                        <div className={styles.loading}>Cargando clientes...</div>
                      ) : searchTerm.trim() !== '' && filteredClients.length > 0 ? (
                        <>
                          {filteredClients.map(client => (
                            <div
                              key={client.id}
                              className={`${styles.dropdownItem} ${selectedClient?.id === client.id ? styles.selected : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                console.log('MouseDown en cliente:', client);
                                handleClientSelect(client);
                              }}
                            >
                              <div className={styles.clientInfo}>
                                <div className={styles.clientName}>
                                  {client.firstName} {client.lastName}
                                </div>
                                <div className={styles.clientDetails}>
                                  {client.email && <span>{client.email}</span>}
                                  {client.phone && <span>{client.phone}</span>}
                                  {client.documentNumber && (
                                    <span>{client.documentType}: {client.documentNumber}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Botón para agregar nuevo cliente */}
                          <div 
                            className={styles.addNewClientButton}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddNewClient();
                            }}
                          >
                            <span className={styles.addIcon}>+</span>
                            <span>Agregar Nuevo Cliente</span>
                          </div>
                        </>
                      ) : searchTerm.trim() !== '' ? (
                        <div className={styles.noResults}>
                          <div>No se encontraron clientes</div>
                          <div 
                            className={styles.addNewClientButton}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddNewClient();
                            }}
                          >
                            <span className={styles.addIcon}>+</span>
                            <span>Agregar Nuevo Cliente</span>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className={styles.addNewClientButton}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddNewClient();
                          }}
                        >
                          <span className={styles.addIcon}>+</span>
                          <span>Agregar Nuevo Cliente</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {errors.client && <span className={styles.errorText}>{errors.client}</span>}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className={styles.section}>
            <h3>Notas Adicionales</h3>
            <div className={styles.formGroup}>
              <label htmlFor="notes">Observaciones</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Información adicional, preferencias especiales, etc."
                rows={3}
              />
            </div>
          </div>

          {/* Botones */}
          <div className={styles.actions}>
            <button type="button" onClick={handleCancel} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton}>
              Crear Reserva
            </button>
          </div>
        </form>
      </div>

      {/* Modal de selección de habitaciones */}
      <RoomSelectionModal
        isOpen={isRoomSelectionModalOpen}
        onClose={() => setIsRoomSelectionModalOpen(false)}
        onRoomSelected={handleRoomSelected}
        requirements={requirements}
        checkIn={formData.checkIn}
        checkOut={formData.checkOut}
        reservationType={formData.reservationType}
      />
    </SidePanel>
  );
} 