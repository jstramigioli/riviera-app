import React, { useState, useEffect } from 'react';
import { FaPlus, FaChevronDown, FaChevronRight, FaTimes, FaCheck } from 'react-icons/fa';
import PaymentForm from '../PaymentForm';
import styles from './ReservationTabs.module.css';

const civilNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = String(checkIn).slice(0, 10);
  const end = String(checkOut).slice(0, 10);
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (![ys, ms, ds, ye, me, de].every(Number.isFinite)) return 0;
  const msDiff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.max(0, Math.round(msDiff / 86400000));
};

const resolveReservationTotal = (reservation, nights) => {
  const explicit = Number(reservation?.totalAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const activeSegments = (reservation?.segments || []).filter((s) => s.isActive !== false);
  const segments = activeSegments.length > 0 ? activeSegments : (reservation?.segments || []);
  if (segments.length > 0) {
    const fromSegments = segments.reduce((sum, segment) => {
      const segNights = civilNights(segment.startDate, segment.endDate) || nights || 1;
      const rate = Number(segment.baseRate) || 0;
      return sum + rate * segNights;
    }, 0);
    if (fromSegments > 0) return fromSegments;
  }

  const nightly = Number(reservation?.averageRate || reservation?.segments?.[0]?.baseRate) || 0;
  if (nightly > 0 && nights > 0) return nightly * nights;
  return 0;
};

const EstadoFinancieroTab = ({
  reservation,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onFinancialChange,
  onAddCargo
}) => {
  const [expandedFinancialRow, setExpandedFinancialRow] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [newCargo, setNewCargo] = useState({
    descripcion: '',
    monto: '',
    subcategoriaCargoId: null,
    notas: ''
  });

  useEffect(() => {
    loadCategoriasHibridas();
  }, []);

  const loadCategoriasHibridas = async () => {
    try {
      setLoadingCategorias(true);
      const subcategoriasRes = await fetch('http://localhost:3001/api/subcategoria-cargo');
      if (!subcategoriasRes.ok) throw new Error('Error al cargar subcategorías');
      const subcategoriasResult = await subcategoriasRes.json();

      const todasSubcategorias = [];
      for (const [tipo, subcats] of Object.entries(subcategoriasResult.data || {})) {
        for (const subcat of subcats) {
          todasSubcategorias.push({
            ...subcat,
            tipoNombre: {
              SERVICIO: 'Servicios',
              CONSUMO: 'Consumos',
              OTRO: 'Otros'
            }[tipo] || tipo
          });
        }
      }

      setSubcategorias(todasSubcategorias);
      if (todasSubcategorias.length > 0) {
        setNewCargo((prev) => ({
          ...prev,
          subcategoriaCargoId: todasSubcategorias[0].id
        }));
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      setLoadingCategorias(false);
    }
  };

  if (!reservation) return null;

  const checkIn = reservation.checkIn || reservation.segments?.[0]?.startDate;
  const checkOut = reservation.checkOut || reservation.segments?.[reservation.segments?.length - 1]?.endDate;
  const nightsFromDates = civilNights(checkIn, checkOut);
  const nights = Number(reservation.days) > 0 ? Number(reservation.days) : nightsFromDates;
  const reservationTotal = resolveReservationTotal(reservation, nights);
  const activeSegment = reservation?.segments?.find((s) => s.isActive !== false) || reservation?.segments?.[0];
  const nightlyRate = Number(reservation?.averageRate)
    || Number(activeSegment?.baseRate)
    || (nights > 0 ? reservationTotal / nights : 0);
  const totalPagos = Number(financialSummary?.resumen?.totalPagos) || 0;
  const totalCargosRaw = Number(financialSummary?.resumen?.totalCargos) || 0;
  const totalCargosDisplay = Math.max(totalCargosRaw, reservationTotal);
  const saldoDisplay = totalCargosDisplay - totalPagos;
  const estadoPago = saldoDisplay > 0 ? 'PENDIENTE' : (saldoDisplay < 0 ? 'A_FAVOR' : 'PAGADO');

  const cargoItems = financialSummary?.cargos?.items || [];
  const pagoItems = financialSummary?.pagos?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const nonAlojamientoTipos = Object.values(cargosPorTipo).filter((t) => t.codigo !== 'ALOJAMIENTO');

  const toggleFinancialRow = (row) => {
    setExpandedFinancialRow((current) => (current === row ? null : row));
  };

  const resetCargoForm = () => {
    setNewCargo({
      descripcion: '',
      monto: '',
      subcategoriaCargoId: subcategorias.length > 0 ? subcategorias[0].id : null,
      notas: ''
    });
  };

  const handleCargoSubmit = async (e) => {
    e.preventDefault();
    if (!newCargo.subcategoriaCargoId) {
      alert('Debe seleccionar una subcategoría');
      return;
    }

    await onAddCargo({
      descripcion: newCargo.descripcion,
      monto: parseFloat(newCargo.monto),
      notas: newCargo.notas || null,
      subcategoriaCargoId: parseInt(newCargo.subcategoriaCargoId, 10)
    });

    resetCargoForm();
    setShowCargoModal(false);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    if (onFinancialChange) await onFinancialChange();
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Estado financiero</h3>
        <div className={styles.headerActionsRow}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setShowPaymentForm(true)}
            data-testid="btn-add-pago"
          >
            <FaPlus /> pago
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              resetCargoForm();
              setShowCargoModal(true);
            }}
            data-testid="btn-add-cargo"
          >
            <FaPlus /> cargo
          </button>
        </div>
      </div>

      {loadingFinancial && !financialSummary ? (
        <div className={styles.loading}>Cargando estado financiero...</div>
      ) : financialSummary ? (
        <div className={styles.financialAlert} data-testid="estado-financiero">
          <div className={styles.financialAlertBody}>
            <div className={styles.financialRowBlock}>
              <button
                type="button"
                className={styles.financialRowToggle}
                onClick={() => toggleFinancialRow('total')}
                aria-expanded={expandedFinancialRow === 'total'}
                data-testid="financial-row-total"
              >
                <span className={styles.financialRowLabel}>
                  <span className={styles.financialRowChevron} aria-hidden="true">
                    {expandedFinancialRow === 'total' ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                  Total reserva
                </span>
                <strong data-testid="financial-total-reserva">{formatCurrency(reservationTotal)}</strong>
              </button>
              {expandedFinancialRow === 'total' && (
                <div className={styles.financialRowDetail} data-testid="financial-detail-total">
                  {nights > 0 && nightlyRate > 0 ? (
                    <ul className={styles.breakdownList}>
                      <li className={styles.breakdownItem} data-testid="alojamiento-noches">
                        <span>
                          Alojamiento · {nights}×{formatCurrency(nightlyRate)}
                        </span>
                        <strong>{formatCurrency(nights * nightlyRate)}</strong>
                      </li>
                      {nonAlojamientoTipos.map((tipo) => (
                        <li key={tipo.codigo} className={styles.breakdownItem}>
                          <span>{tipo.nombre}</span>
                          <span>{formatCurrency(tipo.total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.breakdownEmpty}>Sin desglose de alojamiento disponible.</p>
                  )}
                </div>
              )}
            </div>

            <div className={styles.financialRowBlock}>
              <button
                type="button"
                className={styles.financialRowToggle}
                onClick={() => toggleFinancialRow('cargos')}
                aria-expanded={expandedFinancialRow === 'cargos'}
                data-testid="financial-row-cargos"
              >
                <span className={styles.financialRowLabel}>
                  <span className={styles.financialRowChevron} aria-hidden="true">
                    {expandedFinancialRow === 'cargos' ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                  Total cargos
                </span>
                <strong>{formatCurrency(totalCargosDisplay)}</strong>
              </button>
              {expandedFinancialRow === 'cargos' && (
                <div className={styles.financialRowDetail} data-testid="financial-detail-cargos">
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
              )}
            </div>

            <div className={styles.financialRowBlock}>
              <button
                type="button"
                className={styles.financialRowToggle}
                onClick={() => toggleFinancialRow('pagos')}
                aria-expanded={expandedFinancialRow === 'pagos'}
                data-testid="financial-row-pagos"
              >
                <span className={styles.financialRowLabel}>
                  <span className={styles.financialRowChevron} aria-hidden="true">
                    {expandedFinancialRow === 'pagos' ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                  Total pagos
                </span>
                <strong>{formatCurrency(totalPagos)}</strong>
              </button>
              {expandedFinancialRow === 'pagos' && (
                <div className={styles.financialRowDetail} data-testid="financial-detail-pagos">
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
              )}
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
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No hay datos financieros disponibles</p>
        </div>
      )}

      {showPaymentForm && (
        <PaymentForm
          reservaId={reservation.id}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showCargoModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCargoModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Agregar cargo</h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowCargoModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCargoSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Descripción *</label>
                <input
                  type="text"
                  required
                  value={newCargo.descripcion}
                  onChange={(e) => setNewCargo({ ...newCargo, descripcion: e.target.value })}
                  placeholder="Ej: Minuta, Bebidas, Lavandería"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newCargo.monto}
                  onChange={(e) => setNewCargo({ ...newCargo, monto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Categoría *</label>
                <select
                  value={newCargo.subcategoriaCargoId || ''}
                  onChange={(e) => setNewCargo({
                    ...newCargo,
                    subcategoriaCargoId: e.target.value ? parseInt(e.target.value, 10) : null
                  })}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {['SERVICIO', 'CONSUMO', 'OTRO'].map((tipoPrincipal) => {
                    const subcatsDelTipo = subcategorias.filter((sub) => sub.tipo === tipoPrincipal);
                    if (subcatsDelTipo.length === 0) return null;
                    return (
                      <optgroup key={tipoPrincipal} label={subcatsDelTipo[0].tipoNombre}>
                        {subcatsDelTipo.map((subcat) => (
                          <option key={subcat.id} value={subcat.id}>
                            {subcat.nombre}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {loadingCategorias && (
                  <small style={{ color: '#6c757d' }}>Cargando opciones...</small>
                )}
              </div>
              <div className={styles.formGroup}>
                <label>Notas</label>
                <textarea
                  value={newCargo.notas}
                  onChange={(e) => setNewCargo({ ...newCargo, notas: e.target.value })}
                  placeholder="Observaciones opcionales"
                  rows="3"
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowCargoModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  <FaCheck /> Guardar cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstadoFinancieroTab;
