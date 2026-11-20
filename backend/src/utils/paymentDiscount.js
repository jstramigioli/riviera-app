/**
 * Descuentos por medio de pago.
 *
 * Base del %: sobre la deuda cancelada (crédito a folio).
 * - Parcial: usuario ingresa dinero recibido X → crédito = X / (1 − p), D = crédito − X
 * - Total: cancela saldo S → dinero a pedir = S * (1 − p), D = S * p
 * - No se recorta D solo para evitar A_FAVOR (decisión PGH-135).
 */

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function rateFromPercent(percent) {
  const p = toNumber(percent);
  if (p <= 0) return 0;
  if (p >= 100) return 0.9999; // evitar división por cero; config inválida
  return p / 100;
}

/**
 * Preview / cálculo desde dinero recibido (parcial o monto libre).
 * @returns {{ aplica: boolean, dineroARS: number, descuentoARS: number, creditoARS: number, porcentaje: number|null, motivoNoAplica?: string }}
 */
function computeDiscountFromReceived({
  dineroARS,
  config,
  motivo = 'Pago',
  saldoPendiente = null
} = {}) {
  const dinero = roundMoney(Math.abs(toNumber(dineroARS)));
  if (dinero <= 0) {
    return {
      aplica: false,
      dineroARS: 0,
      descuentoARS: 0,
      creditoARS: 0,
      porcentaje: null,
      motivoNoAplica: 'monto_invalido'
    };
  }

  if (!config || !config.descuentoActivo) {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje: null,
      motivoNoAplica: 'descuento_inactivo'
    };
  }

  if (motivo === 'Seña' && config.aplicaEnSeña === false) {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje: null,
      motivoNoAplica: 'no_aplica_sena'
    };
  }

  const tipo = config.descuentoTipo || 'PERCENT';

  if (tipo === 'FIXED') {
    const fijo = roundMoney(toNumber(config.descuentoValor));
    if (fijo <= 0) {
      return {
        aplica: false,
        dineroARS: dinero,
        descuentoARS: 0,
        creditoARS: dinero,
        porcentaje: null,
        motivoNoAplica: 'valor_cero'
      };
    }
    if (config.aplicaEnParcial === false && saldoPendiente != null) {
      const creditoTentativo = roundMoney(dinero + fijo);
      if (creditoTentativo + 0.005 < toNumber(saldoPendiente)) {
        return {
          aplica: false,
          dineroARS: dinero,
          descuentoARS: 0,
          creditoARS: dinero,
          porcentaje: null,
          motivoNoAplica: 'solo_pago_total'
        };
      }
    }
    return {
      aplica: true,
      dineroARS: dinero,
      descuentoARS: fijo,
      creditoARS: roundMoney(dinero + fijo),
      porcentaje: null,
      valorFijo: fijo
    };
  }

  if (tipo !== 'PERCENT') {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje: null,
      motivoNoAplica: 'tipo_no_soportado'
    };
  }

  const porcentaje = toNumber(config.descuentoValor);
  const rate = rateFromPercent(porcentaje);
  if (rate <= 0) {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje,
      motivoNoAplica: 'valor_cero'
    };
  }

  const credito = roundMoney(dinero / (1 - rate));
  const descuento = roundMoney(credito - dinero);

  // Si aplicaEnParcial=false: solo cuando el crédito salda (o supera) el saldo pendiente.
  if (config.aplicaEnParcial === false && saldoPendiente != null) {
    const saldo = toNumber(saldoPendiente);
    if (credito + 0.005 < saldo) {
      return {
        aplica: false,
        dineroARS: dinero,
        descuentoARS: 0,
        creditoARS: dinero,
        porcentaje,
        motivoNoAplica: 'solo_pago_total'
      };
    }
  }

  return {
    aplica: descuento > 0,
    dineroARS: dinero,
    descuentoARS: descuento,
    creditoARS: credito,
    porcentaje
  };
}

/**
 * Dinero a pedir para saldar un saldo con descuento % sobre deuda cancelada.
 */
function computeCashToSettle({
  saldoPendiente,
  config,
  motivo = 'Pago'
} = {}) {
  const saldo = roundMoney(toNumber(saldoPendiente));
  if (saldo <= 0) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: Math.max(0, saldo),
      descuentoARS: 0,
      creditoARS: Math.max(0, saldo),
      porcentaje: null,
      motivoNoAplica: 'sin_saldo'
    };
  }

  if (!config || !config.descuentoActivo) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: saldo,
      descuentoARS: 0,
      creditoARS: saldo,
      porcentaje: null,
      motivoNoAplica: 'descuento_inactivo'
    };
  }

  if (motivo === 'Seña' && config.aplicaEnSeña === false) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: saldo,
      descuentoARS: 0,
      creditoARS: saldo,
      porcentaje: null,
      motivoNoAplica: 'no_aplica_sena'
    };
  }

  const tipo = config.descuentoTipo || 'PERCENT';

  if (tipo === 'FIXED') {
    const fijo = roundMoney(Math.min(toNumber(config.descuentoValor), saldo));
    if (fijo <= 0) {
      return {
        aplica: false,
        saldoARS: saldo,
        dineroARS: saldo,
        descuentoARS: 0,
        creditoARS: saldo,
        porcentaje: null,
        motivoNoAplica: 'valor_cero'
      };
    }
    return {
      aplica: true,
      saldoARS: saldo,
      dineroARS: roundMoney(saldo - fijo),
      descuentoARS: fijo,
      creditoARS: saldo,
      porcentaje: null,
      valorFijo: fijo
    };
  }

  if (tipo !== 'PERCENT') {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: saldo,
      descuentoARS: 0,
      creditoARS: saldo,
      porcentaje: null,
      motivoNoAplica: 'tipo_no_soportado'
    };
  }

  const porcentaje = toNumber(config.descuentoValor);
  const rate = rateFromPercent(porcentaje);
  if (rate <= 0) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: saldo,
      descuentoARS: 0,
      creditoARS: saldo,
      porcentaje,
      motivoNoAplica: 'valor_cero'
    };
  }

  const dinero = roundMoney(saldo * (1 - rate));
  const descuento = roundMoney(saldo - dinero);

  return {
    aplica: descuento > 0,
    saldoARS: saldo,
    dineroARS: dinero,
    descuentoARS: descuento,
    creditoARS: saldo,
    porcentaje
  };
}

/**
 * Reversión proporcional del descuento original al devolver parte/todo del pago.
 */
function computeDiscountReversal({
  originalDiscountARS,
  originalPagoARS,
  devolucionARS
} = {}) {
  const originalD = Math.abs(toNumber(originalDiscountARS));
  const originalP = Math.abs(toNumber(originalPagoARS));
  const dev = Math.abs(toNumber(devolucionARS));
  if (originalD <= 0 || originalP <= 0 || dev <= 0) {
    return { descuentoRevertidoARS: 0 };
  }
  const ratio = Math.min(1, dev / originalP);
  return { descuentoRevertidoARS: roundMoney(originalD * ratio) };
}

module.exports = {
  toNumber,
  roundMoney,
  rateFromPercent,
  computeDiscountFromReceived,
  computeCashToSettle,
  computeDiscountReversal
};
