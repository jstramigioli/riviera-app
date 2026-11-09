import React, { useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import useReservationStatuses from '../../hooks/useReservationStatuses';
import styles from './ReservationTabs.module.css';

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '0.95rem',
  boxSizing: 'border-box'
};

const toDateInput = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

/** Total de la estadía: nunca confundir con tarifa/noche (baseRate). */
const resolveReservationTotal = (reservation, nights) => {
  const explicit = Number(reservation?.totalAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const activeSegments = (reservation?.segments || []).filter((s) => s.isActive !== false);
  const segments = activeSegments.length > 0 ? activeSegments : (reservation?.segments || []);
  if (segments.length > 0) {
    const fromSegments = segments.reduce((sum, segment) => {
      const start = segment.startDate ? new Date(segment.startDate) : null;
      const end = segment.endDate ? new Date(segment.endDate) : null;
      const segNights = start && end
        ? Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
        : nights || 1;
      const rate = Number(segment.baseRate) || 0;
      return sum + rate * segNights;
    }, 0);
    if (fromSegments > 0) return fromSegments;
  }

  const nightly = Number(reservation?.averageRate || reservation?.segments?.[0]?.baseRate) || 0;
  if (nightly > 0 && nights > 0) return nightly * nights;
  return 0;
};

const GeneralInfoTab = ({ 
  reservation,
  editData,
  isEditing = false,
  rooms = [],
  clients = [],
  serviceTypes = [],
  onEditChange,
  financialSummary, 
  formatDate, 
  formatCurrency, 
  getServiceTypeLabel,
  getStatusLabel 
}) => {
  const { statuses: statusOptions } = useReservationStatuses();
  const [financialExpanded, setFinancialExpanded] = useState(false);

  if (!reservation) return null;

  const data = isEditing && editData ? editData : reservation;

  const checkIn = data.checkIn || data.segments?.[0]?.startDate;
  const checkOut = data.checkOut || data.segments?.[data.segments?.length - 1]?.endDate;
  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    : 0;
  const guestCount = data.segments?.[0]?.guestCount || data.requiredGuests || 1;
  const serviceId = data.segments?.[0]?.services?.[0] || data.reservationType || '';
  const reservationTotal = resolveReservationTotal(reservation, nights);
  const totalPagos = Number(financialSummary?.resumen?.totalPagos) || 0;
  const totalCargosRaw = Number(financialSummary?.resumen?.totalCargos) || 0;
  // Si los cargos están desfasados (p.ej. solo 1 noche), el total de reserva manda.
  const totalCargosDisplay = Math.max(totalCargosRaw, reservationTotal);
  const saldoDisplay = totalCargosDisplay - totalPagos;
  const estadoPago = saldoDisplay > 0 ? 'PENDIENTE' : (saldoDisplay < 0 ? 'A_FAVOR' : 'PAGADO');

  const cargoItems = financialSummary?.cargos?.items || [];
  const pagoItems = financialSummary?.pagos?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};

  const handleSegmentField = (field, value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) segments[0] = {};
    segments[0] = { ...segments[0], [field]: value };
    onEditChange('segments', segments);
  };

  const handleServiceChange = (value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) segments[0] = {};
    segments[0] = { ...segments[0], services: value ? [value] : [] };
    onEditChange('segments', segments);
  };

  return (
    <div className={styles.tabContent}>
      <h3 className={styles.sectionTitle}>Información General</h3>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-in:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="date"
                value={toDateInput(checkIn)}
                onChange={(e) => {
                  onEditChange('checkIn', e.target.value);
                  handleSegmentField('startDate', e.target.value);
                }}
                style={inputStyle}
              />
            ) : (
              formatDate(checkIn)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Check-out:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="date"
                value={toDateInput(checkOut)}
                onChange={(e) => {
                  onEditChange('checkOut', e.target.value);
                  const segments = [...(editData?.segments || reservation.segments || [])];
                  const lastIdx = Math.max(segments.length - 1, 0);
                  if (!segments[lastIdx]) segments[lastIdx] = {};
                  segments[lastIdx] = { ...segments[lastIdx], endDate: e.target.value };
                  onEditChange('segments', segments);
                }}
                style={inputStyle}
              />
            ) : (
              formatDate(checkOut)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Noches:</span>
          <span className={styles.infoValue}>{nights || '—'}</span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Estado:</span>
          <span className={`${styles.infoValue} ${!isEditing ? `${styles.statusBadge} ${styles[reservation.status]}` : ''}`}>
            {isEditing ? (
              <select
                value={data.status || reservation.status}
                onChange={(e) => onEditChange('status', e.target.value)}
                style={inputStyle}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              getStatusLabel(reservation.status)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Huéspedes:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 1;
                  handleSegmentField('guestCount', value);
                  onEditChange('requiredGuests', value);
                }}
                style={inputStyle}
              />
            ) : (
              <>
                {guestCount} persona{guestCount > 1 ? 's' : ''}
              </>
            )}
          </span>
        </div>

        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Cliente:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={data.mainClientId || reservation.mainClientId || ''}
                onChange={(e) => onEditChange('mainClientId', parseInt(e.target.value, 10))}
                style={inputStyle}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </option>
                ))}
              </select>
            ) : (
              `${reservation.mainClient?.firstName || ''} ${reservation.mainClient?.lastName || ''}`.trim() || '—'
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Habitación:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={data.roomId || reservation.roomId || ''}
                onChange={(e) => onEditChange('roomId', parseInt(e.target.value, 10))}
                style={inputStyle}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            ) : reservation.room ? (
              <a href={`/rooms/${reservation.room.id}`} className={styles.link}>
                {reservation.room.name}
              </a>
            ) : (
              'Sin habitación'
            )}
          </span>
        </div>
        
        {!isEditing && reservation.room && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tipo:</span>
            <span className={styles.infoValue}>{reservation.room.roomType?.name || 'No especificado'}</span>
          </div>
        )}
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Servicio:</span>
          <span className={styles.infoValue}>
            {isEditing ? (
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar…</option>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            ) : (
              getServiceTypeLabel(serviceId)
            )}
          </span>
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Total:</span>
          <span className={`${styles.infoValue} ${!isEditing ? styles.highlight : ''}`} data-testid="reservation-total">
            {isEditing ? (
              <input
                type="number"
                value={data.totalAmount ?? reservationTotal ?? 0}
                onChange={(e) => onEditChange('totalAmount', parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            ) : reservationTotal > 0 ? (
              formatCurrency(reservationTotal)
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      <div className={styles.notesBox}>
        <h4>Notas:</h4>
        {isEditing ? (
          <textarea
            value={data.notes ?? reservation.notes ?? ''}
            onChange={(e) => onEditChange('notes', e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Notas adicionales…"
          />
        ) : (
          <p>{reservation.notes || 'Sin notas'}</p>
        )}
      </div>

      {financialSummary && (
        <div className={`${styles.financialAlert} ${financialExpanded ? styles.financialAlertExpanded : ''}`}>
          <button
            type="button"
            className={styles.financialAlertToggle}
            onClick={() => setFinancialExpanded((v) => !v)}
            aria-expanded={financialExpanded}
          >
            <span className={styles.financialAlertHeader}>Estado Financiero</span>
            <span className={styles.financialExpandIcon} aria-hidden="true">
              {financialExpanded ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          </button>
          <div className={styles.financialAlertBody}>
            <div className={styles.financialRow}>
              <span>Total reserva:</span>
              <strong data-testid="financial-total-reserva">{formatCurrency(reservationTotal)}</strong>
            </div>
            <div className={styles.financialRow}>
              <span>Total cargos:</span>
              <strong>{formatCurrency(totalCargosDisplay)}</strong>
            </div>
            <div className={styles.financialRow}>
              <span>Total pagos:</span>
              <strong>{formatCurrency(totalPagos)}</strong>
            </div>
            <div className={`${styles.financialRow} ${styles.saldoRow} ${styles[estadoPago]}`}>
              <span>Saldo:</span>
              <strong>{formatCurrency(saldoDisplay)}</strong>
            </div>
            <div className={styles.estadoPagoTag}>
              {estadoPago === 'PENDIENTE' && 'Pendiente de pago'}
              {estadoPago === 'PAGADO' && 'Pagado completamente'}
              {estadoPago === 'A_FAVOR' && 'Saldo a favor'}
            </div>
          </div>

          {financialExpanded && (
            <div className={styles.financialBreakdown}>
              <div className={styles.breakdownSection}>
                <h4>Desglose de montos</h4>
                {Object.keys(cargosPorTipo).length > 0 ? (
                  <ul className={styles.breakdownList}>
                    {Object.values(cargosPorTipo).map((tipo) => (
                      <li key={tipo.codigo} className={styles.breakdownGroup}>
                        <div className={styles.breakdownGroupHeader}>
                          <span>{tipo.nombre}</span>
                          <strong>{formatCurrency(tipo.total)}</strong>
                        </div>
                        {(tipo.items || []).map((item) => (
                          <div key={item.id} className={styles.breakdownItem}>
                            <span>{item.descripcion || 'Cargo'}</span>
                            <span>{formatCurrency(item.monto)}</span>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : cargoItems.length > 0 ? (
                  <ul className={styles.breakdownList}>
                    {cargoItems.map((item) => (
                      <li key={item.id} className={styles.breakdownItem}>
                        <span>{item.descripcion || 'Cargo'}</span>
                        <span>{formatCurrency(item.monto)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.breakdownEmpty}>
                    Sin cargos registrados. Total de reserva: {formatCurrency(reservationTotal)}
                    {nights > 1 ? ` (${nights} noches).` : '.'}
                  </p>
                )}

                {totalCargosRaw > 0 && totalCargosRaw < reservationTotal && (
                  <p className={styles.breakdownHint}>
                    Los cargos cargados ({formatCurrency(totalCargosRaw)}) son menores al total
                    de la reserva ({formatCurrency(reservationTotal)}). Se usa el total de la estadía.
                  </p>
                )}
              </div>

              <div className={styles.breakdownSection}>
                <h4>Pagos</h4>
                {pagoItems.length > 0 ? (
                  <ul className={styles.breakdownList}>
                    {pagoItems.map((pago) => (
                      <li key={pago.id} className={styles.breakdownItem}>
                        <span>{pago.metodo || 'Pago'}{pago.fecha ? ` · ${formatDate(pago.fecha)}` : ''}</span>
                        <span>{formatCurrency(pago.montoARS ?? pago.monto)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.breakdownEmpty}>Sin pagos registrados.</p>
                )}
              </div>

              {nights > 0 && reservationTotal > 0 && (
                <div className={styles.breakdownSection}>
                  <h4>Desglose por noche (total de reserva)</h4>
                  <ul className={styles.breakdownList}>
                    {Array.from({ length: nights }, (_, i) => {
                      const perNight = reservationTotal / nights;
                      return (
                        <li key={`night-${i + 1}`} className={styles.breakdownItem}>
                          <span>Noche {i + 1}</span>
                          <span>{formatCurrency(perNight)}</span>
                        </li>
                      );
                    })}
                    <li className={`${styles.breakdownItem} ${styles.breakdownTotal}`}>
                      <strong>Total estadía</strong>
                      <strong>{formatCurrency(reservationTotal)}</strong>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneralInfoTab;
