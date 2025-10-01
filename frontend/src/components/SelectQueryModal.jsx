import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './SelectQueryModal.module.css';

function SelectQueryModal({ isOpen, onClose, queries, clientName, onSelectQuery, onCreateNew }) {
  if (!isOpen) return null;

  const formatDate = (date) => {
    if (!date) return 'Sin fecha';
    return format(new Date(date), 'dd/MM/yyyy', { locale: es });
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Consultas recientes de {clientName}</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.description}>
            Este cliente tiene {queries.length} {queries.length === 1 ? 'consulta' : 'consultas'} reciente{queries.length !== 1 ? 's' : ''}. 
            Seleccioná una para continuar editándola o creá una nueva:
          </p>

          <div className={styles.queriesList}>
            {queries.map((query) => (
              <div 
                key={query.id} 
                className={styles.queryCard}
                onClick={() => onSelectQuery(query)}
              >
                <div className={styles.queryHeader}>
                  <span className={styles.queryId}>Consulta #{query.id}</span>
                  <span className={styles.queryDate}>
                    Actualizada: {formatDate(query.updatedAt)}
                  </span>
                </div>
                <div className={styles.queryDetails}>
                  {query.checkIn && query.checkOut && (
                    <div className={styles.queryDetail}>
                      <span className={styles.detailLabel}>📅 Estadía:</span>
                      <span>{formatDate(query.checkIn)} - {formatDate(query.checkOut)}</span>
                    </div>
                  )}
                  {query.requiredGuests && (
                    <div className={styles.queryDetail}>
                      <span className={styles.detailLabel}>👥 Huéspedes:</span>
                      <span>{query.requiredGuests}</span>
                    </div>
                  )}
                  {query.room && (
                    <div className={styles.queryDetail}>
                      <span className={styles.detailLabel}>🏠 Habitación:</span>
                      <span>{query.room.name}</span>
                    </div>
                  )}
                  {query.requirementsNotes && (
                    <div className={styles.queryDetail}>
                      <span className={styles.detailLabel}>📝 Notas:</span>
                      <span className={styles.notesPreview}>{query.requirementsNotes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button 
            className={styles.createNewButton}
            onClick={onCreateNew}
          >
            + Crear nueva consulta para este cliente
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelectQueryModal;

