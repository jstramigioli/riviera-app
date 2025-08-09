import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FaTimes, FaTrash } from 'react-icons/fa';
import styles from '../SeasonalCurveEditor.module.css';

export default function EditPointModal({ 
  point, 
  onClose, 
  onSave, 
  onDelete, 
  selectedRoomType = 'doble', 
  selectedPriceType = 'base', 
  roomTypes = [] 
}) {
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const [roomType, setRoomType] = useState(selectedRoomType);

  useEffect(() => {
    if (point) {
      setDate(format(new Date(point.date), 'yyyy-MM-dd'));
      setValue(point.value.toString());
      setRoomType(point.roomType || selectedRoomType);
    }
  }, [point, selectedRoomType]);

  const getRoomTypeName = (type) => {
    const roomType = roomTypes.find(rt => rt.id === type);
    return roomType ? roomType.name : type;
  };

  const getPriceTypeName = (type) => {
    const types = {
      'base': 'Precio Base',
      'breakfast': 'Con Desayuno',
      'halfBoard': 'Media Pensión'
    };
    return types[type] || type;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!date || !value) {
      alert('Por favor complete todos los campos');
      return;
    }

    const updatedPoint = {
      ...point,
      date: date,
      value: parseFloat(value),
      roomType: roomType
    };

    onSave(updatedPoint);
  };

  const handleDelete = () => {
    if (window.confirm('¿Está seguro de que desea eliminar este punto?')) {
      onDelete(point.id);
    }
  };

  if (!point) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Editar Punto de Precio</h3>
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

          <div className={styles.pointInfo}>
            <p><strong>Tipo de Precio:</strong> {getPriceTypeName(selectedPriceType)}</p>
            <p><strong>Habitación:</strong> {getRoomTypeName(roomType)}</p>
          </div>

          <div className={styles.modalActions}>
            <button 
              type="button" 
              onClick={handleDelete} 
              className={styles.deleteButton}
            >
              <FaTrash /> Eliminar
            </button>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton}>
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 