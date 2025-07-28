import React, { useEffect, useState } from 'react';

export default function OperationalPeriodsPanel({ hotelId = "default-hotel" }) {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    console.log('🚀 OperationalPeriodsPanel montado con hotelId:', hotelId);
    loadPeriods();
  }, [hotelId]);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      console.log('🔍 Cargando períodos operacionales desde:', `${API_URL}/operational-periods/${hotelId}`);
      
      const response = await fetch(`${API_URL}/operational-periods/${hotelId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Datos recibidos:', data);
      
      if (Array.isArray(data)) {
        setPeriods(data);
        console.log('✅ Períodos operacionales cargados:', data.length);
      } else {
        console.error('❌ Respuesta inesperada del servidor:', data);
        setPeriods([]);
        setError('Respuesta inesperada del servidor');
        showNotification('Error: Respuesta inesperada del servidor', 'error');
      }
    } catch (error) {
      console.error('❌ Error al cargar períodos operacionales:', error);
      setPeriods([]);
      setError(error.message);
      showNotification('Error al cargar períodos operacionales', 'error');
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
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/operational-periods/${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodData)
      });

      if (response.ok) {
        showNotification('Período agregado exitosamente');
        loadPeriods();
        setShowAddModal(false);
        
        // Disparar evento para actualizar otros componentes
        window.dispatchEvent(new CustomEvent('operationalPeriodsUpdated', {
          detail: { hotelId, periods: await loadPeriodsData() }
        }));
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al crear período', 'error');
      }
    } catch (error) {
      console.error('Error al crear período:', error);
      showNotification('Error al crear período', 'error');
    }
  };

  const handleUpdatePeriod = async (id, data) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/operational-periods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        showNotification('Período actualizado correctamente');
        loadPeriods();
        setEditingPeriod(null);
        
        // Disparar evento para actualizar otros componentes
        window.dispatchEvent(new CustomEvent('operationalPeriodsUpdated', {
          detail: { hotelId, periods: await loadPeriodsData() }
        }));
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al actualizar', 'error');
      }
    } catch (error) {
      console.error('Error al actualizar período:', error);
      showNotification('Error al actualizar período', 'error');
    }
  };

  const handleDeletePeriod = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este período?')) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/operational-periods/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          showNotification('Período eliminado correctamente');
          loadPeriods();
          
          // Disparar evento para actualizar otros componentes
          window.dispatchEvent(new CustomEvent('operationalPeriodsUpdated', {
            detail: { hotelId, periods: await loadPeriodsData() }
          }));
        } else {
          const error = await response.json();
          showNotification(error.message || 'Error al eliminar', 'error');
        }
      } catch (error) {
        console.error('Error al eliminar período:', error);
        showNotification('Error al eliminar período', 'error');
      }
    }
  };

  // Función auxiliar para cargar datos de períodos
  const loadPeriodsData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/operational-periods/${hotelId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error al cargar datos de períodos:', error);
    }
    return [];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getFullYear() === end.getFullYear()) {
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
      } else {
        return `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
    } else {
      return `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando períodos operacionales...
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

  console.log('🎨 Renderizando OperationalPeriodsPanel');
  console.log('📊 periods:', periods);

  const safePeriods = Array.isArray(periods) ? periods : [];

  return (
    <div style={{ 
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'fit-content'
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
          Períodos de Apertura y Cierre
        </h3>
      </div>

      <div style={{ 
        marginBottom: '20px', 
        color: '#6c757d',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        Configura los períodos en los que el hotel estará abierto o cerrado. 
        Puedes agregar un título opcional para identificar cada período (ej: "Temporada alta", "Cierre por mantenimiento").
      </div>

      {/* Lista de períodos operacionales */}
      <div style={{ 
        display: 'grid', 
        gap: '12px'
      }}>
        {safePeriods.map((period) => (
          <div key={period.id} style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            background: '#f8f9fa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              {period.label && (
                <div style={{ 
                  fontWeight: '600', 
                  color: '#495057',
                  marginBottom: '4px',
                  fontSize: '16px'
                }}>
                  {period.label}
                </div>
              )}
              <div style={{ 
                fontWeight: '500', 
                color: '#495057',
                marginBottom: '4px'
              }}>
                {formatDateRange(period.startDate, period.endDate)}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6c757d'
              }}>
                {formatDate(period.startDate)} - {formatDate(period.endDate)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setEditingPeriod(period)}
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
                onClick={() => handleDeletePeriod(period.id)}
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
        
        {/* Botón para agregar período con formato de período */}
        <div 
          onClick={() => setShowAddModal(true)}
          style={{
            border: '2px dashed #28a745',
            borderRadius: '8px',
            padding: '16px',
            background: '#f8fff9',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            ':hover': {
              background: '#e8f5e8',
              borderColor: '#20c997'
            }
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#e8f5e8';
            e.target.style.borderColor = '#20c997';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#f8fff9';
            e.target.style.borderColor = '#28a745';
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: '#28a745',
            fontWeight: '500',
            fontSize: '16px'
          }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>+</span>
            Agregar período
          </div>
        </div>
        
        {safePeriods.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            color: '#6c757d',
            padding: '40px 20px'
          }}>
            No hay períodos operacionales configurados
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

      {/* Modal para editar período */}
      {editingPeriod && (
        <EditPeriodModal
          period={editingPeriod}
          onClose={() => setEditingPeriod(null)}
          onSave={handleUpdatePeriod}
          onDelete={handleDeletePeriod}
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
    label: ''
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
        <h3 style={{ marginBottom: '20px' }}>Agregar Período Operacional</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Título (opcional):</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Ej: Temporada alta"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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

// Modal para editar período
function EditPeriodModal({ period, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    startDate: period.startDate.slice(0, 10),
    endDate: period.endDate.slice(0, 10),
    label: period.label || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(period.id, formData);
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
        <h3 style={{ marginBottom: '20px' }}>Editar Período Operacional</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Título (opcional):</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Ej: Temporada alta"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onDelete(period.id)}
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