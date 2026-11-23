import React, { forwardRef } from 'react';
import { todayAsLocalDate } from '../../utils/calendarDates';
import { formatMoney, formatMoneyArs } from '../../utils/formatMoney';
import styles from './LiquidacionPrint.module.css';

const civilNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = String(checkIn).slice(0, 10);
  const end = String(checkOut).slice(0, 10);
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (![ys, ms, ds, ye, me, de].every(Number.isFinite)) return 0;
  const msDiff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.max(0, Math.round(msDiff / 86400000));
};

const TIPO_ORDER = ['ALOJAMIENTO', 'CONSUMO', 'SERVICIO', 'OTRO'];

const pagoDetalle = (cobro) => {
  const parts = [];
  if (cobro.empresa) parts.push(cobro.empresa);
  if (cobro.tipoTarjeta) parts.push(cobro.tipoTarjeta);
  if (cobro.numeroTarjeta) parts.push(`****${String(cobro.numeroTarjeta).slice(-4)}`);
  if (cobro.moneda && cobro.moneda !== 'ARS') {
    const original = Number(cobro.monto);
    const tc = Number(cobro.tipoCambio);
    const originalLabel = Number.isFinite(original)
      ? formatMoney(original, cobro.moneda)
      : cobro.moneda;
    parts.push(originalLabel);
    if (Number.isFinite(tc) && tc > 0) parts.push(`TC ${tc}`);
  }
  return parts.join(' · ') || '—';
};

const LiquidacionPrint = forwardRef(function LiquidacionPrint(
  { reservation, financialSummary, formatDate, formatCurrency = formatMoneyArs, hotelName = 'Hotel Riviera' },
  ref
) {
  if (!reservation || !financialSummary) return null;

  const client = reservation.mainClient || {};
  const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ')
    || client.name
    || 'Huésped';
  const checkIn = reservation.checkIn || reservation.segments?.[0]?.startDate;
  const checkOut = reservation.checkOut || reservation.segments?.[reservation.segments?.length - 1]?.endDate;
  const nights = Number(reservation.days) > 0
    ? Number(reservation.days)
    : civilNights(checkIn, checkOut);
  const activeSegment = reservation?.segments?.find((s) => s.isActive !== false)
    || reservation?.segments?.[0];
  const roomLabel = activeSegment?.room?.name
    || activeSegment?.roomType?.name
    || '—';

  const cargoItems = financialSummary?.cargos?.items || [];
  const pagoItems = financialSummary?.cobros?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const totalCargos = Number(financialSummary?.resumen?.totalCargos) || 0;
  const totalCobros = Number(financialSummary?.resumen?.totalCobros) || 0;
  const totalDescuentos = Number(financialSummary?.resumen?.totalDescuentos) || 0;
  const descuentoItems = financialSummary?.descuentos?.items || [];
  const saldo =
    financialSummary?.resumen?.saldo != null
      ? Number(financialSummary.resumen.saldo)
      : totalCargos - totalCobros - totalDescuentos;
  const emittedAt = todayAsLocalDate();

  const tiposOrdenados = [
    ...TIPO_ORDER.filter((c) => cargosPorTipo[c]),
    ...Object.keys(cargosPorTipo).filter((c) => !TIPO_ORDER.includes(c))
  ];

  const hasAnyCargo = tiposOrdenados.length > 0 || cargoItems.length > 0;

  const renderCargoResumen = () => {
    if (tiposOrdenados.length === 0) {
      if (cargoItems.length === 0) {
        return <p className={styles.empty}>Sin cargos registrados.</p>;
      }
      const fallbackTotal = cargoItems.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
      return (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Concepto</th>
              <th className={styles.num}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cargos</td>
              <td className={styles.num}>{formatCurrency(fallbackTotal)}</td>
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <table className={`${styles.table} ${styles.summaryTable}`}>
        <thead>
          <tr>
            <th>Concepto</th>
            <th className={styles.num}>Total</th>
          </tr>
        </thead>
        <tbody>
          {tiposOrdenados.map((codigo) => {
            const tipo = cargosPorTipo[codigo];
            if (codigo === 'ALOJAMIENTO') {
              return (
                <tr key={codigo} className={styles.summaryMain}>
                  <td>Alojamiento</td>
                  <td className={styles.num}>{formatCurrency(tipo.total)}</td>
                </tr>
              );
            }

            const subcats = Object.values(tipo.subcategorias || {})
              .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

            if (subcats.length === 0) {
              return (
                <tr key={codigo} className={styles.summaryMain}>
                  <td>{tipo.nombre}</td>
                  <td className={styles.num}>{formatCurrency(tipo.total)}</td>
                </tr>
              );
            }

            return (
              <React.Fragment key={codigo}>
                <tr className={styles.summaryGroup}>
                  <td colSpan={2}>{tipo.nombre}</td>
                </tr>
                {subcats.map((sub) => (
                  <tr key={`${codigo}-${sub.nombre}`} className={styles.summaryItem}>
                    <td>{sub.nombre}</td>
                    <td className={styles.num}>{formatCurrency(sub.total)}</td>
                  </tr>
                ))}
                {subcats.length > 1 && (
                  <tr className={styles.summarySubtotal}>
                    <td>Subtotal {tipo.nombre.toLowerCase()}</td>
                    <td className={styles.num}>{formatCurrency(tipo.total)}</td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div ref={ref} className={styles.sheet} data-testid="liquidacion-print">
      <header className={`${styles.header} ${styles.keepTogether}`}>
        <div className={styles.brandBlock}>
          <img
            className={styles.logo}
            src="/riviera-hotel-logo.png"
            alt={hotelName}
            width={740}
            height={410}
          />
          <p className={styles.docTitle}>Liquidación de estadía</p>
        </div>
        <div className={styles.meta}>
          <div><span>Reserva</span><strong>#{reservation.id}</strong></div>
          <div><span>Emitido</span><strong>{formatDate(emittedAt.toISOString())}</strong></div>
        </div>
      </header>

      <section className={`${styles.block} ${styles.keepTogether}`}>
        <h2>Huésped</h2>
        <div className={styles.grid2}>
          <div>
            <span className={styles.label}>Nombre</span>
            <strong>{clientName}</strong>
          </div>
          <div>
            <span className={styles.label}>Documento</span>
            <strong>
              {[client.documentType, client.documentNumber].filter(Boolean).join(' ') || '—'}
            </strong>
          </div>
          <div>
            <span className={styles.label}>Teléfono</span>
            <strong>{client.phone || '—'}</strong>
          </div>
          <div>
            <span className={styles.label}>Email</span>
            <strong>{client.email || '—'}</strong>
          </div>
          <div>
            <span className={styles.label}>Nacimiento</span>
            <strong>
              {client.birthDate
                ? new Date(client.birthDate).toLocaleDateString('es-AR')
                : '—'}
            </strong>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.keepTogether}`}>
        <h2>Estadía</h2>
        <div className={styles.grid2}>
          <div>
            <span className={styles.label}>Check-in</span>
            <strong>{formatDate(checkIn)}</strong>
          </div>
          <div>
            <span className={styles.label}>Check-out</span>
            <strong>{formatDate(checkOut)}</strong>
          </div>
          <div>
            <span className={styles.label}>Noches</span>
            <strong>{nights}</strong>
          </div>
          <div>
            <span className={styles.label}>Habitación</span>
            <strong>{roomLabel}</strong>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${styles.cargosBlock}`}>
        <h2>Cargos</h2>
        {renderCargoResumen()}
        {hasAnyCargo && (
          <div className={styles.subtotal}>
            <span>Total cargos</span>
            <strong>{formatCurrency(totalCargos)}</strong>
          </div>
        )}
      </section>

      <section className={`${styles.block} ${styles.cobrosBlock}`}>
        <h2>Cobros</h2>
        {pagoItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th>Detalle</th>
                <th className={styles.num}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagoItems.map((cobro) => (
                <tr key={cobro.id}>
                  <td>{formatDate(cobro.fecha)}</td>
                  <td>{cobro.metodo || 'Cobro'}</td>
                  <td className={styles.pagoDetalle}>{pagoDetalle(cobro)}</td>
                  <td className={styles.num}>{formatCurrency(cobro.montoARS ?? cobro.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Sin cobros registrados.</p>
        )}
        <div className={styles.subtotal}>
          <span>Total cobros</span>
          <strong>{formatCurrency(totalCobros)}</strong>
        </div>
      </section>

      {(totalDescuentos !== 0 || descuentoItems.length > 0) && (
        <section className={`${styles.block} ${styles.cobrosBlock}`}>
          <h2>Descuentos por medio de pago</h2>
          {descuentoItems.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th className={styles.num}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {descuentoItems.map((d) => (
                  <tr key={d.id}>
                    <td>{d.tipo || 'Descuento'}</td>
                    <td>
                      {d.porcentaje != null ? `${Number(d.porcentaje)}%` : '—'}
                      {d.notas ? ` · ${d.notas}` : ''}
                    </td>
                    <td className={styles.num}>{formatCurrency(d.montoARS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.empty}>Sin descuentos registrados.</p>
          )}
          <div className={styles.subtotal}>
            <span>Total descuentos</span>
            <strong>{formatCurrency(totalDescuentos)}</strong>
          </div>
        </section>
      )}

      <section className={`${styles.closing} ${styles.keepTogether}`}>
        <div className={`${styles.block} ${styles.saldoBlock}`}>
          <div className={styles.saldoRow}>
            <span>Saldo</span>
            <strong>{formatCurrency(saldo)}</strong>
          </div>
          <p className={styles.saldoState}>
            {saldo > 0 && 'Pendiente de cobro'}
            {saldo === 0 && 'Pagado completamente'}
            {saldo < 0 && 'Saldo a favor'}
          </p>
        </div>

        <footer className={styles.footer}>
          <div className={styles.signLine}>
            <span>Firma del huésped</span>
          </div>
          <div className={styles.signLine}>
            <span>Firma recepción</span>
          </div>
        </footer>
      </section>
    </div>
  );
});

export default LiquidacionPrint;
