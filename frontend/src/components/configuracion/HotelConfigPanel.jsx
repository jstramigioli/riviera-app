import React, { useState, useEffect } from 'react';
import { getHotel, updateHotel } from '../../services/api';

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

  useEffect(() => {
    loadHotelData();
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
    </div>
  );
};

export default HotelConfigPanel; 