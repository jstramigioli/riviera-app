import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import {
  createTipoCena,
  deleteTipoCena,
  fetchTiposCena,
  updateTipoCena
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import styles from './CenasTab.module.css';

const NEW_KEY = 'nuevo';

function toDraft(tipo) {
  return {
    nombre: tipo?.nombre ?? '',
    precioAlojado: tipo?.precioAlojado != null ? String(tipo.precioAlojado) : '',
    precioExterno: tipo?.precioExterno != null ? String(tipo.precioExterno) : ''
  };
}

function isDirty(tipo, draft) {
  const base = toDraft(tipo);
  return (
    draft.nombre.trim() !== base.nombre ||
    Number(draft.precioAlojado || 0) !== Number(base.precioAlojado || 0) ||
    Number(draft.precioExterno || 0) !== Number(base.precioExterno || 0)
  );
}

/**
 * Configuración → Cenas: tipos de cena (habitual, buffet, fiestas…) con su
 * precio para alojados y externos. Se usan al cargar cenas y comandas.
 */
export default function CenasTab() {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [tipos, setTipos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTiposCena({ includeInactive: true });
      const list = res.data || [];
      setTipos(list);
      setDrafts(Object.fromEntries(list.map((t) => [t.id, toDraft(t)])));
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los tipos de cena');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = tipos.map((t) => ({ key: t.id, tipo: t }));
    if (drafts[NEW_KEY]) list.push({ key: NEW_KEY, tipo: null });
    return list;
  }, [tipos, drafts]);

  const setDraft = (key, field, value) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const cancelRow = (key, tipo) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (key === NEW_KEY) delete next[NEW_KEY];
      else next[key] = toDraft(tipo);
      return next;
    });
  };

  const saveRow = async (key, tipo) => {
    const draft = drafts[key];
    const payload = {
      nombre: draft.nombre,
      precioAlojado: Number(draft.precioAlojado || 0),
      precioExterno: Number(draft.precioExterno || 0)
    };
    setSavingKey(key);
    setError(null);
    try {
      if (key === NEW_KEY) await createTipoCena(payload);
      else await updateTipoCena(tipo.id, payload);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleActivo = async (tipo) => {
    setSavingKey(tipo.id);
    setError(null);
    try {
      await updateTipoCena(tipo.id, { activo: !tipo.activo });
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar');
    } finally {
      setSavingKey(null);
    }
  };

  const removeTipo = async (tipo) => {
    const ok = await confirm({
      title: 'Eliminar tipo de cena',
      message: `¿Eliminar "${tipo.nombre}"? Solo se puede eliminar si nunca se usó.`,
      confirmText: 'Eliminar'
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteTipoCena(tipo.id);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    }
  };

  const addRow = () => {
    setDrafts((prev) => (prev[NEW_KEY] ? prev : { ...prev, [NEW_KEY]: toDraft(null) }));
  };

  return (
    <div className={styles.wrap}>
      {confirmDialog}
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Cenas</h2>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={addRow}
          disabled={Boolean(drafts[NEW_KEY])}
        >
          <FiPlus aria-hidden="true" />
          Tipo de cena
        </button>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <div className={styles.muted}>Cargando…</div> : null}

      {!loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipo de cena</th>
                <th className={styles.num}>Precio alojado</th>
                <th className={styles.num}>Precio externo</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, tipo }) => {
                const draft = drafts[key] || toDraft(tipo);
                const dirty = key === NEW_KEY || isDirty(tipo, draft);
                const busy = savingKey === key;
                const inactive = tipo && !tipo.activo;
                return (
                  <tr key={key} className={inactive ? styles.rowInactive : undefined}>
                    <td>
                      <input
                        className={styles.input}
                        value={draft.nombre}
                        placeholder="Ej. Cena temática"
                        aria-label="Nombre del tipo de cena"
                        onChange={(e) => setDraft(key, 'nombre', e.target.value)}
                        disabled={busy}
                      />
                    </td>
                    <td className={styles.num}>
                      <input
                        className={`${styles.input} ${styles.inputNum}`}
                        type="number"
                        min="0"
                        step="100"
                        value={draft.precioAlojado}
                        aria-label="Precio alojado"
                        onChange={(e) => setDraft(key, 'precioAlojado', e.target.value)}
                        disabled={busy}
                      />
                    </td>
                    <td className={styles.num}>
                      <input
                        className={`${styles.input} ${styles.inputNum}`}
                        type="number"
                        min="0"
                        step="100"
                        value={draft.precioExterno}
                        aria-label="Precio externo"
                        onChange={(e) => setDraft(key, 'precioExterno', e.target.value)}
                        disabled={busy}
                      />
                    </td>
                    <td>
                      {tipo ? (
                        <button
                          type="button"
                          className={styles.statusBtn}
                          onClick={() => toggleActivo(tipo)}
                          disabled={busy}
                          title={tipo.activo ? 'Desactivar' : 'Activar'}
                        >
                          <span
                            className={`${styles.dot} ${tipo.activo ? styles.dotOn : ''}`}
                            aria-hidden="true"
                          />
                          {tipo.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      ) : (
                        <span className={styles.muted}>Nuevo</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {dirty ? (
                          <>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => saveRow(key, tipo)}
                              disabled={busy || !draft.nombre.trim()}
                              title="Guardar"
                              aria-label="Guardar"
                            >
                              <FiCheck aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => cancelRow(key, tipo)}
                              disabled={busy}
                              title="Cancelar"
                              aria-label="Cancelar"
                            >
                              <FiX aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                        {tipo && !dirty && !tipo.usos ? (
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconDanger}`}
                            onClick={() => removeTipo(tipo)}
                            title="Eliminar"
                            aria-label={`Eliminar ${tipo.nombre}`}
                          >
                            <FiTrash2 aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    No hay tipos de cena.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
