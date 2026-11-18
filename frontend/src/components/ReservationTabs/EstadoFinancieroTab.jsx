import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaPlus,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaCheck,
  FaEdit,
  FaPrint,
  FaTrash,
  FaSave
} from 'react-icons/fa';
import PaymentForm from '../PaymentForm';
import LiquidacionPrint from './LiquidacionPrint';
import { fetchPaymentMethodConfigs } from '../../services/api';
import styles from './ReservationTabs.module.css';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function draftFromPago(pago) {
  return {
    monto: String(pago.monto ?? ''),
    moneda: pago.moneda || 'ARS',
    tipoCambio: pago.tipoCambio != null ? String(pago.tipoCambio) : '',
    metodo: pago.metodo || 'Efectivo',
    motivo: pago.motivo || 'Pago',
    numeroTarjeta: pago.numeroTarjeta || '',
    empresa: pago.empresa || '',
    notas: pago.notas || '',
    fecha: toDateInputValue(pago.fecha),
    retirado: Boolean(pago.retirado)
  };
}

function discountLabel(d) {
  if (!d) return '—';
  const parts = [];
  if (d.porcentaje != null && d.porcentaje !== '') {
    parts.push(`${Number(d.porcentaje)}%`);
  }
  if (d.notas) parts.push(d.notas);
  if (d.tipo && !parts.length) parts.push(d.tipo);
  return parts.length ? parts.join(' · ') : 'Descuento';
}

function promoHintFromDiscount(d) {
  if (d?.promotionRule?.label || d?.promotionRule?.code) {
    return d.promotionRule.label || d.promotionRule.code;
  }
  const rules = Array.isArray(d?.appliedRulesJson)
    ? d.appliedRulesJson
    : Array.isArray(d?.appliedRulesJson?.appliedRules)
      ? d.appliedRulesJson.appliedRules
      : [];
  const labels = rules
    .map((r) => r?.label || r?.code)
    .filter(Boolean);
  if (labels.length) return labels.join(' + ');
  return discountLabel(d);
}

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
  onUpdatePago,
  onDeletePago,
  pendingAction = null,
  onPendingActionHandled,
  onRequestConsumo
}) => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [expandedFinancialRow, setExpandedFinancialRow] = useState('cargos');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [newCargo, setNewCargo] = useState({
    descripcion: '',
    monto: '',
    subcategoriaCargoId: null,
    notas: ''
  });
  const [methodOptions, setMethodOptions] = useState([]);
  const [editingPagoId, setEditingPagoId] = useState(null);
  const [pagoDraft, setPagoDraft] = useState(null);
  const [savingPagoId, setSavingPagoId] = useState(null);
  const printRef = useRef(null);
  const pendingHandledRef = useRef(null);

  useEffect(() => {
    loadCategoriasHibridas();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPaymentMethodConfigs();
        if (!cancelled) setMethodOptions(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setMethodOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
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
  };

  const openCreateCargo = () => {
    resetCargoForm();
    setShowCargoModal(true);
  };

  const openEditConsumo = (cargo) => {
    setEditingCargo(cargo);
    setNewCargo({
      descripcion: cargo.descripcion || '',
      monto: String(cargo.monto ?? ''),
      subcategoriaCargoId: cargo.subcategoriaCargoId,
      notas: cargo.notas || ''
    });
    setShowCargoModal(true);
  };

  const handleCargoSubmit = async (e) => {
    e.preventDefault();

    if (editingCargo) {
      if (!newCargo.subcategoriaCargoId) {
        notify({ title: 'Validación', message: 'Debe seleccionar una subcategoría', type: 'warning' });
        return;
      }
      await onUpdateCargo(editingCargo.id, {
        descripcion: newCargo.descripcion,
        monto: parseFloat(newCargo.monto),
        notas: newCargo.notas || null,
        subcategoriaCargoId: parseInt(newCargo.subcategoriaCargoId, 10)
      });
    } else {
      if (!newCargo.subcategoriaCargoId) {
        notify({ title: 'Validación', message: 'Debe seleccionar una subcategoría', type: 'warning' });
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

  const handleDeleteCargo = async (cargo) => {
    if (!onDeleteCargo) return;
    const ok = await confirm({
      title: 'Eliminar cargo',
      message: `¿Eliminar el cargo "${cargo.descripcion || 'Cargo'}"?`,
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    await onDeleteCargo(cargo.id);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    if (onFinancialChange) await onFinancialChange();
  };

  const startEditPago = (pago) => {
    setEditingPagoId(pago.id);
    setPagoDraft(draftFromPago(pago));
  };

  const cancelEditPago = () => {
    setEditingPagoId(null);
    setPagoDraft(null);
  };

  const setDraftField = (field, value) => {
    setPagoDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSavePago = async (pagoId) => {
    if (!onUpdatePago || !pagoDraft) return;
    const monto = parseFloat(pagoDraft.monto);
    if (!(monto > 0)) {
      notify({ title: 'Validación', message: 'El monto debe ser mayor a 0', type: 'warning' });
      return;
    }
    if (pagoDraft.moneda === 'USD' && !(parseFloat(pagoDraft.tipoCambio) > 0)) {
      notify({ title: 'Validación', message: 'Tipo de cambio requerido para USD', type: 'warning' });
      return;
    }
    try {
      setSavingPagoId(pagoId);
      await onUpdatePago(pagoId, {
        monto,
        moneda: pagoDraft.moneda,
        tipoCambio:
          pagoDraft.moneda === 'USD' ? parseFloat(pagoDraft.tipoCambio) : undefined,
        metodo: pagoDraft.metodo,
        motivo: pagoDraft.motivo || 'Pago',
        numeroTarjeta: pagoDraft.numeroTarjeta || null,
        empresa: pagoDraft.empresa || null,
        notas: pagoDraft.notas || null,
        fecha: pagoDraft.fecha || undefined,
        retirado: Boolean(pagoDraft.retirado)
      });
      cancelEditPago();
    } finally {
      setSavingPagoId(null);
    }
  };

  const handleDeletePago = async (pago) => {
    if (!onDeletePago) return;
    const ok = await confirm({
      title: 'Eliminar pago',
      message: `¿Eliminar el pago ${pago.codigo || `#${pago.id}`}?`,
      confirmText: 'Eliminar'
    });
    if (!ok) return;
    await onDeletePago(pago.id);
    if (editingPagoId === pago.id) cancelEditPago();
  };

  const handlePrintLiquidacion = () => {
    if (!financialSummary) {
      notify({ title: 'Sin datos', message: 'No hay datos financieros para imprimir', type: 'warning' });
      return;
    }
    const printRoot = printRef.current?.closest('[data-print-root]') || printRef.current;
    if (!printRoot) {
      notify({ title: 'Error', message: 'No se encontró el documento de liquidación', type: 'error' });
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(cleanup, 60000);
      });
    });
  };

  useEffect(() => {
    if (!pendingAction) {
      pendingHandledRef.current = null;
      return;
    }
    if (pendingHandledRef.current === pendingAction) return;
    if (loadingFinancial || loadingCategorias) return;

    if (pendingAction === 'add-consumo') {
      pendingHandledRef.current = pendingAction;
      if (typeof onRequestConsumo === 'function') {
        onRequestConsumo();
      } else if (subcategorias.length > 0) {
        openCreateCargo();
      } else {
        return;
      }
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
    onPendingActionHandled,
    onRequestConsumo
  ]);

  const totalPagos = Number(financialSummary?.resumen?.totalPagos) || 0;
  const totalCargos = Number(financialSummary?.resumen?.totalCargos) || 0;
  const totalDescuentos = Number(financialSummary?.resumen?.totalDescuentos) || 0;
  const saldoDisplay =
    financialSummary?.resumen?.saldo != null
      ? Number(financialSummary.resumen.saldo)
      : totalCargos - totalPagos - totalDescuentos;
  const estadoPago =
    saldoDisplay > 0 ? 'PENDIENTE' : saldoDisplay < 0 ? 'A_FAVOR' : 'PAGADO';

  const cargoItems = financialSummary?.cargos?.items || [];
  const pagoItems = financialSummary?.pagos?.items || [];
  const descuentoItems = financialSummary?.descuentos?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const tipoCargoOrder = ['ALOJAMIENTO', 'CONSUMO', 'SERVICIO', 'OTRO'];
  const tiposCargosOrdenados = [
    ...tipoCargoOrder.filter((codigo) => cargosPorTipo[codigo]),
    ...Object.keys(cargosPorTipo).filter((codigo) => !tipoCargoOrder.includes(codigo))
  ].map((codigo) => cargosPorTipo[codigo]);

  const metodoSelectOptions = useMemo(() => {
    const labels = methodOptions.map((m) => m.label).filter(Boolean);
    const current = pagoDraft?.metodo;
    if (current && !labels.includes(current)) labels.unshift(current);
    if (!labels.length) {
      return ['Efectivo', 'Transferencia', 'Tarjeta Debito', 'Tarjeta Credito'];
    }
    return labels;
  }, [methodOptions, pagoDraft?.metodo]);

  if (!reservation) return null;

  const toggleFinancialRow = (row) => {
    setExpandedFinancialRow((current) => (current === row ? null : row));
  };

  const isLodgingCargo = (item) => !item.subcategoriaCargoId;

  const renderCargoActions = (item) => {
    if (isLodgingCargo(item)) {
      return null;
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
      <span>{formatCurrency(item.monto)}</span>
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
        <div className={styles.financialLayout} data-testid="estado-financiero">
          <div className={styles.financialMain}>
            <div className={styles.financialAlert}>
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
                        {expandedFinancialRow === 'cargos' ? (
                          <FaChevronDown />
                        ) : (
                          <FaChevronRight />
                        )}
                      </span>
                      Cargos
                    </span>
                    <strong data-testid="financial-total-cargos">
                      {formatCurrency(totalCargos)}
                    </strong>
                  </button>
                  {expandedFinancialRow === 'cargos' && (
                    <div
                      className={styles.financialRowDetail}
                      data-testid="financial-detail-cargos"
                    >
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
                                  <span>
                                    {item.descripcion || 'Cargo'}
                                    {item.fecha ? ` · ${formatDate(item.fecha)}` : ''}
                                  </span>
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
                              <span>
                                {item.descripcion || 'Cargo'}
                                {item.fecha ? ` · ${formatDate(item.fecha)}` : ''}
                              </span>
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
              </div>
            </div>

            <section
              className={styles.pagosTableSection}
              aria-labelledby="financial-pagos-heading"
            >
              <div className={styles.pagosTableHeader}>
                <h4 id="financial-pagos-heading">Pagos</h4>
                <span data-testid="financial-pagos-count">
                  {pagoItems.length} registro{pagoItems.length === 1 ? '' : 's'}
                </span>
              </div>
              {pagoItems.length === 0 ? (
                <p className={styles.breakdownEmpty}>Sin pagos registrados.</p>
              ) : (
                <div className={styles.tableContainer}>
                  <table
                    className={`${styles.dataTable} ${styles.pagosEditableTable}`}
                    data-testid="financial-pagos-table"
                  >
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Moneda</th>
                        <th>Método</th>
                        <th>Motivo</th>
                        <th>Descuento</th>
                        <th>Notas</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagoItems.map((pago) => {
                        const editing = editingPagoId === pago.id && pagoDraft;
                        const disc = pago.discountApplication;
                        return (
                          <tr
                            key={pago.id}
                            data-testid={`financial-pago-row-${pago.id}`}
                            className={editing ? styles.pagoRowEditing : undefined}
                          >
                            <td>{pago.codigo || `#${pago.id}`}</td>
                            <td>
                              {editing ? (
                                <input
                                  type="date"
                                  className={styles.tableInput}
                                  value={pagoDraft.fecha}
                                  onChange={(e) => setDraftField('fecha', e.target.value)}
                                  aria-label="Fecha del pago"
                                />
                              ) : (
                                formatDate(pago.fecha)
                              )}
                            </td>
                            <td className={styles.montoCell}>
                              {editing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className={styles.tableInput}
                                  value={pagoDraft.monto}
                                  onChange={(e) => setDraftField('monto', e.target.value)}
                                  aria-label="Monto del pago"
                                  data-testid={`pago-edit-monto-${pago.id}`}
                                />
                              ) : (
                                <>
                                  {pago.moneda === 'USD'
                                    ? `$${Number(pago.monto).toFixed(2)} USD`
                                    : formatCurrency(pago.montoARS ?? pago.monto)}
                                  {pago.moneda === 'USD' && pago.montoARS != null ? (
                                    <div className={styles.arsEquivalent}>
                                      ≈ {formatCurrency(pago.montoARS)}
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <select
                                  className={styles.tableInput}
                                  value={pagoDraft.moneda}
                                  onChange={(e) => setDraftField('moneda', e.target.value)}
                                  aria-label="Moneda"
                                >
                                  <option value="ARS">ARS</option>
                                  <option value="USD">USD</option>
                                </select>
                              ) : (
                                pago.moneda || 'ARS'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <select
                                  className={styles.tableInput}
                                  value={pagoDraft.metodo}
                                  onChange={(e) => setDraftField('metodo', e.target.value)}
                                  aria-label="Método"
                                >
                                  {metodoSelectOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                pago.metodo || '—'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <select
                                  className={styles.tableInput}
                                  value={pagoDraft.motivo}
                                  onChange={(e) => setDraftField('motivo', e.target.value)}
                                  aria-label="Motivo"
                                >
                                  <option value="Pago">Pago</option>
                                  <option value="Seña">Seña</option>
                                  <option value="Devolución">Devolución</option>
                                </select>
                              ) : (
                                pago.motivo || 'Pago'
                              )}
                            </td>
                            <td>
                              {disc && Number(disc.montoARS) !== 0
                                ? formatCurrency(disc.montoARS)
                                : '—'}
                              {disc && Number(disc.montoARS) !== 0 ? (
                                <div className={styles.arsEquivalent}>
                                  {promoHintFromDiscount(disc)}
                                </div>
                              ) : null}
                            </td>
                            <td className={styles.notasCell}>
                              {editing ? (
                                <input
                                  type="text"
                                  className={styles.tableInput}
                                  value={pagoDraft.notas}
                                  onChange={(e) => setDraftField('notas', e.target.value)}
                                  aria-label="Notas"
                                />
                              ) : (
                                pago.notas || '—'
                              )}
                            </td>
                            <td>
                              {editing ? (
                                <span className={styles.breakdownActions}>
                                  {pagoDraft.moneda === 'USD' ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className={styles.tableInput}
                                      value={pagoDraft.tipoCambio}
                                      onChange={(e) =>
                                        setDraftField('tipoCambio', e.target.value)
                                      }
                                      aria-label="Tipo de cambio"
                                      placeholder="TC"
                                      title="Tipo de cambio"
                                    />
                                  ) : null}
                                  <button
                                    type="button"
                                    className={styles.editIconButton}
                                    onClick={() => handleSavePago(pago.id)}
                                    disabled={savingPagoId === pago.id}
                                    title="Guardar"
                                    data-testid={`pago-save-${pago.id}`}
                                  >
                                    <FaSave />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.deleteIconButton}
                                    onClick={cancelEditPago}
                                    title="Cancelar"
                                  >
                                    <FaTimes />
                                  </button>
                                </span>
                              ) : (
                                <span className={styles.breakdownActions}>
                                  <button
                                    type="button"
                                    className={styles.editIconButton}
                                    onClick={() => startEditPago(pago)}
                                    title="Editar pago"
                                    data-testid={`pago-edit-${pago.id}`}
                                    disabled={!onUpdatePago}
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.deleteIconButton}
                                    onClick={() => handleDeletePago(pago)}
                                    title="Eliminar pago"
                                    data-testid={`pago-delete-${pago.id}`}
                                    disabled={!onDeletePago}
                                  >
                                    <FaTrash />
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside
            className={styles.financialSummaryPanel}
            aria-label="Resumen financiero"
            data-testid="financial-summary-panel"
          >
            <h4 className={styles.summaryPanelTitle}>Resumen</h4>

            <div className={styles.summaryPanelRow}>
              <span>Total de cargos</span>
              <strong data-testid="summary-total-cargos">
                {formatCurrency(totalCargos)}
              </strong>
            </div>
            {tiposCargosOrdenados.length > 0 ? (
              <ul className={styles.summaryPanelSublist} data-testid="summary-cargos-breakdown">
                {tiposCargosOrdenados.map((tipo) => (
                  <li key={tipo.codigo}>
                    <span>{tipo.nombre}</span>
                    <span>{formatCurrency(tipo.total)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={styles.summaryPanelHint}>
              Incluye tarifas con promociones de tarifa ya aplicadas en los cargos.
            </p>

            <div className={styles.summaryPanelRow}>
              <span>Total de pagos</span>
              <strong data-testid="summary-total-pagos">
                {formatCurrency(totalPagos)}
              </strong>
            </div>

            <div className={styles.summaryPanelRow}>
              <span>Total de descuentos</span>
              <strong data-testid="summary-total-descuentos">
                {formatCurrency(totalDescuentos)}
              </strong>
            </div>
            {descuentoItems.length > 0 ? (
              <ul className={styles.summaryPanelSublist} data-testid="summary-descuentos-list">
                {descuentoItems.map((d) => (
                  <li key={d.id}>
                    <span>{promoHintFromDiscount(d)}</span>
                    <span>{formatCurrency(d.montoARS)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.summaryPanelHint}>Sin descuentos por medio de pago.</p>
            )}

            <div
              className={`${styles.summaryPanelSaldo} ${styles[estadoPago]}`}
              data-testid="financial-saldo-block"
            >
              <span>Saldo</span>
              <strong data-testid="financial-saldo">{formatCurrency(saldoDisplay)}</strong>
            </div>
            <div className={styles.estadoPagoTag} data-testid="financial-saldo-estado">
              {estadoPago === 'PENDIENTE' && 'Pendiente de pago'}
              {estadoPago === 'PAGADO' && 'Pagado completamente'}
              {estadoPago === 'A_FAVOR' && 'Saldo a favor'}
            </div>
          </aside>
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
        <div
          className={styles.modalOverlay}
          onClick={() => {
            resetCargoForm();
            setShowCargoModal(false);
          }}
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingCargo ? 'Editar cargo' : 'Agregar cargo'}</h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => {
                  resetCargoForm();
                  setShowCargoModal(false);
                }}
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
                  data-testid="input-cargo-monto"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Categoría *</label>
                <select
                  value={newCargo.subcategoriaCargoId || ''}
                  onChange={(e) =>
                    setNewCargo({
                      ...newCargo,
                      subcategoriaCargoId: e.target.value ? parseInt(e.target.value, 10) : null
                    })
                  }
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
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    resetCargoForm();
                    setShowCargoModal(false);
                  }}
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
      {confirmDialog}
      {noticeDialog}
    </div>
  );
};

export default EstadoFinancieroTab;
