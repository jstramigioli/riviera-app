import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import SidePanel from './SidePanel';
import ReservationRequirements from './ReservationRequirements';
import RoomSelectionModal from './RoomSelectionModal';
import LocationSelector from './LocationSelector';
import api from '../services/api';
import styles from '../styles/CreateQueryPanel.module.css';

export default function CreateQueryPanel({ 
  isOpen, 
  onClose, 
  onCreateQuery,
  rooms = []
}) {
  const [formData, setFormData] = useState({
    checkIn: '',
    checkOut: '',
    reservationType: 'con_desayuno',
    totalAmount: '',
    status: 'pendiente',
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
    requiredGuests: '',
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
  const [selectedRoom, setSelectedRoom] = useState(null);
  const searchInputRef = useRef(null);

  // Cargar clientes al abrir el panel
  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  // Filtrar clientes cuando cambia el término de búsqueda
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
      setIsLoadingClients(true);
      const response = await api.get('/clients');
      setClients(response.data);
      setFilteredClients(response.data.slice(0, 10));
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      mainClient: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        phone: client.phone || '',
        documentType: client.documentType || 'DNI',
        documentNumber: client.documentNumber || '',
        country: client.country || 'AR',
        province: client.province || '',
        city: client.city || ''
      }
    }));
    setSearchTerm('');
    setIsSearchFocused(false);
  };

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    setRequirements(prev => ({
      ...prev,
      requiredRoomId: room.id
    }));
    setIsRoomSelectionModalOpen(false);
  };

  const validateForm = () => {
    const newErrors = {};

    // En consultas, todos los campos son opcionales, pero podemos validar formato si están presentes
    if (formData.checkIn && formData.checkOut) {
      const checkIn = new Date(formData.checkIn);
      const checkOut = new Date(formData.checkOut);
      
      if (checkIn >= checkOut) {
        newErrors.checkOut = 'La fecha de salida debe ser posterior a la fecha de entrada';
      }
    }

    if (formData.totalAmount && parseFloat(formData.totalAmount) <= 0) {
      newErrors.totalAmount = 'El monto debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const queryData = {
        ...formData,
        roomId: selectedRoom?.id || null,
        mainClientId: selectedClient?.id || null,
        checkIn: formData.checkIn ? new Date(formData.checkIn).toISOString() : null,
        checkOut: formData.checkOut ? new Date(formData.checkOut).toISOString() : null,
        totalAmount: formData.totalAmount ? parseFloat(formData.totalAmount) : null,
        requiredGuests: requirements.requiredGuests ? parseInt(requirements.requiredGuests) : null,
        requiredRoomId: requirements.requiredRoomId,
        requiredTags: requirements.requiredTags,
        requirementsNotes: requirements.requirementsNotes
      };

      // Si no hay cliente seleccionado pero hay datos de cliente, crear uno nuevo
      if (!selectedClient && (formData.mainClient.firstName || formData.mainClient.lastName)) {
        try {
          const newClient = await api.post('/clients', formData.mainClient);
          queryData.mainClientId = newClient.data.id;
        } catch (error) {
          console.error('Error creating client:', error);
          // Continuar sin cliente si falla la creación
        }
      }

      const response = await api.post('/queries', queryData);
      onCreateQuery(response.data);
      handleClose();
    } catch (error) {
      console.error('Error creating query:', error);
      alert('Error al crear la consulta: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleClose = () => {
    setFormData({
      checkIn: '',
      checkOut: '',
      reservationType: 'con_desayuno',
      totalAmount: '',
      status: 'pendiente',
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
      requiredGuests: '',
      requiredRoomId: null,
      requiredTags: [],
      requirementsNotes: ''
    });
    setErrors({});
    setSelectedClient(null);
    setSelectedRoom(null);
    setSearchTerm('');
    setShowNewClientForm(false);
    onClose();
  };

  return (
    <SidePanel
      open={isOpen}
      onClose={handleClose}
      title="NUEVA CONSULTA"
      width={520}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h3>Información Básica</h3>
          
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Estado</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_revision">En Revisión</option>
                <option value="confirmada">Confirmada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            
            <div className={styles.field}>
              <label>Tipo de Servicio</label>
              <select
                value={formData.reservationType}
                onChange={(e) => handleInputChange('reservationType', e.target.value)}
              >
                <option value="con_desayuno">Con Desayuno</option>
                <option value="media_pension">Media Pensión</option>
                <option value="pension_completa">Pensión Completa</option>
                <option value="solo_alojamiento">Solo Alojamiento</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Check-in (opcional)</label>
              <input
                type="date"
                value={formData.checkIn}
                onChange={(e) => handleInputChange('checkIn', e.target.value)}
                className={errors.checkIn ? styles.error : ''}
              />
              {errors.checkIn && <span className={styles.errorText}>{errors.checkIn}</span>}
            </div>
            
            <div className={styles.field}>
              <label>Check-out (opcional)</label>
              <input
                type="date"
                value={formData.checkOut}
                onChange={(e) => handleInputChange('checkOut', e.target.value)}
                className={errors.checkOut ? styles.error : ''}
              />
              {errors.checkOut && <span className={styles.errorText}>{errors.checkOut}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label>Monto Total (opcional)</label>
            <input
              type="number"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) => handleInputChange('totalAmount', e.target.value)}
              placeholder="0.00"
              className={errors.totalAmount ? styles.error : ''}
            />
            {errors.totalAmount && <span className={styles.errorText}>{errors.totalAmount}</span>}
          </div>
        </div>

        <div className={styles.section}>
          <h3>Cliente (opcional)</h3>
          
          <div className={styles.clientSearch}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar cliente existente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className={styles.searchInput}
            />
            
            {isSearchFocused && (
              <div className={styles.clientDropdown}>
                {isLoadingClients ? (
                  <div className={styles.loading}>Cargando clientes...</div>
                ) : (
                  <>
                    {filteredClients.map(client => (
                      <div
                        key={client.id}
                        className={styles.clientOption}
                        onClick={() => handleClientSelect(client)}
                      >
                        <strong>{client.firstName} {client.lastName}</strong>
                        {client.email && <div className={styles.clientEmail}>{client.email}</div>}
                      </div>
                    ))}
                    <div
                      className={styles.clientOption}
                      onClick={() => setShowNewClientForm(true)}
                    >
                      <strong>+ Crear nuevo cliente</strong>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {selectedClient && (
            <div className={styles.selectedClient}>
              <strong>Cliente seleccionado:</strong> {selectedClient.firstName} {selectedClient.lastName}
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
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
                }}
                className={styles.removeButton}
              >
                Cambiar
              </button>
            </div>
          )}

          {(showNewClientForm || (!selectedClient && !isSearchFocused)) && (
            <div className={styles.newClientForm}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={formData.mainClient.firstName}
                    onChange={(e) => handleClientInputChange('firstName', e.target.value)}
                    placeholder="Nombre"
                  />
                </div>
                
                <div className={styles.field}>
                  <label>Apellido</label>
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
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3>Requerimientos (opcional)</h3>
          
          <ReservationRequirements
            requirements={requirements}
            setRequirements={setRequirements}
            rooms={rooms}
            onRoomSelect={() => setIsRoomSelectionModalOpen(true)}
            selectedRoom={selectedRoom}
          />
        </div>

        <div className={styles.section}>
          <h3>Notas</h3>
          
          <div className={styles.field}>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Notas adicionales sobre la consulta..."
              rows={3}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={handleClose} className={styles.cancelButton}>
            Cancelar
          </button>
          <button type="submit" className={styles.submitButton}>
            Crear Consulta
          </button>
        </div>
      </form>

      {isRoomSelectionModalOpen && (
        <RoomSelectionModal
          isOpen={isRoomSelectionModalOpen}
          onClose={() => setIsRoomSelectionModalOpen(false)}
          onSelect={handleRoomSelect}
          rooms={rooms}
        />
      )}
    </SidePanel>
  );
} 