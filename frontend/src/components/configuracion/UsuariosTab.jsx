import React, { useCallback, useEffect, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import {
  createUserRequest,
  deleteUserRequest,
  fetchUsers,
  updateUserRequest
} from '../../services/authApi';
import { ACTIVE_ROLES, ROLES, activeRoleOptions, roleLabel } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import styles from './UsuariosTab.module.css';

const EMPTY_FORM = {
  username: '',
  displayName: '',
  role: ROLES.RECEPCION,
  password: '',
  isActive: true
};

function UsuariosTab() {
  const { user: currentUser, can } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const canManage = can('users');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const roleOptions = activeRoleOptions();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      username: row.username || '',
      displayName: row.displayName || '',
      role: ACTIVE_ROLES.includes(row.role) ? row.role : ROLES.RECEPCION,
      password: '',
      isActive: row.isActive !== false
    });
    setMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editing) {
        const payload = {
          username: form.username,
          displayName: form.displayName,
          role: form.role,
          isActive: Boolean(form.isActive)
        };
        if (form.password.trim()) payload.password = form.password;
        const updated = await updateUserRequest(editing.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setMessage(`Usuario actualizado: ${updated.username}`);
      } else {
        const created = await createUserRequest({
          username: form.username,
          displayName: form.displayName,
          role: form.role,
          password: form.password,
          isActive: Boolean(form.isActive)
        });
        setUsers((prev) =>
          [...prev, created].sort((a, b) =>
            String(a.username).localeCompare(String(b.username))
          )
        );
        setMessage(`Usuario creado: ${created.username}`);
      }
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (row.role === ROLES.ADMIN) return;
    const ok = await confirm({
      title: 'Eliminar usuario',
      message: `¿Confirmás eliminar a «${row.displayName || row.username}»?`,
      confirmText: 'Eliminar'
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await deleteUserRequest(row.id);
      setUsers((prev) => prev.filter((u) => u.id !== row.id));
      setMessage(`Usuario eliminado: ${row.username}`);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    }
  };

  if (!canManage) {
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Solo el administrador puede gestionar usuarios.</p>
      </div>
    );
  }

  if (loading) {
    return <p className={styles.muted}>Cargando usuarios…</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h3 className={styles.title}>Usuarios</h3>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          <FiPlus aria-hidden="true" />
          Nuevo usuario
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.ok}>{message}</p> : null}

      {users.length === 0 ? (
        <div className={styles.emptyInline}>
          <p className={styles.muted}>No hay usuarios cargados.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const isAdmin = row.role === ROLES.ADMIN;
                const isSelf = currentUser?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    className={row.isActive === false ? styles.inactiveRow : undefined}
                  >
                    <td className={styles.nameCell}>{row.displayName}</td>
                    <td className={styles.username}>{row.username}</td>
                    <td>
                      <span className={styles.badge}>{roleLabel(row.role)}</span>
                    </td>
                    <td>
                      {row.isActive !== false ? (
                        <span className={styles.statusOn}>Activo</span>
                      ) : (
                        <span className={styles.statusOff}>Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Editar"
                          aria-label={`Editar ${row.username}`}
                          onClick={() => openEdit(row)}
                        >
                          <FiEdit2 aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconDanger}`}
                          title={
                            isAdmin
                              ? 'Los Admin no se pueden eliminar'
                              : isSelf
                                ? 'No podés eliminarte a vos mismo'
                                : 'Eliminar'
                          }
                          aria-label={`Eliminar ${row.username}`}
                          disabled={isAdmin || isSelf}
                          onClick={() => handleDelete(row)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div
          className={styles.formOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            className={styles.formDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="usuarios-form-title"
            onSubmit={handleSubmit}
          >
            <div className={styles.formHeader}>
              <h4 id="usuarios-form-title" className={styles.formTitle}>
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </h4>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Cerrar"
                onClick={closeModal}
                disabled={saving}
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="user-displayName">Nombre</label>
                <input
                  id="user-displayName"
                  value={form.displayName}
                  onChange={(e) => setField('displayName', e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="name"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="user-username">Usuario</label>
                <input
                  id="user-username"
                  value={form.username}
                  onChange={(e) => setField('username', e.target.value)}
                  required
                  disabled={saving}
                  autoComplete="username"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="user-role">Rol</label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value)}
                  disabled={saving}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="user-password">
                  {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  required={!editing}
                  disabled={saving}
                  autoComplete={editing ? 'new-password' : 'new-password'}
                  minLength={editing && !form.password ? undefined : 6}
                />
                {editing ? (
                  <p className={styles.hint}>Dejá vacío para mantener la actual.</p>
                ) : null}
              </div>

              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.isActive)}
                    onChange={(e) => setField('isActive', e.target.checked)}
                    disabled={saving}
                  />
                  Usuario activo
                </label>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  );
}

export default UsuariosTab;
