
import './App.css'
import RoomList from './components/RoomList'
import ReservationGrid from './components/ReservationGrid';

function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Hotel Riviera - Gestión de Reservas</h1>
      <p>¡Bienvenido! Aquí podrás gestionar habitaciones, clientes y reservas.</p>
      <p>Estas son las reservas:</p>
      <ReservationGrid />
    </div>
  );
}

export default App
