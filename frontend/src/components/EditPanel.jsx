import React from 'react';
import { FaTimes, FaPen } from 'react-icons/fa';

const EditPanel = ({ 
  title, 
  subtitle, 
  isEditing, 
  onEditToggle, 
  onSave, 
  children, 
  saveButtonText = "Guardar Cambios",
  saveDisabled = false 
}) => {
  return (
    <div style={{ fontSize: '1.15rem', lineHeight: 1.7 }}>
      {/* Header con título, subtítulo y botón de editar/cancelar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          {subtitle && <span style={{ fontSize: '0.95rem', color: '#888' }}>{subtitle}</span>}
        </div>
        <button 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: 22, 
            color: '#666', 
            marginLeft: 8 
          }} 
          title={isEditing ? "Cancelar edición" : "Editar"} 
          onClick={onEditToggle}
        >
          {isEditing ? <FaTimes /> : <FaPen />}
        </button>
      </div>

      {/* Título principal */}
      {title && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '1.35rem' }}>
            {title}
          </div>
        </div>
      )}

      {/* Contenido del panel */}
      <div>
        {children}
      </div>

      {/* Botón Guardar - solo en edición, abajo del todo */}
      {isEditing && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button 
            style={{ 
              background: saveDisabled ? '#6c757d' : '#28a745', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              padding: '12px 32px', 
              cursor: saveDisabled ? 'not-allowed' : 'pointer', 
              fontSize: '1.1rem',
              fontWeight: 'bold',
              width: '100%',
              opacity: saveDisabled ? 0.6 : 1
            }} 
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