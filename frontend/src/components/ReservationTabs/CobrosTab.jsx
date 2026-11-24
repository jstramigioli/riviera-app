import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import CobroForm from '../CobroForm';
import { formatMoneyArs, formatMoneyUsd } from '../../utils/formatMoney';
import styles from './ReservationTabs.module.css';

const CobrosTab = ({ 
  reservation,
  cobros,
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency = formatMoneyArs,
  onAddCobro,
  onDeleteCobro
}) => {
  const [showCobroForm, setShowCobroForm] = useState(false);

  const handlePaymentSuccess = () => {
    setShowCobroForm(false);
    // Recargar datos financieros
    window.location.reload(); // Simple reload para actualizar los datos
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}> Cobros</h3>
        <button 
          className={styles.addButton}
          onClick={() => setShowCobroForm(true)}
        >
          <FaPlus /> Agregar Cobro
        </button>
      </div>

      {loadingFinancial ? (
        <div className={styles.loading}> Cargando cobros...</div>
      ) : (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}> Total Abonado</div>
              <div className={styles.summaryValue}>
                {formatCurrency(financialSummary?.resumen.totalCobros || 0)}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}> Saldo Restante</div>
              <div className={`${styles.summaryValue} ${styles.saldo}`}>
                {formatCurrency(financialSummary?.resumen.saldo || 0)}
              </div>
            </div>
          </div>

          {cobros.length === 0 ? (
            <div className={styles.emptyState}>
              <p> No hay cobros registrados</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th> Fecha</th>
                    <th className={styles.montoCell}> Monto</th>
                    <th className={styles.shortCell}> Moneda</th>
                    <th> Método</th>
                    <th> Detalles</th>
                    <th> Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cobros.map(cobro => (
                    <tr key={cobro.id}>
                      <td>{formatDate(cobro.fecha)}</td>
                      <td className={styles.montoCell}>
                        {cobro.moneda === 'USD' 
                          ? formatMoneyUsd(cobro.monto)
                          : formatCurrency(parseFloat(cobro.monto))
                        }
                        {cobro.moneda === 'USD' && cobro.montoARS && (
                          <div className={styles.arsEquivalent}>
                            ≈ {formatCurrency(parseFloat(cobro.montoARS))}
                          </div>
                        )}
                      </td>
                      <td className={styles.shortCell}>{cobro.moneda || 'ARS'}</td>
                      <td>{cobro.metodo}</td>
                      <td>
                        {['Tarjeta Debito', 'Tarjeta Credito'].includes(cobro.metodo) && (
                          <div className={styles.cardDetails}>
                            <div>{cobro.metodo}</div>
                            <div>{cobro.empresa}</div>
                            {cobro.numeroTarjeta && (
                              <div className={styles.cardNumber}>
                                ****{cobro.numeroTarjeta.slice(-4)}
                              </div>
                            )}
                          </div>
                        )}
                        {!['Tarjeta Debito', 'Tarjeta Credito'].includes(cobro.metodo) && '-'}
                      </td>
                      <td>
                        <button
                          className={styles.deleteIconButton}
                          onClick={() => onDeleteCobro(cobro.id)}
                          title="Eliminar cobro"
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

          {/* Botón para agregar cobro - siempre visible */}
          <div className={styles.addPaymentSection}>
            <button 
              className={styles.addPaymentButton}
              onClick={() => setShowCobroForm(true)}
            >
              <FaPlus /> Agregar Cobro
            </button>
          </div>
        </>
      )}

      {/* Modal de formulario de cobros mejorado */}
      {showCobroForm && (
        <CobroForm
          reservaId={reservation.id}
          onClose={() => setShowCobroForm(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default CobrosTab;


