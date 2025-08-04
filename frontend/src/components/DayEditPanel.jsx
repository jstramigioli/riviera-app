import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaTimes, FaSave, FaDollarSign, FaCalculator, FaEdit } from 'react-icons/fa';
import SidePanel from './SidePanel';
import styles from '../styles/DayEditPanel.module.css';

export default function DayEditPanel({ 
  isOpen, 
  onClose, 
  selectedDate, 
  dayData, 
  roomTypes, 
  onSave 
}) {
  const [formData, setFormData] = useState({
    isClosed: true,
    isHoliday: false,
    priceType: 'dynamic', // 'dynamic' o 'fixed'
    fixedPrice: null,
    notes: '',
    roomTypePrices: []
  });

  useEffect(() => {
    console.log('DayEditPanel useEffect - selectedDate:', selectedDate);
    console.log('DayEditPanel useEffect - dayData:', dayData);
    console.log('DayEditPanel useEffect - roomTypes:', roomTypes);
    
    if (selectedDate && dayData) {
      console.log('Setting form data for existing day');
      setFormData({
        isClosed: dayData.isClosed !== undefined ? dayData.isClosed : true,
        isHoliday: dayData.isHoliday || false,
        priceType: dayData.fixedPrice ? 'fixed' : 'dynamic',
        fixedPrice: dayData.fixedPrice ? dayData.fixedPrice / 100 : null,
        notes: dayData.notes || '',
        roomTypePrices: roomTypes.map(roomType => ({
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          multiplier: roomType.multiplier,
          fixedPrice: null, // Precio fijo específico para este tipo
          useFixedPrice: false
        }))
      });
    } else if (selectedDate) {
      console.log('Setting form data for new day');
      // Nuevo día
      setFormData({
        isClosed: true,
        isHoliday: false,
        priceType: 'dynamic',
        fixedPrice: null,
        notes: '',
        roomTypePrices: roomTypes.map(roomType => ({
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          multiplier: roomType.multiplier,
          fixedPrice: null,
          useFixedPrice: false
        }))
      });
    }
  }, [selectedDate, dayData, roomTypes]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Nueva función para actualizar todos los precios personalizados
  const handleCustomPriceChange = (roomTypeId, value) => {
    // Si el valor es vacío, limpiar todos los precios personalizados
    if (value === '' || value === null || isNaN(value)) {
      setFormData(prev => ({
        ...prev,
        roomTypePrices: prev.roomTypePrices.map(rtp => ({
          ...rtp,
          fixedPrice: null,
          useFixedPrice: false
        }))
      }));
      return;
    }
    // Si hay valor, actualizar todos los tipos
    setFormData(prev => ({
      ...prev,
      roomTypePrices: prev.roomTypePrices.map(rtp => ({
        ...rtp,
        fixedPrice: Math.round(parseFloat(value) * rtp.multiplier * 100) / 100,
        useFixedPrice: true
      }))
    }));
  };

  const calculateBasePrice = () => {
    // TODO: Implementar cálculo de precio base dinámico
    return 50; // $50 USD por defecto
  };

  const calculateRoomTypePrice = (roomType) => {
    if (roomType.useFixedPrice && roomType.fixedPrice) {
      return roomType.fixedPrice;
    }
    
    const basePrice = formData.priceType === 'fixed' && formData.fixedPrice 
      ? formData.fixedPrice 
      : calculateBasePrice();
    
    return Math.round(basePrice * roomType.multiplier);
  };

  const handleSave = () => {
    const saveData = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      isClosed: formData.isClosed,
      isHoliday: formData.isHoliday,
      priceType: formData.priceType,
      fixedPrice: formData.priceType === 'fixed' && formData.fixedPrice 
        ? Math.round(formData.fixedPrice * 100) 
        : null,
      notes: formData.notes,
      roomTypePrices: formData.roomTypePrices.map(rtp => ({
        roomTypeId: rtp.roomTypeId,
        useFixedPrice: rtp.useFixedPrice,
        fixedPrice: rtp.useFixedPrice && rtp.fixedPrice 
          ? Math.round(rtp.fixedPrice * 100) 
          : null
      }))
    };

    onSave(saveData);
  };

  console.log('DayEditPanel render - formData:', formData);
  console.log('DayEditPanel render - isClosed:', formData.isClosed);
  
  if (!selectedDate) return null;

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={`Editar Día - ${format(selectedDate, 'dd \'de\' MMMM \'de\' yyyy', { locale: es })}`}
      width={600}
    >
      <div className={styles.content}>
        {/* Estado del día */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Estado del Día</h3>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isClosed}
                onChange={e => handleInputChange('isClosed', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                Cerrado este día
              </span>
            </label>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isHoliday}
                onChange={e => handleInputChange('isHoliday', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                🏖️ Feriado/Fin de semana largo
              </span>
            </label>
          </div>
        </div>

        {/* Si el día está abierto, mostrar precios */}
        {!formData.isClosed && (
          <>
            {/* Precio base */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Precio Base</h3>
              <div className={styles.priceTypeSelector}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="priceType"
                    value="dynamic"
                    checked={formData.priceType === 'dynamic'}
                    onChange={e => handleInputChange('priceType', e.target.value)}
                    className={styles.radio}
                  />
                  <span className={styles.radioText}>
                    <FaCalculator className={styles.radioIcon} />
                    Precio dinámico (calculado automáticamente)
                  </span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="priceType"
                    value="fixed"
                    checked={formData.priceType === 'fixed'}
                    onChange={e => handleInputChange('priceType', e.target.value)}
                    className={styles.radio}
                  />
                  <span className={styles.radioText}>
                    <FaDollarSign className={styles.radioIcon} />
                    Precio fijo
                  </span>
                </label>
              </div>
              {formData.priceType === 'fixed' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Precio base (USD)
                  </label>
                  <div className={styles.priceInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      type="number"
                      value={formData.fixedPrice || ''}
                      onChange={e => handleInputChange('fixedPrice', parseFloat(e.target.value) || null)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className={styles.input}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Notas o Evento Especial</h3>
              <div className={styles.formGroup}>
                <textarea
                  value={formData.notes}
                  onChange={e => handleInputChange('notes', e.target.value)}
                  placeholder="Descripción del evento, notas especiales, etc."
                  rows={3}
                  className={styles.textarea}
                />
              </div>
            </div>

            {/* Tarifas por tipo de habitación */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Tarifas por Tipo de Habitación</h3>
              <div className={styles.roomTypesTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.headerCell}>Tipo</div>
                  <div className={styles.headerCell}>Multiplicador</div>
                  <div className={styles.headerCell}>Precio Base</div>
                  <div className={styles.headerCell}>Precio Final</div>
                  <div className={styles.headerCell}>Precio Personalizado</div>
                </div>
                {formData.roomTypePrices.map((roomType) => (
                  <div key={roomType.roomTypeId} className={styles.tableRow}>
                    <div className={styles.cell}>
                      <strong>{roomType.roomTypeName}</strong>
                    </div>
                    <div className={styles.cell}>
                      <span className={styles.multiplier}>
                        x{roomType.multiplier}
                      </span>
                    </div>
                    <div className={styles.cell}>
                      <span className={styles.basePrice}>
                        ${(formData.priceType === 'fixed' && formData.fixedPrice ? formData.fixedPrice : calculateBasePrice()).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.cell}>
                      <span className={styles.finalPrice}>
                        ${calculateRoomTypePrice(roomType).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.fixedPriceInput}>
                        <span className={styles.currencySymbol}>$</span>
                        <input
                          type="number"
                          value={roomType.fixedPrice || ''}
                          onChange={e => handleCustomPriceChange(roomType.roomTypeId, e.target.value)}
                          placeholder="Precio personalizado"
                          step="0.01"
                          min="0"
                          className={styles.smallInput}
                        />
                      </div>
                      {roomType.fixedPrice && (
                        <div className={styles.priceNote}>
                          Precio personalizado activo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Botones de acción */}
        <div className={styles.actions}>
          <button 
            type="button" 
            onClick={onClose} 
            className={styles.cancelButton}
          >
            <FaTimes />
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            className={styles.saveButton}
          >
            <FaSave />
            Guardar Cambios
          </button>
        </div>
      </div>
    </SidePanel>
  );
} 