import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import styles from './ReservationConfirmationModal.module.css';
import { API_URL } from '../services/api.js';

const ReservationConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  reservationData,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [reservationStatus, setReservationStatus] = useState('PENDIENTE');
  const [segmentPricing, setSegmentPricing] = useState({});
  const [discountType, setDiscountType] = useState(''); // '' | PERCENT | FIXED
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  
  const reservationStatuses = useMemo(() => {
    const statuses = [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'CONFIRMADA', label: 'Confirmada' }
    ];
    
    if (reservationData?.segments && reservationData.segments.length > 0) {
      const firstCheckIn = reservationData.segments[0].checkIn;
      if (firstCheckIn) {
        const checkInDate = new Date(firstCheckIn);
        const today = new Date();
        checkInDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (checkInDate <= today) {
          statuses.push({ value: 'INGRESADA', label: 'Ingresada' });
        }
      }
    }
    
    return statuses;
  }, [reservationData]);

  useEffect(() => {
    if (!isOpen || !reservationData?.segments) return;

    const initial = {};
    reservationData.segments.forEach((segment, index) => {
      const room = reservationData.selectedRoomsPerBlock?.[index];
      const rates = room?.ratesData?.rates || [];
      const nights = (() => {
        if (!segment.checkIn || !segment.checkOut) return 0;
        return Math.ceil(
          (new Date(segment.checkOut) - new Date(segment.checkIn)) / (1000 * 60 * 60 * 24)
        );
      })();
      let listRate = null;
      if (rates.length > 0) {
        listRate = rates.reduce((sum, r) => sum + (r.listRate || r.serviceRate || r.baseRate || 0), 0) / rates.length;
      } else if (room?.ratesData?.totalAmount && nights > 0) {
        listRate = room.ratesData.totalAmount / nights;
      } else if (room?.price && nights > 0) {
        listRate = room.price;
      }
      initial[index] = {
        listRate: listRate || 0,
        manualRate: '',
        notes: ''
      };
    });
    setSegmentPricing(initial);
    setDiscountType('');
    setDiscountValue('');
    setDiscountReason('');
  }, [isOpen, reservationData]);
  
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/service-types?hotelId=default-hotel`);
        if (response.ok) {
          const data = await response.json();
          setServiceTypes(data.data || []);
        }
      } catch (error) {
        console.error('Error loading service types:', error);
      }
    };
    loadServiceTypes();
  }, []);

  useEffect(() => {
    const availableValues = reservationStatuses.map(s => s.value);
    if (!availableValues.includes(reservationStatus)) {
      setReservationStatus('PENDIENTE');
    }
  }, [reservationData, reservationStatus, reservationStatuses]);
  
  if (!isOpen) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    if (!serviceType) {
      return `Servicio (ID: ${serviceTypeId})`;
    }
    return serviceType.name;
  };

  const getSegmentNights = (segment) => {
    if (!segment?.checkIn || !segment?.checkOut) return 0;
    return Math.ceil(
      (new Date(segment.checkOut) - new Date(segment.checkIn)) / (1000 * 60 * 60 * 24)
    );
  };

  const getSegmentAgreedRate = (index) => {
    const pricing = segmentPricing[index];
    if (!pricing) return 0;
    if (pricing.manualRate !== '' && Number(pricing.manualRate) > 0) {
      return Number(pricing.manualRate);
    }
    return Number(pricing.listRate) || 0;
  };

  const lodgingSubtotal = useMemo(() => {
    if (!reservationData?.segments) return 0;
    return reservationData.segments.reduce((sum, segment, index) => {
      const nights = getSegmentNights(segment);
      return sum + nights * getSegmentAgreedRate(index);
    }, 0);
  }, [reservationData, segmentPricing]);

  const discountAmount = useMemo(() => {
    const value = Number(discountValue);
    if (!discountType || !value || value <= 0) return 0;
    if (discountType === 'PERCENT') return lodgingSubtotal * (value / 100);
    return value;
  }, [discountType, discountValue, lodgingSubtotal]);

  const finalTotal = Math.max(0, lodgingSubtotal - discountAmount);

  const handleConfirm = () => {
    onConfirm({
      status: reservationStatus,
      segmentPricing,
      discount: discountType
        ? {
            type: discountType,
            value: Number(discountValue) || 0,
            reason: discountReason
          }
        : null
    });
  };

  const handleCancel = () => {
    onClose();
  };

  const updateSegmentPricing = (index, patch) => {
    setSegmentPricing((prev) => ({
      ...prev,
      [index]: { ...prev[index], ...patch }
    }));
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div className={styles.icon}>🏨</div>
          <h2 className={styles.title}>Datos de la Reserva</h2>
        </div>
        
        <div className={styles.body}>
          <div className={styles.clientSection}>
            <span className={styles.clientName} onClick={() => navigate(`/clients/${reservationData?.mainClient?.id || 'new'}`)}>
              {reservationData?.mainClient?.firstName} {reservationData?.mainClient?.lastName}
            </span>
          </div>

          {reservationData?.segments && reservationData.segments.length > 0 && (
            <div className={styles.staySection}>
              <table className={styles.stayTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Check-in:</td>
                    <td className={styles.tableValue}>{formatDate(reservationData.segments[0].checkIn)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Check-out:</td>
                    <td className={styles.tableValue}>{formatDate(reservationData.segments[reservationData.segments.length - 1].checkOut)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Noches:</td>
                    <td className={styles.tableValue}>
                      {(() => {
                        const firstCheckIn = new Date(reservationData.segments[0].checkIn);
                        const lastCheckOut = new Date(reservationData.segments[reservationData.segments.length - 1].checkOut);
                        return Math.ceil((lastCheckOut - firstCheckIn) / (1000 * 60 * 60 * 24));
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {reservationData?.segments?.map((segment, index) => {
            const selectedRoom = reservationData.selectedRoomsPerBlock?.[index];
            const nights = getSegmentNights(segment);
            const pricing = segmentPricing[index] || { listRate: 0, manualRate: '' };
            const agreed = getSegmentAgreedRate(index);

            return (
              <div key={segment.id || index} className={styles.segmentDetail}>
                <div className={styles.segmentTitle}>
                  Tramo {index + 1}: {formatDate(segment.checkIn)} – {formatDate(segment.checkOut)}
                </div>
                <div className={styles.segmentInfo}>
                  <div><strong>Servicio:</strong> {getServiceTypeLabel(segment.serviceType)}</div>
                  <div><strong>Habitación:</strong> {selectedRoom?.name || 'No especificada'}</div>
                  <div><strong>Noches:</strong> {nights}</div>
                  <div><strong>Tarifa de lista:</strong> ${Number(pricing.listRate || 0).toLocaleString('es-AR')}/noche</div>
                  <label className={styles.pricingField}>
                    <span>Precio especial /noche (opcional)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={String(Math.round(pricing.listRate || 0))}
                      value={pricing.manualRate}
                      onChange={(e) => updateSegmentPricing(index, { manualRate: e.target.value })}
                    />
                  </label>
                  <div><strong>Subtotal tramo:</strong> ${Math.round(agreed * nights).toLocaleString('es-AR')}</div>
                </div>
              </div>
            );
          })}

          <div className={styles.discountSection}>
            <h3 className={styles.sectionHeading}>Descuento (opcional)</h3>
            <div className={styles.discountRow}>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
              >
                <option value="">Sin descuento</option>
                <option value="PERCENT">Porcentaje %</option>
                <option value="FIXED">Monto fijo $</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!discountType}
                placeholder={discountType === 'PERCENT' ? '%' : '$'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
            <input
              className={styles.discountReason}
              type="text"
              disabled={!discountType}
              placeholder="Motivo del descuento"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
            />
          </div>

          <div className={styles.totalSection}>
            <table className={styles.totalTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Subtotal alojamiento:</td>
                  <td className={styles.tableValue}>${Math.round(lodgingSubtotal).toLocaleString('es-AR')}</td>
                </tr>
                {discountAmount > 0 && (
                  <tr>
                    <td className={styles.tableLabel}>Descuento:</td>
                    <td className={styles.tableValue}>-${Math.round(discountAmount).toLocaleString('es-AR')}</td>
                  </tr>
                )}
                <tr>
                  <td className={styles.tableLabel}>Total:</td>
                  <td className={styles.tableValue}>
                    <strong>${Math.round(finalTotal).toLocaleString('es-AR')}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {reservationData?.notes && reservationData.notes.trim() !== '' && (
            <div className={styles.notesSection}>
              <table className={styles.notesTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Notas:</td>
                    <td className={styles.tableValue}>{reservationData.notes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.statusSection}>
            <table className={styles.statusTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Estado:</td>
                  <td className={styles.tableValue}>
                    <select
                      value={reservationStatus}
                      onChange={(e) => setReservationStatus(e.target.value)}
                      className={styles.statusSelect}
                    >
                      {reservationStatuses.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </button>
          <button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Creando...' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationModal;
