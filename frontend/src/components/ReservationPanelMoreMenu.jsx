import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMoreVertical } from 'react-icons/fi';
import styles from './ReservationPanelMoreMenu.module.css';

export const FINANCIAL_ACTIONS = {
  ADD_CONSUMO: 'add-consumo',
  PRINT_LIQUIDACION: 'print-liquidacion',
  ADD_PAGO: 'add-pago'
};

const MENU_ITEMS = [
  { id: FINANCIAL_ACTIONS.ADD_CONSUMO, label: 'Agregar consumo' },
  { id: FINANCIAL_ACTIONS.PRINT_LIQUIDACION, label: 'Imprimir liquidación' },
  { id: FINANCIAL_ACTIONS.ADD_PAGO, label: 'Agregar pago' }
];

/**
 * Kebab (⋮) al lado del dropdown de estado en el panel del Libro.
 * "Agregar consumo" abre la comanda POS si hay onAddConsumo; el resto navega a la página financiera.
 */
const ReservationPanelMoreMenu = ({ reservation, onAddConsumo }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!reservation?.id) return null;

  const handleAction = (financialAction) => {
    setOpen(false);
    if (financialAction === FINANCIAL_ACTIONS.ADD_CONSUMO && typeof onAddConsumo === 'function') {
      onAddConsumo(reservation);
      return;
    }
    navigate(`/reservations/${reservation.id}`, {
      state: {
        activeTab: 'financiero',
        financialAction
      }
    });
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más acciones de la reserva"
        title="Más acciones"
        data-testid="reservation-panel-more-menu"
      >
        <FiMoreVertical aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.item}
              data-testid={`panel-action-${item.id}`}
              onClick={() => handleAction(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationPanelMoreMenu;
