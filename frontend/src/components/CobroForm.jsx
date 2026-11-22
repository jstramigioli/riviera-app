import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCreditCard,
  FiDollarSign,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiUpload,
  FiX
} from 'react-icons/fi';
import {
  createCobro,
  createAccountCobro,
  createClientMultiCobro,
  createExternalAccount,
  updateCobro,
  fetchReservation,
  fetchCuentasParaCobro,
  fetchPaymentMethodConfigs,
  fetchAccountResumen,
  fetchAccountCobros,
  getReservationFinancialSummary,
  getClientBillingProfile,
  getTipoCambioActual,
  uploadCobroAdjuntos,
  previewPromotion
} from '../services/api';
import {
  benefitUnitLabel,
  buildBenefitApplyPayload,
  collectManualBenefitSuggestions,
  collectOptionalPromoChoices,
  formatOptionalBenefitValue,
  isRemovableOptionalPromo
} from '../utils/promoManualBenefit';
import {
  DEFAULT_COBRO_MOTIVO,
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  MOTIVO_DEVOLUCION,
  emptyBillingForm,
  isCardMethod,
  isPersonInvoiceType,
  localDateInputToIso,
  methodRequiresBilling,
  todayLocalDateInputValue
} from '../constants/billing';
import { COUNTRIES } from '../constants/countries';
import { todayAsLocalDate } from '../utils/calendarDates';
import {
  computeRefundFromCash,
  computeRefundFromCredit,
  formatArs,
  roundMoney
} from '../utils/paymentDiscount';
import {
  isEfectivo,
  readCashTenderFields,
  suggestVueltoARS
} from '../utils/cashTender';
import { formatMoney, formatMoneyArs, formatMoneyUsd } from '../utils/formatMoney';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import styles from './CobroForm.module.css';

function pagoFechaToInput(value) {
  if (!value) return todayLocalDateInputValue();
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayLocalDateInputValue();
  return todayLocalDateInputValue(d);
}

const MODE_PAGO = 'cobro';
const MODE_DEVOLUCION = 'devolucion';
const AMOUNT_MODE_INGRESADO = 'ingresado';
const AMOUNT_MODE_SALDAR = 'saldar';
const ADJUNTO_COMPROBANTE = 'COMPROBANTE';
const COMPROBANTE_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
/** Monedas habilitadas en el sistema (alineado al backend). */
const SYSTEM_CURRENCIES = [
  { code: 'ARS', label: 'Pesos Argentinos (ARS)' },
  { code: 'USD', label: 'Dólares (USD)' }
];

/** True si la moneda del cobro no es ARS (caja en divisa + TC). */
function isForeignCurrency(moneda) {
  return Boolean(moneda) && String(moneda).toUpperCase() !== 'ARS';
}

/** Convierte un monto ARS al valor de caja en la moneda del formulario. */
function arsToFormMonto(ars, moneda, tipoCambio) {
  const amount = Number(ars) || 0;
  if (isForeignCurrency(moneda)) {
    const tc = parseFloat(tipoCambio) || 0;
    if (!(tc > 0)) return '';
    return String(roundMoney(amount / tc));
  }
  return String(roundMoney(amount));
}

/** Convierte monto de caja (moneda del form) a ARS. */
function formMontoToArs(monto, moneda, tipoCambio) {
  const amount = parseFloat(monto) || 0;
  if (isForeignCurrency(moneda)) {
    const tc = parseFloat(tipoCambio) || 0;
    if (!(tc > 0)) return 0;
    return roundMoney(amount * tc);
  }
  return roundMoney(amount);
}

function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
}

/** Icono SVG distinto por medio de pago (columna de método). */
function paymentMethodIcon(metodo) {
  const m = String(metodo || '')
    .trim()
    .toLowerCase();
  if (m.includes('efectivo')) return FiDollarSign;
  if (m.includes('tarjeta') || m.includes('débito') || m.includes('debito') || m.includes('crédito') || m.includes('credito')) {
    return FiCreditCard;
  }
  if (m.includes('transfer')) return FiRefreshCw;
  return FiMoreHorizontal;
}

function reservationOptionLabel(row) {
  if (row.label) return row.label;
  if (row.accountKind === 'EXTERNAL' || row.origen === 'EXTERNA') {
    return row.label || `Externa #${row.accountId}`;
  }
  const room = row.roomName || 'Hab.';
  const apellido = row.clientLastName || (row.clientName || '').split(/\s+/).pop() || 'Sin apellido';
  return `${room} - ${apellido}`;
}

function optionKey(row) {
  if (!row) return '';
  if (row.accountId != null) return `a:${row.accountId}`;
  if (row.reservationId != null) return `r:${row.reservationId}`;
  return '';
}

function isExternalRow(row) {
  return Boolean(row && (row.origen === 'EXTERNA' || row.accountKind === 'EXTERNAL'));
}

let allocSeq = 0;
function newAllocRow(partial = {}) {
  allocSeq += 1;
  return {
    localId: `alloc-${allocSeq}`,
    optionKey: '',
    monto: '',
    ...partial
  };
}

/** Normaliza respuesta SETTLEMENT del motor de promociones para la UI de Nuevo cobro. */
function mapSettlementPreview(preview, saldoPendiente = null) {
  const appliedRules = Array.isArray(preview?.appliedRules)
    ? preview.appliedRules
        .filter((r) => r && (Number(r.montoARS) > 0 || r.promotionRuleId != null))
        .map((r) => ({
          promotionRuleId: r.promotionRuleId ?? r.id ?? null,
          code: r.code || null,
          label: r.label || r.code || 'Descuento',
          montoARS: Number(r.montoARS) || 0,
          porcentaje: r.porcentaje != null ? Number(r.porcentaje) : null,
          modality: r.modality || 'AUTO',
          defaultOn: r.defaultOn != null ? Boolean(r.defaultOn) : r.modality === 'SUGERIDA'
        }))
    : [];
  if (!preview?.aplica && appliedRules.length === 0) return null;
  const primary = appliedRules[0] || null;
  return {
    aplica: Boolean(preview?.aplica) || appliedRules.length > 0,
    descuentoARS: preview?.descuentoARS,
    creditoARS: preview?.creditoARS,
    dineroARS: preview?.dineroARS,
    porcentaje: preview?.porcentaje,
    saldoARS: preview?.saldoARS != null ? preview.saldoARS : saldoPendiente,
    label: primary?.label || null,
    appliedRules
  };
}

const CobroForm = ({
  reservaId: reservaIdProp = null,
  accountId: accountIdProp = null,
  initialCobro = null,
  initialMontoASaldar = null,
  initialMode = null,
  initialMonto = null,
  onClose,
  onSuccess
}) => {
  const isEditMode = initialCobro != null && initialCobro.id != null;
  const showAllocationUi = !isEditMode;
  const [reservationOptions, setReservationOptions] = useState([]);
  const [allocations, setAllocations] = useState(() => [newAllocRow()]);
  const [activeAllocId, setActiveAllocId] = useState(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [showCreateExternal, setShowCreateExternal] = useState(false);
  const [externalLabel, setExternalLabel] = useState('');
  const [creatingExternal, setCreatingExternal] = useState(false);
  const accountPickerRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [mode, setMode] = useState(() => {
    if (isEditMode && String(initialCobro.motivo || '') === MOTIVO_DEVOLUCION) {
      return MODE_DEVOLUCION;
    }
    if (!isEditMode && initialMode === MODE_DEVOLUCION) {
      return MODE_DEVOLUCION;
    }
    return MODE_PAGO;
  });
  const [esSena, setEsSena] = useState(
    () => isEditMode && String(initialCobro.motivo || '') === 'Seña'
  );

  const optionByKey = useMemo(() => {
    const map = new Map();
    for (const row of reservationOptions) {
      const key = optionKey(row);
      if (key) map.set(key, row);
    }
    return map;
  }, [reservationOptions]);

  const assignedAllocations = useMemo(
    () =>
      allocations
        .map((alloc) => ({
          ...alloc,
          row: alloc.optionKey ? optionByKey.get(alloc.optionKey) || null : null
        }))
        .filter((alloc) => alloc.optionKey && alloc.row),
    [allocations, optionByKey]
  );

  const isMultiAlloc = assignedAllocations.length > 1;
  const pickedRow = assignedAllocations[0]?.row || null;

  const isExternalAccount = isEditMode
    ? accountIdProp != null && reservaIdProp == null
    : assignedAllocations.length > 0
      ? assignedAllocations.every((a) => isExternalRow(a.row))
      : accountIdProp != null && reservaIdProp == null;

  const reservaId = isEditMode
    ? reservaIdProp != null
      ? Number(reservaIdProp)
      : null
    : pickedRow?.reservationId
      ? Number(pickedRow.reservationId)
      : reservaIdProp != null && assignedAllocations.length === 0
        ? Number(reservaIdProp)
        : null;

  const accountId = isEditMode
    ? accountIdProp != null
      ? Number(accountIdProp)
      : null
    : pickedRow?.accountId
      ? Number(pickedRow.accountId)
      : accountIdProp != null && assignedAllocations.length === 0
        ? Number(accountIdProp)
        : null;

  const isDevolucion = mode === MODE_DEVOLUCION;
  // Seña solo en Account de reserva 1:1 (decisión PGH-130).
  const canUseSena = !isExternalAccount && !isMultiAlloc;
  const motivoActual = isDevolucion
    ? MOTIVO_DEVOLUCION
    : esSena && canUseSena
      ? 'Seña'
      : DEFAULT_COBRO_MOTIVO;

  const [formData, setFormData] = useState(() => {
    if (!isEditMode) {
      const seedMonto = Number(initialMonto);
      return {
        monto:
          Number.isFinite(seedMonto) && seedMonto > 0
            ? String(roundMoney(seedMonto))
            : '',
        moneda: 'ARS',
        tipoCambio: '',
        metodo: 'Efectivo',
        numeroTarjeta: '',
        empresa: '',
        notas: '',
        fecha: todayLocalDateInputValue()
      };
    }
    return {
      monto: String(Math.abs(Number(initialCobro.monto) || 0) || ''),
      moneda: initialCobro.moneda || 'ARS',
      tipoCambio:
        initialCobro.tipoCambio != null ? String(initialCobro.tipoCambio) : '',
      metodo: initialCobro.metodo || 'Efectivo',
      numeroTarjeta: initialCobro.numeroTarjeta || '',
      empresa: initialCobro.empresa || '',
      notas: initialCobro.notas || '',
      fecha: pagoFechaToInput(initialCobro.fecha)
    };
  });

  const [requiereFacturacion, setRequiereFacturacion] = useState(false);
  const [billing, setBilling] = useState(() => emptyBillingForm());
  const [comprobanteFiles, setComprobanteFiles] = useState([]);

  const [tipoCambioGlobal, setTipoCambioGlobal] = useState(null);
  const [montoARS, setMontoARS] = useState(0);
  const [loading, setLoading] = useState(false);
  const overlayDismiss = useOverlayDismiss(onClose, { enabled: !loading });
  const [error, setError] = useState(null);
  const [methodConfigs, setMethodConfigs] = useState([]);
  const [saldoPendiente, setSaldoPendiente] = useState(null);
  const [cobrosOrigen, setCobrosOrigen] = useState([]);
  const [cobroOrigenId, setCobroOrigenId] = useState('');
  const [amountMode, setAmountMode] = useState(() => {
    const n = Number(initialMontoASaldar);
    return Number.isFinite(n) && n > 0 ? AMOUNT_MODE_SALDAR : AMOUNT_MODE_INGRESADO;
  });
  const [montoASaldar, setMontoASaldar] = useState(() => {
    const n = Number(initialMontoASaldar);
    return Number.isFinite(n) && n > 0 ? String(roundMoney(n)) : '';
  });
  /** Draft del equivalente ARS mientras se edita (evita pelear con redondeo monto↔ARS). */
  const [equivArsDraft, setEquivArsDraft] = useState('');
  const equivArsFocusedRef = useRef(false);
  /** Movimiento de efectivo: sync independiente de ingresado↔saldado. */
  const [dineroRecibido, setDineroRecibido] = useState(() => {
    if (!isEditMode) return '';
    const t = readCashTenderFields(initialCobro);
    return t.dineroRecibido > 0 ? String(t.dineroRecibido) : '';
  });
  const [vueltoARS, setVueltoARS] = useState(() => {
    if (!isEditMode) return '0';
    const t = readCashTenderFields(initialCobro);
    return String(t.vueltoARS || 0);
  });
  // Dirty solo si el cobro ya tenía recibido distinto del default (recibido≠monto).
  // Vuelto siempre = excedente máx (solo lectura; crédito vía monto ingresado).
  const dineroRecibidoDirtyRef = useRef(
    (() => {
      if (!isEditMode) return false;
      const t = readCashTenderFields(initialCobro);
      const montoAbs = roundMoney(Math.abs(Number(initialCobro?.monto) || 0));
      return Math.abs(t.dineroRecibido - montoAbs) > 0.009;
    })()
  );
  const [manualPromoSuggestions, setManualPromoSuggestions] = useState([]);
  const [manualPromoValues, setManualPromoValues] = useState({});
  const [manualPromoPreview, setManualPromoPreview] = useState(null);
  const [optionalChoices, setOptionalChoices] = useState([]);
  const [selectedOptionalIds, setSelectedOptionalIds] = useState([]);
  const [deselectedRuleIds, setDeselectedRuleIds] = useState([]);
  const [addPromoOpen, setAddPromoOpen] = useState(false);
  const addPromoRef = useRef(null);
  const showComprobanteField = isTransferencia(formData.metodo);
  const showCashTender = isEfectivo(formData.metodo) && !isDevolucion;
  const isSaldarMode = amountMode === AMOUNT_MODE_SALDAR;
  const montoASaldarARS = roundMoney(parseFloat(montoASaldar) || 0);

  const selectedCobroOrigen = useMemo(() => {
    if (!cobroOrigenId) return null;
    return cobrosOrigen.find((p) => String(p.id) === String(cobroOrigenId)) || null;
  }, [cobrosOrigen, cobroOrigenId]);

  const origenCobroARS = selectedCobroOrigen
    ? roundMoney(Math.abs(Number(selectedCobroOrigen.montoARS) || 0))
    : 0;
  const origenDescuentoARS = selectedCobroOrigen
    ? roundMoney(
        Math.abs(Number(selectedCobroOrigen.discountApplication?.montoARS) || 0)
      )
    : 0;

  const manualPromoApply = useMemo(
    () =>
      buildBenefitApplyPayload({
        manualValues: manualPromoValues,
        selectedOptionalIds,
        deselectedRuleIds
      }),
    [manualPromoValues, selectedOptionalIds, deselectedRuleIds]
  );

  const selectedMethodConfig = useMemo(() => {
    const label = String(formData.metodo || '').trim().toLowerCase();
    return (
      methodConfigs.find((c) => String(c.label).trim().toLowerCase() === label) || null
    );
  }, [methodConfigs, formData.metodo]);

  const billingForced =
    selectedMethodConfig != null
      ? Boolean(selectedMethodConfig.requiereFacturacion)
      : methodRequiresBilling(formData.metodo);
  const billingEnabled = billingForced || requiereFacturacion;

  const showInvoiceCardField = billingEnabled && !isCardMethod(formData.metodo);

  const applyBillingPrefill = useCallback(async (cid) => {
    if (!cid) return;
    try {
      const profile = await getClientBillingProfile(cid);
      const savedTipo = ['A', 'B', 'T'].includes(profile.lastInvoiceType)
        ? profile.lastInvoiceType
        : 'B';
      setBilling((prev) =>
        emptyBillingForm({
          ...prev,
          tipo: savedTipo,
          fecha: todayLocalDateInputValue(),
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          documentType:
            profile.documentType || (savedTipo === 'T' ? 'Pasaporte' : 'DNI'),
          documentNumber: profile.documentNumber || '',
          passportCountry: profile.passportCountry || '',
          address: profile.address || '',
          email: profile.email || '',
          businessName: profile.businessName || '',
          cuit: profile.cuit || '',
          commercialAddress: profile.commercialAddress || '',
          ivaCondition: profile.ivaCondition || prev.ivaCondition,
          cardNumber: profile.cardNumber || ''
        })
      );
    } catch (err) {
      console.error('Error cargando perfil de facturación:', err);
    }
  }, []);

  useEffect(() => {
    loadTipoCambioGlobal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchPaymentMethodConfigs();
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setMethodConfigs(rows);
          setFormData((prev) => {
            const stillValid = rows.some((c) => c.label === prev.metodo);
            if (stillValid) return prev;
            return { ...prev, metodo: rows[0].label };
          });
        }
      } catch (err) {
        console.error('Error cargando medios de pago:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    calculateMontoARS();
  }, [formData.monto, formData.moneda, formData.tipoCambio]);

  // Sync dinero recibido / vuelto (independiente de ingresado↔saldado; recibido respeta dirty).
  // Vuelto siempre = excedente máx (solo lectura).
  useEffect(() => {
    if (!showCashTender) return;
    const ingresado = parseFloat(formData.monto) || 0;
    if (!dineroRecibidoDirtyRef.current) {
      setDineroRecibido(ingresado > 0 ? String(roundMoney(ingresado)) : '');
    }
    const recibidoNum = dineroRecibidoDirtyRef.current
      ? parseFloat(dineroRecibido) || 0
      : ingresado;
    const suggested = suggestVueltoARS({
      dineroRecibido: recibidoNum,
      moneda: formData.moneda,
      tipoCambio: formData.tipoCambio,
      montoIngresadoARS: montoARS
    });
    setVueltoARS(String(suggested));
  }, [
    showCashTender,
    formData.monto,
    formData.moneda,
    formData.tipoCambio,
    montoARS,
    dineroRecibido
  ]);

  // Sync draft del equivalente ARS desde monto×TC, salvo mientras el usuario escribe.
  useEffect(() => {
    if (equivArsFocusedRef.current) return;
    if (!isForeignCurrency(formData.moneda)) {
      setEquivArsDraft('');
      return;
    }
    const monto = parseFloat(formData.monto) || 0;
    const tc = parseFloat(formData.tipoCambio) || 0;
    if (!(monto > 0) || !(tc > 0)) {
      setEquivArsDraft('');
      return;
    }
    const next = String(roundMoney(monto * tc));
    setEquivArsDraft((prev) => (prev === next ? prev : next));
  }, [formData.monto, formData.moneda, formData.tipoCambio, montoARS]);

  // Devolución: sync bidireccional como Nuevo cobro.
  // Sin origen / sin desc. → 1:1; con descuento del cobro origen → proporción de reversión.
  useEffect(() => {
    if (!isDevolucion) return;

    if (amountMode === AMOUNT_MODE_SALDAR && montoASaldarARS > 0) {
      const r = computeRefundFromCredit({
        creditoARS: montoASaldarARS,
        originalCobroARS: origenCobroARS,
        originalDiscountARS: origenDescuentoARS
      });
      setFormData((prev) => {
        const nextCash = arsToFormMonto(r.cashARS, prev.moneda, prev.tipoCambio);
        if (nextCash === '' || prev.monto === nextCash) return prev;
        return { ...prev, monto: nextCash };
      });
      return;
    }

    if (amountMode === AMOUNT_MODE_INGRESADO && Number(montoARS) > 0) {
      const r = computeRefundFromCash({
        cashARS: montoARS,
        originalCobroARS: origenCobroARS,
        originalDiscountARS: origenDescuentoARS
      });
      const nextSaldar = String(roundMoney(r.creditoARS));
      setMontoASaldar((prev) => (prev === nextSaldar ? prev : nextSaldar));
    }
  }, [
    isDevolucion,
    origenCobroARS,
    origenDescuentoARS,
    amountMode,
    montoASaldarARS,
    montoARS,
    formData.moneda,
    formData.tipoCambio
  ]);

  useEffect(() => {
    if (isDevolucion) {
      setManualPromoSuggestions([]);
      setManualPromoPreview(null);
      setOptionalChoices([]);
      return undefined;
    }
    // Sin método aún (configs cargando): no pedir preview.
    if (!formData.metodo && !selectedMethodConfig?.id) {
      setManualPromoSuggestions([]);
      setManualPromoPreview(null);
      setOptionalChoices([]);
      return undefined;
    }

    const hasIngresado = amountMode === AMOUNT_MODE_INGRESADO && Number(montoARS) > 0;
    const hasSaldar = amountMode === AMOUNT_MODE_SALDAR && montoASaldarARS > 0;
    // Sonda: listar elegibles aunque aún no haya monto (nombre + %).
    const probeOnly = !hasIngresado && !hasSaldar;
    const previewMode = hasSaldar || (probeOnly && saldoPendiente != null && saldoPendiente > 0)
      ? 'settle'
      : 'received';
    const dineroARS = hasIngresado ? montoARS : probeOnly && previewMode === 'received' ? 10000 : undefined;
    const saldoForPreview = hasSaldar
      ? montoASaldarARS
      : saldoPendiente;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const {
          benefitValueByRuleId,
          selectedRuleIds,
          deselectedRuleIds: deselected
        } = manualPromoApply;
        const preview = await previewPromotion({
          layer: 'SETTLEMENT',
          metodo: formData.metodo,
          paymentMethodConfigId: selectedMethodConfig?.id,
          dineroARS,
          saldoPendiente: saldoForPreview,
          moneda: formData.moneda,
          motivo: motivoActual,
          mode: previewMode,
          selectedRuleIds,
          deselectedRuleIds: deselected,
          benefitValueByRuleId,
          applySuggestedDefaults: true
        });
        if (cancelled) return;
        const mapped = mapSettlementPreview(preview, saldoForPreview);
        setManualPromoSuggestions(collectManualBenefitSuggestions(preview));
        setManualPromoPreview(
          mapped
            ? {
                ...mapped,
                probeOnly,
                amountMode,
                saldoARS: mapped.saldoARS ?? (hasSaldar ? montoASaldarARS : saldoPendiente)
              }
            : null
        );
        setOptionalChoices(collectOptionalPromoChoices(preview, mapped?.appliedRules || []));
        // Sync peer field: con descuento → preview; sin descuento → 1:1.
        // Respeta la moneda elegida (USD↔ARS) sin forzar ARS.
        if (!probeOnly) {
          if (hasSaldar) {
            const peerArs =
              mapped?.aplica && mapped.dineroARS != null
                ? mapped.dineroARS
                : montoASaldarARS;
            setFormData((prev) => {
              const nextIngresado = arsToFormMonto(
                peerArs,
                prev.moneda,
                prev.tipoCambio
              );
              if (nextIngresado === '' || prev.monto === nextIngresado) return prev;
              return { ...prev, monto: nextIngresado };
            });
          } else if (hasIngresado) {
            const nextSaldar = String(
              roundMoney(
                mapped?.aplica && mapped.creditoARS != null
                  ? mapped.creditoARS
                  : montoARS
              )
            );
            setMontoASaldar((prev) => (prev === nextSaldar ? prev : nextSaldar));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Preview promos settlement falló', err);
          setManualPromoSuggestions([]);
          setManualPromoPreview(null);
          setOptionalChoices([]);
          // Fallback 1:1 si el preview falló (misma regla que sin descuento).
          if (!probeOnly) {
            if (hasSaldar) {
              setFormData((prev) => {
                const nextIngresado = arsToFormMonto(
                  montoASaldarARS,
                  prev.moneda,
                  prev.tipoCambio
                );
                if (nextIngresado === '' || prev.monto === nextIngresado) return prev;
                return { ...prev, monto: nextIngresado };
              });
            } else if (hasIngresado) {
              const nextSaldar = String(roundMoney(montoARS));
              setMontoASaldar((prev) => (prev === nextSaldar ? prev : nextSaldar));
            }
          }
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isDevolucion,
    amountMode,
    montoARS,
    montoASaldarARS,
    formData.metodo,
    formData.moneda,
    formData.tipoCambio,
    selectedMethodConfig?.id,
    saldoPendiente,
    motivoActual,
    manualPromoApply
  ]);

  useEffect(() => {
    if (!addPromoOpen) return undefined;
    const onDocClick = (e) => {
      if (addPromoRef.current && !addPromoRef.current.contains(e.target)) {
        setAddPromoOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [addPromoOpen]);

  const setManualPromoValue = (ruleId, value) => {
    setManualPromoValues((prev) => ({ ...prev, [ruleId]: value }));
  };

  const removeOptionalPromo = (promo) => {
    const id = Number(promo?.promotionRuleId ?? promo?.id);
    if (!Number.isFinite(id)) return;
    if (promo.defaultOn || String(promo.modality || '').toUpperCase() === 'SUGERIDA') {
      setDeselectedRuleIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setSelectedOptionalIds((prev) => prev.filter((x) => Number(x) !== id));
    } else {
      setSelectedOptionalIds((prev) => prev.filter((x) => Number(x) !== id));
    }
    setManualPromoValues((prev) => {
      if (prev[id] == null && prev[String(id)] == null) return prev;
      const next = { ...prev };
      delete next[id];
      delete next[String(id)];
      return next;
    });
  };

  const addOptionalPromo = (choice) => {
    if (!choice || choice.id == null) return;
    const id = Number(choice.id);
    if (choice.defaultOn) {
      setDeselectedRuleIds((prev) => prev.filter((x) => Number(x) !== id));
    } else {
      setSelectedOptionalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
    setAddPromoOpen(false);
  };

  useEffect(() => {
    if (billingForced) {
      setRequiereFacturacion(true);
    }
  }, [billingForced]);

  useEffect(() => {
    if (!canUseSena && esSena) setEsSena(false);
  }, [canUseSena, esSena]);

  useEffect(() => {
    let cancelled = false;
    async function loadFolioMeta() {
      const resolvedAccountId = accountId;
      const resolvedReservaId = reservaId;
      if (!resolvedAccountId && !resolvedReservaId) {
        setSaldoPendiente(null);
        setCobrosOrigen([]);
        setCobroOrigenId('');
        return;
      }
      try {
        let saldo = null;
        let cobros = [];
        // Preferir resumen de reserva (vista de folio con imputaciones) cuando hay reservationId.
        if (resolvedReservaId) {
          const summary = await getReservationFinancialSummary(resolvedReservaId);
          saldo = summary?.resumen?.saldo;
          cobros = Array.isArray(summary?.cobros?.items) ? summary.cobros.items : [];
        } else if (resolvedAccountId) {
          const [resumenRes, cobrosRes] = await Promise.all([
            fetchAccountResumen(resolvedAccountId),
            fetchAccountCobros(resolvedAccountId)
          ]);
          saldo = resumenRes?.resumen?.saldo;
          cobros = Array.isArray(cobrosRes) ? cobrosRes : [];
        }
        if (cancelled) return;
        setSaldoPendiente(saldo != null ? Number(saldo) : null);
        const cobrosElegibles = (cobros || []).filter(
          (p) =>
            String(p.motivo || 'Cobro') !== MOTIVO_DEVOLUCION &&
            Number(p.montoARS) > 0
        );
        setCobrosOrigen(cobrosElegibles);
        setCobroOrigenId((prev) =>
          prev && cobrosElegibles.some((p) => String(p.id) === String(prev))
            ? prev
            : ''
        );
      } catch (err) {
        if (!cancelled) {
          console.error('Error cargando saldo/cobros del folio:', err);
          setSaldoPendiente(null);
          setCobrosOrigen([]);
        }
      }
    }
    loadFolioMeta();
    return () => {
      cancelled = true;
    };
  }, [accountId, reservaId]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (isEditMode) {
        if (reservaIdProp) {
          try {
            setLoadingMeta(true);
            const reservation = await fetchReservation(reservaIdProp);
            const cid = reservation?.mainClient?.id || reservation?.mainClientId || null;
            if (!cancelled) {
              setClientId(cid);
              if (cid) await applyBillingPrefill(cid);
            }
          } catch (err) {
            if (!cancelled) setError(err.message || 'Error cargando datos del cobro');
          } finally {
            if (!cancelled) setLoadingMeta(false);
          }
        }
        return;
      }

      setLoadingMeta(true);
      setError(null);
      try {
        const optionsRes = await fetchCuentasParaCobro();
        const list = Array.isArray(optionsRes.data)
          ? optionsRes.data
          : Array.isArray(optionsRes)
            ? optionsRes
            : [];
        if (cancelled) return;
        setReservationOptions(list);

        let seedKey = '';
        let seedClientId = null;
        if (reservaIdProp != null) {
          const match =
            list.find((r) => Number(r.reservationId) === Number(reservaIdProp)) || null;
          if (match) {
            seedKey = optionKey(match);
            seedClientId = match.clientId || null;
          } else {
            const reservation = await fetchReservation(reservaIdProp);
            if (cancelled) return;
            seedClientId =
              reservation?.mainClient?.id || reservation?.mainClientId || null;
            const synthetic = {
              reservationId: Number(reservaIdProp),
              accountId: reservation?.account?.id ?? reservation?.accountId ?? null,
              accountKind: 'RESERVATION',
              origen: 'RESERVA',
              clientId: seedClientId,
              clientLastName: reservation?.mainClient?.lastName || '',
              clientName: reservation?.mainClient
                ? `${reservation.mainClient.firstName || ''} ${reservation.mainClient.lastName || ''}`.trim()
                : '',
              roomName: reservation?.segments?.[0]?.room?.name || null,
              label: null
            };
            setReservationOptions((prev) => {
              const key = optionKey(synthetic);
              if (!key || prev.some((r) => optionKey(r) === key)) return prev;
              return [...prev, synthetic];
            });
            seedKey = optionKey(synthetic);
          }
        } else if (accountIdProp != null) {
          const match = list.find((r) => Number(r.accountId) === Number(accountIdProp));
          if (match) {
            seedKey = optionKey(match);
            seedClientId = match.clientId || null;
          }
        }

        if (seedKey) {
          setAllocations([newAllocRow({ optionKey: seedKey })]);
          setActiveAllocId(null);
          setClientId(seedClientId);
          if (seedClientId) await applyBillingPrefill(seedClientId);
        } else {
          setAllocations([newAllocRow()]);
          setActiveAllocId(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error cargando datos del cobro');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, reservaIdProp, accountIdProp, applyBillingPrefill]);

  useEffect(() => {
    if (isEditMode || !pickedRow) return;
    const cid = pickedRow?.clientId || null;
    setClientId(cid);
    if (cid) applyBillingPrefill(cid);
  }, [isEditMode, pickedRow, applyBillingPrefill]);

  const loadTipoCambioGlobal = async () => {
    try {
      const response = await getTipoCambioActual();
      if (response.tipoCambio) {
        setTipoCambioGlobal(response.tipoCambio);
        setFormData((prev) => ({
          ...prev,
          tipoCambio: response.tipoCambio.toString()
        }));
      }
    } catch (err) {
      console.error('Error cargando tipo de cambio global:', err);
    }
  };

  const calculateMontoARS = () => {
    setMontoARS(formMontoToArs(formData.monto, formData.moneda, formData.tipoCambio));
  };

  const handleInputChange = (field, value) => {
    setError(null);
    if (field === 'metodo') {
      if (!isTransferencia(value)) setComprobanteFiles([]);
      if (!isEfectivo(value)) {
        dineroRecibidoDirtyRef.current = false;
        setDineroRecibido('');
        setVueltoARS('0');
      }
      if (!isCardMethod(value)) {
        setFormData((prev) => ({
          ...prev,
          metodo: value,
          numeroTarjeta: '',
          empresa: ''
        }));
        return;
      }
    }
    if (field === 'monto') {
      setAmountMode(AMOUNT_MODE_INGRESADO);
      if (!value || !(parseFloat(value) > 0)) {
        setMontoASaldar('');
      }
    }
    if (field === 'tipoCambio') {
      // TC: en modo ingresado mantiene monto moneda (ARS cambia);
      // en modo saldar el peer effect reconvierte el ARS a moneda.
      setFormData((prev) => ({ ...prev, tipoCambio: value }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Equivalente ARS editable (bajo monto ingresado, moneda ≠ ARS).
   *  Mantiene TC y recalcula el monto en moneda; marca modo ingresado. */
  const handleEquivalenteArsChange = (value) => {
    setError(null);
    setAmountMode(AMOUNT_MODE_INGRESADO);
    setEquivArsDraft(value);
    const ars = parseFloat(value);
    if (!value || !(ars > 0)) {
      setFormData((prev) => ({ ...prev, monto: '' }));
      setMontoASaldar('');
      return;
    }
    setFormData((prev) => {
      const nextMonto = arsToFormMonto(ars, prev.moneda, prev.tipoCambio);
      if (nextMonto === '' || prev.monto === nextMonto) return prev;
      return { ...prev, monto: nextMonto };
    });
  };

  const handleMontoASaldarChange = (value) => {
    setError(null);
    setAmountMode(AMOUNT_MODE_SALDAR);
    setMontoASaldar(value);
    if (!value || !(parseFloat(value) > 0)) {
      setFormData((prev) => ({ ...prev, monto: '' }));
    }
  };

  const useSaldoPendienteAsSaldar = () => {
    if (saldoPendiente == null || Number(saldoPendiente) <= 0) return;
    handleMontoASaldarChange(String(roundMoney(saldoPendiente)));
  };

  /** Monto de caja a registrar (ARS) según modo. En devolución = efectivo a devolver. */
  const tenderMontoARS = useMemo(() => {
    if (isDevolucion) {
      if (amountMode === AMOUNT_MODE_SALDAR && montoASaldarARS > 0) {
        return computeRefundFromCredit({
          creditoARS: montoASaldarARS,
          originalCobroARS: origenCobroARS,
          originalDiscountARS: origenDescuentoARS
        }).cashARS;
      }
      return montoARS;
    }
    if (amountMode === AMOUNT_MODE_SALDAR) {
      if (manualPromoPreview?.aplica && manualPromoPreview.dineroARS != null) {
        return roundMoney(manualPromoPreview.dineroARS);
      }
      return montoASaldarARS > 0 ? montoASaldarARS : 0;
    }
    return montoARS;
  }, [
    isDevolucion,
    amountMode,
    montoARS,
    montoASaldarARS,
    manualPromoPreview,
    origenCobroARS,
    origenDescuentoARS
  ]);

  const refundCreditoARS = useMemo(() => {
    if (!isDevolucion) return 0;
    if (amountMode === AMOUNT_MODE_SALDAR && montoASaldarARS > 0) {
      return montoASaldarARS;
    }
    if (!(montoARS > 0)) return 0;
    return computeRefundFromCash({
      cashARS: montoARS,
      originalCobroARS: origenCobroARS,
      originalDiscountARS: origenDescuentoARS
    }).creditoARS;
  }, [
    isDevolucion,
    amountMode,
    montoASaldarARS,
    montoARS,
    origenCobroARS,
    origenDescuentoARS
  ]);

  const handleComprobanteChange = (fileList) => {
    setError(null);
    const next = Array.from(fileList || []);
    setComprobanteFiles(next);
  };

  const handleBillingChange = (field, value) => {
    setBilling((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'tipo' && value === 'T' && prev.documentType === 'DNI') {
        next.documentType = 'Pasaporte';
      }
      return next;
    });
    setError(null);
  };

  const occupiedOptions = useMemo(() => {
    const byKey = new Map();
    for (const row of reservationOptions) {
      const key = optionKey(row);
      if (key && !byKey.has(key)) byKey.set(key, row);
    }
    return Array.from(byKey.values());
  }, [reservationOptions]);

  const accountOptionText = useCallback((row) => {
    if (!row) return '';
    const kind =
      row.origen === 'EXTERNA' || row.accountKind === 'EXTERNAL' ? 'Externa' : 'Reserva';
    const label = reservationOptionLabel(row);
    const parts = [
      kind,
      label,
      row.reservationId != null ? String(row.reservationId) : '',
      row.accountId != null ? String(row.accountId) : '',
      row.roomName || '',
      row.clientLastName || '',
      row.clientName || '',
      row.label || ''
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }, []);

  const takenOptionKeys = useMemo(
    () => new Set(allocations.map((a) => a.optionKey).filter(Boolean)),
    [allocations]
  );

  const filteredAccountOptions = useMemo(() => {
    const q = String(accountQuery || '').trim().toLowerCase();
    const available = occupiedOptions.filter((row) => {
      const key = optionKey(row);
      if (!key || takenOptionKeys.has(key)) return false;
      // Multi: preferir mismo cliente si ya hay una asignación con clientId.
      if (clientId != null && row.clientId != null && Number(row.clientId) !== Number(clientId)) {
        return assignedAllocations.length === 0;
      }
      if (clientId != null && assignedAllocations.length > 0 && row.clientId == null) {
        // Externas sin cliente: permitir solo si aún no hay multi de otro titular.
        return true;
      }
      return true;
    });
    if (!q) return available;
    return available.filter((row) => accountOptionText(row).includes(q));
  }, [
    occupiedOptions,
    accountQuery,
    accountOptionText,
    takenOptionKeys,
    clientId,
    assignedAllocations.length
  ]);

  useEffect(() => {
    if (!activeAllocId && !showCreateExternal) return undefined;
    const onDocClick = (e) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target)) {
        setActiveAllocId(null);
        setShowCreateExternal(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [activeAllocId, showCreateExternal]);

  const reloadAccountOptions = useCallback(async () => {
    if (isEditMode) return [];
    const optionsRes = await fetchCuentasParaCobro();
    const list = Array.isArray(optionsRes.data)
      ? optionsRes.data
      : Array.isArray(optionsRes)
        ? optionsRes
        : [];
    setReservationOptions(list);
    return list;
  }, [isEditMode]);

  const pickAccountOption = (row, allocLocalId) => {
    const key = optionKey(row);
    if (!key) return;
    setAllocations((prev) =>
      prev.map((a) =>
        a.localId === allocLocalId ? { ...a, optionKey: key, monto: a.monto || '' } : a
      )
    );
    setAccountQuery('');
    setActiveAllocId(null);
    setShowCreateExternal(false);
    setError(null);
  };

  const clearAllocation = (allocLocalId) => {
    setAllocations((prev) => {
      const next = prev.filter((a) => a.localId !== allocLocalId);
      if (next.length === 0) return [newAllocRow()];
      // Si no queda fila vacía de búsqueda y tampoco hay asignadas… keep at least one search row
      if (next.every((a) => a.optionKey)) {
        // ok: all assigned; user can add another via button
        return next;
      }
      return next;
    });
    setActiveAllocId(null);
    setShowCreateExternal(false);
  };

  const addAllocationRow = () => {
    if (isDevolucion) return;
    setAllocations((prev) => {
      const hasEmpty = prev.some((a) => !a.optionKey);
      if (hasEmpty) {
        const empty = prev.find((a) => !a.optionKey);
        setActiveAllocId(empty.localId);
        return prev;
      }
      const row = newAllocRow();
      setActiveAllocId(row.localId);
      return [...prev, row];
    });
    setAccountQuery('');
    setShowCreateExternal(false);
  };

  const setAllocationMonto = (allocLocalId, value) => {
    setAllocations((prev) =>
      prev.map((a) => (a.localId === allocLocalId ? { ...a, monto: value } : a))
    );
    setError(null);
  };

  const handleCreateExternalAccount = async (allocLocalId) => {
    const label = String(externalLabel || '').trim();
    if (!label) {
      setError('Indicá un nombre para la cuenta externa');
      return;
    }
    try {
      setCreatingExternal(true);
      setError(null);
      const createdRes = await createExternalAccount({
        label,
        clientId: clientId || undefined
      });
      const created = createdRes?.data || createdRes;
      const list = await reloadAccountOptions();
      const createdId = created?.id ?? created?.accountId ?? null;
      const match =
        (createdId != null &&
          list.find((r) => Number(r.accountId) === Number(createdId))) ||
        list.find(
          (r) =>
            isExternalRow(r) &&
            String(r.label || '').trim().toLowerCase() === label.toLowerCase()
        );
      if (match) pickAccountOption(match, allocLocalId);
      setExternalLabel('');
      setShowCreateExternal(false);
    } catch (err) {
      setError(err?.message || 'Error al crear cuenta externa');
    } finally {
      setCreatingExternal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEditMode && assignedAllocations.length === 0) {
      setError('Seleccioná una reserva o cuenta externa');
      return;
    }
    if (isEditMode && !reservaId && !accountId) {
      setError('Seleccioná una cuenta');
      return;
    }
    if (esSena && (isExternalAccount || isMultiAlloc)) {
      setError('La seña solo se registra en la cuenta de una reserva');
      return;
    }
    if (isMultiAlloc && isDevolucion) {
      setError('La devolución se registra sobre una sola reserva');
      return;
    }
    if (isMultiAlloc && !clientId) {
      setError('Para imputar a varias cuentas hace falta un cliente titular');
      return;
    }
    if (isMultiAlloc) {
      const distSum = assignedAllocations.reduce(
        (s, a) => s + (Number(a.monto) || 0),
        0
      );
      const recibido =
        !isDevolucion && amountMode === AMOUNT_MODE_SALDAR
          ? tenderMontoARS
          : montoARS;
      if (assignedAllocations.some((a) => !(Number(a.monto) > 0))) {
        setError('Indicá el monto a imputar en cada reserva/cuenta');
        return;
      }
      if (Math.abs(roundMoney(distSum) - roundMoney(recibido)) > 0.009) {
        setError(
          `La suma imputada (${formatArs(distSum)}) debe coincidir con lo recibido (${formatArs(recibido)})`
        );
        return;
      }
    }

    if (isDevolucion && !cobroOrigenId) {
      setError('Seleccioná el cobro de origen a devolver');
      return;
    }

    if (amountMode === AMOUNT_MODE_INGRESADO) {
      if (!formData.monto || parseFloat(formData.monto) <= 0) {
        setError(
          isDevolucion
            ? 'El monto a devolver debe ser mayor a 0'
            : 'El monto ingresado debe ser mayor a 0'
        );
        return;
      }
    } else if (amountMode === AMOUNT_MODE_SALDAR) {
      if (!(montoASaldarARS > 0)) {
        setError('El monto a saldar debe ser mayor a 0');
        return;
      }
      if (!(tenderMontoARS > 0)) {
        setError(
          isDevolucion
            ? 'No se pudo calcular cuánto devolver al cliente'
            : 'No se pudo calcular cuánto debe abonar el cliente'
        );
        return;
      }
    }

    if (
      isForeignCurrency(formData.moneda) &&
      (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0)
    ) {
      setError(`Para cobros en ${formData.moneda}, el tipo de cambio es requerido`);
      return;
    }

    if (isCardMethod(formData.metodo)) {
      if (!formData.numeroTarjeta) {
        setError('Debe ingresar el número de tarjeta');
        return;
      }
      if (!formData.empresa) {
        setError('Debe seleccionar la empresa de la tarjeta');
        return;
      }
    }

    if (!isEditMode && billingEnabled) {
      if (!billing.tipo || !['A', 'B', 'T'].includes(billing.tipo)) {
        setError('Seleccioná Factura A, Factura B o Factura T');
        return;
      }
      if (!billing.fecha || !localDateInputToIso(billing.fecha)) {
        setError('La fecha de facturación es requerida');
        return;
      }
      if (isPersonInvoiceType(billing.tipo)) {
        const label = billing.tipo === 'T' ? 'Factura T' : 'Factura B';
        if (!billing.firstName || !billing.lastName) {
          setError(`Nombre y apellido son requeridos para ${label}`);
          return;
        }
        if (!billing.documentNumber) {
          setError(`El número de documento es requerido para ${label}`);
          return;
        }
        if (billing.tipo === 'T' && !billing.passportCountry) {
          setError('El país emisor del pasaporte es requerido para Factura T');
          return;
        }
      } else if (!billing.businessName || !billing.cuit) {
        setError('Razón social y CUIT son requeridos para Factura A');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const facturaPayload = billingEnabled
        ? {
            tipo: billing.tipo,
            fecha: localDateInputToIso(billing.fecha),
            motivo: motivoActual,
            firstName: billing.firstName || null,
            lastName: billing.lastName || null,
            documentType: billing.documentType || null,
            documentNumber: billing.documentNumber || null,
            passportCountry:
              billing.tipo === 'T' ? billing.passportCountry || null : null,
            address: billing.address || null,
            email: billing.email || null,
            businessName: billing.businessName || null,
            cuit: billing.cuit || null,
            commercialAddress: billing.commercialAddress || null,
            ivaCondition: billing.ivaCondition || null,
            cardNumber: isCardMethod(formData.metodo)
              ? formData.numeroTarjeta
              : billing.cardNumber || null
          }
        : undefined;

      // Devolución: monto positivo en UI (efectivo); el backend lo guarda negativo.
      // Modo saldar: se registra el efectivo en la moneda elegida (USD↔ARS).
      const submitMoneda = formData.moneda;
      let submitMonto =
        amountMode === AMOUNT_MODE_SALDAR
          ? isForeignCurrency(submitMoneda)
            ? (() => {
                const tc = parseFloat(formData.tipoCambio) || 0;
                return tc > 0 ? roundMoney(tenderMontoARS / tc) : tenderMontoARS;
              })()
            : tenderMontoARS
          : parseFloat(formData.monto);

      let submitDineroRecibido;
      let submitVueltoARS = 0;
      if (showCashTender) {
        const recibidoNum = roundMoney(parseFloat(dineroRecibido) || 0);
        if (!(recibidoNum > 0)) {
          setError('Indicá el dinero recibido en efectivo');
          setLoading(false);
          return;
        }
        const ingresadoARSForTender =
          amountMode === AMOUNT_MODE_SALDAR ? tenderMontoARS : montoARS;
        // Vuelto solo lectura = excedente máx; crédito vía monto ingresado.
        submitVueltoARS = suggestVueltoARS({
          dineroRecibido: recibidoNum,
          moneda: submitMoneda,
          tipoCambio: formData.tipoCambio,
          montoIngresadoARS: ingresadoARSForTender
        });
        submitDineroRecibido = recibidoNum;
      }

      const fechaIso =
        localDateInputToIso(formData.fecha) || todayAsLocalDate().toISOString();
      const pagoData = {
        monto: submitMonto,
        moneda: submitMoneda,
        tipoCambio: isForeignCurrency(submitMoneda)
          ? parseFloat(formData.tipoCambio)
          : undefined,
        metodo: formData.metodo,
        paymentMethodConfigId: selectedMethodConfig?.id ?? undefined,
        cobroOrigenId: isDevolucion ? Number(cobroOrigenId) : undefined,
        motivo: motivoActual,
        numeroTarjeta: isCardMethod(formData.metodo) ? formData.numeroTarjeta : undefined,
        empresa: isCardMethod(formData.metodo) ? formData.empresa : undefined,
        notas: formData.notas || null,
        fecha: fechaIso,
        requiereFacturacion: billingEnabled,
        factura: isEditMode ? undefined : facturaPayload,
        selectedRuleIds: isDevolucion ? undefined : manualPromoApply.selectedRuleIds,
        deselectedRuleIds: isDevolucion ? undefined : manualPromoApply.deselectedRuleIds,
        benefitValueByRuleId: isDevolucion ? undefined : manualPromoApply.benefitValueByRuleId,
        applySuggestedDefaults: isDevolucion ? undefined : true,
        ...(showCashTender
          ? { dineroRecibido: submitDineroRecibido, vueltoARS: submitVueltoARS }
          : {})
      };

      let nuevoCobro;
      if (isEditMode) {
        nuevoCobro = await updateCobro(initialCobro.id, {
          monto: pagoData.monto,
          moneda: pagoData.moneda,
          tipoCambio: pagoData.tipoCambio,
          metodo: pagoData.metodo,
          paymentMethodConfigId: pagoData.paymentMethodConfigId,
          motivo: pagoData.motivo,
          numeroTarjeta: pagoData.numeroTarjeta ?? null,
          empresa: pagoData.empresa ?? null,
          notas: pagoData.notas,
          fecha: pagoData.fecha,
          selectedRuleIds: pagoData.selectedRuleIds,
          deselectedRuleIds: pagoData.deselectedRuleIds,
          benefitValueByRuleId: pagoData.benefitValueByRuleId,
          applySuggestedDefaults: pagoData.applySuggestedDefaults,
          dineroRecibido: pagoData.dineroRecibido,
          vueltoARS: pagoData.vueltoARS
        });
      } else if (isMultiAlloc) {
        nuevoCobro = await createClientMultiCobro(clientId, {
          ...pagoData,
          imputaciones: assignedAllocations.map((a, index) => ({
            accountId: a.row.accountId != null ? Number(a.row.accountId) : undefined,
            reservaId: a.row.reservationId != null ? Number(a.row.reservationId) : undefined,
            montoARS: roundMoney(Number(a.monto) || 0),
            ordenIndex: index
          }))
        });
      } else if (isExternalAccount || (accountId && !reservaId)) {
        nuevoCobro = await createAccountCobro(accountId, pagoData);
      } else {
        nuevoCobro = await createCobro(reservaId, pagoData);
      }

      if (
        showComprobanteField &&
        comprobanteFiles.length > 0 &&
        nuevoCobro?.id != null
      ) {
        try {
          const adjuntos = await uploadCobroAdjuntos(
            nuevoCobro.id,
            ADJUNTO_COMPROBANTE,
            comprobanteFiles
          );
          nuevoCobro = {
            ...nuevoCobro,
            adjuntos: [...(nuevoCobro.adjuntos || []), ...(adjuntos || [])]
          };
        } catch (uploadErr) {
          // El cobro ya quedó creado; el comprobante se puede adjuntar luego en Cobros.
          setError(
            uploadErr.message
              ? `Cobro guardado, pero falló el comprobante: ${uploadErr.message}. Podés adjuntarlo luego en Cobros.`
              : 'Cobro guardado, pero falló el comprobante. Podés adjuntarlo luego en Cobros.'
          );
          onSuccess?.(nuevoCobro);
          setLoading(false);
          return;
        }
      }

      onSuccess?.(nuevoCobro);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear el cobro');
      console.error('Error creating payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasIngresadoAmount = (parseFloat(formData.monto) || 0) > 0;
  const foreignCurrency = isForeignCurrency(formData.moneda);
  const monedaCode = String(formData.moneda || 'ARS').toUpperCase();
  const MethodIcon = paymentMethodIcon(formData.metodo);

  const creditoACuentaARS =
    !isDevolucion &&
    manualPromoPreview?.aplica &&
    !manualPromoPreview.probeOnly
      ? Number(manualPromoPreview.creditoARS) || 0
      : isSaldarMode
        ? montoASaldarARS
        : Number(montoARS) || 0;
  const saldoProyectadoARS =
    !isDevolucion && saldoPendiente != null
      ? roundMoney(Number(saldoPendiente) - creditoACuentaARS)
      : null;

  const montoDescontadoARS = !isDevolucion
    ? manualPromoPreview?.aplica && !manualPromoPreview.probeOnly
      ? Number(manualPromoPreview.descuentoARS) || 0
      : 0
    : selectedCobroOrigen && origenDescuentoARS > 0 && tenderMontoARS > 0
      ? roundMoney(Math.max(0, refundCreditoARS - tenderMontoARS))
      : 0;

  const headerIngresadoLabel = isDevolucion
    ? 'Devolver al cliente'
    : isSaldarMode
      ? 'Cliente abona'
      : 'Monto ingresado';

  const headerIngresadoDisplay = (() => {
    if (isDevolucion) {
      return tenderMontoARS > 0 ? formatMoneyArs(tenderMontoARS) : '—';
    }
    if (isSaldarMode) {
      return tenderMontoARS > 0 ? formatMoneyArs(tenderMontoARS) : '—';
    }
    if (!hasIngresadoAmount) return '—';
    if (foreignCurrency && monedaCode === 'USD') {
      return formatMoneyUsd(parseFloat(formData.monto) || 0);
    }
    if (foreignCurrency) {
      return formatMoney(parseFloat(formData.monto) || 0, monedaCode);
    }
    return formatMoneyArs(parseFloat(formData.monto) || 0);
  })();

  const headerSaldadoDisplay = (() => {
    if (isDevolucion) {
      return refundCreditoARS > 0 ? formatMoneyArs(refundCreditoARS) : '—';
    }
    return creditoACuentaARS > 0 ? formatMoneyArs(creditoACuentaARS) : '—';
  })();

  const headerDescontadoDisplay =
    montoDescontadoARS > 0 ? formatMoneyArs(montoDescontadoARS) : '—';

  return (
    <div className={styles.overlay} {...overlayDismiss}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
        <div className={styles.header}>
          <h2 id="payment-form-title">
            {isEditMode
              ? isDevolucion
                ? 'Editar devolución'
                : 'Editar cobro'
              : isDevolucion
                ? 'Nueva devolución'
                : 'Nuevo cobro'}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            <FiX />
          </button>
        </div>

        {!isEditMode ? (
          <div className={styles.modeTabs} role="tablist" aria-label="Tipo de movimiento">
            <button
              type="button"
              role="tab"
              id="tab-nuevo-cobro"
              aria-selected={!isDevolucion}
              className={`${styles.modeTab} ${!isDevolucion ? styles.modeTabActive : ''}`}
              onClick={() => setMode(MODE_PAGO)}
              disabled={loading}
            >
              Nuevo cobro
            </button>
            <button
              type="button"
              role="tab"
              id="tab-nueva-devolucion"
              aria-selected={isDevolucion}
              className={`${styles.modeTab} ${isDevolucion ? styles.modeTabActive : ''}`}
              onClick={() => {
                setMode(MODE_DEVOLUCION);
                setAmountMode(AMOUNT_MODE_INGRESADO);
                setMontoASaldar('');
              }}
              disabled={loading}
            >
              Nueva devolución
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formBody}>
          <div
            className={styles.summaryHeader}
            data-testid="payment-summary"
            aria-label={isDevolucion ? 'Resumen de la devolución' : 'Resumen del cobro'}
          >
            <div className={`${styles.summaryHeaderCell} ${styles.summaryHeaderCellPill}`}>
              <span className={styles.summaryHeaderLabel}>{headerIngresadoLabel}</span>
              <span className={styles.summaryHeaderValue}>{headerIngresadoDisplay}</span>
            </div>
            <div className={styles.summaryHeaderCell}>
              <span className={styles.summaryHeaderLabel}>Monto descontado</span>
              <span className={styles.summaryHeaderValue}>{headerDescontadoDisplay}</span>
            </div>
            <div className={`${styles.summaryHeaderCell} ${styles.summaryHeaderCellPill}`}>
              <span className={styles.summaryHeaderLabel}>
                {isDevolucion ? 'Monto a saldar' : 'Monto saldado'}
              </span>
              <span className={styles.summaryHeaderValue} data-testid="summary-monto-saldado">
                {headerSaldadoDisplay}
              </span>
            </div>
            {foreignCurrency && !isDevolucion ? (
              <div className={styles.summaryHeaderCell} data-testid="summary-equivalente-ars">
                <span className={styles.summaryHeaderLabel}>Equivalente en ARS</span>
                <span className={styles.summaryHeaderValue}>
                  {hasIngresadoAmount ? formatMoneyArs(montoARS) : '—'}
                </span>
              </div>
            ) : null}
            <div className={styles.summaryHeaderMeta}>
              <span>Motivo: {motivoActual}</span>
              {foreignCurrency && !isDevolucion && parseFloat(formData.tipoCambio) > 0 ? (
                <span>TC: {parseFloat(formData.tipoCambio)}</span>
              ) : null}
            </div>
          </div>

          <div className={styles.layoutGrid}>
            {/* Col 1 — entidad / fecha / toggles / notas */}
            <section className={styles.layoutCol} aria-label="Datos del cobro">
              <div className={styles.formGroup}>
                <label htmlFor="payment-fecha">Fecha *</label>
                <input
                  id="payment-fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => handleInputChange('fecha', e.target.value)}
                  required
                  disabled={loading}
                  data-testid="payment-fecha"
                />
              </div>

              {showAllocationUi && (
                <div className={styles.formGroup} ref={accountPickerRef}>
                  <div className={styles.allocationFieldHeader}>
                    <label
                      htmlFor={
                        assignedAllocations.length === 0 ? 'payment-reservation' : undefined
                      }
                      id="payment-imputa-label"
                      data-testid="payment-imputa-label"
                    >
                      Imputar a
                    </label>
                  </div>
                  <div className={styles.allocationsList} data-testid="payment-allocations">
                    {allocations.map((alloc) => {
                      const row = alloc.optionKey
                        ? optionByKey.get(alloc.optionKey) || null
                        : null;
                      const isAssigned = Boolean(row);
                      const menuOpen = activeAllocId === alloc.localId;
                      const kind = isAssigned
                        ? isExternalRow(row)
                          ? 'Externa'
                          : 'Reserva'
                        : null;

                      if (isAssigned) {
                        return (
                          <div
                            key={alloc.localId}
                            className={styles.allocationChip}
                            data-testid={`payment-alloc-chip-${alloc.localId}`}
                          >
                            <div className={styles.allocationChipMain}>
                              <span className={styles.accountOptionKind}>{kind}</span>
                              <span className={styles.allocationChipLabel}>
                                {reservationOptionLabel(row)}
                              </span>
                            </div>
                            {isMultiAlloc && !isDevolucion ? (
                              <label className={styles.allocationMonto}>
                                <span>Monto</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={alloc.monto}
                                  onChange={(e) =>
                                    setAllocationMonto(alloc.localId, e.target.value)
                                  }
                                  disabled={loading}
                                  aria-label={`Monto imputado a ${reservationOptionLabel(row)}`}
                                  data-testid={`payment-alloc-monto-${alloc.localId}`}
                                />
                              </label>
                            ) : null}
                            <button
                              type="button"
                              className={styles.allocationRemove}
                              onClick={() => clearAllocation(alloc.localId)}
                              disabled={loading}
                              aria-label="Quitar imputación"
                            >
                              <FiX aria-hidden="true" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div key={alloc.localId} className={styles.accountCombobox}>
                          <input
                            id={
                              alloc.localId === allocations[0]?.localId
                                ? 'payment-reservation'
                                : undefined
                            }
                            type="text"
                            role="combobox"
                            aria-expanded={menuOpen}
                            aria-controls={`payment-account-listbox-${alloc.localId}`}
                            aria-autocomplete="list"
                            aria-labelledby="payment-imputa-label"
                            aria-label="Elegir reserva o cuenta externa a la que se imputa el cobro"
                            placeholder={
                              loadingMeta
                                ? 'Cargando…'
                                : occupiedOptions.length === 0
                                  ? 'Sin reservas/cuentas — creá una externa'
                                  : 'Buscar por habitación, huésped o cuenta…'
                            }
                            value={accountQuery}
                            onChange={(e) => {
                              setAccountQuery(e.target.value);
                              setActiveAllocId(alloc.localId);
                              setShowCreateExternal(false);
                            }}
                            onFocus={() => {
                              setActiveAllocId(alloc.localId);
                              setAccountQuery('');
                              setShowCreateExternal(false);
                            }}
                            required={assignedAllocations.length === 0}
                            disabled={loadingMeta || loading}
                            data-testid="payment-account-search"
                            autoComplete="off"
                          />
                          {menuOpen ? (
                            <ul
                              id={`payment-account-listbox-${alloc.localId}`}
                              className={styles.accountMenu}
                              role="listbox"
                              aria-label="Reservas y cuentas externas"
                            >
                              {filteredAccountOptions.length === 0 ? (
                                <li
                                  className={styles.accountMenuEmpty}
                                  role="presentation"
                                  data-testid="payment-account-empty"
                                >
                                  {occupiedOptions.length === 0
                                    ? 'No hay reservas ni cuentas abiertas. Creá una cuenta externa abajo.'
                                    : 'Sin coincidencias. Probá otro texto o creá una cuenta externa.'}
                                </li>
                              ) : (
                                filteredAccountOptions.map((opt) => {
                                  const key = optionKey(opt);
                                  const optKind = isExternalRow(opt) ? 'Externa' : 'Reserva';
                                  return (
                                    <li key={key} role="presentation">
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={false}
                                        className={styles.accountOption}
                                        onClick={() => pickAccountOption(opt, alloc.localId)}
                                      >
                                        <span className={styles.accountOptionKind}>{optKind}</span>
                                        <span className={styles.accountOptionLabel}>
                                          {reservationOptionLabel(opt)}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })
                              )}
                              <li
                                className={styles.accountMenuCreate}
                                role="presentation"
                              >
                                {!showCreateExternal ? (
                                  <button
                                    type="button"
                                    className={styles.createExternalInMenu}
                                    disabled={loading || creatingExternal}
                                    onClick={() => setShowCreateExternal(true)}
                                    data-testid="payment-create-external"
                                  >
                                    <FiPlus aria-hidden="true" />
                                    Crear cuenta externa
                                  </button>
                                ) : (
                                  <div
                                    className={styles.createExternalPanel}
                                    aria-label="Alta cuenta externa"
                                  >
                                    <input
                                      type="text"
                                      value={externalLabel}
                                      onChange={(e) => setExternalLabel(e.target.value)}
                                      placeholder="Ej. Bar mesa 3 / Empresa ACME"
                                      aria-label="Etiqueta de cuenta externa"
                                      disabled={loading || creatingExternal}
                                      data-testid="payment-external-label"
                                    />
                                    <button
                                      type="button"
                                      className={styles.createExternalConfirm}
                                      disabled={loading || creatingExternal}
                                      onClick={() => handleCreateExternalAccount(alloc.localId)}
                                    >
                                      {creatingExternal ? 'Creando…' : 'Crear'}
                                    </button>
                                  </div>
                                )}
                              </li>
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {!isDevolucion && assignedAllocations.length > 0 ? (
                    <button
                      type="button"
                      className={styles.addAllocationBtn}
                      disabled={loading || loadingMeta}
                      onClick={addAllocationRow}
                      data-testid="payment-add-allocation"
                    >
                      <FiPlus aria-hidden="true" />
                      Agregar reserva
                    </button>
                  ) : null}

                  {isMultiAlloc && !isDevolucion ? (
                    <p className={styles.allocationHint} data-testid="payment-alloc-hint">
                      Indicá cuánto de lo recibido va a cada reserva/cuenta. La suma debe
                      coincidir con el monto del cobro.
                    </p>
                  ) : null}
                </div>
              )}

              {isDevolucion && (
                <div className={styles.formGroup}>
                  <label htmlFor="payment-origen">Cobro de origen *</label>
                  <select
                    id="payment-origen"
                    value={cobroOrigenId}
                    onChange={(e) => setCobroOrigenId(e.target.value)}
                    required
                    disabled={loading || cobrosOrigen.length === 0}
                  >
                    <option value="">
                      {cobrosOrigen.length === 0
                        ? 'No hay cobros disponibles'
                        : 'Seleccionar cobro…'}
                    </option>
                    {cobrosOrigen.map((p) => {
                      const disc = p.discountApplication?.montoARS;
                      const discLabel =
                        disc != null && Number(disc) > 0
                          ? ` · desc. ${formatMoneyArs(disc)}`
                          : '';
                      return (
                        <option key={p.id} value={p.id}>
                          {p.codigo || `#${p.id}`} — {p.metodo || 'Cobro'} —{' '}
                          {formatMoneyArs(p.montoARS)}
                          {discLabel}
                        </option>
                      );
                    })}
                  </select>
                  <span className={styles.helpText}>
                    Obligatorio. Si el cobro tenía descuento, se revierte en la misma operación.
                  </span>
                </div>
              )}

              <div className={styles.toggleStack}>
                {!isDevolucion && canUseSena ? (
                  <div className={styles.formGroup}>
                    <span className={styles.fieldLabel} id="payment-sena-label">
                      Seña
                    </span>
                    <label className={styles.toggleLabel} htmlFor="payment-sena-toggle">
                      <input
                        id="payment-sena-toggle"
                        type="checkbox"
                        checked={esSena}
                        disabled={loading}
                        aria-labelledby="payment-sena-label"
                        onChange={(e) => setEsSena(e.target.checked)}
                      />
                      <span aria-hidden="true">{esSena ? 'Sí' : 'No'}</span>
                    </label>
                  </div>
                ) : null}

                {!isEditMode ? (
                  <div className={styles.formGroup}>
                    <label className={styles.toggleLabel} htmlFor="payment-billing-toggle">
                      <input
                        id="payment-billing-toggle"
                        type="checkbox"
                        checked={billingEnabled}
                        disabled={billingForced || loading}
                        onChange={(e) => setRequiereFacturacion(e.target.checked)}
                      />
                      <span>Requiere facturación</span>
                      {billingForced && (
                        <span className={styles.helpText}>Obligatorio para este medio de pago</span>
                      )}
                    </label>
                  </div>
                ) : null}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="payment-notas">Notas</label>
                <textarea
                  id="payment-notas"
                  value={formData.notas}
                  onChange={(e) => handleInputChange('notas', e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </section>

            {/* Col 2 — medio de pago + campos condicionales */}
            <section className={styles.layoutCol} aria-label="Medio de pago">
              <div className={styles.methodHero}>
                <div className={styles.methodIconWrap} aria-hidden="true">
                  <MethodIcon />
                </div>
                <p className={styles.methodName} aria-hidden="true">
                  {formData.metodo || '—'}
                </p>
                <div className={styles.formGroup}>
                  <label htmlFor="payment-metodo" className={styles.srOnly}>
                    {isDevolucion ? 'Método de devolución *' : 'Método de pago *'}
                  </label>
                  <select
                    id="payment-metodo"
                    value={formData.metodo}
                    onChange={(e) => handleInputChange('metodo', e.target.value)}
                    required
                    disabled={loading || methodConfigs.length === 0}
                    aria-label={isDevolucion ? 'Método de devolución' : 'Método de pago'}
                  >
                    {methodConfigs.length === 0 ? (
                      <option value="">Cargando medios…</option>
                    ) : (
                      methodConfigs.map((m) => (
                        <option key={m.id} value={m.label}>
                          {m.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div
                className={
                  foreignCurrency ? styles.monedaTcPair : styles.formGroup
                }
                data-testid="payment-moneda-tc"
              >
                <div className={styles.formGroup}>
                  <label htmlFor="payment-moneda">Moneda *</label>
                  <select
                    id="payment-moneda"
                    value={formData.moneda}
                    onChange={(e) => handleInputChange('moneda', e.target.value)}
                    required
                    disabled={loading}
                    data-testid="payment-moneda"
                  >
                    {SYSTEM_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                {foreignCurrency ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="payment-tc">Tipo de cambio *</label>
                    <input
                      id="payment-tc"
                      type="number"
                      value={formData.tipoCambio}
                      onChange={(e) => handleInputChange('tipoCambio', e.target.value)}
                      onFocus={() => {
                        if (amountMode !== AMOUNT_MODE_SALDAR) {
                          setAmountMode(AMOUNT_MODE_INGRESADO);
                        }
                      }}
                      placeholder="1000.00"
                      step="0.01"
                      min="0"
                      required
                      disabled={loading}
                      data-testid="payment-tc"
                    />
                    {tipoCambioGlobal != null && (
                      <span className={styles.helpText}>Global: {tipoCambioGlobal}</span>
                    )}
                  </div>
                ) : null}
              </div>

              <div
                className={`${styles.amountModes} ${styles.amountModesSameBox}`}
                data-testid="payment-amount-modes"
              >
                <div
                  className={`${styles.amountModeBlock} ${
                    amountMode === AMOUNT_MODE_INGRESADO ? styles.amountModeActive : ''
                  }`}
                >
                  <span className={styles.amountModeHeading} id="payment-monto-ingresado-label">
                    {isDevolucion ? 'Monto a devolver' : 'Monto ingresado'}
                  </span>
                  {foreignCurrency ? (
                    <div
                      className={styles.fxSyncFields}
                      role="group"
                      aria-labelledby="payment-monto-ingresado-label"
                      data-testid="payment-fx-sync"
                    >
                      <label htmlFor="payment-monto">Monto en {monedaCode}</label>
                      <input
                        id="payment-monto"
                        type="number"
                        value={formData.monto}
                        onChange={(e) => handleInputChange('monto', e.target.value)}
                        onFocus={() => setAmountMode(AMOUNT_MODE_INGRESADO)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        required={amountMode === AMOUNT_MODE_INGRESADO}
                        disabled={loading}
                        data-testid="payment-monto-ingresado"
                        aria-label={`Monto en ${monedaCode}`}
                      />

                      <label htmlFor="payment-equiv-ars">Equivalente ARS</label>
                      <input
                        id="payment-equiv-ars"
                        type="number"
                        value={equivArsDraft}
                        onChange={(e) => handleEquivalenteArsChange(e.target.value)}
                        onFocus={() => {
                          equivArsFocusedRef.current = true;
                          setAmountMode(AMOUNT_MODE_INGRESADO);
                        }}
                        onBlur={() => {
                          equivArsFocusedRef.current = false;
                          const ars = parseFloat(equivArsDraft);
                          if (ars > 0) {
                            setEquivArsDraft(String(roundMoney(ars)));
                          } else if (!equivArsDraft) {
                            setEquivArsDraft('');
                          } else {
                            const tc = parseFloat(formData.tipoCambio) || 0;
                            const monto = parseFloat(formData.monto) || 0;
                            setEquivArsDraft(
                              monto > 0 && tc > 0 ? String(roundMoney(monto * tc)) : ''
                            );
                          }
                        }}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        disabled={loading}
                        data-testid="payment-equiv-ars"
                      />
                    </div>
                  ) : (
                    <>
                      <label htmlFor="payment-monto" className={styles.srOnly}>
                        {isDevolucion ? 'Monto a devolver' : 'Monto ingresado'}
                      </label>
                      <input
                        id="payment-monto"
                        type="number"
                        value={formData.monto}
                        onChange={(e) => handleInputChange('monto', e.target.value)}
                        onFocus={() => setAmountMode(AMOUNT_MODE_INGRESADO)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        required={amountMode === AMOUNT_MODE_INGRESADO}
                        disabled={loading}
                        data-testid="payment-monto-ingresado"
                        aria-labelledby="payment-monto-ingresado-label"
                      />
                    </>
                  )}
                </div>

                <div
                  className={`${styles.amountModeBlock} ${
                    amountMode === AMOUNT_MODE_SALDAR ? styles.amountModeActive : ''
                  }`}
                >
                  <label htmlFor="payment-monto-saldar">Monto a saldar</label>
                  <input
                    id="payment-monto-saldar"
                    type="number"
                    value={montoASaldar}
                    onChange={(e) => handleMontoASaldarChange(e.target.value)}
                    onFocus={() => setAmountMode(AMOUNT_MODE_SALDAR)}
                    placeholder={
                      isDevolucion && selectedCobroOrigen
                        ? formatArs(roundMoney(origenCobroARS + origenDescuentoARS))
                        : saldoPendiente != null && Number(saldoPendiente) > 0
                          ? formatArs(saldoPendiente)
                          : '0'
                    }
                    step="0.01"
                    min="0"
                    required={amountMode === AMOUNT_MODE_SALDAR}
                    disabled={loading || isEditMode}
                    data-testid="payment-monto-saldar"
                  />
                  {!isDevolucion && saldoPendiente != null && Number(saldoPendiente) > 0 ? (
                    <button
                      type="button"
                      className={styles.useSaldoBtn}
                      disabled={loading || isEditMode}
                      onClick={useSaldoPendienteAsSaldar}
                      data-testid="payment-use-saldo"
                    >
                      Usar saldo pendiente ({formatMoneyArs(saldoPendiente)})
                    </button>
                  ) : null}
                  {isDevolucion && selectedCobroOrigen && origenDescuentoARS > 0 ? (
                    <span className={styles.helpText} data-testid="payment-refund-discount-hint">
                      Origen con desc. {formatMoneyArs(origenDescuentoARS)}: al saldar se calcula
                      cuánto devolver.
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.methodFieldsSlot} data-testid="payment-method-fields">
                {showCashTender ? (
                  <section
                    className={styles.cashTenderSection}
                    data-testid="payment-cash-tender"
                    aria-labelledby="payment-cash-tender-title"
                  >
                    <h3 id="payment-cash-tender-title" className={styles.cashTenderTitle}>
                      Efectivo
                    </h3>
                    <div className={styles.formGroup}>
                      <label htmlFor="payment-dinero-recibido">
                        Paga con ({formData.moneda || 'ARS'})
                      </label>
                      <input
                        id="payment-dinero-recibido"
                        type="number"
                        value={dineroRecibido}
                        onChange={(e) => {
                          dineroRecibidoDirtyRef.current = true;
                          setDineroRecibido(e.target.value);
                          const next = suggestVueltoARS({
                            dineroRecibido: parseFloat(e.target.value) || 0,
                            moneda: formData.moneda,
                            tipoCambio: formData.tipoCambio,
                            montoIngresadoARS: montoARS
                          });
                          setVueltoARS(String(next));
                        }}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        disabled={loading}
                        data-testid="payment-dinero-recibido"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="payment-vuelto-ars">Vuelto (ARS)</label>
                      <input
                        id="payment-vuelto-ars"
                        type="number"
                        value={vueltoARS}
                        readOnly
                        tabIndex={-1}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        disabled={loading}
                        data-testid="payment-vuelto-ars"
                        aria-readonly="true"
                      />
                      <span className={styles.helpText}>
                        Solo lectura (= excedente). Para acreditar, subí el monto ingresado
                        {foreignCurrency ? ' · mismo TC del cobro' : ''}
                      </span>
                    </div>
                  </section>
                ) : null}

                {isCardMethod(formData.metodo) ? (
                  <div className={styles.methodFields}>
                    <div className={styles.formGroup}>
                      <label htmlFor="payment-card">Número de tarjeta *</label>
                      <input
                        id="payment-card"
                        type="text"
                        value={formData.numeroTarjeta}
                        onChange={(e) => handleInputChange('numeroTarjeta', e.target.value)}
                        placeholder="**** **** **** ****"
                        maxLength={19}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="payment-empresa">Empresa *</label>
                      <select
                        id="payment-empresa"
                        value={formData.empresa}
                        onChange={(e) => handleInputChange('empresa', e.target.value)}
                        required
                      >
                        <option value="">Seleccionar empresa...</option>
                        {formData.metodo === 'Tarjeta Debito' ? (
                          <>
                            <option value="Maestro">Maestro</option>
                            <option value="Visa Electron">Visa Electron</option>
                            <option value="Cabal 24hs">Cabal 24hs</option>
                            <option value="Mastercard Debito">Mastercard Débito</option>
                            <option value="Otra">Otra</option>
                          </>
                        ) : (
                          <>
                            <option value="American Express">American Express</option>
                            <option value="Visa">Visa</option>
                            <option value="Mastercard">Mastercard</option>
                            <option value="Credencial">Credencial</option>
                            <option value="Carta Franca">Carta Franca</option>
                            <option value="Cabal">Cabal</option>
                            <option value="Diners">Diners</option>
                            <option value="Tarjeta Shopping">Tarjeta Shopping</option>
                            <option value="Tarjeta Naranja">Tarjeta Naranja</option>
                            <option value="Otra">Otra</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                ) : null}

                {showComprobanteField ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="payment-comprobante">Comprobante (opcional)</label>
                    <label
                      className={`${styles.comprobanteDropzone} ${loading ? styles.comprobanteDropzoneBusy : ''}`}
                      htmlFor="payment-comprobante"
                    >
                      <input
                        id="payment-comprobante"
                        type="file"
                        accept={COMPROBANTE_ACCEPT}
                        multiple
                        disabled={loading}
                        onChange={(e) => {
                          handleComprobanteChange(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <FiUpload aria-hidden="true" />
                      {comprobanteFiles.length > 0
                        ? `${comprobanteFiles.length} archivo${comprobanteFiles.length === 1 ? '' : 's'} listo${comprobanteFiles.length === 1 ? '' : 's'} — clic para cambiar`
                        : 'Subir comprobante (JPG, PNG o PDF)'}
                    </label>
                    {comprobanteFiles.length > 0 && (
                      <button
                        type="button"
                        className={styles.comprobanteClear}
                        disabled={loading}
                        onClick={() => setComprobanteFiles([])}
                      >
                        Quitar archivos
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Col 3 — descuentos */}
            <section className={styles.layoutCol} aria-label="Descuentos">
              <h3 className={styles.colTitle}>Descuentos</h3>

              {!isDevolucion && manualPromoSuggestions.length > 0 && (
                <div
                  className={styles.manualPromoBlock}
                  data-testid="payment-manual-promos"
                >
                  <p className={styles.discountTitle}>Valor al aplicar</p>
                  <p className={styles.helpText}>
                    Promos/descuentos sin valor fijo: completá el beneficio para aplicarlos.
                  </p>
                  {manualPromoSuggestions.map((s) => (
                    <label key={s.id} className={styles.manualPromoRow}>
                      <span className={styles.manualPromoLabel}>{s.label}</span>
                      <span className={styles.manualPromoInputWrap}>
                        <input
                          type="number"
                          min="0"
                          step={s.benefitType === 'FREE_NIGHTS' ? '1' : '0.01'}
                          className={styles.manualPromoInput}
                          value={manualPromoValues[s.id] ?? ''}
                          onChange={(e) => setManualPromoValue(s.id, e.target.value)}
                          placeholder="—"
                          aria-label={`Valor de ${s.label}`}
                          disabled={loading}
                        />
                        <span className={styles.manualPromoUnit} aria-hidden="true">
                          {benefitUnitLabel(s.benefitType)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {!isDevolucion &&
                manualPromoPreview?.aplica &&
                manualPromoPreview.appliedRules?.length > 0 && (
                  <div
                    className={styles.promoList}
                    role="status"
                    data-testid="payment-applied-promos"
                  >
                    {manualPromoPreview.appliedRules.map((promo) => {
                      const removable = isRemovableOptionalPromo(promo);
                      return (
                        <div
                          key={promo.promotionRuleId || promo.code || promo.label}
                          className={styles.promoBlock}
                        >
                          <div className={styles.promoRow}>
                            <span className={styles.promoLabel}>
                              {promo.label}
                              {promo.porcentaje != null ? ` (${promo.porcentaje}%)` : ''}
                            </span>
                            <span className={styles.promoValue}>
                              {manualPromoPreview.probeOnly && promo.porcentaje != null
                                ? `−${promo.porcentaje}%`
                                : `−${formatMoneyArs(promo.montoARS)}`}
                            </span>
                          </div>
                          {removable ? (
                            <button
                              type="button"
                              className={styles.promoRemoveBtn}
                              onClick={() => removeOptionalPromo(promo)}
                              aria-label={`Quitar ${promo.label}`}
                              disabled={loading}
                              data-testid={`payment-promo-remove-${promo.promotionRuleId}`}
                            >
                              <FiX aria-hidden="true" />
                              <span>Quitar</span>
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

              {!isDevolucion && (
                <div className={styles.addPromoWrap} ref={addPromoRef}>
                  <button
                    type="button"
                    className={styles.addPromoBtn}
                    onClick={() => setAddPromoOpen((v) => !v)}
                    aria-expanded={addPromoOpen}
                    aria-haspopup="listbox"
                    disabled={loading || optionalChoices.length === 0}
                    data-testid="payment-add-optional-promo"
                  >
                    <FiPlus aria-hidden="true" />
                    Descuento
                  </button>
                  {addPromoOpen && optionalChoices.length > 0 ? (
                    <ul
                      className={styles.addPromoMenu}
                      role="listbox"
                      aria-label="Descuentos opcionales"
                    >
                      {optionalChoices.map((choice) => {
                        const valueLabel = formatOptionalBenefitValue(choice);
                        return (
                          <li key={choice.id} role="option">
                            <button
                              type="button"
                              className={styles.addPromoOption}
                              onClick={() => addOptionalPromo(choice)}
                            >
                              <span className={styles.addPromoName}>{choice.label}</span>
                              {valueLabel ? (
                                <span className={styles.addPromoMeta}>{valueLabel}</span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              )}

              {isDevolucion ? (
                <p className={styles.helpText}>
                  En devolución no se agregan descuentos; se revierten los del cobro de origen.
                </p>
              ) : null}
            </section>

            {/* Col 4 — saldos */}
            <section className={styles.layoutCol} aria-label="Saldo" data-testid="payment-saldo-col">
              <div className={styles.saldoBlock}>
                <span className={styles.saldoLabel}>Saldo original</span>
                <span className={styles.saldoValue}>
                  {!isDevolucion && saldoPendiente != null
                    ? formatMoneyArs(saldoPendiente)
                    : '—'}
                </span>
              </div>
              <div className={styles.saldoBlock}>
                <span className={styles.saldoLabel}>Monto saldado</span>
                <span className={styles.saldoValue}>
                  {!isDevolucion && creditoACuentaARS > 0
                    ? formatMoneyArs(creditoACuentaARS)
                    : isDevolucion && refundCreditoARS > 0
                      ? formatMoneyArs(refundCreditoARS)
                      : '—'}
                </span>
              </div>
              <div className={styles.saldoDivider} aria-hidden="true" />
              <div
                className={`${styles.saldoBlock} ${styles.saldoBlockHighlight}`}
                data-testid="summary-saldo"
              >
                <span className={styles.saldoLabel}>Nuevo saldo</span>
                <span className={styles.saldoValueLarge}>
                  {saldoProyectadoARS != null ? formatMoneyArs(saldoProyectadoARS) : '—'}
                </span>
              </div>
            </section>
          </div>

          {!isEditMode && billingEnabled && (
            <div className={`${styles.billingSection} ${styles.billingBelow}`}>
              <div className={styles.invoiceTypeRow} role="group" aria-label="Tipo de factura">
                <button
                  type="button"
                  className={`${styles.invoiceTypeButton} ${billing.tipo === 'B' ? styles.invoiceTypeActive : ''}`}
                  onClick={() => handleBillingChange('tipo', 'B')}
                  disabled={loading}
                >
                  Factura B
                </button>
                <button
                  type="button"
                  className={`${styles.invoiceTypeButton} ${billing.tipo === 'T' ? styles.invoiceTypeActive : ''}`}
                  onClick={() => handleBillingChange('tipo', 'T')}
                  disabled={loading}
                >
                  Factura T
                </button>
                <button
                  type="button"
                  className={`${styles.invoiceTypeButton} ${billing.tipo === 'A' ? styles.invoiceTypeActive : ''}`}
                  onClick={() => handleBillingChange('tipo', 'A')}
                  disabled={loading}
                >
                  Factura A
                </button>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="billing-fecha">Fecha de facturación *</label>
                  <input
                    id="billing-fecha"
                    type="date"
                    value={billing.fecha}
                    onChange={(e) => handleBillingChange('fecha', e.target.value)}
                    required
                  />
                </div>
              </div>

              {isPersonInvoiceType(billing.tipo) ? (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-nombre">Nombre *</label>
                      <input
                        id="billing-nombre"
                        type="text"
                        value={billing.firstName}
                        onChange={(e) => handleBillingChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-apellido">Apellido *</label>
                      <input
                        id="billing-apellido"
                        type="text"
                        value={billing.lastName}
                        onChange={(e) => handleBillingChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-doc-type">Tipo documento *</label>
                      <select
                        id="billing-doc-type"
                        value={billing.documentType}
                        onChange={(e) => handleBillingChange('documentType', e.target.value)}
                      >
                        {DOCUMENT_TYPES_AR.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-doc-num">N° documento *</label>
                      <input
                        id="billing-doc-num"
                        type="text"
                        value={billing.documentNumber}
                        onChange={(e) => handleBillingChange('documentNumber', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {billing.tipo === 'T' ? (
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="billing-passport-country">
                          País emisor del pasaporte *
                        </label>
                        <select
                          id="billing-passport-country"
                          value={billing.passportCountry}
                          onChange={(e) =>
                            handleBillingChange('passportCountry', e.target.value)
                          }
                          required
                        >
                          <option value="">Seleccionar país…</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-domicilio">Domicilio</label>
                      <input
                        id="billing-domicilio"
                        type="text"
                        value={billing.address}
                        onChange={(e) => handleBillingChange('address', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-email-b">Email</label>
                      <input
                        id="billing-email-b"
                        type="email"
                        value={billing.email}
                        onChange={(e) => handleBillingChange('email', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-razon">Razón social *</label>
                      <input
                        id="billing-razon"
                        type="text"
                        value={billing.businessName}
                        onChange={(e) => handleBillingChange('businessName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-cuit">CUIT *</label>
                      <input
                        id="billing-cuit"
                        type="text"
                        value={billing.cuit}
                        onChange={(e) => handleBillingChange('cuit', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-dom-com">Domicilio comercial</label>
                      <input
                        id="billing-dom-com"
                        type="text"
                        value={billing.commercialAddress}
                        onChange={(e) => handleBillingChange('commercialAddress', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-email-a">Email</label>
                      <input
                        id="billing-email-a"
                        type="email"
                        value={billing.email}
                        onChange={(e) => handleBillingChange('email', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="billing-iva">Condición frente al IVA</label>
                      <select
                        id="billing-iva"
                        value={billing.ivaCondition}
                        onChange={(e) => handleBillingChange('ivaCondition', e.target.value)}
                      >
                        {IVA_CONDITIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {showInvoiceCardField && (
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="billing-tarjeta">Tarjeta / N°</label>
                    <input
                      id="billing-tarjeta"
                      type="text"
                      value={billing.cardNumber}
                      onChange={(e) => handleBillingChange('cardNumber', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              )}

              {clientId == null && showAllocationUi && (
                <p className={styles.helpText}>
                  Elegí una reserva para prellenar datos del cliente.
                </p>
              )}
            </div>
          )}

          </div>

          <div className={styles.stickyFooter}>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.submitButton} disabled={loading}>
                <FiSave />
                {loading
                  ? 'Guardando...'
                  : isEditMode
                    ? 'Guardar cambios'
                    : isDevolucion
                      ? 'Guardar devolución'
                      : 'Guardar cobro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CobroForm;
