import React, { useEffect, useState } from "react";

function getMonthDays(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const days = [];
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export default function RatesCalendar() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [rates, setRates] = useState({});
  const [roomTypes, setRoomTypes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar tipos de habitación
    fetch('/api/room-types')
      .then(res => res.json())
      .then(data => setRoomTypes(data))
      .catch(() => setRoomTypes([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    // Cargar tarifas del mes de una sola vez
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    
    fetch(`${API_URL}/dynamic-pricing/rates/default-hotel/1?startDate=${startDate}&endDate=${endDate}`)
      .then((res) => res.json())
      .then((data) => {
        // Organizar los datos por fecha
        const ratesByDate = {};
        data.forEach(rate => {
          const dateKey = rate.date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
          if (!ratesByDate[dateKey]) {
            ratesByDate[dateKey] = [];
          }
          ratesByDate[dateKey].push(rate);
        });
        setRates(ratesByDate);
        setLoading(false);
      })
      .catch(() => {
        // Si no hay tarifas, crear datos por defecto para el mes
        const days = getMonthDays(year, month);
        const defaultRates = {};
        days.forEach((date) => {
          const key = date.toISOString().slice(0, 10);
          defaultRates[key] = [{ 
            roomTypeId: 1, 
            baseRate: 10000, 
            dynamicRate: 10000, 
            withBreakfast: 11500, 
            withHalfBoard: 13500,
            promoActive: false 
          }];
        });
        setRates(defaultRates);
        setLoading(false);
      });
  }, [currentMonth]);

  const openModal = (date) => {
    setSelectedDate(date);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleOverride = async (roomTypeId, newPrice) => {
    try {
      await fetch(`${API_URL}/dynamic-pricing/rates/default-hotel/${roomTypeId}/${selectedDate.toISOString().slice(0, 10)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dynamicRate: newPrice }),
      });
      // Refrescar tarifas
      const key = selectedDate.toISOString().slice(0, 10);
      fetch(`${API_URL}/dynamic-pricing/rates/default-hotel/1?startDate=${key}&endDate=${key}`)
        .then((res) => res.json())
        .then((data) => setRates((r) => ({ ...r, [key]: data })));
    } catch {
      alert("Error al actualizar la tarifa");
    }
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getMonthDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#2c3e50', margin: 0 }}>Calendario de Tarifas</h2>
        <p>Cargando tarifas...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#2c3e50', margin: 0 }}>Calendario de Tarifas</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Mes anterior
          </button>
          <span style={{ 
            padding: '8px 16px', 
            background: '#f8f9fa', 
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Mes siguiente →
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '2px', 
        background: '#e9ecef',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Días de la semana */}
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
          <div key={d} style={{ 
            padding: '12px', 
            background: '#f8f9fa', 
            textAlign: 'center',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            {d}
          </div>
        ))}
        
        {/* Días vacíos al inicio */}
        {Array(firstDay).fill(null).map((_, i) => (
          <div key={`empty-${i}`} style={{ background: '#fff', minHeight: '80px' }}></div>
        ))}
        
        {/* Días del mes */}
        {days.map((date) => {
          const key = date.toISOString().slice(0, 10);
          const dayRates = rates[key] || [];
          const hasPromo = dayRates.some((r) => r.promoActive);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={key}
              style={{
                background: isToday ? '#e3f2fd' : '#fff',
                minHeight: '80px',
                padding: '8px',
                cursor: 'pointer',
                position: 'relative',
                border: '1px solid #dee2e6',
                transition: 'background-color 0.2s'
              }}
              onClick={() => openModal(date)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = isToday ? '#e3f2fd' : '#fff'}
            >
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: isToday ? '#1976d2' : '#495057'
              }}>
                {date.getDate()}
              </div>
              {hasPromo && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: '#f59e42',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '10px',
                  padding: '2px 6px',
                  fontWeight: 'bold'
                }}>
                  Promo
                </span>
              )}
              {dayRates.length > 0 && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6c757d',
                  marginTop: '4px'
                }}>
                  ${dayRates[0]?.dynamicRate?.toLocaleString() || '0'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalOpen && selectedDate && (
        <RatesModal
          date={selectedDate}
          rates={rates[selectedDate.toISOString().slice(0, 10)] || []}
          roomTypes={roomTypes}
          onClose={closeModal}
          onOverride={handleOverride}
        />
      )}
    </div>
  );
}

function RatesModal({ date, rates, roomTypes, onClose, onOverride }) {
  const [editingRates, setEditingRates] = useState({});

  const handleRateChange = (roomTypeId, field, value) => {
    setEditingRates(prev => ({
      ...prev,
      [roomTypeId]: { ...prev[roomTypeId], [field]: value }
    }));
  };

  const handleSave = () => {
    Object.entries(editingRates).forEach(([roomTypeId, rate]) => {
      if (rate.dynamicRate) {
        onOverride(parseInt(roomTypeId), rate.dynamicRate);
      }
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      background: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px', 
        minWidth: '600px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>
            Tarifas para {date.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6c757d'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                  Tipo de Habitación
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                  Base
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                  Dinámica
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                  Desayuno
                </th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                  Media Pensión
                </th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                  Override
                </th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => {
                const r = rates.find((x) => x.roomTypeId === rt.id) || {};
                const editing = editingRates[rt.id] || {};
                
                return (
                  <tr key={rt.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      {rt.name}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6c757d' }}>
                      ${r.baseRate?.toLocaleString() || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                      ${r.dynamicRate?.toLocaleString() || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#28a745' }}>
                      ${r.withBreakfast?.toLocaleString() || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#dc3545' }}>
                      ${r.withHalfBoard?.toLocaleString() || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        placeholder={r.dynamicRate?.toString() || '0'}
                        value={editing.dynamicRate || ''}
                        onChange={(e) => handleRateChange(rt.id, 'dynamicRate', e.target.value)}
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ 
          marginTop: '20px', 
          display: 'flex', 
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
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
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
} 