import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import {
  createPago,
  createAccountPago,
  fetchReservation,
  fetchCuentasParaPago,
  fetchPaymentMethodConfigs,
  fetchAccountResumen,
  fetchAccountPagos,
  getReservationFinancialSummary,
  getClientBillingProfile,
  getTipoCambioActual,
  uploadPagoAdjuntos
} from '../services/api';
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
import {
  computeCashToSettle,
  computeDiscountFromReceived,
  formatArs,
  roundMoney
} from '../utils/paymentDiscount';
import styles from './PaymentForm.module.css';

const MODE_PAGO = 'pago';
const MODE_DEVOLUCION = 'devolucion';
const ADJUNTO_COMPROBANTE = 'COMPROBANTE';
const COMPROBANTE_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

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

const PaymentForm = ({
  reservaId: reservaIdProp = null,
  accountId: accountIdProp = null,
  onClose,
  onSuccess
}) => {
  const needsAccountPick = reservaIdProp == null && accountIdProp == null;
  const [reservationOptions, setReservationOptions] = useState([]);
  const [pickedOptionKey, setPickedOptionKey] = useState('');
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
  const showComprobanteField = isTransferencia(formData.metodo);

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

  const discountPreview = useMemo(() => {
    if (isDevolucion) return null;
    return computeDiscountFromReceived({
      dineroARS: montoARS,
      config: selectedMethodConfig,
      motivo: motivoActual,
      saldoPendiente
    });
  }, [isDevolucion, montoARS, selectedMethodConfig, motivoActual, saldoPendiente]);

  const settlePreview = useMemo(() => {
    if (isDevolucion || saldoPendiente == null) return null;
    return computeCashToSettle({
      saldoPendiente,
      config: selectedMethodConfig,
      motivo: motivoActual
    });
  }, [isDevolucion, saldoPendiente, selectedMethodConfig, motivoActual]);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
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
      const pagoData = {
        monto: parseFloat(formData.monto),
        moneda: formData.moneda,
        tipoCambio: formData.moneda === 'USD' ? parseFloat(formData.tipoCambio) : undefined,
        metodo: formData.metodo,
        paymentMethodConfigId: selectedMethodConfig?.id ?? undefined,
        pagoOrigenId: isDevolucion ? Number(pagoOrigenId) : undefined,
        motivo: motivoActual,
        numeroTarjeta: isCardMethod(formData.metodo) ? formData.numeroTarjeta : undefined,
        empresa: isCardMethod(formData.metodo) ? formData.empresa : undefined,
        notas: formData.notas || null,
        requiereFacturacion: billingEnabled,
        factura: facturaPayload
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
            onClick={() => setMode(MODE_PAGO)}
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
            onClick={() => setMode(MODE_DEVOLUCION)}
            disabled={loading}
          >
            Nueva devolución
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {needsAccountPick && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="payment-reservation">Cuenta *</label>
                <select
                  id="payment-reservation"
                  value={pickedOptionKey}
                  onChange={(e) => setPickedOptionKey(e.target.value)}
                  required
                  disabled={loadingMeta || loading}
                >
                  <option value="">
                    {loadingMeta
                      ? 'Cargando…'
                      : occupiedOptions.length === 0
                        ? 'Sin cuentas abiertas'
                        : 'Seleccionar reserva o cuenta externa…'}
                  </option>
                  {occupiedOptions.map((row) => (
                    <option key={optionKey(row)} value={optionKey(row)}>
                      {row.origen === 'EXTERNA' || row.accountKind === 'EXTERNAL'
                        ? `Externa · ${reservationOptionLabel(row)}`
                        : `Reserva · ${reservationOptionLabel(row)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="payment-monto">Monto *</label>
              <input
                id="payment-monto"
                type="number"
                value={formData.monto}
                onChange={(e) => handleInputChange('monto', e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="payment-moneda">Moneda *</label>
              <select
                id="payment-moneda"
                value={formData.moneda}
                onChange={(e) => handleInputChange('moneda', e.target.value)}
                required
              >
                <option value="ARS">Pesos Argentinos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
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
              >
                {(methodConfigs.length > 0
                  ? methodConfigs
                  : [
                      { id: 'ef', label: 'Efectivo' },
                      { id: 'td', label: 'Tarjeta Debito' },
                      { id: 'tc', label: 'Tarjeta Credito' },
                      { id: 'tr', label: 'Transferencia' }
                    ]
                ).map((m) => (
                  <option key={m.id} value={m.label}>
                    {m.label}
                    {m.descuentoActivo && Number(m.descuentoValor) > 0
                      ? ` (−${Number(m.descuentoValor)}%)`
                      : ''}
                  </option>
                ))}
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

          {!isDevolucion && discountPreview?.aplica && (
            <div className={styles.discountPreview} role="status">
              <p className={styles.discountTitle}>
                Descuento {discountPreview.porcentaje}% ({selectedMethodConfig?.label})
              </p>
              <ul className={styles.discountList}>
                <li>
                  Recibe / registra: <strong>$ {formatArs(discountPreview.dineroARS)}</strong>
                </li>
                <li>
                  Descuento aplicado: <strong>$ {formatArs(discountPreview.descuentoARS)}</strong>
                </li>
                <li>
                  Crédito a cuenta: <strong>$ {formatArs(discountPreview.creditoARS)}</strong>
                </li>
                {saldoPendiente != null && (
                  <li>
                    Saldo restante proyectado:{' '}
                    <strong>
                      ${' '}
                      {formatArs(
                        roundMoney(saldoPendiente - discountPreview.creditoARS)
                      )}
                    </strong>
                  </li>
                )}
              </ul>
            </div>
          )}

          {!isDevolucion &&
            settlePreview?.aplica &&
            saldoPendiente != null &&
            saldoPendiente > 0 && (
              <div className={styles.settleRow}>
                <button
                  type="button"
                  className={styles.settleButton}
                  disabled={loading}
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      moneda: 'ARS',
                      monto: String(settlePreview.dineroARS)
                    }));
                  }}
                >
                  Cobrar saldo con este medio ($ {formatArs(settlePreview.dineroARS)})
                </button>
                <span className={styles.helpText}>
                  Cancela $ {formatArs(settlePreview.saldoARS)} pidiendo ${' '}
                  {formatArs(settlePreview.dineroARS)} (desc. ${' '}
                  {formatArs(settlePreview.descuentoARS)})
                </span>
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

          <div className={styles.paymentSummary}>
            <h3>{isDevolucion ? 'Resumen de la devolución' : 'Resumen del pago'}</h3>
            <div className={styles.summaryRow}>
              <span>Motivo:</span>
              <span>{motivoActual}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Monto original:</span>
              <span className={isDevolucion ? styles.amountARS : styles.amount}>
                {isDevolucion ? '−' : ''}
                {formData.moneda === 'USD'
                  ? formatPriceUSD(parseFloat(formData.monto) || 0)
                  : formatPrice(parseFloat(formData.monto) || 0)}
              </span>
            </div>
            {formData.moneda === 'USD' && (
              <div className={styles.summaryRow}>
                <span>Tipo de cambio:</span>
                <span>{parseFloat(formData.tipoCambio) || 0}</span>
              </div>
            )}
            <div className={styles.summaryRow}>
              <span>Equivalente en ARS:</span>
              <span className={styles.amountARS}>
                {isDevolucion ? '−' : ''}
                {formatPrice(montoARS)}
              </span>
            </div>
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
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
