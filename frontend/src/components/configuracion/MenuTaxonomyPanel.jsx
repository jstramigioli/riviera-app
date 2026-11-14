import { useCallback, useEffect, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight, FiCheck, FiX } from 'react-icons/fi';
import {
  fetchMenuGroups,
  createMenuGroup,
  updateMenuGroup,
  toggleMenuGroup,
  deleteMenuGroup,
  fetchMenuSubgroups,
  createMenuSubgroup,
  updateMenuSubgroup,
  deleteMenuSubgroup
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import styles from './MenuConsumosTab.module.css';

const emptyGroupForm = { codigo: '', nombre: '', ordenIndex: 100 };
const emptySubForm = { category: '', name: '', ordenIndex: 0 };

export default function MenuTaxonomyPanel({ onChanged }) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [groups, setGroups] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [subForm, setSubForm] = useState(emptySubForm);
  const [editingSubId, setEditingSubId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, sRes] = await Promise.all([
        fetchMenuGroups({ includeInactive: true }),
        fetchMenuSubgroups({})
      ]);
      const nextGroups = gRes.data || [];
      setGroups(nextGroups);
      setSubgroups(sRes.data || []);
      setSubForm((f) => ({
        ...f,
        category: f.category || nextGroups.find((g) => g.esActivo)?.code || 'BEBIDAS'
      }));
    } catch (err) {
      setError(err.message || 'Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bump = async () => {
    await load();
    if (onChanged) onChanged();
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingGroupId) {
        await updateMenuGroup(editingGroupId, {
          codigo: groupForm.codigo,
          nombre: groupForm.nombre,
          ordenIndex: Number(groupForm.ordenIndex) || 0
        });
      } else {
        await createMenuGroup({
          codigo: groupForm.codigo,
          nombre: groupForm.nombre,
          ordenIndex: Number(groupForm.ordenIndex) || 100
        });
      }
      setGroupForm(emptyGroupForm);
      setEditingGroupId(null);
      await bump();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo guardar el grupo' });
    } finally {
      setSaving(false);
    }
  };

  const saveSubgroup = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSubId) {
        await updateMenuSubgroup(editingSubId, {
          category: subForm.category,
          name: subForm.name,
          ordenIndex: Number(subForm.ordenIndex) || 0
        });
      } else {
        await createMenuSubgroup({
          category: subForm.category,
          name: subForm.name,
          ordenIndex: Number(subForm.ordenIndex) || 0
        });
      }
      setSubForm((f) => ({ ...emptySubForm, category: f.category }));
      setEditingSubId(null);
      await bump();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo guardar el subgrupo' });
    } finally {
      setSaving(false);
    }
  };

  const onToggleGroup = async (group) => {
    try {
      await toggleMenuGroup(group.id);
      await bump();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo cambiar el grupo' });
    }
  };

  const onDeleteGroup = async (group) => {
    const ok = await confirm({
      title: 'Eliminar grupo',
      message: `¿Eliminar o desactivar el grupo “${group.label}”?`,
      confirmLabel: 'Confirmar',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteMenuGroup(group.id);
      await bump();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo eliminar' });
    }
  };

  const onDeleteSubgroup = async (sub) => {
    const ok = await confirm({
      title: 'Eliminar subgrupo',
      message:
        sub.itemCount > 0
          ? `“${sub.name}” tiene ${sub.itemCount} ítems. Se quitará el subgrupo de esos ítems.`
          : `¿Eliminar el subgrupo “${sub.name}”?`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteMenuSubgroup(sub.id, { clearItems: sub.itemCount > 0 });
      await bump();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo eliminar' });
    }
  };

  const activeGroups = groups.filter((g) => g.esActivo);

  return (
    <section className={styles.taxonomy}>
      {confirmDialog}
      {noticeDialog}

      <div className={styles.taxonomyHeader}>
        <div>
          <h3 className={styles.taxonomyTitle}>Grupos y subgrupos</h3>
          <p className={styles.hint}>
            Liquidación de consumos: Bebidas, Minutas y Cafetería (Snacks desactivado).
          </p>
        </div>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {!open ? null : (
        <>
          {error ? <div className={styles.error}>{error}</div> : null}
          {loading ? <div className={styles.muted}>Cargando taxonomía…</div> : null}

          <div className={styles.taxonomyGrid}>
            <div className={styles.taxonomyCol}>
              <h4 className={styles.taxonomyColTitle}>Grupos</h4>
              <ul className={styles.taxonomyList}>
                {groups.map((g) => (
                  <li key={g.id} className={g.esActivo ? '' : styles.inactiveRow}>
                    <div className={styles.taxonomyRowMain}>
                      <strong>{g.label}</strong>
                      <code className={styles.code}>{g.code}</code>
                      {g.isCanonical ? (
                        <span className={styles.badgeOn}>Canónico</span>
                      ) : null}
                      <span className={styles.muted}>{g.itemCount} ítems</span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title={g.esActivo ? 'Desactivar' : 'Activar'}
                        onClick={() => onToggleGroup(g)}
                        disabled={g.isCanonical && g.esActivo}
                      >
                        {g.esActivo ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Editar"
                        onClick={() => {
                          setEditingGroupId(g.id);
                          setGroupForm({
                            codigo: g.code,
                            nombre: g.label,
                            ordenIndex: g.ordenIndex
                          });
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Eliminar"
                        onClick={() => onDeleteGroup(g)}
                        disabled={g.isCanonical}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form className={styles.taxonomyForm} onSubmit={saveGroup}>
                <span className={styles.taxonomyFormLabel}>
                  {editingGroupId ? 'Editar grupo' : 'Nuevo grupo'}
                </span>
                <div className={styles.formRow}>
                  <label className={styles.field}>
                    <span>Código</span>
                    <input
                      value={groupForm.codigo}
                      onChange={(e) =>
                        setGroupForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))
                      }
                      placeholder="EJ. VINOS"
                      required
                      disabled={Boolean(editingGroupId && groups.find((g) => g.id === editingGroupId)?.isCanonical)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input
                      value={groupForm.nombre}
                      onChange={(e) => setGroupForm((f) => ({ ...f, nombre: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                <div className={styles.formActions}>
                  {editingGroupId ? (
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => {
                        setEditingGroupId(null);
                        setGroupForm(emptyGroupForm);
                      }}
                    >
                      <FiX aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : null}
                  <button type="submit" className={styles.primaryBtn} disabled={saving}>
                    {editingGroupId ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                    {editingGroupId ? 'Guardar' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>

            <div className={styles.taxonomyCol}>
              <h4 className={styles.taxonomyColTitle}>Subgrupos</h4>
              <ul className={styles.taxonomyList}>
                {subgroups.map((s) => (
                  <li key={s.id}>
                    <div className={styles.taxonomyRowMain}>
                      <strong>{s.name}</strong>
                      <span className={styles.muted}>
                        {groups.find((g) => g.code === s.category)?.label || s.category}
                      </span>
                      <span className={styles.muted}>{s.itemCount} ítems</span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Editar"
                        onClick={() => {
                          setEditingSubId(s.id);
                          setSubForm({
                            category: s.category,
                            name: s.name,
                            ordenIndex: s.ordenIndex
                          });
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Eliminar"
                        onClick={() => onDeleteSubgroup(s)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form className={styles.taxonomyForm} onSubmit={saveSubgroup}>
                <span className={styles.taxonomyFormLabel}>
                  {editingSubId ? 'Editar subgrupo' : 'Nuevo subgrupo'}
                </span>
                <div className={styles.formRow}>
                  <label className={styles.field}>
                    <span>Grupo</span>
                    <select
                      value={subForm.category}
                      onChange={(e) => setSubForm((f) => ({ ...f, category: e.target.value }))}
                      required
                    >
                      {(activeGroups.length ? activeGroups : groups).map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input
                      value={subForm.name}
                      onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej. Ensaladas"
                      required
                    />
                  </label>
                </div>
                <div className={styles.formActions}>
                  {editingSubId ? (
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => {
                        setEditingSubId(null);
                        setSubForm((f) => ({ ...emptySubForm, category: f.category }));
                      }}
                    >
                      <FiX aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : null}
                  <button type="submit" className={styles.primaryBtn} disabled={saving}>
                    {editingSubId ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                    {editingSubId ? 'Guardar' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
