import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiPlus, FiSave, FiX } from 'react-icons/fi';
import {
  createPago,
  createAccountPago,
  createExternalAccount,
  fetchReservation,
  fetchCuentasParaPago,
  fetchPaymentMethodConfigs,
  fetchAccountResumen,
  fetchAccountPagos,
  getReservationFinancialSummary,
  getClientBillingProfile,
  getTipoCambioActual,
  uploadPagoAdjuntos,
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
  DEFAULT_PAGO_MOTIVO,
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  MOTIVO_DEVOLUCION,
  emptyBillingForm,
  isCardMethod,
  localDateInputToIso,
  methodRequiresBilling,
  todayLocalDateInputValue
} from '../constants/billing';
import { formatArs, roundMoney } from '../utils/paymentDiscount';
import styles from './PaymentForm.module.css';

const MODE_PAGO = 'pago';
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

function isTransferencia(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'transferencia';
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
  if (row.accountId != null) return `a:${row.accountId}`;
  if (row.reservationId != null) return `r:${row.reservationId}`;
  return '';
}

/** Normaliza respuesta SETTLEMENT del motor de promociones para la UI de Nuevo pago. */
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

const PaymentForm = ({
  reservaId: reservaIdProp = null,
  accountId: accountIdProp = null,
  onClose,
  onSuccess
}) => {
  const needsAccountPick = reservaIdProp == null && accountIdProp == null;
  const [reservationOptions, setReservationOptions] = useState([]);
  const [pickedOptionKey, setPickedOptionKey] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showCreateExternal, setShowCreateExternal] = useState(false);
  const [externalLabel, setExternalLabel] = useState('');
  const [creatingExternal, setCreatingExternal] = useState(false);
  const accountPickerRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [mode, setMode] = useState(MODE_PAGO);
  const [esSena, setEsSena] = useState(false);

  const pickedRow = useMemo(() => {
    if (!needsAccountPick || !pickedOptionKey) return null;
    return reservationOptions.find((r) => optionKey(r) === pickedOptionKey) || null;
  }, [needsAccountPick, pickedOptionKey, reservationOptions]);

  const isExternalAccount = needsAccountPick
    ? pickedRow?.accountKind === 'EXTERNAL' || pickedRow?.origen === 'EXTERNA'
    : accountIdProp != null && reservaIdProp == null;

  const reservaId = needsAccountPick
    ? pickedRow?.reservationId
      ? Number(pickedRow.reservationId)
      : null
    : reservaIdProp != null
      ? Number(reservaIdProp)
      : null;

  const accountId = needsAccountPick
    ? pickedRow?.accountId
      ? Number(pickedRow.accountId)
      : null
    : accountIdProp != null
      ? Number(accountIdProp)
      : null;

  const isDevolucion = mode === MODE_DEVOLUCION;
  // Seña solo en Account de reserva (decisión PGH-130).
  const canUseSena = !isExternalAccount;
  const motivoActual = isDevolucion
    ? MOTIVO_DEVOLUCION
    : esSena && canUseSena
      ? 'Seña'
      : DEFAULT_PAGO_MOTIVO;

  const [formData, setFormData] = useState({
    monto: '',
    moneda: 'ARS',
    tipoCambio: '',
    metodo: 'Efectivo',
    numeroTarjeta: '',
    empresa: '',
    notas: ''
  });

  const [requiereFacturacion, setRequiereFacturacion] = useState(false);
  const [billing, setBilling] = useState(() => emptyBillingForm());
  const [comprobanteFiles, setComprobanteFiles] = useState([]);

  const [tipoCambioGlobal, setTipoCambioGlobal] = useState(null);
  const [montoARS, setMontoARS] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [methodConfigs, setMethodConfigs] = useState([]);
  const [saldoPendiente, setSaldoPendiente] = useState(null);
  const [pagosOrigen, setPagosOrigen] = useState([]);
  const [pagoOrigenId, setPagoOrigenId] = useState('');
  const [amountMode, setAmountMode] = useState(AMOUNT_MODE_INGRESADO);
  const [montoASaldar, setMontoASaldar] = useState('');
  const [manualPromoSuggestions, setManualPromoSuggestions] = useState([]);
  const [manualPromoValues, setManualPromoValues] = useState({});
  const [manualPromoPreview, setManualPromoPreview] = useState(null);
  const [optionalChoices, setOptionalChoices] = useState([]);
  const [selectedOptionalIds, setSelectedOptionalIds] = useState([]);
  const [deselectedRuleIds, setDeselectedRuleIds] = useState([]);
  const [addPromoOpen, setAddPromoOpen] = useState(false);
  const addPromoRef = useRef(null);
  const showComprobanteField = isTransferencia(formData.metodo);
  const isSaldarMode = !isDevolucion && amountMode === AMOUNT_MODE_SALDAR;
  const montoASaldarARS = roundMoney(parseFloat(montoASaldar) || 0);

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
      setBilling((prev) =>
        emptyBillingForm({
          ...prev,
          tipo: profile.lastInvoiceType === 'A' ? 'A' : 'B',
          fecha: todayLocalDateInputValue(),
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          documentType: profile.documentType || 'DNI',
          documentNumber: profile.documentNumber || '',
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
        // Sincronizar el otro campo según descuentos (fuente = amountMode).
        if (!probeOnly && mapped?.aplica) {
          if (hasSaldar && mapped.dineroARS != null) {
            const nextIngresado = String(roundMoney(mapped.dineroARS));
            setFormData((prev) =>
              prev.monto === nextIngresado && prev.moneda === 'ARS'
                ? prev
                : { ...prev, monto: nextIngresado, moneda: 'ARS' }
            );
          } else if (hasIngresado && mapped.creditoARS != null) {
            const nextSaldar = String(roundMoney(mapped.creditoARS));
            setMontoASaldar((prev) => (prev === nextSaldar ? prev : nextSaldar));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Preview promos settlement falló', err);
          setManualPromoSuggestions([]);
          setManualPromoPreview(null);
          setOptionalChoices([]);
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
        setPagosOrigen([]);
        setPagoOrigenId('');
        return;
      }
      try {
        let saldo = null;
        let pagos = [];
        if (resolvedAccountId) {
          const [resumenRes, pagosRes] = await Promise.all([
            fetchAccountResumen(resolvedAccountId),
            fetchAccountPagos(resolvedAccountId)
          ]);
          saldo = resumenRes?.resumen?.saldo;
          pagos = Array.isArray(pagosRes) ? pagosRes : [];
        } else if (resolvedReservaId) {
          const summary = await getReservationFinancialSummary(resolvedReservaId);
          saldo = summary?.resumen?.saldo;
          pagos = Array.isArray(summary?.pagos?.items) ? summary.pagos.items : [];
        }
        if (cancelled) return;
        setSaldoPendiente(saldo != null ? Number(saldo) : null);
        const cobros = (pagos || []).filter(
          (p) =>
            String(p.motivo || 'Pago') !== MOTIVO_DEVOLUCION &&
            Number(p.montoARS) > 0
        );
        setPagosOrigen(cobros);
        setPagoOrigenId((prev) =>
          prev && cobros.some((p) => String(p.id) === String(prev)) ? prev : ''
        );
      } catch (err) {
        if (!cancelled) {
          console.error('Error cargando saldo/pagos del folio:', err);
          setSaldoPendiente(null);
          setPagosOrigen([]);
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
      setLoadingMeta(true);
      setError(null);
      try {
        if (needsAccountPick) {
          const optionsRes = await fetchCuentasParaPago();
          const list = optionsRes.data || optionsRes || [];
          if (!cancelled) setReservationOptions(Array.isArray(list) ? list : []);
        } else if (reservaIdProp) {
          const reservation = await fetchReservation(reservaIdProp);
          const cid = reservation?.mainClient?.id || reservation?.mainClientId || null;
          if (!cancelled) {
            setClientId(cid);
            if (cid) await applyBillingPrefill(cid);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error cargando datos del pago');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [needsAccountPick, reservaIdProp, applyBillingPrefill]);

  useEffect(() => {
    if (!needsAccountPick || !pickedRow) return;
    const cid = pickedRow?.clientId || null;
    setClientId(cid);
    if (cid) applyBillingPrefill(cid);
  }, [needsAccountPick, pickedRow, applyBillingPrefill]);

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
    const monto = parseFloat(formData.monto) || 0;
    let calculatedARS = 0;

    if (formData.moneda === 'USD') {
      const tipoCambio = parseFloat(formData.tipoCambio) || 0;
      calculatedARS = monto * tipoCambio;
    } else {
      calculatedARS = monto;
    }

    setMontoARS(calculatedARS);
  };

  const handleInputChange = (field, value) => {
    setError(null);
    if (field === 'metodo') {
      if (!isTransferencia(value)) setComprobanteFiles([]);
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
    if (field === 'monto' && !isDevolucion) {
      setAmountMode(AMOUNT_MODE_INGRESADO);
      if (!value || !(parseFloat(value) > 0)) {
        setMontoASaldar('');
      }
    }
    if (field === 'moneda' && value !== 'ARS' && !isDevolucion) {
      // Monto a saldar es ARS de cuenta; otra moneda usa modo ingresado como fuente.
      setAmountMode(AMOUNT_MODE_INGRESADO);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMontoASaldarChange = (value) => {
    setError(null);
    setAmountMode(AMOUNT_MODE_SALDAR);
    setMontoASaldar(value);
    if (!value || !(parseFloat(value) > 0)) {
      setFormData((prev) => ({ ...prev, monto: '', moneda: 'ARS' }));
    } else {
      setFormData((prev) => (prev.moneda === 'ARS' ? prev : { ...prev, moneda: 'ARS' }));
    }
  };

  const useSaldoPendienteAsSaldar = () => {
    if (saldoPendiente == null || Number(saldoPendiente) <= 0) return;
    handleMontoASaldarChange(String(roundMoney(saldoPendiente)));
  };

  /** Monto de caja a registrar (ARS) según modo. */
  const tenderMontoARS = useMemo(() => {
    if (isDevolucion) return montoARS;
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
    manualPromoPreview
  ]);

  const handleComprobanteChange = (fileList) => {
    setError(null);
    const next = Array.from(fileList || []);
    setComprobanteFiles(next);
  };

  const handleBillingChange = (field, value) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
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

  const filteredAccountOptions = useMemo(() => {
    const q = String(accountQuery || '').trim().toLowerCase();
    if (!q) return occupiedOptions;
    return occupiedOptions.filter((row) => accountOptionText(row).includes(q));
  }, [occupiedOptions, accountQuery, accountOptionText]);

  const pickedAccountLabel = useMemo(() => {
    if (!pickedRow) return '';
    const kind =
      pickedRow.origen === 'EXTERNA' || pickedRow.accountKind === 'EXTERNAL'
        ? 'Externa'
        : 'Reserva';
    return `${kind} · ${reservationOptionLabel(pickedRow)}`;
  }, [pickedRow]);

  useEffect(() => {
    if (!accountMenuOpen && !showCreateExternal) return undefined;
    const onDocClick = (e) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [accountMenuOpen, showCreateExternal]);

  const reloadAccountOptions = useCallback(async () => {
    if (!needsAccountPick) return [];
    const optionsRes = await fetchCuentasParaPago();
    const list = optionsRes.data || optionsRes || [];
    const next = Array.isArray(list) ? list : [];
    setReservationOptions(next);
    return next;
  }, [needsAccountPick]);

  const pickAccountOption = (row) => {
    const key = optionKey(row);
    setPickedOptionKey(key);
    setAccountQuery('');
    setAccountMenuOpen(false);
    setShowCreateExternal(false);
  };

  const handleCreateExternalAccount = async () => {
    const label = String(externalLabel || '').trim();
    if (!label) {
      setError('Indicá un nombre para la cuenta externa');
      return;
    }
    try {
      setCreatingExternal(true);
      setError(null);
      const created = await createExternalAccount({ label });
      const list = await reloadAccountOptions();
      const createdId = created?.id ?? created?.accountId ?? null;
      const match =
        (createdId != null &&
          list.find((r) => Number(r.accountId) === Number(createdId))) ||
        list.find(
          (r) =>
            (r.origen === 'EXTERNA' || r.accountKind === 'EXTERNAL') &&
            String(r.label || '').trim().toLowerCase() === label.toLowerCase()
        );
      if (match) pickAccountOption(match);
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

    if (!reservaId && !accountId) {
      setError('Seleccioná una cuenta');
      return;
    }
    if (esSena && isExternalAccount) {
      setError('La seña solo se registra en la cuenta de una reserva');
      return;
    }

    if (isDevolucion || amountMode === AMOUNT_MODE_INGRESADO) {
      if (!formData.monto || parseFloat(formData.monto) <= 0) {
        setError('El monto ingresado debe ser mayor a 0');
        return;
      }
    } else if (amountMode === AMOUNT_MODE_SALDAR) {
      if (!(montoASaldarARS > 0)) {
        setError('El monto a saldar debe ser mayor a 0');
        return;
      }
      if (!(tenderMontoARS > 0)) {
        setError('No se pudo calcular cuánto debe abonar el cliente');
        return;
      }
    }

    if (isDevolucion && !pagoOrigenId) {
      setError('Seleccioná el pago de origen a devolver');
      return;
    }

    if (formData.moneda === 'USD' && (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0)) {
      setError('Para pagos en USD, el tipo de cambio es requerido');
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

    if (billingEnabled) {
      if (!billing.tipo || !['A', 'B'].includes(billing.tipo)) {
        setError('Seleccioná Factura A o Factura B');
        return;
      }
      if (!billing.fecha || !localDateInputToIso(billing.fecha)) {
        setError('La fecha de facturación es requerida');
        return;
      }
      if (billing.tipo === 'B') {
        if (!billing.firstName || !billing.lastName) {
          setError('Nombre y apellido son requeridos para Factura B');
          return;
        }
        if (!billing.documentNumber) {
          setError('El número de documento es requerido para Factura B');
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

      // fecha del pago: la fija el servidor (ahora). Solo se envía fecha de facturación si aplica.
      // Devolución: monto positivo en UI; el backend lo guarda negativo en el saldo.
      // Modo saldar: se registra lo que el cliente abona (dinero); el motor aplica el descuento.
      const submitMonto =
        !isDevolucion && amountMode === AMOUNT_MODE_SALDAR
          ? tenderMontoARS
          : parseFloat(formData.monto);
      const submitMoneda =
        !isDevolucion && amountMode === AMOUNT_MODE_SALDAR ? 'ARS' : formData.moneda;
      const pagoData = {
        monto: submitMonto,
        moneda: submitMoneda,
        tipoCambio: submitMoneda === 'USD' ? parseFloat(formData.tipoCambio) : undefined,
        metodo: formData.metodo,
        paymentMethodConfigId: selectedMethodConfig?.id ?? undefined,
        pagoOrigenId: isDevolucion ? Number(pagoOrigenId) : undefined,
        motivo: motivoActual,
        numeroTarjeta: isCardMethod(formData.metodo) ? formData.numeroTarjeta : undefined,
        empresa: isCardMethod(formData.metodo) ? formData.empresa : undefined,
        notas: formData.notas || null,
        requiereFacturacion: billingEnabled,
        factura: facturaPayload,
        selectedRuleIds: isDevolucion ? undefined : manualPromoApply.selectedRuleIds,
        deselectedRuleIds: isDevolucion ? undefined : manualPromoApply.deselectedRuleIds,
        benefitValueByRuleId: isDevolucion
          ? undefined
          : manualPromoApply.benefitValueByRuleId,
        applySuggestedDefaults: isDevolucion ? undefined : true
      };

      let nuevoPago;
      if (isExternalAccount || (accountId && !reservaId)) {
        nuevoPago = await createAccountPago(accountId, pagoData);
      } else {
        nuevoPago = await createPago(reservaId, pagoData);
      }

      if (
        showComprobanteField &&
        comprobanteFiles.length > 0 &&
        nuevoPago?.id != null
      ) {
        try {
          const adjuntos = await uploadPagoAdjuntos(
            nuevoPago.id,
            ADJUNTO_COMPROBANTE,
            comprobanteFiles
          );
          nuevoPago = {
            ...nuevoPago,
            adjuntos: [...(nuevoPago.adjuntos || []), ...(adjuntos || [])]
          };
        } catch (uploadErr) {
          // El pago ya quedó creado; el comprobante se puede adjuntar luego en Pagos.
          setError(
            uploadErr.message
              ? `Pago guardado, pero falló el comprobante: ${uploadErr.message}. Podés adjuntarlo luego en Pagos.`
              : 'Pago guardado, pero falló el comprobante. Podés adjuntarlo luego en Pagos.'
          );
          onSuccess?.(nuevoPago);
          setLoading(false);
          return;
        }
      }

      onSuccess?.(nuevoPago);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear el pago');
      console.error('Error creating payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasIngresadoAmount = (parseFloat(formData.monto) || 0) > 0;

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);

  const formatPriceUSD = (price) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
        <div className={styles.header}>
          <h2 id="payment-form-title">
            {isDevolucion ? 'Nueva devolución' : 'Nuevo pago'}
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

        <div className={styles.modeTabs} role="tablist" aria-label="Tipo de movimiento">
          <button
            type="button"
            role="tab"
            id="tab-nuevo-pago"
            aria-selected={!isDevolucion}
            className={`${styles.modeTab} ${!isDevolucion ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode(MODE_PAGO);
            }}
            disabled={loading}
          >
            Nuevo pago
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

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formBody}>
          {needsAccountPick && (
            <div className={`${styles.formRow} ${styles.formRowFull}`}>
              <div className={styles.formGroup} ref={accountPickerRef}>
                <div className={styles.accountPickerRow}>
                  <div className={styles.accountCombobox}>
                    <input
                      id="payment-reservation"
                      type="text"
                      role="combobox"
                      aria-expanded={accountMenuOpen}
                      aria-controls="payment-account-listbox"
                      aria-autocomplete="list"
                      aria-label="Seleccionar reserva o cuenta externa"
                      placeholder={
                        loadingMeta
                          ? 'Cargando…'
                          : occupiedOptions.length === 0
                            ? 'Sin cuentas abiertas'
                            : 'Seleccionar reserva o cuenta externa…'
                      }
                      value={accountMenuOpen ? accountQuery : pickedAccountLabel || accountQuery}
                      onChange={(e) => {
                        setAccountQuery(e.target.value);
                        setAccountMenuOpen(true);
                        if (pickedOptionKey) setPickedOptionKey('');
                      }}
                      onFocus={() => {
                        setAccountMenuOpen(true);
                        setAccountQuery('');
                      }}
                      required={!pickedOptionKey}
                      disabled={loadingMeta || loading}
                      data-testid="payment-account-search"
                      autoComplete="off"
                    />
                    {accountMenuOpen ? (
                      <ul
                        id="payment-account-listbox"
                        className={styles.accountMenu}
                        role="listbox"
                        aria-label="Cuentas y reservas"
                      >
                        {filteredAccountOptions.length === 0 ? (
                          <li className={styles.accountMenuEmpty} role="presentation">
                            Sin coincidencias
                          </li>
                        ) : (
                          filteredAccountOptions.map((row) => {
                            const key = optionKey(row);
                            const kind =
                              row.origen === 'EXTERNA' || row.accountKind === 'EXTERNAL'
                                ? 'Externa'
                                : 'Reserva';
                            return (
                              <li key={key} role="option" aria-selected={pickedOptionKey === key}>
                                <button
                                  type="button"
                                  className={styles.accountOption}
                                  onClick={() => pickAccountOption(row)}
                                >
                                  <span className={styles.accountOptionKind}>{kind}</span>
                                  <span className={styles.accountOptionLabel}>
                                    {reservationOptionLabel(row)}
                                  </span>
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.createExternalBtn}
                    disabled={loading || creatingExternal}
                    onClick={() => {
                      setShowCreateExternal((v) => !v);
                      setAccountMenuOpen(false);
                    }}
                    data-testid="payment-create-external"
                  >
                    <FiPlus aria-hidden="true" />
                    Crear cuenta externa
                  </button>
                </div>
                {showCreateExternal ? (
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
                      onClick={handleCreateExternalAccount}
                    >
                      {creatingExternal ? 'Creando…' : 'Crear'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div
            className={`${styles.amountModes} ${styles.amountModesSameBox}`}
            data-testid="payment-amount-modes"
          >
            <div
              className={`${styles.amountModeBlock} ${
                isDevolucion || amountMode === AMOUNT_MODE_INGRESADO
                  ? styles.amountModeActive
                  : ''
              }`}
            >
              <label htmlFor="payment-monto">
                {isDevolucion ? 'Monto *' : 'Monto ingresado'}
              </label>
              <input
                id="payment-monto"
                type="number"
                value={formData.monto}
                onChange={(e) => handleInputChange('monto', e.target.value)}
                onFocus={() => {
                  if (!isDevolucion) setAmountMode(AMOUNT_MODE_INGRESADO);
                }}
                placeholder="0"
                step="0.01"
                min="0"
                required={isDevolucion || amountMode === AMOUNT_MODE_INGRESADO}
                disabled={loading}
                data-testid="payment-monto-ingresado"
              />
            </div>

            {!isDevolucion ? (
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
                  onFocus={() => {
                    setAmountMode(AMOUNT_MODE_SALDAR);
                    setFormData((prev) =>
                      prev.moneda === 'ARS' ? prev : { ...prev, moneda: 'ARS' }
                    );
                  }}
                  placeholder={
                    saldoPendiente != null && Number(saldoPendiente) > 0
                      ? formatArs(saldoPendiente)
                      : '0'
                  }
                  step="0.01"
                  min="0"
                  required={amountMode === AMOUNT_MODE_SALDAR}
                  disabled={loading}
                  data-testid="payment-monto-saldar"
                />
                {saldoPendiente != null && Number(saldoPendiente) > 0 ? (
                  <button
                    type="button"
                    className={styles.useSaldoBtn}
                    disabled={loading}
                    onClick={useSaldoPendienteAsSaldar}
                    data-testid="payment-use-saldo"
                  >
                    Usar saldo pendiente ($ {formatArs(saldoPendiente)})
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={styles.formRow}>
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
          </div>

          {formData.moneda === 'USD' && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="payment-tc">Tipo de cambio *</label>
                <input
                  id="payment-tc"
                  type="number"
                  value={formData.tipoCambio}
                  onChange={(e) => handleInputChange('tipoCambio', e.target.value)}
                  placeholder="1000.00"
                  step="0.01"
                  min="0"
                  required
                />
                {tipoCambioGlobal != null && (
                  <span className={styles.helpText}>Global: {tipoCambioGlobal}</span>
                )}
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="payment-metodo">
                {isDevolucion ? 'Método de devolución *' : 'Método de pago *'}
              </label>
              <select
                id="payment-metodo"
                value={formData.metodo}
                onChange={(e) => handleInputChange('metodo', e.target.value)}
                required
                disabled={loading || methodConfigs.length === 0}
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

            {!isDevolucion && canUseSena && (
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
            )}
          </div>

          {isDevolucion && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="payment-origen">Pago de origen *</label>
                <select
                  id="payment-origen"
                  value={pagoOrigenId}
                  onChange={(e) => setPagoOrigenId(e.target.value)}
                  required
                  disabled={loading || pagosOrigen.length === 0}
                >
                  <option value="">
                    {pagosOrigen.length === 0
                      ? 'No hay cobros disponibles'
                      : 'Seleccionar cobro…'}
                  </option>
                  {pagosOrigen.map((p) => {
                    const disc = p.discountApplication?.montoARS;
                    const discLabel =
                      disc != null && Number(disc) > 0
                        ? ` · desc. ${formatArs(disc)}`
                        : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.codigo || `#${p.id}`} — {p.metodo || 'Pago'} —{' '}
                        {formatArs(p.montoARS)} ARS{discLabel}
                      </option>
                    );
                  })}
                </select>
                <span className={styles.helpText}>
                  Obligatorio. Si el cobro tenía descuento, se revierte en la misma operación.
                </span>
              </div>
            </div>
          )}

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
                            : `−$ ${formatArs(promo.montoARS)}`}
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
                promoción
              </button>
              {addPromoOpen && optionalChoices.length > 0 ? (
                <ul
                  className={styles.addPromoMenu}
                  role="listbox"
                  aria-label="Promociones opcionales"
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

          {!isDevolucion &&
            manualPromoPreview?.aplica &&
            !manualPromoPreview.probeOnly && (
              <div className={styles.discountPreview} role="status">
                <ul className={styles.discountList}>
                  <li>
                    Recibe / registra:{' '}
                    <strong>$ {formatArs(manualPromoPreview.dineroARS || 0)}</strong>
                  </li>
                  <li>
                    Crédito a cuenta:{' '}
                    <strong>$ {formatArs(manualPromoPreview.creditoARS || 0)}</strong>
                  </li>
                  {saldoPendiente != null && (
                    <li>
                      Saldo restante proyectado:{' '}
                      <strong>
                        ${' '}
                        {formatArs(
                          roundMoney(
                            saldoPendiente - (manualPromoPreview.creditoARS || 0)
                          )
                        )}
                      </strong>
                    </li>
                  )}
                </ul>
              </div>
            )}

          {showComprobanteField && (
            <div className={styles.formRow}>
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
                  {comprobanteFiles.length > 0
                    ? `${comprobanteFiles.length} archivo${comprobanteFiles.length === 1 ? '' : 's'} listo${comprobanteFiles.length === 1 ? '' : 's'} — clic para cambiar`
                    : 'Adjuntar JPG, PNG o PDF (también se puede después en Pagos)'}
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
            </div>
          )}

          {isCardMethod(formData.metodo) && (
            <div className={styles.formRow}>
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
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="payment-notas">Notas</label>
              <textarea
                id="payment-notas"
                value={formData.notas}
                onChange={(e) => handleInputChange('notas', e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>

          <div className={styles.billingToggleRow}>
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

          {billingEnabled && (
            <div className={styles.billingSection}>
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

              {billing.tipo === 'B' ? (
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

              {clientId == null && needsAccountPick && (
                <p className={styles.helpText}>
                  Elegí una reserva para prellenar datos del cliente.
                </p>
              )}
            </div>
          )}

          </div>

          <div className={styles.stickyFooter}>
          <div className={styles.paymentSummary} data-testid="payment-summary">
            <h3>{isDevolucion ? 'Resumen de la devolución' : 'Resumen del pago'}</h3>
            <div className={styles.summaryRow}>
              <span>Motivo:</span>
              <span>{motivoActual}</span>
            </div>
            {isSaldarMode ? (
              <>
                <div className={styles.summaryRow}>
                  <span>Monto a saldar:</span>
                  <span className={styles.amount}>
                    {montoASaldarARS > 0 ? formatPrice(montoASaldarARS) : '—'}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Cliente abona:</span>
                  <span className={styles.amountARS}>
                    {montoASaldarARS > 0 && tenderMontoARS > 0
                      ? formatPrice(tenderMontoARS)
                      : '—'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className={styles.summaryRow}>
                  <span>Monto original:</span>
                  <span className={isDevolucion ? styles.amountARS : styles.amount}>
                    {hasIngresadoAmount
                      ? `${isDevolucion ? '−' : ''}${
                          formData.moneda === 'USD'
                            ? formatPriceUSD(parseFloat(formData.monto) || 0)
                            : formatPrice(parseFloat(formData.monto) || 0)
                        }`
                      : '—'}
                  </span>
                </div>
                {formData.moneda === 'USD' && (
                  <div className={styles.summaryRow}>
                    <span>Tipo de cambio:</span>
                    <span>
                      {parseFloat(formData.tipoCambio) > 0
                        ? parseFloat(formData.tipoCambio)
                        : '—'}
                    </span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>Equivalente en ARS:</span>
                  <span className={styles.amountARS}>
                    {hasIngresadoAmount
                      ? `${isDevolucion ? '−' : ''}${formatPrice(montoARS)}`
                      : '—'}
                  </span>
                </div>
              </>
            )}
          </div>

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
                : isDevolucion
                  ? 'Guardar devolución'
                  : 'Guardar pago'}
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
