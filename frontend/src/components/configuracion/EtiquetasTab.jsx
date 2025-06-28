import React, { useState } from 'react';
import { createTag, updateTag, deleteTag } from '../../services/api';
import { useTags } from '../../hooks/useTags';
import '../../styles/variables.css';

function EtiquetasTab() {
  const { tags, loading, addTag, updateTag: updateTagInContext, removeTag } = useTags();
  const [editingTag, setEditingTag] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', color: '#3B82F6' });

  const handleEdit = (tag) => {
    setEditingTag(tag.id);
    setEditForm({
      name: tag.name,
      color: tag.color
    });
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditForm({});
  };

  const handleSaveEdit = async (tagId) => {
    try {
      const updatedTag = await updateTag(tagId, editForm);
      updateTagInContext(updatedTag);
      setEditingTag(null);
      setEditForm({});
    } catch (error) {
      console.error('Error actualizando etiqueta:', error);
      alert('Error al actualizar la etiqueta');
    }
  };

  const handleDelete = async (tagId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta etiqueta?')) {
      try {
        await deleteTag(tagId);
        removeTag(tagId);
      } catch (error) {
        console.error('Error eliminando etiqueta:', error);
        alert('Error al eliminar la etiqueta');
      }
    }
  };

  const handleCreate = async () => {
    try {
      const newTag = await createTag(createForm);
      addTag(newTag);
      setCreateForm({ name: '', color: '#3B82F6' });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creando etiqueta:', error);
      alert('Error al crear la etiqueta');
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateInputChange = (field, value) => {
    setCreateForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', fontSize: 'var(--font-size-large)' }}>
        <div>Cargando etiquetas...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Formulario de creación */}
      {showCreateForm && (
        <div style={{
          backgroundColor: 'var(--color-bg)',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid var(--color-border)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-text-main)', fontSize: 'var(--font-size-large)' }}>
            Crear Nueva Etiqueta
          </h4>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Nombre de la etiqueta"
              value={createForm.name}
              onChange={(e) => handleCreateInputChange('name', e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: 'var(--font-size-medium)'
              }}
            />
            <input
              type="color"
              value={createForm.color}
              onChange={(e) => handleCreateInputChange('color', e.target.value)}
              style={{
                width: '60px',
                height: '48px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!createForm.name.trim()}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-text-light)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-medium)',
                opacity: createForm.name.trim() ? 1 : 0.6
              }}
            >
              Crear
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--color-text-muted)',
                color: 'var(--color-text-light)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-medium)'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botón para mostrar formulario de creación */}
      {!showCreateForm && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-light)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-medium)',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: 'var(--font-size-large)' }}>+</span>
            Nueva Etiqueta
          </button>
        </div>
      )}

      {/* Lista de etiquetas en tabla */}
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'var(--color-bg-white)'
        }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg)' }}>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                fontSize: 'var(--font-size-medium)'
              }}>
                Etiqueta
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'center',
                borderBottom: '2px solid var(--color-border)',
                fontWeight: '600',
                color: 'var(--color-text-main)',
                width: '140px',
                fontSize: 'var(--font-size-medium)'
              }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {tags.map(tag => (
              <tr key={tag.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                <td style={{ padding: '16px' }}>
                  {editingTag === tag.id ? (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      />
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={(e) => handleInputChange('color', e.target.value)}
                        style={{
                          width: '50px',
                          height: '40px',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '6px 12px',
                        backgroundColor: tag.color,
                        color: 'var(--color-text-light)',
                        borderRadius: '16px',
                        fontSize: 'var(--font-size-medium)',
                        fontWeight: '500',
                        minWidth: '80px',
                        textAlign: 'center'
                      }}>
                        {tag.name}
                      </span>
                    </div>
                  )}
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  {editingTag === tag.id ? (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleSaveEdit(tag.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-success)',
                          color: 'var(--color-text-light)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-text-muted)',
                          color: 'var(--color-text-light)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleEdit(tag)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-light)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--color-danger)',
                          color: 'var(--color-text-light)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-medium)'
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tags.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-bg)',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          fontSize: 'var(--font-size-medium)'
        }}>
          <p>No hay etiquetas creadas aún.</p>
          <p>Crea tu primera etiqueta para empezar a organizar las habitaciones.</p>
        </div>
      )}
    </div>
  );
}

export default EtiquetasTab; 