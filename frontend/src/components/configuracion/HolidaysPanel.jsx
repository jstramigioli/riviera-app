import React, { useEffect, useState } from 'react';

export default function HolidaysPanel({ hotelId = "default-hotel" }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  
  // Estado para el formulario de agregar feriado
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: ''
  });
  const [editingHoliday, setEditingHoliday] = useState(null);

  useEffect(() => {
    console.log('🚀 HolidaysPanel montado con hotelId:', hotelId);
    loadHolidays();
  }, [hotelId]);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      console.log('🔍 Cargando feriados desde:', `${API_URL}/open-days/${hotelId}`);
      
      const response = await fetch(`${API_URL}/open-days/${hotelId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Datos recibidos:', data);
      
      // Filtrar solo los días que son feriados y ordenar por fecha
      const holidaysData = data
        .filter(day => day.isHoliday)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      setHolidays(holidaysData);
      console.log('✅ Feriados cargados:', holidaysData.length);
    } catch (error) {
      console.error('❌ Error al cargar feriados:', error);
      setHolidays([]);
      setError(error.message);
      showNotification('Error al cargar feriados', 'error');
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

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    
    if (!newHoliday.date || !newHoliday.name.trim()) {
      showNotification('Por favor completa todos los campos', 'error');
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/open-days/${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newHoliday.date,
          notes: newHoliday.name.trim(),
          isHoliday: true,
          isClosed: false
        })
      });

      if (response.ok) {
        showNotification('Feriado agregado exitosamente');
        setNewHoliday({ date: '', name: '' });
        loadHolidays();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al crear feriado', 'error');
      }
    } catch (error) {
      console.error('Error al crear feriado:', error);
      showNotification('Error al crear feriado', 'error');
    }
  };

  const handleUpdateHoliday = async (id, data) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/open-days/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          isHoliday: true,
          isClosed: false
        })
      });

      if (response.ok) {
        showNotification('Feriado actualizado correctamente');
        loadHolidays();
        setEditingHoliday(null);
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al actualizar', 'error');
      }
    } catch (error) {
      console.error('Error al actualizar feriado:', error);
      showNotification('Error al actualizar feriado', 'error');
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      if (window.confirm('¿Estás seguro de que quieres eliminar este feriado?')) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/open-days/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          showNotification('Feriado eliminado correctamente');
          loadHolidays();
        } else {
          const error = await response.json();
          showNotification(error.message || 'Error al eliminar', 'error');
        }
      }
    } catch (error) {
      console.error('Error al eliminar feriado:', error);
      showNotification('Error al eliminar feriado', 'error');
    }
  };



  const formatDateShort = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const exportHolidays = () => {
    const data = holidays.map(holiday => ({
      fecha: holiday.date,
      nombre: holiday.notes || ''
    }));
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feriados.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Feriados exportados correctamente');
  };

  const importHolidays = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!Array.isArray(data)) {
          showNotification('Formato de archivo inválido', 'error');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const item of data) {
          if (!item.fecha || !item.nombre) {
            errorCount++;
            continue;
          }

          try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_URL}/open-days/${hotelId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: item.fecha,
                notes: item.nombre,
                isHoliday: true,
                isClosed: false
              })
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
                   } catch {
           errorCount++;
         }
        }

        loadHolidays();
        
        if (successCount > 0) {
          showNotification(`${successCount} feriados importados correctamente${errorCount > 0 ? `, ${errorCount} errores` : ''}`);
        } else {
          showNotification('Error al importar feriados', 'error');
        }
             } catch {
         showNotification('Error al leer el archivo', 'error');
       }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando feriados...
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
          🧩 Configuración de Feriados
        </h3>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={exportHolidays}
            style={{
              padding: '8px 12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📤 Exportar
          </button>
          <label style={{
            padding: '8px 12px',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            margin: 0
          }}>
            📥 Importar
            <input
              type="file"
              accept=".json"
              onChange={importHolidays}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Formulario compacto para agregar feriado */}
      <div style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        border: '1px solid #e9ecef'
      }}>
        <form onSubmit={handleAddHoliday} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
              📅 Fecha:
            </label>
            <input
              type="date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
              required
            />
          </div>
          
          <div style={{ flex: '2' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
              🏷️ Nombre del feriado:
            </label>
            <input
              type="text"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              placeholder="Ej: Día de la Independencia"
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
              required
            />
          </div>
          
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ➕ Agregar
          </button>
        </form>
      </div>

      {/* Tabla de feriados */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ marginBottom: '12px', color: '#495057', fontSize: '16px' }}>
          📋 Lista de Feriados ({holidays.length})
        </h4>
        
        {holidays.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#6c757d',
            padding: '40px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            No hay feriados configurados
          </div>
        ) : (
          <div style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: '600',
                    color: '#495057'
                  }}>
                    📅 Fecha
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: '600',
                    color: '#495057'
                  }}>
                    🏷️ Nombre
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: '600',
                    color: '#495057',
                    width: '120px'
                  }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                    <td style={{ padding: '12px', color: '#495057' }}>
                      {formatDateShort(holiday.date)}
                    </td>
                    <td style={{ padding: '12px', color: '#495057' }}>
                      {holiday.notes || 'Sin nombre'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setEditingHoliday(holiday)}
                          style={{
                            padding: '4px 8px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          style={{
                            padding: '4px 8px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para editar feriado */}
      {editingHoliday && (
        <EditHolidayModal
          holiday={editingHoliday}
          onClose={() => setEditingHoliday(null)}
          onSave={handleUpdateHoliday}
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

// Modal para editar feriado
function EditHolidayModal({ holiday, onClose, onSave }) {
  const [formData, setFormData] = useState({
    date: holiday.date.slice(0, 10),
    name: holiday.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.date || !formData.name.trim()) {
      return;
    }
    
    onSave(holiday.id, {
      date: formData.date,
      notes: formData.name.trim()
    });
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
        minWidth: '400px'
      }}>
        <h3 style={{ marginBottom: '20px' }}>✏️ Editar Feriado</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>📅 Fecha:</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>🏷️ Nombre del feriado:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Día de la Independencia"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
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
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 