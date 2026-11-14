/** Preview de descuento por medio (misma fórmula que backend). */

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function rateFromPercent(percent) {
  const p = toNumber(percent);
  if (p <= 0) return 0;
  if (p >= 100) return 0.9999;
  return p / 100;
}

export function computeDiscountFromReceived({
  dineroARS,
  config,
  motivo = 'Pago',
  saldoPendiente = null
} = {}) {
  const dinero = roundMoney(Math.abs(toNumber(dineroARS)));
  if (dinero <= 0 || !config?.descuentoActivo) {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje: config?.descuentoValor != null ? toNumber(config.descuentoValor) : null
    };
  }
  if (motivo === 'Seña' && config.aplicaEnSeña === false) {
    return {
      aplica: false,
      dineroARS: dinero,
      descuentoARS: 0,
      creditoARS: dinero,
      porcentaje: toNumber(config.descuentoValor),
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
        porcentaje: null
      };
    }
    if (config.aplicaEnParcial === false && saldoPendiente != null) {
      if (roundMoney(dinero + fijo) + 0.005 < toNumber(saldoPendiente)) {
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
      porcentaje
    };
  }
  const credito = roundMoney(dinero / (1 - rate));
  const descuento = roundMoney(credito - dinero);
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

export function computeCashToSettle({ saldoPendiente, config, motivo = 'Pago' } = {}) {
  const saldo = roundMoney(toNumber(saldoPendiente));
  if (saldo <= 0 || !config?.descuentoActivo) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: Math.max(0, saldo),
      descuentoARS: 0,
      creditoARS: Math.max(0, saldo),
      porcentaje: config?.descuentoValor != null ? toNumber(config.descuentoValor) : null
    };
  }
  if (motivo === 'Seña' && config.aplicaEnSeña === false) {
    return {
      aplica: false,
      saldoARS: saldo,
      dineroARS: saldo,
      descuentoARS: 0,
      creditoARS: saldo,
      porcentaje: toNumber(config.descuentoValor),
      motivoNoAplica: 'no_aplica_sena'
    };
  }

  const tipo = config.descuentoTipo || 'PERCENT';
  if (tipo === 'FIXED') {
    const fijo = roundMoney(Math.min(toNumber(config.descuentoValor), saldo));
    return {
      aplica: fijo > 0,
      saldoARS: saldo,
      dineroARS: roundMoney(saldo - fijo),
      descuentoARS: fijo,
      creditoARS: saldo,
      porcentaje: null,
      valorFijo: fijo
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
      porcentaje
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

export function formatArs(value) {
  return roundMoney(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
