import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight, FiX, FiCheck } from 'react-icons/fi';
import {
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleMenuItem,
  deleteMenuItem
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import styles from './MenuConsumosTab.module.css';

const CATEGORIES = [
  { code: 'BEBIDAS', label: 'Bebidas' },
  { code: 'MINUTAS', label: 'Minutas' },
  { code: 'CAFETERIA', label: 'Cafetería' }
];

const emptyForm = {
  category: 'BEBIDAS',
  name: '',
  price: '',
  description: '',
  ordenIndex: 0,
  isActive: true
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export default function MenuConsumosTab() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMenuItems({});
      setItems(res.data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar el menú');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
      if (!q) return true;
      return String(item.name).toLowerCase().includes(q);
    });
  }, [items, filterCategory, query]);

  const openCreate = () => {
    setEditing('new');
    setForm({
      ...emptyForm,
      category: filterCategory === 'ALL' ? 'BEBIDAS' : filterCategory
    });
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      category: item.category,
      name: item.name,
      price: String(item.price),
      description: item.description || '',
      ordenIndex: item.ordenIndex ?? 0,
      isActive: item.isActive !== false
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify({ title: 'Nombre requerido', message: 'Ingresá el nombre del ítem.' });
      return;
    }
    const price = Number(String(form.price).replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      notify({ title: 'Precio inválido', message: 'Ingresá un precio numérico válido.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: form.category,
        name: form.name.trim(),
        price,
        description: form.description.trim() || null,
        ordenIndex: Number(form.ordenIndex) || 0,
        isActive: form.isActive
      };

      if (editing === 'new') {
        await createMenuItem(payload);
      } else {
        await updateMenuItem(editing.id, payload);
      }
      closeForm();
      await load();
    } catch (err) {
      notify({ title: 'No se pudo guardar', message: err.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (item) => {
    try {
      await toggleMenuItem(item.id);
      await load();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo cambiar el estado' });
    }
  };

  const onDelete = async (item) => {
    const ok = await confirm({
      title: 'Desactivar ítem',
      message: `¿Desactivar “${item.name}” del menú? Dejará de aparecer en la comanda; se puede reactivar después.`,
      confirmText: 'Desactivar',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await deleteMenuItem(item.id);
      await load();
    } catch (err) {
      notify({ title: 'Error', message: err.message || 'No se pudo desactivar' });
    }
  };

  return (
    <div className={styles.wrap}>
      {confirmDialog}
      {noticeDialog}

      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Menú de consumos</h2>
          <p className={styles.hint}>
            Ítems para la comanda del Libro (Bebidas, Minutas, Cafetería).
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          <FiPlus aria-hidden="true" />
          Nuevo ítem
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.tabs} role="tablist" aria-label="Categorías">
          <button
            type="button"
            role="tab"
            aria-selected={filterCategory === 'ALL'}
            className={`${styles.tab} ${filterCategory === 'ALL' ? styles.tabActive : ''}`}
            onClick={() => setFilterCategory('ALL')}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.code}
              type="button"
              role="tab"
              aria-selected={filterCategory === cat.code}
              className={`${styles.tab} ${filterCategory === cat.code ? styles.tabActive : ''}`}
              onClick={() => setFilterCategory(cat.code)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar ítem…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar ítem"
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.muted}>Cargando menú…</div> : null}

      {!loading && filtered.length === 0 ? (
        <div className={styles.empty}>No hay ítems en esta vista.</div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Orden</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const catLabel =
                CATEGORIES.find((c) => c.code === item.category)?.label || item.category;
              return (
                <tr key={item.id} className={item.isActive ? '' : styles.inactiveRow}>
                  <td>{catLabel}</td>
                  <td>
                    <div className={styles.nameCell}>{item.name}</div>
                    {item.description ? (
                      <div className={styles.desc}>{item.description}</div>
                    ) : null}
                  </td>
                  <td className={styles.num}>{formatMoney(item.price)}</td>
                  <td>
                    <span className={item.isActive ? styles.badgeOn : styles.badgeOff}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className={styles.num}>{item.ordenIndex}</td>
                  <td className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={item.isActive ? 'Desactivar' : 'Activar'}
                      aria-label={item.isActive ? 'Desactivar' : 'Activar'}
                      onClick={() => onToggle(item)}
                    >
                      {item.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Editar"
                      aria-label="Editar"
                      onClick={() => openEdit(item)}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Desactivar"
                      aria-label="Desactivar"
                      onClick={() => onDelete(item)}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {editing ? (
        <div className={styles.formOverlay} role="presentation">
          <form className={styles.form} onSubmit={save}>
            <div className={styles.formHeader}>
              <h3>{editing === 'new' ? 'Nuevo ítem' : 'Editar ítem'}</h3>
              <button type="button" className={styles.iconBtn} onClick={closeForm} aria-label="Cerrar">
                <FiX />
              </button>
            </div>

            <label className={styles.field}>
              <span>Categoría</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </label>

            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>Precio</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Orden</span>
                <input
                  type="number"
                  value={form.ordenIndex}
                  onChange={(e) => setForm((f) => ({ ...f, ordenIndex: e.target.value }))}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Descripción</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Activo
            </label>

            <div className={styles.formActions}>
              <button type="button" className={styles.ghostBtn} onClick={closeForm} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                <FiCheck aria-hidden="true" />
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
