import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SidePanel from './SidePanel';
import { fetchClients } from '../services/api';
import styles from '../styles/CreateReservationPanel.module.css';

export default function CreateReservationPanel({ 
  isOpen, 
  onClose, 
  rooms, 
  onCreateReservation 
}) {
  const [formData, setFormData] = useState({
    roomId: '',
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    mainClient: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      documentType: 'DNI',
      documentNumber: ''
    },
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Cargar clientes al abrir el panel
  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  // Filtrar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients.slice(0, 10)); // Mostrar solo los primeros 10
    } else {
      const filtered = clients.filter(client => 
        client.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.documentNumber?.includes(searchTerm)
      );
      setFilteredClients(filtered);
    }
  }, [searchTerm, clients]);

  const loadClients = async () => {
    try {
      setIsLoadingClients(true);
      const clientsData = await fetchClients();
      setClients(clientsData);
      setFilteredClients(clientsData.slice(0, 10));
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleClientSelect = (client) => {
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
        documentNumber: ''
      }
    }));
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

  const validateForm = () => {
    const newErrors = {};

    // Validar habitación
    if (!formData.roomId) {
      newErrors.roomId = 'Debe seleccionar una habitación';
    }

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
      const newReservation = {
        ...formData,
        id: Date.now().toString(), // ID temporal
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      onCreateReservation(newReservation);
      onClose();
      
      // Resetear formulario
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      roomId: '',
      checkIn: format(new Date(), 'yyyy-MM-dd'),
      checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      mainClient: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        documentType: 'DNI',
        documentNumber: ''
      },
      notes: ''
    });
    setSelectedClient(null);
    setShowNewClientForm(false);
    setSearchTerm('');
    setErrors({});
  };

  const handleCancel = () => {
    onClose();
    resetForm();
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
            
            <div className={styles.formGroup}>
              <label htmlFor="roomId">Habitación *</label>
              <select
                id="roomId"
                value={formData.roomId}
                onChange={(e) => handleInputChange('roomId', e.target.value)}
                className={errors.roomId ? styles.error : ''}
              >
                <option value="">Seleccionar habitación</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              {errors.roomId && <span className={styles.errorText}>{errors.roomId}</span>}
            </div>

            <div className={styles.dateGroup}>
              <div className={styles.formGroup}>
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

              <div className={styles.formGroup}>
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
            </div>
          </div>

          {/* Información del Cliente */}
          <div className={styles.section}>
            <h3>Información del Cliente</h3>
            
            {!showNewClientForm ? (
              <>
                {/* Buscador de clientes */}
                <div className={styles.formGroup}>
                  <label htmlFor="clientSearch">Buscar Cliente</label>
                  <input
                    type="text"
                    id="clientSearch"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, apellido, email o documento..."
                    className={errors.client ? styles.error : ''}
                  />
                  {errors.client && <span className={styles.errorText}>{errors.client}</span>}
                </div>

                {/* Lista de clientes filtrados */}
                <div className={styles.clientList}>
                  {isLoadingClients ? (
                    <div className={styles.loading}>Cargando clientes...</div>
                  ) : (
                    <>
                      {filteredClients.map(client => (
                        <div
                          key={client.id}
                          className={`${styles.clientItem} ${selectedClient?.id === client.id ? styles.selected : ''}`}
                          onClick={() => handleClientSelect(client)}
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
                        onClick={handleAddNewClient}
                      >
                        <span className={styles.addIcon}>+</span>
                        <span>Agregar Nuevo Cliente</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Mostrar cliente seleccionado */}
                {selectedClient && (
                  <div className={styles.selectedClientInfo}>
                    <h4>Cliente Seleccionado:</h4>
                    <div className={styles.clientCard}>
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
                )}
              </>
            ) : (
              <>
                {/* Formulario para nuevo cliente */}
                <div className={styles.newClientHeader}>
                  <h4>Nuevo Cliente</h4>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => {
                      setShowNewClientForm(false);
                      setSelectedClient(null);
                      setSearchTerm('');
                    }}
                  >
                    ← Volver a buscar
                  </button>
                </div>
                
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
              </>
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
    </SidePanel>
  );
} 