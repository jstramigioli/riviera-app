import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDollarSign, FiSave, FiX } from 'react-icons/fi';
import {
  createPago,
  fetchOccupiedRoomsToday,
  fetchReservation,
  getClientBillingProfile,
  getTipoCambioActual
} from '../services/api';
import {
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  emptyBillingForm,
  isCardMethod,
  methodRequiresBilling,
  todayLocalDateTimeInputValue
} from '../constants/billing';
import styles from './PaymentForm.module.css';

function reservationOptionLabel(row) {
  if (row.label) return row.label;
  const room = row.roomName || 'Hab.';
  const apellido = row.clientLastName || (row.clientName || '').split(/\s+/).pop() || 'Sin apellido';
  return `${room} - ${apellido}`;
}

const PaymentForm = ({ reservaId: reservaIdProp = null, onClose, onSuccess }) => {
  const needsReservationPick = reservaIdProp == null;
  const [occupied, setOccupied] = useState([]);
  const [pickedReservationId, setPickedReservationId] = useState('');
  const [clientId, setClientId] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const reservaId = needsReservationPick
    ? (pickedReservationId ? Number(pickedReservationId) : null)
    : Number(reservaIdProp);

  const [formData, setFormData] = useState({
    monto: '',
    moneda: 'ARS',
    tipoCambio: '',
    metodo: 'Efectivo',
    numeroTarjeta: '',
    empresa: '',
    referencia: '',
    notas: ''
  });

  const billingForced = methodRequiresBilling(formData.metodo);
  const [requiereFacturacion, setRequiereFacturacion] = useState(false);
  const billingEnabled = billingForced || requiereFacturacion;
  const [billing, setBilling] = useState(() => emptyBillingForm());

  const [tipoCambioGlobal, setTipoCambioGlobal] = useState(null);
  const [montoARS, setMontoARS] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const showInvoiceCardField = billingEnabled && !isCardMethod(formData.metodo);

  const applyBillingPrefill = useCallback(async (cid) => {
    if (!cid) return;
    try {
      const profile = await getClientBillingProfile(cid);
      setBilling((prev) =>
        emptyBillingForm({
          ...prev,
          tipo: profile.lastInvoiceType === 'A' ? 'A' : 'B',
          fecha: todayLocalDateTimeInputValue(),
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
    calculateMontoARS();
  }, [formData.monto, formData.moneda, formData.tipoCambio]);

  useEffect(() => {
    if (billingForced) {
      setRequiereFacturacion(true);
    }
  }, [billingForced]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoadingMeta(true);
      setError(null);
      try {
        if (needsReservationPick) {
          const roomsRes = await fetchOccupiedRoomsToday();
          const list = roomsRes.data || roomsRes || [];
          if (!cancelled) setOccupied(list);
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
  }, [needsReservationPick, reservaIdProp, applyBillingPrefill]);

  useEffect(() => {
    if (!needsReservationPick || !pickedReservationId) return;
    const row = occupied.find((r) => String(r.reservationId) === String(pickedReservationId));
    const cid = row?.clientId || null;
    setClientId(cid);
    if (cid) applyBillingPrefill(cid);
  }, [needsReservationPick, pickedReservationId, occupied, applyBillingPrefill]);

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
    if (field === 'metodo' && !isCardMethod(value)) {
      setFormData((prev) => ({
        ...prev,
        metodo: value,
        numeroTarjeta: '',
        empresa: ''
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBillingChange = (field, value) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const occupiedOptions = useMemo(() => {
    const byReservation = new Map();
    for (const row of occupied) {
      const key = String(row.reservationId);
      if (!byReservation.has(key)) byReservation.set(key, row);
    }
    return Array.from(byReservation.values());
  }, [occupied]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reservaId) {
      setError('Seleccioná una reserva');
      return;
    }

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      setError('El monto debe ser mayor a 0');
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
      if (!billing.fecha) {
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
            fecha: new Date(billing.fecha).toISOString(),
            motivo: billing.motivo || null,
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

      const pagoData = {
        monto: parseFloat(formData.monto),
        moneda: formData.moneda,
        tipoCambio: formData.moneda === 'USD' ? parseFloat(formData.tipoCambio) : undefined,
        metodo: formData.metodo,
        numeroTarjeta: isCardMethod(formData.metodo) ? formData.numeroTarjeta : undefined,
        empresa: isCardMethod(formData.metodo) ? formData.empresa : undefined,
        referencia: formData.referencia || null,
        notas: formData.notas || null,
        fecha: new Date().toISOString(),
        requiereFacturacion: billingEnabled,
        factura: facturaPayload
      };

      const nuevoPago = await createPago(reservaId, pagoData);
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
            <FiDollarSign />
            Nuevo pago
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

        <form onSubmit={handleSubmit} className={styles.form}>
          {needsReservationPick && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="payment-reservation">Reserva *</label>
                <select
                  id="payment-reservation"
                  value={pickedReservationId}
                  onChange={(e) => setPickedReservationId(e.target.value)}
                  required
                  disabled={loadingMeta || loading}
                >
                  <option value="">
                    {loadingMeta ? 'Cargando…' : 'Seleccionar habitación / huésped…'}
                  </option>
                  {occupiedOptions.map((row) => (
                    <option key={row.reservationId} value={row.reservationId}>
                      {reservationOptionLabel(row)}
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
              <label htmlFor="payment-metodo">Método de pago *</label>
              <select
                id="payment-metodo"
                value={formData.metodo}
                onChange={(e) => handleInputChange('metodo', e.target.value)}
                required
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta Debito">Tarjeta Débito</option>
                <option value="Tarjeta Credito">Tarjeta Crédito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercadopago">Mercadopago</option>
                <option value="Cuenta DNI">Cuenta DNI</option>
                <option value="Cheque">Cheque</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="payment-ref">Referencia</label>
              <input
                id="payment-ref"
                type="text"
                value={formData.referencia}
                onChange={(e) => handleInputChange('referencia', e.target.value)}
                placeholder="Número de comprobante, referencia bancaria, etc."
              />
            </div>
          </div>

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
                  <label htmlFor="billing-fecha">Fecha *</label>
                  <input
                    id="billing-fecha"
                    type="datetime-local"
                    value={billing.fecha}
                    onChange={(e) => handleBillingChange('fecha', e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="billing-motivo">Motivo</label>
                  <input
                    id="billing-motivo"
                    type="text"
                    value={billing.motivo}
                    onChange={(e) => handleBillingChange('motivo', e.target.value)}
                    placeholder="Concepto / motivo"
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

              {clientId == null && needsReservationPick && (
                <p className={styles.helpText}>
                  Elegí una reserva para prellenar datos del cliente.
                </p>
              )}
            </div>
          )}

          <div className={styles.paymentSummary}>
            <h3>Resumen del pago</h3>
            <div className={styles.summaryRow}>
              <span>Monto original:</span>
              <span className={styles.amount}>
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
              <span className={styles.amountARS}>{formatPrice(montoARS)}</span>
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
              {loading ? 'Guardando...' : 'Guardar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
