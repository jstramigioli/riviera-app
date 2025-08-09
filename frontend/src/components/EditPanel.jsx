import React from 'react';
import { FaTimes, FaPen, FaTrash } from 'react-icons/fa';
import styles from '../styles/EditPanel.module.css';

const EditPanel = ({ 
  title, 
  subtitle, 
  isEditing, 
  onEditToggle, 
  onSave, 
  onDelete,
  children, 
  saveButtonText = "Guardar Cambios",
  saveDisabled = false,
  showDeleteButton = false
}) => {
  return (
    <div className={styles.editPanel}>
      {/* Header con título, subtítulo y botones de editar/cancelar y eliminar */}
      <div className={styles.header}>
        <div>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        <div className={styles.headerButtons}>
          {showDeleteButton && !isEditing && (
            <button 
              className={styles.deleteButton}
              title="Eliminar"
              onClick={onDelete}
            >
              <FaTrash />
            </button>
          )}
          <button 
            className={styles.editButton}
            title={isEditing ? "Cancelar edición" : "Editar"} 
            onClick={onEditToggle}
          >
            {isEditing ? <FaTimes /> : <FaPen />}
          </button>
        </div>
      </div>

      {/* Título principal */}
      {title && (
        <div className={styles.titleContainer}>
          <div className={styles.title}>
            {title}
          </div>
        </div>
      )}

      {/* Contenido del panel */}
      <div className={styles.content}>
        {children}
      </div>

      {/* Botón Guardar - solo en edición, abajo del todo */}
      {isEditing && (
        <div className={styles.buttonContainer}>
          <button 
            className={`${styles.saveButton} ${saveDisabled ? styles.disabled : ''}`}
            onClick={onSave}
            disabled={saveDisabled}
          >
            {saveButtonText}
          </button>
        </div>
      )}
    </div>
  );
};

export default EditPanel; 