import { useNavigate } from 'react-router-dom';
import { FiDollarSign, FiPlus, FiPrinter } from 'react-icons/fi';
import styles from './ReservationPanelActions.module.css';

const FINANCIAL_ACTIONS = {
  ADD_CONSUMO: 'add-consumo',
  PRINT_LIQUIDACION: 'print-liquidacion',
  ADD_COBRO: 'add-cobro'
};

const ACTIONS = [
  { id: FINANCIAL_ACTIONS.ADD_CONSUMO, label: 'Comanda', title: 'Nueva comanda', Icon: FiPlus },
  { id: FINANCIAL_ACTIONS.ADD_COBRO, label: 'Cobro', title: 'Agregar cobro', Icon: FiDollarSign },
  { id: FINANCIAL_ACTIONS.PRINT_LIQUIDACION, label: 'Liquidación', title: 'Imprimir liquidación', Icon: FiPrinter }
];

/**
 * Acciones del panel de reserva del Libro, siempre visibles al pie.
 * «Consumo» abre la comanda si hay onAddConsumo; el resto va a la pestaña financiera.
 */
export default function ReservationPanelActions({ reservation, onAddConsumo }) {
  const navigate = useNavigate();
  if (!reservation?.id) return null;

  const handleAction = (financialAction) => {
    if (financialAction === FINANCIAL_ACTIONS.ADD_CONSUMO && typeof onAddConsumo === 'function') {
      onAddConsumo(reservation);
      return;
    }
    navigate(`/reservations/${reservation.id}`, {
      state: { activeTab: 'financiero', financialAction }
    });
  };

  return (
    <div className={styles.root}>
      {ACTIONS.map((action) => {
        const { id, label, title, Icon } = action;
        return (
          <button
            key={id}
            type="button"
            className={styles.action}
            title={title}
            data-testid={`panel-action-${id}`}
            onClick={() => handleAction(id)}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
