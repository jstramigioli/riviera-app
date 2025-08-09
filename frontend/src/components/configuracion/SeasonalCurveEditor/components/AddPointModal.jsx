import React, { useState } from 'react';
import { format } from 'date-fns';
import { FaTimes } from 'react-icons/fa';
import styles from '../SeasonalCurveEditor.module.css';

export default function AddPointModal({ 
  onClose, 
  onAdd, 
  selectedRoomType = 'doble', 
  roomTypes = [] 
}) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [value, setValue] = useState('');
  const [roomType, setRoomType] = useState(selectedRoomType);

  const getRoomTypeName = (type) => {
    const roomType = roomTypes.find(rt => rt.id === type);
    return roomType ? roomType.name : type;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!date || !value) {
      alert('Por favor complete todos los campos');
      return;
    }

    const newPoint = {
      id: Date.now().toString(), // ID temporal
      date: date,
      value: parseFloat(value),
      roomType: roomType
    };

    onAdd(newPoint);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Agregar Punto de Precio</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="date">Fecha:</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="value">Precio Base:</label>
            <input
              type="number"
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ingrese el precio"
              min="0"
              step="0.01"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="roomType">Tipo de Habitación:</label>
            <select
              id="roomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className={styles.select}
            >
              {roomTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton}>
              Agregar Punto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 