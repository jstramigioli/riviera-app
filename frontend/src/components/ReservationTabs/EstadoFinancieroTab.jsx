import React, { useState, useEffect, useRef } from 'react';
import {
  FaPlus,
  FaChevronDown,
  FaChevronRight,
  FaTimes,
  FaCheck,
  FaEdit,
  FaPrint,
  FaTrash
} from 'react-icons/fa';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import CobroForm from '../CobroForm';
import LiquidacionPrint from './LiquidacionPrint';
import { RESERVATION_STATUSES } from '../../utils/reservationStatusUtils';
import styles from './ReservationTabs.module.css';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import { todayIsoLocal } from '../../utils/calendarDates';
import { formatMoneyArs, formatMoneyUsd } from '../../utils/formatMoney';

function civilIsoToday() {
  return todayIsoLocal();
}

function civilIsoOf(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Huésped ya retirado / check-out hecho o fecha de salida vencida. */
export function isGuestDeparted(reservation, todayIso = civilIsoToday()) {
  const status = String(reservation?.status || '').toUpperCase();
  if (status === RESERVATION_STATUSES.FINALIZADA) return true;
  const checkOut = civilIsoOf(reservation?.checkOut);
  if (!checkOut) return false;
  return checkOut < todayIso;
}

/**
 * Estado visual del saldo en el resumen:
 * - PAGADO: saldo ≤ 0
 * - PENDIENTE: saldo > 0 y huésped aún no se fue
 * - VENCIDO: saldo > 0 y huésped ya check-out / retirado
 */
export function resolveSaldoVisualStatus(saldo, reservation, todayIso = civilIsoToday()) {
  const amount = Number(saldo) || 0;
  if (amount <= 0) return amount < 0 ? 'A_FAVOR' : 'PAGADO';
  return isGuestDeparted(reservation, todayIso) ? 'VENCIDO' : 'PENDIENTE';
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

const AMBITO_LABELS = {
  CENA: 'Cena',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería',
  FRIGOBAR: 'Frigobar',
};

/** Comanda a la que pertenece un cargo (null si es un cargo suelto). */
function comandaOfCargo(cargo) {
  return cargo?.comandaItem?.comanda || null;
}

const EstadoFinancieroTab = ({
  reservation,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency = formatMoneyArs,
  onFinancialChange,
  onAddCargo,
  onUpdateCargo,
  onDeleteCargo,
  onDeleteCobro,
  pendingAction = null,
  onPendingActionHandled,
  onRequestConsumo,
  onOpenComanda
}) => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  /** Filas desplegadas: `cargo:<CODIGO>` por tipo de cargo y `cobros`. Todo colapsado al entrar. */
  const [expanded, setExpanded] = useState(() => new Set());
  const [showCobroForm, setShowCobroForm] = useState(false);
  const [editingCobro, setEditingCobro] = useState(null);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [newCargo, setNewCargo] = useState({
    descripcion: '',
    monto: '',
    subcategoriaCargoId: null
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
      const defaultSub =
        todasSubcategorias.find((s) => s.tipo === 'OTRO') || todasSubcategorias[0];
      if (defaultSub) {
        setNewCargo((prev) => ({
          ...prev,
          subcategoriaCargoId: defaultSub.id
        }));
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      setLoadingCategorias(false);
    }
  };

  const defaultSubcategoriaId = () => {
    const preferred =
      subcategorias.find((s) => s.tipo === 'OTRO') || subcategorias[0];
    return preferred?.id ?? null;
  };

  const resetCargoForm = () => {
    setNewCargo({
      descripcion: '',
      monto: '',
      subcategoriaCargoId: defaultSubcategoriaId()
    });
    setEditingCargo(null);
  };

  const closeCargoModal = () => {
    resetCargoForm();
    setShowCargoModal(false);
  };

  const cargoOverlayDismiss = useOverlayDismiss(closeCargoModal);

  const openCreateCargo = () => {
    resetCargoForm();
    setShowCargoModal(true);
  };

  const openEditConsumo = (cargo) => {
    setEditingCargo(cargo);
    setNewCargo({
      descripcion: cargo.descripcion || '',
      monto: String(cargo.monto ?? ''),
      subcategoriaCargoId: cargo.subcategoriaCargoId
    });
    setShowCargoModal(true);
  };

  const buildCargoPayload = () => {
    const base = {
      descripcion: newCargo.descripcion,
      monto: parseFloat(newCargo.monto)
    };
    const subId = newCargo.subcategoriaCargoId || defaultSubcategoriaId();
    if (subId) {
      return { ...base, subcategoriaCargoId: parseInt(subId, 10) };
    }
    // BE exige subcategoría o tipo; OTRO es el default sensato sin UI de categoría
    return { ...base, tipo: 'OTRO' };
  };

  const handleCargoSubmit = async (e) => {
    e.preventDefault();

    const payload = buildCargoPayload();
    if (editingCargo) {
      await onUpdateCargo(editingCargo.id, payload);
    } else {
      await onAddCargo(payload);
    }

    resetCargoForm();
    setShowCargoModal(false);
  };

  const handleDeleteCargo = async (cargo) => {
    if (!onDeleteCargo) return;
    const comanda = comandaOfCargo(cargo);
    const ok = await confirm(
      comanda
        ? {
            title: 'Quitar de la comanda',
            message: `¿Quitar "${cargo.descripcion || 'Cargo'}" de la comanda #${comanda.id}? Si es la última línea, la comanda queda anulada.`,
            confirmText: 'Quitar',
          }
        : {
            title: 'Eliminar cargo',
            message: `¿Eliminar el cargo "${cargo.descripcion || 'Cargo'}"?`,
            confirmText: 'Eliminar',
          }
    );
    if (!ok) return;
    await onDeleteCargo(cargo.id);
  };

  const openNewCobroForm = () => {
    setEditingCobro(null);
    setShowCobroForm(true);
  };

  const openEditCobroForm = (cobro) => {
    setEditingCobro(cobro);
    setShowCobroForm(true);
    setExpanded((prev) => new Set(prev).add('cobros'));
  };

  const closeCobroForm = () => {
    setShowCobroForm(false);
    setEditingCobro(null);
  };

  const handlePaymentSuccess = async () => {
    closeCobroForm();
    if (onFinancialChange) await onFinancialChange();
  };

  const handleDeleteCobro = async (cobro) => {
    if (!onDeleteCobro) return;
    const ok = await confirm({
      title: 'Anular cobro',
      message: `¿Anular el cobro ${cobro.codigo || `#${cobro.id}`}? Queda registrado como anulado y deja de sumar en caja y saldos. No se puede revertir.`,
      confirmText: 'Anular'
    });
    if (!ok) return;
    await onDeleteCobro(cobro.id);
    if (editingCobro?.id === cobro.id) closeCobroForm();
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

    if (pendingAction === 'add-cobro') {
      pendingHandledRef.current = pendingAction;
      openNewCobroForm();
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

  const totalCobrosNet =
    Number(financialSummary?.resumen?.totalCobros) || 0;
  const totalCargos = Number(financialSummary?.resumen?.totalCargos) || 0;
  const totalDescuentos = Number(financialSummary?.resumen?.totalDescuentos) || 0;
  const cargoItems = financialSummary?.cargos?.items || [];
  const cobroItems = financialSummary?.cobros?.items || [];
  const descuentoItems = financialSummary?.descuentos?.items || [];

  const isDevolucionCobro = (cobro) =>
    String(cobro?.motivo || '') === 'Devolución' || Number(cobro?.montoARS) < 0;

  const totalDevoluciones = cobroItems
    .filter(isDevolucionCobro)
    .reduce((sum, cobro) => sum + Math.abs(Number(cobro.montoARS ?? cobro.monto) || 0), 0);

  const totalCobrosBrutos = cobroItems
    .filter((cobro) => !isDevolucionCobro(cobro))
    .reduce((sum, cobro) => sum + Math.abs(Number(cobro.montoARS ?? cobro.monto) || 0), 0);

  /** Neto para saldo / accordion: API o brutos − devoluciones. */
  const totalCobros =
    financialSummary?.resumen?.totalCobros != null
      ? totalCobrosNet
      : totalCobrosBrutos - totalDevoluciones;

  const saldoDisplay =
    financialSummary?.resumen?.saldo != null
      ? Number(financialSummary.resumen.saldo)
      : totalCargos - totalCobros - totalDescuentos;
  const estadoCobro = resolveSaldoVisualStatus(saldoDisplay, reservation);
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const tipoCargoOrder = ['ALOJAMIENTO', 'CONSUMO', 'SERVICIO', 'OTRO'];
  const tiposCargosOrdenados = [
    ...tipoCargoOrder.filter((codigo) => cargosPorTipo[codigo]),
    ...Object.keys(cargosPorTipo).filter((codigo) => !tipoCargoOrder.includes(codigo))
  ].map((codigo) => cargosPorTipo[codigo]);

  if (!reservation) return null;

  const toggleRow = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderCargoItem = (item) => (
    <li key={item.id} className={styles.finItem}>
      <span className={styles.finItemDesc}>
        {item.descripcion || 'Cargo'}
        {item.fecha ? <span className={styles.finItemFecha}> · {formatDate(item.fecha)}</span> : null}
        {renderComandaTag(item)}
      </span>
      {renderMonto(item)}
    </li>
  );

  /** Fila colapsable: chevron + título (+ detalle) a la izquierda, total a la derecha. */
  const renderToggle = (key, label, meta, total, testIds = {}) => {
    const open = expanded.has(key);
    return (
      <button
        type="button"
        className={styles.finToggle}
        onClick={() => toggleRow(key)}
        aria-expanded={open}
        data-testid={testIds.row}
      >
        <span className={styles.finToggleLabel}>
          <span className={styles.finChevron} aria-hidden="true">
            {open ? <FaChevronDown /> : <FaChevronRight />}
          </span>
          {label}
          {meta ? (
            <span className={styles.finMeta} data-testid={testIds.meta}>
              {meta}
            </span>
          ) : null}
        </span>
        <span className={styles.finToggleTotal} data-testid={testIds.total}>
          {formatCurrency(total)}
        </span>
      </button>
    );
  };

  const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

  /**
   * Ítems de un tipo de cargo agrupados por comanda: cada comanda es un chip que abre
   * la comanda para editarla, con sus líneas debajo; los cargos sueltos (sin comanda,
   * p. ej. consumos anteriores al sistema de comandas) van al final.
   */
  const renderGroupItems = (items) => {
    const porComanda = new Map();
    const sueltos = [];
    for (const item of items) {
      const comanda = comandaOfCargo(item);
      if (!comanda) {
        sueltos.push(item);
        continue;
      }
      if (!porComanda.has(comanda.id)) porComanda.set(comanda.id, { comanda, items: [] });
      porComanda.get(comanda.id).items.push(item);
    }
    return (
      <ul className={styles.finItems}>
        {[...porComanda.values()].map(({ comanda, items: lineas }) => (
          <li key={`comanda-${comanda.id}`} className={styles.finComanda}>
            <div className={styles.finComandaHead}>
              <button
                type="button"
                className={styles.comandaChip}
                onClick={() => onOpenComanda?.(comanda.id)}
                disabled={typeof onOpenComanda !== 'function' || comanda.estado === 'ANULADA'}
                title={`Abrir comanda #${comanda.id}`}
                data-testid={`comanda-chip-${comanda.id}`}
              >
                Comanda #{comanda.id}
              </button>
              <span className={styles.finItemFecha}>
                {AMBITO_LABELS[comanda.ambito] || comanda.ambito}
                {comanda.fecha ? ` · ${String(comanda.fecha).slice(0, 10).split('-').reverse().join('/')}` : ''}
              </span>
              <span className={styles.finComandaTotal}>
                {formatCurrency(lineas.reduce((sum, l) => sum + (Number(l.monto) || 0), 0))}
              </span>
            </div>
            <ul className={styles.finComandaLines}>
              {lineas.map((item) => (
                <li key={item.id} className={styles.finItem}>
                  <span className={styles.finItemDesc}>{item.descripcion || 'Cargo'}</span>
                  {renderMonto(item)}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {sueltos.map(renderCargoItem)}
      </ul>
    );
  };

  const isLodgingCargo = (item) => !item.subcategoriaCargoId;

  const renderCargoActions = (item) => {
    if (isLodgingCargo(item)) {
      return null;
    }

    const comanda = comandaOfCargo(item);

    return (
      <span className={styles.breakdownActions}>
        {!comanda && (
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
        )}
        <button
          type="button"
          className={styles.deleteIconButton}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteCargo(item);
          }}
          title={comanda ? 'Quitar de la comanda' : 'Eliminar cargo'}
          data-testid={`btn-delete-cargo-${item.id}`}
        >
          <FaTimes />
        </button>
      </span>
    );
  };

  const renderComandaTag = (item) => {
    const comanda = comandaOfCargo(item);
    if (!comanda) return null;
    return (
      <span className={styles.comandaTag}>
        {` · Comanda #${comanda.id} · ${AMBITO_LABELS[comanda.ambito] || comanda.ambito}`}
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
            onClick={openNewCobroForm}
            data-testid="btn-add-cobro"
          >
            <FaPlus /> cobro
          </button>
          {typeof onRequestConsumo === 'function' && (
            <button
              type="button"
              className={styles.addButton}
              onClick={onRequestConsumo}
              data-testid="btn-add-consumo"
            >
              <FaPlus /> Comanda
            </button>
          )}
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
            <section className={styles.finSection} aria-labelledby="fin-cargos-title">
              <div className={styles.finSectionHead} data-testid="financial-row-cargos">
                <h4 id="fin-cargos-title" className={styles.finSectionTitle}>
                  Cargos
                </h4>
                <strong className={styles.finSectionTotal} data-testid="financial-total-cargos">
                  {formatCurrency(totalCargos)}
                </strong>
              </div>
              {tiposCargosOrdenados.length > 0 ? (
                <ul className={styles.finGroups} data-testid="financial-detail-cargos">
                  {tiposCargosOrdenados.map((tipo) => {
                    const key = `cargo:${tipo.codigo}`;
                    const items = tipo.items || [];
                    return (
                      <li key={tipo.codigo} className={styles.finGroup}>
                        {renderToggle(key, tipo.nombre, cantidad(items.length, 'cargo', 'cargos'), tipo.total, {
                          row: `financial-group-${tipo.codigo}`
                        })}
                        {expanded.has(key) ? renderGroupItems(items) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : cargoItems.length > 0 ? (
                <ul className={styles.finItems} data-testid="financial-detail-cargos">
                  {cargoItems.map(renderCargoItem)}
                </ul>
              ) : (
                <p className={styles.finEmpty}>Sin cargos registrados.</p>
              )}
            </section>

            <section className={styles.finSection} aria-label="Cobros">
              {renderToggle(
                'cobros',
                <span className={styles.finSectionTitle}>Cobros</span>,
                cantidad(cobroItems.length, 'registro', 'registros'),
                totalCobros,
                { row: 'financial-row-cobros', meta: 'financial-cobros-count', total: 'financial-total-cobros' }
              )}
              {expanded.has('cobros') ? (
                <div data-testid="financial-detail-cobros">
                  {cobroItems.length === 0 ? (
                    <p className={styles.finEmpty}>Sin cobros registrados.</p>
                  ) : (
                    <div className={styles.cobrosTableScroll}>
                      <table
                        className={`${styles.dataTable} ${styles.cobrosTable}`}
                        data-testid="financial-cobros-table"
                      >
                        <thead>
                          <tr>
                            <th className={styles.shortCell}>Código</th>
                            <th>Fecha</th>
                            <th className={styles.montoCell}>Monto</th>
                            <th className={styles.shortCell}>Moneda</th>
                            <th>Método</th>
                            <th>Motivo</th>
                            <th className={styles.montoCell}>Descuento</th>
                            <th aria-label="Acciones" />
                          </tr>
                        </thead>
                        <tbody>
                          {cobroItems.map((cobro) => {
                            const disc = cobro.discountApplication;
                            const codigo = cobro.cobroCodigo || cobro.codigo || `#${cobro.id}`;
                            return (
                              <tr
                                key={cobro.imputacionId || cobro.id}
                                data-testid={`financial-cobro-row-${cobro.imputacionId || cobro.id}`}
                              >
                                <td className={styles.shortCell}>
                                  {codigo}
                                  {cobro.esImputacionParcial
                                    ? ` · parte de ${formatCurrency(cobro.pagoTotalARS)}`
                                    : ''}
                                </td>
                                <td>{formatDate(cobro.fecha)}</td>
                                <td className={styles.montoCell}>
                                  {cobro.moneda === 'USD'
                                    ? formatMoneyUsd(cobro.monto)
                                    : formatCurrency(cobro.montoARS ?? cobro.monto)}
                                  {cobro.moneda === 'USD' && cobro.montoARS != null ? (
                                    <div className={styles.arsEquivalent}>≈ {formatCurrency(cobro.montoARS)}</div>
                                  ) : null}
                                </td>
                                <td className={styles.shortCell}>{cobro.moneda || 'ARS'}</td>
                                <td>{cobro.metodo || '—'}</td>
                                <td>{cobro.motivo || 'Cobro'}</td>
                                <td className={styles.montoCell}>
                                  {disc && Number(disc.montoARS) !== 0 ? formatCurrency(disc.montoARS) : '—'}
                                  {disc && Number(disc.montoARS) !== 0 ? (
                                    <div className={styles.arsEquivalent}>{promoHintFromDiscount(disc)}</div>
                                  ) : null}
                                </td>
                                <td>
                                  <span className={styles.breakdownActions}>
                                    <button
                                      type="button"
                                      className={styles.editIconButton}
                                      onClick={() => openEditCobroForm(cobro)}
                                      title="Editar cobro"
                                      aria-label={`Editar cobro ${codigo}`}
                                      data-testid={`cobro-edit-${cobro.id}`}
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.deleteIconButton}
                                      onClick={() => handleDeleteCobro(cobro)}
                                      title="Anular cobro"
                                      aria-label={`Anular cobro ${codigo}`}
                                      data-testid={`cobro-delete-${cobro.id}`}
                                      disabled={!onDeleteCobro}
                                    >
                                      <FaTrash />
                                    </button>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
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

            <div className={styles.summaryPanelRow}>
              <span>Total de cobros</span>
              <strong data-testid="summary-total-cobros">
                {formatCurrency(totalCobrosBrutos)}
              </strong>
            </div>

            <div className={styles.summaryPanelRow}>
              <span>Total de devoluciones</span>
              <strong data-testid="summary-total-devoluciones">
                {formatCurrency(totalDevoluciones)}
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
            ) : null}

            <div
              className={`${styles.summaryPanelSaldo} ${styles[estadoCobro]}`}
              data-testid="financial-saldo-block"
              data-status={estadoCobro}
            >
              <span className={styles.summarySaldoLabel}>
                {estadoCobro === 'PAGADO' || estadoCobro === 'A_FAVOR' ? (
                  <FiCheckCircle
                    className={`${styles.summaryStatusIcon} ${styles.summaryStatusPaid}`}
                    aria-hidden="true"
                    data-testid="saldo-icon-paid"
                  />
                ) : null}
                {estadoCobro === 'PENDIENTE' ? (
                  <FiAlertTriangle
                    className={`${styles.summaryStatusIcon} ${styles.summaryStatusPending}`}
                    aria-hidden="true"
                    data-testid="saldo-icon-pending"
                  />
                ) : null}
                {estadoCobro === 'VENCIDO' ? (
                  <FiAlertTriangle
                    className={`${styles.summaryStatusIcon} ${styles.summaryStatusOverdue}`}
                    aria-hidden="true"
                    data-testid="saldo-icon-overdue"
                  />
                ) : null}
                Saldo
              </span>
              <strong data-testid="financial-saldo">{formatCurrency(saldoDisplay)}</strong>
            </div>
            <div className={styles.estadoCobroTag} data-testid="financial-saldo-estado">
              {estadoCobro === 'PENDIENTE' && 'Pendiente de cobro'}
              {estadoCobro === 'VENCIDO' && 'Saldo vencido (huésped retirado)'}
              {estadoCobro === 'PAGADO' && 'Pagado completamente'}
              {estadoCobro === 'A_FAVOR' && 'Saldo a favor'}
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

      {showCobroForm && (
        <CobroForm
          reservaId={reservation.id}
          initialCobro={editingCobro}
          onClose={closeCobroForm}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showCargoModal && (
        <div className={styles.modalOverlay} {...cargoOverlayDismiss}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingCargo ? 'Editar cargo' : 'Agregar cargo'}</h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeCargoModal}
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
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeCargoModal}
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
