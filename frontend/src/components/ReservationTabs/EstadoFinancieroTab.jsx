import React, { useState, useEffect, useRef } from 'react';
import {
  FaPlus,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaCheck,
  FaEdit,
  FaPrint,
  FaUndo
} from 'react-icons/fa';
import PaymentForm from '../PaymentForm';
import LiquidacionPrint from './LiquidacionPrint';
import styles from './ReservationTabs.module.css';

const EstadoFinancieroTab = ({
  reservation,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onFinancialChange,
  onAddCargo,
  onUpdateCargo,
  onDeleteCargo,
  pendingAction = null,
  onPendingActionHandled
}) => {
  const [expandedFinancialRow, setExpandedFinancialRow] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [editMontoOnly, setEditMontoOnly] = useState(false);
  const [newCargo, setNewCargo] = useState({
    descripcion: '',
    monto: '',
    subcategoriaCargoId: null,
    notas: ''
  });
  const printRef = useRef(null);
  const pendingHandledRef = useRef(null);

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

  const resetCargoForm = () => {
    setNewCargo({
      descripcion: '',
      monto: '',
      subcategoriaCargoId: subcategorias.length > 0 ? subcategorias[0].id : null,
      notas: ''
    });
    setEditingCargo(null);
    setEditMontoOnly(false);
  };

  const openCreateCargo = () => {
    resetCargoForm();
    setShowCargoModal(true);
  };

  const openEditConsumo = (cargo) => {
    setEditingCargo(cargo);
    setEditMontoOnly(false);
    setNewCargo({
      descripcion: cargo.descripcion || '',
      monto: String(cargo.monto ?? ''),
      subcategoriaCargoId: cargo.subcategoriaCargoId,
      notas: cargo.notas || ''
    });
    setShowCargoModal(true);
  };

  const openEditAlojamiento = (cargo) => {
    setEditingCargo(cargo);
    setEditMontoOnly(true);
    setNewCargo({
      descripcion: cargo.descripcion || '',
      monto: String(cargo.monto ?? ''),
      subcategoriaCargoId: null,
      notas: cargo.notas || ''
    });
    setShowCargoModal(true);
  };

  const handleCargoSubmit = async (e) => {
    e.preventDefault();

    if (editingCargo) {
      if (editMontoOnly) {
        const monto = parseFloat(newCargo.monto);
        if (!(monto > 0)) {
          alert('El monto debe ser mayor a 0');
          return;
        }
        await onUpdateCargo(editingCargo.id, { monto });
      } else {
        if (!newCargo.subcategoriaCargoId) {
          alert('Debe seleccionar una subcategoría');
          return;
        }
        await onUpdateCargo(editingCargo.id, {
          descripcion: newCargo.descripcion,
          monto: parseFloat(newCargo.monto),
          notas: newCargo.notas || null,
          subcategoriaCargoId: parseInt(newCargo.subcategoriaCargoId, 10)
        });
      }
    } else {
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
    }

    resetCargoForm();
    setShowCargoModal(false);
  };

  const handleClearOverride = async (cargo) => {
    if (!onUpdateCargo) return;
    const ok = window.confirm(
      '¿Quitar el valor manual y volver a la tarifa original de la reserva?'
    );
    if (!ok) return;
    await onUpdateCargo(cargo.id, { clearOverride: true });
  };

  const handleDeleteCargo = async (cargo) => {
    if (!onDeleteCargo) return;
    const ok = window.confirm(`¿Eliminar el cargo "${cargo.descripcion || 'Cargo'}"?`);
    if (!ok) return;
    await onDeleteCargo(cargo.id);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    if (onFinancialChange) await onFinancialChange();
  };

  const handlePrintLiquidacion = () => {
    if (!financialSummary) {
      alert('No hay datos financieros para imprimir');
      return;
    }
    const printRoot = printRef.current?.closest('[data-print-root]') || printRef.current;
    if (!printRoot) {
      alert('No se encontró el documento de liquidación');
      return;
    }
    const placeholder = document.createComment('liquidacion-print-placeholder');
    const originalParent = printRoot.parentNode;
    if (originalParent) {
      originalParent.insertBefore(placeholder, printRoot);
      document.body.appendChild(printRoot);
    }
    document.documentElement.classList.add('printing-liquidacion');
    document.body.classList.add('printing-liquidacion');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.documentElement.classList.remove('printing-liquidacion');
      document.body.classList.remove('printing-liquidacion');
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(printRoot, placeholder);
        placeholder.remove();
      }
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Dos frames: reflow con html/body height:auto antes del diálogo de Chrome
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(cleanup, 60000);
      });
    });
  };

  // Acciones disparadas desde el menú ⋮ del panel del Libro
  useEffect(() => {
    if (!pendingAction) {
      pendingHandledRef.current = null;
      return;
    }
    if (pendingHandledRef.current === pendingAction) return;
    if (loadingFinancial || loadingCategorias) return;

    if (pendingAction === 'add-consumo') {
      if (subcategorias.length === 0) return;
      pendingHandledRef.current = pendingAction;
      openCreateCargo();
      onPendingActionHandled?.();
      return;
    }

    if (pendingAction === 'add-pago') {
      pendingHandledRef.current = pendingAction;
      setShowPaymentForm(true);
      onPendingActionHandled?.();
      return;
    }

    if (pendingAction === 'print-liquidacion') {
      if (!financialSummary) return;
      pendingHandledRef.current = pendingAction;
      requestAnimationFrame(() => {
        handlePrintLiquidacion();
        onPendingActionHandled?.();
      });
    }
  }, [
    pendingAction,
    loadingFinancial,
    loadingCategorias,
    financialSummary,
    subcategorias.length,
    onPendingActionHandled
  ]);

  if (!reservation) return null;

  const totalPagos = Number(financialSummary?.resumen?.totalPagos) || 0;
  const totalCargos = Number(financialSummary?.resumen?.totalCargos) || 0;
  const saldoDisplay = totalCargos - totalPagos;
  const estadoPago = saldoDisplay > 0 ? 'PENDIENTE' : (saldoDisplay < 0 ? 'A_FAVOR' : 'PAGADO');

  const cargoItems = financialSummary?.cargos?.items || [];
  const pagoItems = financialSummary?.pagos?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const tipoCargoOrder = ['ALOJAMIENTO', 'CONSUMO', 'SERVICIO', 'OTRO'];
  const tiposCargosOrdenados = [
    ...tipoCargoOrder.filter((codigo) => cargosPorTipo[codigo]),
    ...Object.keys(cargosPorTipo).filter((codigo) => !tipoCargoOrder.includes(codigo))
  ].map((codigo) => cargosPorTipo[codigo]);

  const toggleFinancialRow = (row) => {
    setExpandedFinancialRow((current) => (current === row ? null : row));
  };

  const isLodgingCargo = (item) => !item.subcategoriaCargoId;

  const renderCargoActions = (item) => {
    if (isLodgingCargo(item)) {
      return (
        <span className={styles.breakdownActions}>
          <button
            type="button"
            className={styles.editIconButton}
            onClick={(e) => {
              e.stopPropagation();
              openEditAlojamiento(item);
            }}
            title="Editar monto de alojamiento"
            data-testid={`btn-edit-alojamiento-${item.id}`}
          >
            <FaEdit />
          </button>
          {item.manualOverride && (
            <button
              type="button"
              className={styles.undoIconButton}
              onClick={(e) => {
                e.stopPropagation();
                handleClearOverride(item);
              }}
              title="Volver a tarifa original"
              data-testid={`btn-clear-override-${item.id}`}
            >
              <FaUndo />
            </button>
          )}
        </span>
      );
    }

    return (
      <span className={styles.breakdownActions}>
        <button
          type="button"
          className={styles.editIconButton}
          onClick={(e) => {
            e.stopPropagation();
            openEditConsumo(item);
          }}
          title="Editar cargo"
          data-testid={`btn-edit-cargo-${item.id}`}
        >
          <FaEdit />
        </button>
        <button
          type="button"
          className={styles.deleteIconButton}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteCargo(item);
          }}
          title="Eliminar cargo"
          data-testid={`btn-delete-cargo-${item.id}`}
        >
          <FaTimes />
        </button>
      </span>
    );
  };

  const renderMonto = (item) => (
    <span className={styles.breakdownMonto}>
      <span>
        {formatCurrency(item.monto)}
        {item.manualOverride ? (
          <abbr
            className={styles.manualAsterisk}
            title="Valor asignado manualmente"
            data-testid={`manual-asterisk-${item.id}`}
          >
            *
          </abbr>
        ) : null}
      </span>
      {renderCargoActions(item)}
    </span>
  );

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Estado financiero</h3>
        <div className={styles.headerActionsRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handlePrintLiquidacion}
            data-testid="btn-imprimir-liquidacion"
            disabled={!financialSummary}
          >
            <FaPrint /> Imprimir liquidación
          </button>
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
            onClick={openCreateCargo}
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
                onClick={() => toggleFinancialRow('cargos')}
                aria-expanded={expandedFinancialRow === 'cargos'}
                data-testid="financial-row-cargos"
              >
                <span className={styles.financialRowLabel}>
                  <span className={styles.financialRowChevron} aria-hidden="true">
                    {expandedFinancialRow === 'cargos' ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                  Cargos
                </span>
                <strong data-testid="financial-total-cargos">{formatCurrency(totalCargos)}</strong>
              </button>
              {expandedFinancialRow === 'cargos' && (
                <div className={styles.financialRowDetail} data-testid="financial-detail-cargos">
                  {tiposCargosOrdenados.length > 0 ? (
                    <ul className={styles.breakdownList}>
                      {tiposCargosOrdenados.map((tipo) => (
                        <li key={tipo.codigo} className={styles.breakdownGroup}>
                          <div className={styles.breakdownGroupHeader}>
                            <span>{tipo.nombre}</span>
                            <strong>{formatCurrency(tipo.total)}</strong>
                          </div>
                          {(tipo.items || []).map((item) => (
                            <div key={item.id} className={styles.breakdownItem}>
                              <span>{item.descripcion || 'Cargo'}</span>
                              {renderMonto(item)}
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
                          {renderMonto(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.breakdownEmpty}>Sin cargos registrados.</p>
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
                  Pagos
                </span>
                <strong data-testid="financial-total-pagos">{formatCurrency(totalPagos)}</strong>
              </button>
              {expandedFinancialRow === 'pagos' && (
                <div className={styles.financialRowDetail} data-testid="financial-detail-pagos">
                  {pagoItems.length > 0 ? (
                    <ul className={styles.breakdownList}>
                      {pagoItems.map((pago) => (
                        <li key={pago.id} className={styles.breakdownItem}>
                          <span>
                            {pago.metodo || 'Pago'}
                            {pago.fecha ? ` · ${formatDate(pago.fecha)}` : ''}
                          </span>
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
              <strong data-testid="financial-saldo">{formatCurrency(saldoDisplay)}</strong>
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

      <div className={styles.printRoot} data-print-root aria-hidden="true">
        <LiquidacionPrint
          ref={printRef}
          reservation={reservation}
          financialSummary={financialSummary}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
        />
      </div>

      {showPaymentForm && (
        <PaymentForm
          reservaId={reservation.id}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showCargoModal && (
        <div className={styles.modalOverlay} onClick={() => { resetCargoForm(); setShowCargoModal(false); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {editingCargo
                  ? (editMontoOnly ? 'Editar monto de alojamiento' : 'Editar cargo')
                  : 'Agregar cargo'}
              </h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => { resetCargoForm(); setShowCargoModal(false); }}
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCargoSubmit} className={styles.modalForm}>
              {!editMontoOnly && (
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
              )}
              {editMontoOnly && (
                <p className={styles.modalHint}>
                  El monto manual tiene prioridad sobre la tarifa. Se conserva la tarifa original
                  de la reserva para poder restaurarla.
                  {editingCargo?.montoOriginal != null && (
                    <>
                      {' '}Tarifa original:{' '}
                      <strong>{formatCurrency(editingCargo.montoOriginal)}</strong>
                    </>
                  )}
                </p>
              )}
              <div className={styles.formGroup}>
                <label>Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newCargo.monto}
                  onChange={(e) => setNewCargo({ ...newCargo, monto: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-cargo-monto"
                />
              </div>
              {!editMontoOnly && (
                <>
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
                </>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => { resetCargoForm(); setShowCargoModal(false); }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  <FaCheck /> {editingCargo ? 'Guardar cambios' : 'Guardar cargo'}
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
