import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { searchDishes, renameDish, deleteDish } from '../../services/gastronomiaApi';
import { CATALOG_CATEGORIES } from '../../constants/catalogoPlatos';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import styles from '../../pages/Gastronomia.module.css';

/** Configuración → Catálogo de platos: platos usados en los menús diarios. */
export default function CatalogoPlatosTab() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await searchDishes(q, 200));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const byCategory = useMemo(() => {
    const map = Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c.id, []]));
    for (const dish of rows) {
      const cat = dish.category || 'ENTRADA';
      if (!map[cat]) map[cat] = [];
      map[cat].push(dish);
    }
    return map;
  }, [rows]);

  const borrar = async (dish) => {
    const ok = await confirm({
      title: 'Borrar plato',
      message: `¿Borrar «${dish.name}» del catálogo? Los menús ya guardados no cambian.`,
      confirmText: 'Borrar',
      cancelText: 'Volver'
    });
    if (!ok) return;
    try {
      await deleteDish(dish.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`${styles.gVars} ${styles.panel}`} data-testid="catalogo-platos">
      {confirmDialog}
      <div className={styles.toolbar}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label htmlFor="c-q">Buscar plato</label>
          <input id="c-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {CATALOG_CATEGORIES.map((cat) => {
        const list = byCategory[cat.id] || [];
        return (
          <div key={cat.id} className={styles.catalogGroup}>
            <h3 className={styles.sectionTitle}>
              {cat.label}
              <span className={styles.catalogCount}>{list.length}</span>
            </h3>
            {list.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Usos</th>
                    <th>Último uso</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((dish) => (
                    <tr key={dish.id}>
                      <td>
                        <input
                          defaultValue={dish.name}
                          aria-label={`Nombre ${dish.name}`}
                          onBlur={async (e) => {
                            const next = e.target.value.trim();
                            if (!next || next === dish.name) return;
                            try {
                              await renameDish(dish.id, { name: next });
                              load();
                            } catch (err) {
                              setError(err.message);
                              e.target.value = dish.name;
                            }
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.catalogSelect}
                          value={dish.category || cat.id}
                          aria-label={`Categoría ${dish.name}`}
                          onChange={async (e) => {
                            const next = e.target.value;
                            if (next === dish.category) return;
                            try {
                              await renameDish(dish.id, { category: next });
                              load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          {CATALOG_CATEGORIES.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{dish.usageCount}</td>
                      <td>{dish.lastUsedAt ? String(dish.lastUsedAt).slice(0, 10) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Borrar"
                          aria-label={`Borrar ${dish.name}`}
                          onClick={() => borrar(dish)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.emptyMuted}>Sin platos en esta categoría.</p>
            )}
          </div>
        );
      })}
      {!rows.length && !loading ? <p className={styles.empty}>Sin platos en el catálogo.</p> : null}
    </div>
  );
}
