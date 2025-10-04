import React, { useState, useEffect } from 'react';
import { getHotel, updateHotel } from '../../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import ConfirmationModal from '../ConfirmationModal';

const HotelConfigPanel = () => {
  const [hotelData, setHotelData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Estados para gestión de servicios
  const [serviceTypes, setServiceTypes] = useState([]);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingServiceData, setEditingServiceData] = useState({ name: '', description: '' });
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  
  // Estados para drag and drop
  const [draggedService, setDraggedService] = useState(null);
  const [dragOverService, setDragOverService] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Estado para modal de confirmación
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  useEffect(() => {
    loadHotelData();
    loadServiceTypes();
  }, []);

  const loadHotelData = async () => {
    try {
      setLoading(true);
      const response = await getHotel();
      
      if (response.success) {
        setHotelData({
          name: response.data.name || '',
          description: response.data.description || '',
          address: response.data.address || '',
          phone: response.data.phone || '',
          email: response.data.email || '',
          website: response.data.website || ''
        });
      } else {
        // Si no hay datos del hotel, usar valores por defecto
        setHotelData({
          name: 'Hotel Riviera',
          description: '',
          address: '',
          phone: '',
          email: '',
          website: ''
        });
      }
    } catch (error) {
      console.error('Error al cargar datos del hotel:', error);
      setMessage({
        type: 'error',
        text: 'Error al cargar los datos del hotel'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadServiceTypes = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/service-types?hotelId=default-hotel`);
      if (response.ok) {
        const result = await response.json();
        setServiceTypes(result.data || []);
      } else {
        console.error('Error al cargar tipos de servicio');
      }
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setHotelData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const response = await updateHotel(hotelData);
      
      if (response.success) {
        setMessage({
          type: 'success',
          text: 'Información del hotel actualizada correctamente'
        });
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Error al actualizar la información'
        });
      }
    } catch (error) {
      console.error('Error al guardar datos del hotel:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Error al guardar los datos'
      });
    } finally {
      setSaving(false);
    }
  };

  // Funciones para gestión de servicios
  const handleStartCreateService = () => {
    setIsCreatingService(true);
    setEditingServiceData({ name: '', description: '' });
    setServiceError(null);
  };

  const handleStartEditService = (serviceType) => {
    setEditingServiceId(serviceType.id);
    setEditingServiceData({ 
      name: serviceType.name, 
      description: serviceType.description || '' 
    });
    setIsCreatingService(false);
    setServiceError(null);
  };

  const handleCancelEditService = () => {
    setEditingServiceId(null);
    setIsCreatingService(false);
    setEditingServiceData({ name: '', description: '' });
    setServiceError(null);
  };

  const handleSaveCreateService = async () => {
    if (!editingServiceData.name.trim()) {
      setServiceError('El nombre es requerido');
      return;
    }

    setLoadingServices(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/service-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingServiceData.name.trim(),
          description: editingServiceData.description.trim() || null,
          hotelId: 'default-hotel'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setServiceTypes([...serviceTypes, result.data]);
        setIsCreatingService(false);
        setEditingServiceData({ name: '', description: '' });
        setServiceError(null);
        setMessage({
          type: 'success',
          text: 'Servicio creado correctamente'
        });
      } else {
        const result = await response.json();
        setServiceError(result.errors?.[0] || 'Error al crear el servicio');
      }
    } catch (error) {
      console.error('Error creating service type:', error);
      setServiceError('Error al crear el servicio');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleSaveEditService = async () => {
    if (!editingServiceData.name.trim()) {
      setServiceError('El nombre es requerido');
      return;
    }

    setLoadingServices(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/service-types/${editingServiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingServiceData.name.trim(),
          description: editingServiceData.description.trim() || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setServiceTypes(serviceTypes.map(st => 
          st.id === editingServiceId ? result.data : st
        ));
        setEditingServiceId(null);
        setEditingServiceData({ name: '', description: '' });
        setServiceError(null);
        setMessage({
          type: 'success',
          text: 'Servicio actualizado correctamente'
        });
      } else {
        const result = await response.json();
        setServiceError(result.errors?.[0] || 'Error al actualizar el servicio');
      }
    } catch (error) {
      console.error('Error updating service type:', error);
      setServiceError('Error al actualizar el servicio');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleDeleteService = (serviceType) => {
    // 🚨 VALIDACIÓN ADICIONAL: No permitir eliminar si solo queda 1 servicio
    if (serviceTypes.length <= 1) {
      setServiceError('No se puede eliminar el último tipo de servicio. Debe existir al menos un tipo de servicio.');
      return;
    }
    
    setServiceToDelete(serviceType);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;

    setLoadingServices(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/service-types/${serviceToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setServiceTypes(serviceTypes.filter(st => st.id !== serviceToDelete.id));
        setServiceError(null);
        setMessage({
          type: 'success',
          text: 'Servicio eliminado correctamente'
        });
      } else {
        const result = await response.json();
        const errorMessage = result.errors?.[0] || 'Error al eliminar el servicio';
        setServiceError(errorMessage);
        setMessage({
          type: 'error',
          text: errorMessage
        });
      }
    } catch (error) {
      console.error('Error deleting service type:', error);
      setServiceError('Error al eliminar el servicio');
      setMessage({
        type: 'error',
        text: 'Error al eliminar el servicio'
      });
    } finally {
      setLoadingServices(false);
      setServiceToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Funciones de drag and drop
  const handleDragStart = (e, serviceType) => {
    setDraggedService(serviceType);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  };

  const handleDragOver = (e, serviceType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverService(serviceType);
  };

  const handleDragEnter = (e, serviceType) => {
    e.preventDefault();
    setDragOverService(serviceType);
  };

  const handleDragLeave = () => {
    setDragOverService(null);
  };

  const handleDrop = async (e, targetServiceType) => {
    e.preventDefault();
    
    if (!draggedService || draggedService.id === targetServiceType.id) {
      setDraggedService(null);
      setDragOverService(null);
      setIsDragging(false);
      return;
    }

    try {
      setLoadingServices(true);
      
      // Crear nueva lista con el orden actualizado
      const newServiceTypes = [...serviceTypes];
      const draggedIndex = newServiceTypes.findIndex(s => s.id === draggedService.id);
      const targetIndex = newServiceTypes.findIndex(s => s.id === targetServiceType.id);
      
      // Remover el elemento arrastrado
      const [draggedItem] = newServiceTypes.splice(draggedIndex, 1);
      
      // Insertar en la nueva posición
      newServiceTypes.splice(targetIndex, 0, draggedItem);
      
      // Actualizar el orderIndex para cada servicio
      const updatedServices = newServiceTypes.map((service, index) => ({
        ...service,
        orderIndex: index + 1
      }));
      
      // Actualizar el estado local primero
      setServiceTypes(updatedServices);
      
      // Actualizar en el backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const updatePromises = updatedServices.map(service => 
        fetch(`${API_URL}/service-types/${service.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderIndex: service.orderIndex
          })
        })
      );
      
      await Promise.all(updatePromises);
      
      setMessage({
        type: 'success',
        text: 'Orden de servicios actualizado correctamente'
      });
      
    } catch (error) {
      console.error('Error updating service order:', error);
      setMessage({
        type: 'error',
        text: 'Error al actualizar el orden de los servicios'
      });
      
      // Recargar los servicios para restaurar el estado original
      loadServiceTypes();
    } finally {
      setLoadingServices(false);
      setDraggedService(null);
      setDragOverService(null);
      setIsDragging(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <div>Cargando información del hotel...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        borderBottom: '2px solid #e9ecef',
        marginBottom: '24px',
        paddingBottom: '16px'
      }}>
        <h2 style={{ 
          margin: '0', 
          color: '#2c3e50', 
          fontSize: '1.5rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🏨</span>
          Configuración del Hotel
        </h2>
        <p style={{ 
          margin: '8px 0 0 0', 
          color: '#6c757d',
          fontSize: '0.9rem'
        }}>
          Edita la información básica del hotel
        </p>
      </div>

      {/* Mensaje de estado */}
      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Nombre del hotel */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Nombre del Hotel *
            </label>
            <input
              type="text"
              name="name"
              value={hotelData.name}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Nombre del hotel"
            />
          </div>

          {/* Descripción */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Descripción
            </label>
            <textarea
              name="description"
              value={hotelData.description}
              onChange={handleInputChange}
              rows="3"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              placeholder="Descripción del hotel"
            />
          </div>

          {/* Dirección */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Dirección
            </label>
            <input
              type="text"
              name="address"
              value={hotelData.address}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Dirección del hotel"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={hotelData.phone}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Número de teléfono"
            />
          </div>

          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={hotelData.email}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="correo@hotel.com"
            />
          </div>

          {/* Sitio web */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Sitio Web
            </label>
            <input
              type="url"
              name="website"
              value={hotelData.website}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="https://www.hotel.com"
            />
          </div>

          {/* Botón de guardar */}
          <div style={{ marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>

      {/* Panel de Gestión de Servicios */}
      <div style={{ 
        marginTop: '40px',
        borderTop: '2px solid #e9ecef',
        paddingTop: '24px'
      }}>
        <div style={{ 
          borderBottom: '2px solid #e9ecef',
          marginBottom: '24px',
          paddingBottom: '16px'
        }}>
          <h2 style={{ 
            margin: '0', 
            color: '#2c3e50', 
            fontSize: '1.5rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🛎️</span>
            Gestión de Servicios
          </h2>
          <p style={{ 
            margin: '8px 0 0 0', 
            color: '#6c757d',
            fontSize: '0.9rem'
          }}>
            Gestiona los tipos de servicio que se pueden utilizar en los bloques de temporada
          </p>
        </div>

        {/* Error de servicios */}
        {serviceError && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              ⚠️ Error al eliminar servicio
            </div>
            <div>{serviceError}</div>
            {serviceError.includes('bloques de temporada') && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '0.9rem', 
                fontStyle: 'italic',
                color: '#6c757d'
              }}>
                💡 Para eliminar este servicio, primero debes removerlo de todos los bloques de temporada donde esté siendo utilizado.
              </div>
            )}
          </div>
        )}

        {/* Lista de servicios */}
        <div style={{ marginBottom: '20px' }}>
          {serviceTypes.map(serviceType => (
            <div 
              key={serviceType.id} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                marginBottom: '8px',
                backgroundColor: 'white',
                cursor: isDragging && draggedService?.id === serviceType.id ? 'grabbing' : 'grab',
                opacity: isDragging && draggedService?.id === serviceType.id ? 0.5 : 1,
                transform: isDragging && draggedService?.id === serviceType.id ? 'rotate(5deg)' : 'none',
                borderColor: dragOverService?.id === serviceType.id ? '#667eea' : '#e9ecef',
                borderWidth: dragOverService?.id === serviceType.id ? '2px' : '1px',
                transition: 'all 0.2s ease'
              }}
              draggable={editingServiceId !== serviceType.id && !isCreatingService}
              onDragStart={editingServiceId !== serviceType.id && !isCreatingService ? (e) => handleDragStart(e, serviceType) : undefined}
              onDragOver={editingServiceId !== serviceType.id && !isCreatingService ? (e) => handleDragOver(e, serviceType) : undefined}
              onDragEnter={editingServiceId !== serviceType.id && !isCreatingService ? (e) => handleDragEnter(e, serviceType) : undefined}
              onDragLeave={editingServiceId !== serviceType.id && !isCreatingService ? handleDragLeave : undefined}
              onDrop={editingServiceId !== serviceType.id && !isCreatingService ? (e) => handleDrop(e, serviceType) : undefined}
              onDragEnd={editingServiceId !== serviceType.id && !isCreatingService ? () => {
                setIsDragging(false);
                setDraggedService(null);
                setDragOverService(null);
              } : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Indicador de arrastre */}
                {editingServiceId !== serviceType.id && !isCreatingService && (
                  <div style={{
                    color: '#6c757d',
                    fontSize: '1.2rem',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ⋮⋮
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                    {serviceType.name}
                  </div>
                  {serviceType.description && (
                    <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                      {serviceType.description}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleStartEditService(serviceType)}
                  style={{
                    background: 'none',
                    border: '1px solid #667eea',
                    color: '#667eea',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  <FiEdit2 />
                </button>
                {/* 🚨 VALIDACIÓN: Solo mostrar botón de eliminar si hay más de 1 servicio */}
                {serviceTypes.length > 1 && (
                  <button
                    onClick={() => handleDeleteService(serviceType)}
                    style={{
                      background: 'none',
                      border: '1px solid #dc3545',
                      color: '#dc3545',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Formulario de creación/edición */}
        {(isCreatingService || editingServiceId) && (
          <div style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>
              {isCreatingService ? 'Crear Nuevo Servicio' : 'Editar Servicio'}
            </h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={editingServiceData.name || ''}
                  onChange={(e) => setEditingServiceData({
                    ...editingServiceData,
                    name: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ced4da',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ej: Desayuno, Media Pensión, Pensión Completa"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  Descripción
                </label>
                <textarea
                  value={editingServiceData.description || ''}
                  onChange={(e) => setEditingServiceData({
                    ...editingServiceData,
                    description: e.target.value
                  })}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ced4da',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Descripción del servicio"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={isCreatingService ? handleSaveCreateService : handleSaveEditService}
                  disabled={loadingServices}
                  style={{
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: loadingServices ? 'not-allowed' : 'pointer',
                    opacity: loadingServices ? 0.7 : 1
                  }}
                >
                  {loadingServices ? 'Guardando...' : (isCreatingService ? 'Crear Servicio' : 'Guardar Cambios')}
                </button>
                <button
                  onClick={handleCancelEditService}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botón para crear nuevo servicio */}
        {!isCreatingService && !editingServiceId && (
          <button
            onClick={handleStartCreateService}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FiPlus />
            Agregar Nuevo Servicio
          </button>
                 )}
       </div>

       {/* Modal de confirmación de eliminación */}
       <ConfirmationModal
         isOpen={showDeleteConfirmation}
         onClose={() => {
           setShowDeleteConfirmation(false);
           setServiceToDelete(null);
         }}
         onConfirm={confirmDeleteService}
         title="Eliminar Servicio"
         message={`¿Estás seguro de que deseas eliminar el servicio "${serviceToDelete?.name}"? Esta acción no se puede deshacer.`}
         confirmText="Eliminar"
         cancelText="Cancelar"
         type="danger"
       />
     </div>
   );
 };

export default HotelConfigPanel; 