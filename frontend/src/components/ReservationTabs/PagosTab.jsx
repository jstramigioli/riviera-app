import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import PaymentForm from '../PaymentForm';
import styles from './ReservationTabs.module.css';

const PagosTab = ({ 
  reservation,
  pagos,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onAddPago,
  onDeletePago
}) => {
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    // Recargar datos financieros
    window.location.reload(); // Simple reload para actualizar los datos
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>💳 Pagos</h3>
        <button 
          className={styles.addButton}
          onClick={() => setShowPaymentForm(true)}
        >
          <FaPlus /> Agregar Pago
        </button>
      </div>

      {loadingFinancial ? (
        <div className={styles.loading}>Cargando pagos...</div>
      ) : (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Abonado</div>
              <div className={styles.summaryValue}>
                {formatCurrency(financialSummary?.resumen.totalPagos || 0)}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Saldo Restante</div>
              <div className={`${styles.summaryValue} ${styles.saldo}`}>
                {formatCurrency(financialSummary?.resumen.saldo || 0)}
              </div>
            </div>
          </div>

          {pagos.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay pagos registrados</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Método</th>
                    <th>Detalles</th>
                    <th>Referencia</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(pago => (
                    <tr key={pago.id}>
                      <td>{formatDate(pago.fecha)}</td>
                      <td className={styles.montoCell}>
                        {pago.moneda === 'USD' 
                          ? `$${parseFloat(pago.monto).toFixed(2)} USD`
                          : formatCurrency(parseFloat(pago.monto))
                        }
                        {pago.moneda === 'USD' && pago.montoARS && (
                          <div className={styles.arsEquivalent}>
                            ≈ {formatCurrency(parseFloat(pago.montoARS))}
                          </div>
                        )}
                      </td>
                      <td>{pago.moneda || 'ARS'}</td>
                      <td>{pago.metodo}</td>
                      <td>
                        {['Tarjeta Debito', 'Tarjeta Credito'].includes(pago.metodo) && (
                          <div className={styles.cardDetails}>
                            <div>{pago.metodo}</div>
                            <div>{pago.empresa}</div>
                            {pago.numeroTarjeta && (
                              <div className={styles.cardNumber}>
                                ****{pago.numeroTarjeta.slice(-4)}
                              </div>
                            )}
                          </div>
                        )}
                        {!['Tarjeta Debito', 'Tarjeta Credito'].includes(pago.metodo) && '-'}
                      </td>
                      <td>{pago.referencia || '-'}</td>
                      <td className={styles.notasCell}>{pago.notas || '-'}</td>
                      <td>
                        <button
                          className={styles.deleteIconButton}
                          onClick={() => onDeletePago(pago.id)}
                          title="Eliminar pago"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Botón para agregar pago - siempre visible */}
          <div className={styles.addPaymentSection}>
            <button 
              className={styles.addPaymentButton}
              onClick={() => setShowPaymentForm(true)}
            >
              <FaPlus /> Agregar Pago
            </button>
          </div>
        </>
      )}

      {/* Modal de formulario de pagos mejorado */}
      {showPaymentForm && (
        <PaymentForm
          reservaId={reservation.id}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default PagosTab;


