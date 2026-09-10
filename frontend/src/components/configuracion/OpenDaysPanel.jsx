import React, { useEffect, useState } from 'react';
import { API_URL } from '../../services/api.js';

export default function OpenDaysPanel({ hotelId = "default-hotel" }) {
  const [openDays, setOpenDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOpenDay, setEditingOpenDay] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🚀 OpenDaysPanel montado con hotelId:', hotelId);
    loadOpenDays();
  }, [hotelId]);

  const loadOpenDays = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      console.log('🔍 Cargando días de apertura desde:', `${API_URL}/open-days/${hotelId}`);
      console.log('🏨 Hotel ID:', hotelId);
      console.log('🌐 API_URL:', API_URL);
      
      const response = await fetch(`${API_URL}/open-days/${hotelId}`);
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Datos recibidos:', data);
      console.log('📊 Tipo de datos:', typeof data);
      console.log('🔢 Es array?', Array.isArray(data));
      
      // Asegurar que data sea un array
      if (Array.isArray(data)) {
        setOpenDays(data);
        console.log('✅ Días de apertura cargados:', data.length);
      } else {
        console.error('❌ Respuesta inesperada del servidor:', data);
        setOpenDays([]);
        setError('Respuesta inesperada del servidor');
        showNotification('Error: Respuesta inesperada del servidor', 'error');
      }
    } catch (error) {
      console.error('❌ Error al cargar días de apertura:', error);
      setOpenDays([]);
      setError(error.message);
      showNotification('Error al cargar días de apertura', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const handleAddPeriod = async (periodData) => {
    try {
      
      const response = await fetch(`${API_URL}/open-days/${hotelId}/period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodData)
      });

      if (response.ok) {
        const result = await response.json();
        showNotification(result.message);
        loadOpenDays();
        setShowAddModal(false);
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al crear período', 'error');
      }
    } catch (error) {
      console.error('Error al crear período:', error);
      showNotification('Error al crear período', 'error');
    }
  };

  const handleUpdateOpenDay = async (id, data) => {
    try {
      
      const response = await fetch(`${API_URL}/open-days/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        showNotification('Día de apertura actualizado correctamente');
        loadOpenDays();
        setEditingOpenDay(null);
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al actualizar', 'error');
      }
    } catch (error) {
      console.error('Error al actualizar día de apertura:', error);
      showNotification('Error al actualizar', 'error');
    }
  };

  const handleDeleteOpenDay = async (id) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este día de apertura?')) {
      return;
    }

    try {
      
      const response = await fetch(`${API_URL}/open-days/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Día de apertura eliminado correctamente');
        loadOpenDays();
      } else {
        showNotification('Error al eliminar día de apertura', 'error');
      }
    } catch (error) {
      console.error('Error al eliminar día de apertura:', error);
      showNotification('Error al eliminar', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando días de apertura...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  console.log('🎨 Renderizando OpenDaysPanel');
  console.log('📊 openDays:', openDays);
  console.log('🔢 openDays es array?', Array.isArray(openDays));
  console.log('📏 openDays length:', openDays?.length);

  // Asegurar que openDays sea siempre un array
  const safeOpenDays = Array.isArray(openDays) ? openDays : [];

  return (
    <div style={{ 
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          Períodos de Apertura
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          + Agregar Período
        </button>
      </div>

      <div style={{ 
        marginBottom: '20px', 
        color: '#6c757d',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        Configura los períodos en los que el hotel estará abierto o cerrado. 
        Puedes marcar días como feriados/fines de semana largos y establecer precios fijos.
      </div>

      {/* Lista de días de apertura */}
      <div style={{ 
        display: 'grid', 
        gap: '12px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {safeOpenDays.map((openDay) => (
          <div key={openDay.id} style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            background: '#f8f9fa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ 
                fontWeight: '500', 
                color: '#495057',
                marginBottom: '4px'
              }}>
                {formatDate(openDay.date)}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6c757d',
                display: 'flex',
                gap: '8px'
              }}>
                <span style={{ 
                  color: openDay.isClosed ? '#dc3545' : '#28a745',
                  fontWeight: '500'
                }}>
                  {openDay.isClosed ? 'Cerrado' : 'Abierto'}
                </span>
                {openDay.isHoliday && (
                  <span style={{ color: '#ffc107', fontWeight: '500' }}>
                    Feriado/Fin de semana largo
                  </span>
                )}
                {openDay.fixedPrice && (
                  <span style={{ color: '#17a2b8', fontWeight: '500' }}>
                    ${openDay.fixedPrice.toLocaleString()}
                  </span>
                )}
              </div>
              {openDay.notes && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6c757d',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  {openDay.notes}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setEditingOpenDay(openDay)}
                style={{
                  padding: '6px 12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDeleteOpenDay(openDay.id)}
                style={{
                  padding: '6px 12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        
        {safeOpenDays.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            color: '#6c757d',
            padding: '40px 20px'
          }}>
            No hay períodos de apertura configurados
          </div>
        )}
      </div>

      {/* Modal para agregar período */}
      {showAddModal && (
        <AddPeriodModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPeriod}
        />
      )}

      {/* Modal para editar día */}
      {editingOpenDay && (
        <EditOpenDayModal
          openDay={editingOpenDay}
          onClose={() => setEditingOpenDay(null)}
          onSave={handleUpdateOpenDay}
          onDelete={handleDeleteOpenDay}
        />
      )}

      {/* Notificación */}
      {notification.show && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: notification.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px',
          zIndex: 10000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          {notification.message}
        </div>
      )}
    </div>
  );
}

// Modal para agregar período
function AddPeriodModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    isClosed: true,
    isHoliday: false,
    fixedPrice: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px', 
        minWidth: '500px',
        maxWidth: '600px'
      }}>
        <h3 style={{ marginBottom: '20px' }}>Agregar Período de Apertura</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Fecha de inicio:</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Fecha de fin:</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={formData.isClosed}
                onChange={(e) => setFormData({ ...formData, isClosed: e.target.checked })}
              />
              <span>Hotel cerrado</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.isHoliday}
                onChange={(e) => setFormData({ ...formData, isHoliday: e.target.checked })}
              />
              <span>Feriado/Fin de semana largo</span>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Precio fijo (opcional):</label>
            <input
              type="number"
              value={formData.fixedPrice}
              onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
              placeholder="Ej: 50000"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Notas:</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Agregar Período
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para editar día
function EditOpenDayModal({ openDay, onClose, onSave, onDelete }) {
  // Corregir el problema de zona horaria: convertir la fecha UTC a fecha local
  const localDate = new Date(openDay.date);
  const localDateString = localDate.toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    date: localDateString,
    isClosed: openDay.isClosed,
    isHoliday: openDay.isHoliday,
    fixedPrice: openDay.fixedPrice ? openDay.fixedPrice.toString() : '',
    notes: openDay.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(openDay.id, formData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px', 
        minWidth: '500px'
      }}>
        <h3 style={{ marginBottom: '20px' }}>Editar Día de Apertura</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Fecha:</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={formData.isClosed}
                onChange={(e) => setFormData({ ...formData, isClosed: e.target.checked })}
              />
              <span>Hotel cerrado</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.isHoliday}
                onChange={(e) => setFormData({ ...formData, isHoliday: e.target.checked })}
              />
              <span>Feriado/Fin de semana largo</span>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Precio fijo (opcional):</label>
            <input
              type="number"
              value={formData.fixedPrice}
              onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
              placeholder="Ej: 50000"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Notas:</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onDelete(openDay.id)}
              style={{
                padding: '10px 20px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 