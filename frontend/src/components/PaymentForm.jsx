import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiSave, FiX, FiInfo } from 'react-icons/fi';
import { createPago, getTipoCambioActual } from '../services/api';
import styles from './PaymentForm.module.css';

const PaymentForm = ({ reservaId, onClose, onSuccess }) => {
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
  
  const [tipoCambioGlobal, setTipoCambioGlobal] = useState(null);
  const [montoARS, setMontoARS] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTipoCambioGlobal();
  }, []);

  useEffect(() => {
    calculateMontoARS();
  }, [formData.monto, formData.moneda, formData.tipoCambio]);

  const loadTipoCambioGlobal = async () => {
    try {
      const response = await getTipoCambioActual();
      if (response.tipoCambio) {
        setTipoCambioGlobal(response.tipoCambio);
        setFormData(prev => ({
          ...prev,
          tipoCambio: response.tipoCambio.toString()
        }));
      }
    } catch (error) {
      console.error('Error cargando tipo de cambio global:', error);
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
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    
    // Limpiar campos de tarjeta cuando se cambia el método de pago
    if (field === 'metodo' && !['Tarjeta Debito', 'Tarjeta Credito'].includes(value)) {
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        numeroTarjeta: '',
        empresa: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    if (formData.moneda === 'USD' && (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0)) {
      setError('Para pagos en USD, el tipo de cambio es requerido');
      return;
    }

    if (['Tarjeta Debito', 'Tarjeta Credito'].includes(formData.metodo)) {
      if (!formData.numeroTarjeta) {
        setError('Debe ingresar el número de tarjeta');
        return;
      }
      if (!formData.empresa) {
        setError('Debe seleccionar la empresa de la tarjeta');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const pagoData = {
        monto: parseFloat(formData.monto),
        moneda: formData.moneda,
        tipoCambio: formData.moneda === 'USD' ? parseFloat(formData.tipoCambio) : undefined,
        metodo: formData.metodo,
        numeroTarjeta: ['Tarjeta Debito', 'Tarjeta Credito'].includes(formData.metodo) ? formData.numeroTarjeta : undefined,
        empresa: ['Tarjeta Debito', 'Tarjeta Credito'].includes(formData.metodo) ? formData.empresa : undefined,
        referencia: formData.referencia || null,
        notas: formData.notas || null,
        fecha: new Date().toISOString().split('T')[0]
      };

      await createPago(reservaId, pagoData);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear el pago');
      console.error('Error creating payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const formatPriceUSD = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>
            <FiDollarSign />
            Nuevo Pago
          </h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Monto *</label>
              <input
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
              <label>Moneda *</label>
              <select
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
                <label>Tipo de Cambio *</label>
                <input
                  type="number"
                  value={formData.tipoCambio}
                  onChange={(e) => handleInputChange('tipoCambio', e.target.value)}
                  placeholder="1000.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Método de Pago *</label>
              <select
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
              <label>Referencia</label>
              <input
                type="text"
                value={formData.referencia}
                onChange={(e) => handleInputChange('referencia', e.target.value)}
                placeholder="Número de comprobante, referencia bancaria, etc."
              />
            </div>
          </div>

          {/* Campos específicos para tarjetas */}
          {['Tarjeta Debito', 'Tarjeta Credito'].includes(formData.metodo) && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Número de Tarjeta *</label>
                <input
                  type="text"
                  value={formData.numeroTarjeta}
                  onChange={(e) => handleInputChange('numeroTarjeta', e.target.value)}
                  placeholder="**** **** **** ****"
                  maxLength="19"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Empresa *</label>
                <select
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
              <label>Notas</label>
              <textarea
                value={formData.notas}
                onChange={(e) => handleInputChange('notas', e.target.value)}
                placeholder="Notas adicionales..."
                rows="3"
              />
            </div>
          </div>

          {/* Resumen del pago */}
          <div className={styles.paymentSummary}>
            <h3>Resumen del Pago</h3>
            <div className={styles.summaryRow}>
              <span>Monto original:</span>
              <span className={styles.amount}>
                {formData.moneda === 'USD' 
                  ? formatPriceUSD(parseFloat(formData.monto) || 0)
                  : formatPrice(parseFloat(formData.monto) || 0)
                }
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
                {formatPrice(montoARS)}
              </span>
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              <FiSave />
              {loading ? 'Guardando...' : 'Guardar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
