import { useState, useEffect } from 'react';
import RoomList from './components/RoomList'
import ReservationGrid from './components/ReservationGrid';
import { fetchRooms, fetchReservations } from './services/api';
import SidePanel from './components/SidePanel';
import { format } from 'date-fns';
import { FaPen } from 'react-icons/fa';

async function updateReservationOnServer(reservationId, updateData, setReservations) {
  // Actualización optimista
  setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, ...updateData } : r));
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/reservations/${reservationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (response.ok) {
      const updated = await response.json();
      setReservations(prev => prev.map(r => r.id === reservationId ? updated : r));
    } else {
      throw new Error('Error al actualizar en backend');
    }
  } catch {
    alert('Error de conexión. Los cambios se han revertido.');
    // Revertir
    setReservations(await fetchReservations());
  }
}

function App() {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    Promise.all([fetchRooms(), fetchReservations()])
      .then(([roomsData, reservationsData]) => {
        console.log('Rooms loaded:', roomsData.length);
        console.log('Reservations loaded:', reservationsData.length);
        console.log('Sample reservation:', reservationsData[0]);
        setRooms(roomsData);
        setReservations(reservationsData);
      })
      .catch(err => {
        console.error('Error loading data:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleReservationClick(reservation) {
    setSelectedReservation(reservation);
    setEditData(reservation);
    setIsEditing(false);
    setSidePanelOpen(true);
  }

  function handleEditChange(field, value) {
    setEditData(prev => ({ ...prev, [field]: value }));
  }

  function handleEditToggle() {
    setIsEditing(edit => !edit);
    setEditData(selectedReservation);
  }

  function handleEditSave() {
    // Aquí podrías llamar a updateReservationOnServer
    setIsEditing(false);
    setSelectedReservation(editData);
    // updateReservationOnServer(editData.id, editData, setReservations); // si quieres guardar
  }

  if (loading) return <p>Cargando datos...</p>;
  if (error) return <p style={{color: 'red'}}>Error: {error}</p>;

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      boxSizing: 'border-box',
      alignItems: 'center'
    }}>
      <div style={{ flexShrink: 0, marginBottom: '1rem' }}>
        <h1>Hotel Riviera - Gestión de Reservas</h1>
        <p>¡Bienvenido! Aquí podrás gestionar habitaciones, clientes y reservas.</p>
        <p>Habitaciones: {rooms.length} | Reservas: {reservations.length}</p>
      </div>
      
      <ReservationGrid 
        rooms={rooms} 
        reservations={reservations}
        setReservations={setReservations}
        updateReservation={(id, data) => updateReservationOnServer(id, data, setReservations)}
        onReservationClick={handleReservationClick}
      />
      <SidePanel
        open={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        title={"DATOS DE LA RESERVA"}
        width={520}
      >
        {selectedReservation && (
          <div style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.95rem', color: '#888' }}>{selectedReservation.id}</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#666', marginLeft: 8 }} title={isEditing ? "Cancelar edición" : "Editar reserva"} onClick={handleEditToggle}>
                <FaPen />
              </button>
              {isEditing && (
                <button style={{ marginLeft: 8, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 16 }} onClick={handleEditSave}>
                  Guardar
                </button>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: '1.35rem', marginBottom: 12 }}>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.room?.name || ''}
                  onChange={e => handleEditChange('room', { ...editData.room, name: e.target.value })}
                  style={{ fontWeight: 600, fontSize: '1.2rem', width: '80%' }}
                />
              ) : (
                selectedReservation.room?.name && /^\d+$/.test(selectedReservation.room.name)
                  ? `Habitación ${selectedReservation.room.name}`
                  : selectedReservation.room?.name || ''
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: '1.15rem', marginBottom: 12 }}>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.mainClient?.firstName + ' ' + (editData.mainClient?.lastName || '')}
                  onChange={e => {
                    const [firstName, ...lastName] = e.target.value.split(' ');
                    handleEditChange('mainClient', { ...editData.mainClient, firstName, lastName: lastName.join(' ') });
                  }}
                  style={{ fontWeight: 600, fontSize: '1.1rem', width: '80%' }}
                />
              ) : (
                selectedReservation.mainClient?.firstName + ' ' + (selectedReservation.mainClient?.lastName || '')
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Check-in:</b> {isEditing ? (
                <input
                  type="date"
                  value={format(new Date(editData.checkIn), 'yyyy-MM-dd')}
                  onChange={e => handleEditChange('checkIn', e.target.value)}
                  style={{ fontSize: '1rem' }}
                />
              ) : (
                format(new Date(selectedReservation.checkIn), 'dd/MM/yyyy')
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Check-out:</b> {isEditing ? (
                <input
                  type="date"
                  value={format(new Date(editData.checkOut), 'yyyy-MM-dd')}
                  onChange={e => handleEditChange('checkOut', e.target.value)}
                  style={{ fontSize: '1rem' }}
                />
              ) : (
                format(new Date(selectedReservation.checkOut), 'dd/MM/yyyy')
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Tipo de reserva:</b> {isEditing ? (
                <select value={editData.status} onChange={e => handleEditChange('status', e.target.value)} style={{ fontSize: '1rem' }}>
                  <option value="active">Sin desayuno</option>
                  <option value="con_desayuno">Con desayuno</option>
                  <option value="media_pension">Con media pensión</option>
                </select>
              ) : (
                selectedReservation.status === 'active' ? 'Sin desayuno'
                  : selectedReservation.status === 'con_desayuno' ? 'Con desayuno'
                  : selectedReservation.status === 'media_pension' ? 'Con media pensión'
                  : selectedReservation.status
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>Monto total:</b> {isEditing ? (
                <input
                  type="number"
                  value={editData.totalAmount || ''}
                  onChange={e => handleEditChange('totalAmount', Number(e.target.value))}
                  style={{ fontSize: '1rem', width: 120 }}
                />
              ) : (
                `$${selectedReservation.totalAmount?.toLocaleString('es-AR')}`
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

export default App
