import React, { forwardRef } from 'react';
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

const LiquidacionPrint = forwardRef(function LiquidacionPrint(
  { reservation, financialSummary, formatDate, formatCurrency, hotelName = 'Hotel Riviera' },
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
  const pagoItems = financialSummary?.pagos?.items || [];
  const cargosPorTipo = financialSummary?.cargos?.porTipo || {};
  const totalCargos = Number(financialSummary?.resumen?.totalCargos) || 0;
  const totalPagos = Number(financialSummary?.resumen?.totalPagos) || 0;
  const saldo = totalCargos - totalPagos;
  const emittedAt = new Date();

  const tipoOrder = ['ALOJAMIENTO', 'CONSUMO', 'SERVICIO', 'OTRO'];
  const tiposOrdenados = [
    ...tipoOrder.filter((c) => cargosPorTipo[c]),
    ...Object.keys(cargosPorTipo).filter((c) => !tipoOrder.includes(c))
  ];

  return (
    <div ref={ref} className={styles.sheet} data-testid="liquidacion-print">
      <header className={styles.header}>
        <div>
          <h1 className={styles.hotelName}>{hotelName}</h1>
          <p className={styles.docTitle}>Liquidación de estadía</p>
        </div>
        <div className={styles.meta}>
          <div><span>Reserva</span><strong>#{reservation.id}</strong></div>
          <div><span>Emitido</span><strong>{formatDate(emittedAt.toISOString())}</strong></div>
        </div>
      </header>

      <section className={styles.block}>
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
        </div>
      </section>

      <section className={styles.block}>
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

      <section className={styles.block}>
        <h2>Cargos</h2>
        {tiposOrdenados.length > 0 ? (
          tiposOrdenados.map((codigo) => {
            const tipo = cargosPorTipo[codigo];
            return (
              <div key={codigo} className={styles.chargeGroup}>
                <div className={styles.groupHead}>
                  <span>{tipo.nombre}</span>
                  <strong>{formatCurrency(tipo.total)}</strong>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th className={styles.num}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tipo.items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.fecha)}</td>
                        <td>
                          {item.descripcion || 'Cargo'}
                          {item.manualOverride ? ' *' : ''}
                        </td>
                        <td className={styles.num}>{formatCurrency(item.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        ) : cargoItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th className={styles.num}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {cargoItems.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.fecha)}</td>
                  <td>{item.descripcion || 'Cargo'}{item.manualOverride ? ' *' : ''}</td>
                  <td className={styles.num}>{formatCurrency(item.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Sin cargos registrados.</p>
        )}
        <div className={styles.subtotal}>
          <span>Total cargos</span>
          <strong>{formatCurrency(totalCargos)}</strong>
        </div>
        {cargoItems.some((c) => c.manualOverride) && (
          <p className={styles.footnote}>* Valor asignado manualmente</p>
        )}
      </section>

      <section className={styles.block}>
        <h2>Pagos</h2>
        {pagoItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th className={styles.num}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagoItems.map((pago) => (
                <tr key={pago.id}>
                  <td>{formatDate(pago.fecha)}</td>
                  <td>{pago.metodo || 'Pago'}</td>
                  <td className={styles.num}>{formatCurrency(pago.montoARS ?? pago.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Sin pagos registrados.</p>
        )}
        <div className={styles.subtotal}>
          <span>Total pagos</span>
          <strong>{formatCurrency(totalPagos)}</strong>
        </div>
      </section>

      <section className={`${styles.block} ${styles.saldoBlock}`}>
        <div className={styles.saldoRow}>
          <span>Saldo</span>
          <strong>{formatCurrency(saldo)}</strong>
        </div>
        <p className={styles.saldoState}>
          {saldo > 0 && 'Pendiente de pago'}
          {saldo === 0 && 'Pagado completamente'}
          {saldo < 0 && 'Saldo a favor'}
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.signLine}>
          <span>Firma del huésped</span>
        </div>
        <div className={styles.signLine}>
          <span>Firma recepción</span>
        </div>
      </footer>
    </div>
  );
});

export default LiquidacionPrint;
