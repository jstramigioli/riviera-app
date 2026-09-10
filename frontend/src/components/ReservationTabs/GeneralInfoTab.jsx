import React, { useState, useEffect, useMemo } from 'react';
import styles from './ReservationTabs.module.css';

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const GeneralInfoTab = ({ 
  reservation, 
  rooms = [],
  financialSummary, 
  formatDate, 
  formatCurrency, 
  getServiceTypeLabel,
  getStatusLabel,
  onSaveNotes,
  onUpdateStay
}) => {
  const [notesDraft, setNotesDraft] = useState(reservation?.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState(null);
  const [editingStay, setEditingStay] = useState(false);
  const [savingStay, setSavingStay] = useState(false);
  const [stayMessage, setStayMessage] = useState(null);
  const [stayForm, setStayForm] = useState({
    checkIn: '',
    checkOut: '',
    roomId: '',
    baseRate: '',
    guestCount: 1
  });

  const activeSegment = reservation?.segments?.[0];
  const currentBaseRate = activeSegment?.baseRate ?? reservation?.averageRate ?? 0;

  useEffect(() => {
    setNotesDraft(reservation?.notes || '');
    setNotesMessage(null);
  }, [reservation?.id, reservation?.notes]);

  useEffect(() => {
    if (!reservation) return;
    setStayForm({
      checkIn: toInputDate(reservation.checkIn),
      checkOut: toInputDate(reservation.checkOut),
      roomId: String(reservation.roomId || reservation.room?.id || ''),
      baseRate: currentBaseRate ? String(currentBaseRate) : '',
      guestCount: activeSegment?.guestCount || reservation.requiredGuests || 1
    });
    setStayMessage(null);
    setEditingStay(false);
  }, [
    reservation?.id,
    reservation?.checkIn,
    reservation?.checkOut,
    reservation?.roomId,
    reservation?.room?.id,
    currentBaseRate,
    activeSegment?.guestCount,
    reservation?.requiredGuests
  ]);

  const nightsPreview = useMemo(() => {
    if (!stayForm.checkIn || !stayForm.checkOut) return 0;
    const start = new Date(stayForm.checkIn);
    const end = new Date(stayForm.checkOut);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return nights > 0 ? nights : 0;
  }, [stayForm.checkIn, stayForm.checkOut]);

  const ratePreview = parseFloat(stayForm.baseRate) || 0;
  const lodgingPreview = nightsPreview * ratePreview;

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24)
  );

  const handleSaveNotes = async () => {
    if (typeof onSaveNotes !== 'function') return;
    try {
      setSavingNotes(true);
      setNotesMessage(null);
      await onSaveNotes(notesDraft);
      setNotesMessage({ type: 'success', text: 'Notas guardadas' });
    } catch (error) {
      setNotesMessage({ type: 'error', text: error.message || 'No se pudieron guardar las notas' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveStay = async (e) => {
    e.preventDefault();
    if (typeof onUpdateStay !== 'function') return;

    const baseRate = parseFloat(stayForm.baseRate);
    if (!stayForm.checkIn || !stayForm.checkOut) {
      setStayMessage({ type: 'error', text: 'Indicá check-in y check-out válidos' });
      return;
    }
    if (new Date(stayForm.checkIn) >= new Date(stayForm.checkOut)) {
      setStayMessage({ type: 'error', text: 'El check-out debe ser posterior al check-in' });
      return;
    }
    if (!stayForm.roomId) {
      setStayMessage({ type: 'error', text: 'Seleccioná una habitación' });
      return;
    }
    if (!baseRate || baseRate <= 0) {
      setStayMessage({ type: 'error', text: 'La tarifa por noche debe ser mayor a 0' });
      return;
    }

    const confirmed = window.confirm(
      'Se regenerarán solo los cargos de alojamiento según las nuevas fechas/habitación/tarifa.\n' +
      'Los consumos y los pagos ya registrados se mantienen.'
    );
    if (!confirmed) return;

    try {
      setSavingStay(true);
      setStayMessage(null);
      await onUpdateStay({
        checkIn: stayForm.checkIn,
        checkOut: stayForm.checkOut,
        roomId: parseInt(stayForm.roomId, 10),
        baseRate,
        guestCount: parseInt(stayForm.guestCount, 10) || 1
      });
      setStayMessage({ type: 'success', text: 'Estadía actualizada. Cargos de alojamiento regenerados.' });
      setEditingStay(false);
    } catch (error) {
      setStayMessage({ type: 'error', text: error.message || 'No se pudo actualizar la estadía' });
    } finally {
      setSavingStay(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Información General</h3>
        {!editingStay && typeof onUpdateStay === 'function' && (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setEditingStay(true);
              setStayMessage(null);
            }}
          >
            Editar estadía
          </button>
        )}
      </div>
      
      {/* Resumen Financiero */}
      {financialSummary && (
        <div className={styles.financialAlert}>
          <div className={styles.financialAlertHeader}>Estado Financiero</div>
          <div className={styles.financialAlertBody}>
            <div className={styles.financialRow}>
              <span>Total Cargos:</span>
              <strong>{formatCurrency(financialSummary.resumen.totalCargos)}</strong>
            </div>
            <div className={styles.financialRow}>
              <span>Total Pagos:</span>
              <strong>{formatCurrency(financialSummary.resumen.totalPagos)}</strong>
            </div>
            <div className={`${styles.financialRow} ${styles.saldoRow} ${styles[financialSummary.resumen.estadoPago]}`}>
              <span>Saldo:</span>
              <strong>{formatCurrency(financialSummary.resumen.saldo)}</strong>
            </div>
            <div className={styles.estadoPagoTag}>
              {financialSummary.resumen.estadoPago === 'PENDIENTE' && 'Pendiente de pago'}
              {financialSummary.resumen.estadoPago === 'PAGADO' && 'Pagado completamente'}
              {financialSummary.resumen.estadoPago === 'A_FAVOR' && 'Saldo a favor'}
            </div>
          </div>
        </div>
      )}

      {editingStay ? (
        <form className={styles.editStayForm} onSubmit={handleSaveStay}>
          <p className={styles.editStayHint}>
            Al guardar se regeneran solo los cargos de alojamiento. Consumos y pagos no se modifican.
          </p>
          <div className={styles.editStayGrid}>
            <div className={styles.formGroup}>
              <label>Check-in *</label>
              <input
                type="date"
                required
                value={stayForm.checkIn}
                onChange={(e) => setStayForm((prev) => ({ ...prev, checkIn: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Check-out *</label>
              <input
                type="date"
                required
                value={stayForm.checkOut}
                onChange={(e) => setStayForm((prev) => ({ ...prev, checkOut: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Habitación *</label>
              <select
                required
                value={stayForm.roomId}
                onChange={(e) => setStayForm((prev) => ({ ...prev, roomId: e.target.value }))}
              >
                <option value="">Seleccionar habitación</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}{room.roomType?.name ? ` (${room.roomType.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Tarifa / noche *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={stayForm.baseRate}
                onChange={(e) => setStayForm((prev) => ({ ...prev, baseRate: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Huéspedes</label>
              <input
                type="number"
                min="1"
                step="1"
                value={stayForm.guestCount}
                onChange={(e) => setStayForm((prev) => ({ ...prev, guestCount: e.target.value }))}
              />
            </div>
          </div>
          <div className={styles.editStayPreview}>
            <span>{nightsPreview} noche{nightsPreview === 1 ? '' : 's'}</span>
            <strong>Alojamiento estimado: {formatCurrency(lodgingPreview)}</strong>
          </div>
          <div className={styles.notesActions}>
            <button type="submit" className={styles.saveNotesButton} disabled={savingStay}>
              {savingStay ? 'Guardando...' : 'Guardar estadía'}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              disabled={savingStay}
              onClick={() => {
                setEditingStay(false);
                setStayMessage(null);
                setStayForm({
                  checkIn: toInputDate(reservation.checkIn),
                  checkOut: toInputDate(reservation.checkOut),
                  roomId: String(reservation.roomId || reservation.room?.id || ''),
                  baseRate: currentBaseRate ? String(currentBaseRate) : '',
                  guestCount: activeSegment?.guestCount || reservation.requiredGuests || 1
                });
              }}
            >
              Cancelar
            </button>
            {stayMessage && (
              <span className={stayMessage.type === 'error' ? styles.notesError : styles.notesSuccess}>
                {stayMessage.text}
              </span>
            )}
          </div>
        </form>
      ) : (
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Check-in:</span>
            <span className={styles.infoValue}>{formatDate(reservation.checkIn)}</span>
          </div>
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Check-out:</span>
            <span className={styles.infoValue}>{formatDate(reservation.checkOut)}</span>
          </div>
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Noches:</span>
            <span className={styles.infoValue}>{nights}</span>
          </div>
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Estado:</span>
            <span className={`${styles.infoValue} ${styles.statusBadge} ${styles[reservation.status]}`}>
              {getStatusLabel(reservation.status)}
            </span>
          </div>
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Huéspedes:</span>
            <span className={styles.infoValue}>
              {activeSegment?.guestCount || reservation.requiredGuests || 1} persona{(activeSegment?.guestCount || reservation.requiredGuests || 1) > 1 ? 's' : ''}
            </span>
          </div>
          
          {reservation.room && (
            <>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Habitación:</span>
                <span className={styles.infoValue}>
                  <a href={`/rooms/${reservation.room.id}`} className={styles.link}>
                    {reservation.room.name}
                  </a>
                </span>
              </div>
              
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Tipo:</span>
                <span className={styles.infoValue}>{reservation.room.roomType?.name || 'No especificado'}</span>
              </div>
            </>
          )}
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Servicio:</span>
            <span className={styles.infoValue}>
              {getServiceTypeLabel(activeSegment?.services?.[0] || reservation.reservationType)}
            </span>
          </div>
          
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Tarifa / noche:</span>
            <span className={`${styles.infoValue} ${styles.highlight}`}>
              {formatCurrency(currentBaseRate || 0)}
            </span>
          </div>

          {reservation.totalAmount != null && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tarifa base (total):</span>
              <span className={`${styles.infoValue} ${styles.highlight}`}>
                {formatCurrency(reservation.totalAmount)}
              </span>
            </div>
          )}

          {stayMessage && (
            <div className={styles.infoItem}>
              <span className={stayMessage.type === 'error' ? styles.notesError : styles.notesSuccess}>
                {stayMessage.text}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={styles.notesBox}>
        <h4>Notas</h4>
        <textarea
          className={styles.notesTextarea}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={4}
          placeholder="Observaciones operativas de la reserva..."
        />
        <div className={styles.notesActions}>
          <button
            type="button"
            className={styles.saveNotesButton}
            onClick={handleSaveNotes}
            disabled={savingNotes || notesDraft === (reservation.notes || '')}
          >
            {savingNotes ? 'Guardando...' : 'Guardar notas'}
          </button>
          {notesMessage && (
            <span className={notesMessage.type === 'error' ? styles.notesError : styles.notesSuccess}>
              {notesMessage.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneralInfoTab;
