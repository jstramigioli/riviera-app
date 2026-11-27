import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import {
  createTipoCena,
  deleteTipoCena,
  fetchTiposCena,
  updateTipoCena
} from '../../services/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import styles from './CenasTab.module.css';

const NEW_KEY = 'nuevo';
const DRAFTS_STORAGE_KEY = 'riviera.config.cenas.drafts';

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

function readStoredDrafts() {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStoredDrafts(drafts) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const entries = Object.entries(drafts || {});
    if (!entries.length) {
      sessionStorage.removeItem(DRAFTS_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Configuración → Cenas: tipos de cena (habitual, buffet, fiestas…) con su
 * precio para alojados y externos. Se usan al cargar cenas y comandas.
 */
export default function CenasTab({ onDirtyChange } = {}) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [tipos, setTipos] = useState([]);
  const [drafts, setDrafts] = useState(() => readStoredDrafts());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTiposCena({ includeInactive: true });
      const list = res.data || [];
      setTipos(list);
      setDrafts((prev) => {
        const stored = readStoredDrafts();
        const merged = {};
        for (const t of list) {
          const candidate = prev[t.id] || stored[t.id];
          merged[t.id] = candidate && isDirty(t, candidate) ? candidate : toDraft(t);
        }
        if (prev[NEW_KEY] || stored[NEW_KEY]) {
          merged[NEW_KEY] = prev[NEW_KEY] || stored[NEW_KEY];
        }
        writeStoredDrafts(
          Object.fromEntries(
            Object.entries(merged).filter(([key, draft]) => {
              if (key === NEW_KEY) return true;
              const tipo = list.find((t) => String(t.id) === String(key));
              return tipo ? isDirty(tipo, draft) : false;
            })
          )
        );
        return merged;
      });
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

  const dirtyKeys = useMemo(
    () =>
      rows
        .filter(({ key, tipo }) => {
          const draft = drafts[key] || toDraft(tipo);
          return key === NEW_KEY || isDirty(tipo, draft);
        })
        .map(({ key }) => key),
    [rows, drafts]
  );

  const hasDirty = dirtyKeys.length > 0;

  useEffect(() => {
    onDirtyChange?.(hasDirty);
  }, [hasDirty, onDirtyChange]);

  useEffect(() => {
    const dirtyOnly = {};
    for (const key of dirtyKeys) {
      if (drafts[key]) dirtyOnly[key] = drafts[key];
    }
    writeStoredDrafts(dirtyOnly);
  }, [drafts, dirtyKeys]);

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
    if (!draft?.nombre?.trim()) {
      notify({
        title: 'Nombre requerido',
        message: 'Ingresá el nombre del tipo de cena.',
        type: 'warning'
      });
      return false;
    }
    const payload = {
      nombre: draft.nombre.trim(),
      precioAlojado: Number(draft.precioAlojado || 0),
      precioExterno: Number(draft.precioExterno || 0)
    };
    setSavingKey(key);
    setError(null);
    try {
      if (key === NEW_KEY) await createTipoCena(payload);
      else await updateTipoCena(tipo.id, payload);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
      return true;
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const saveAllDirty = async () => {
    const pending = dirtyKeys
      .map((key) => {
        const row = rows.find((r) => r.key === key);
        const draft = drafts[key];
        return row && draft ? { key, tipo: row.tipo, draft } : null;
      })
      .filter(Boolean);
    if (!pending.length) return;

    for (const item of pending) {
      if (!item.draft.nombre?.trim()) {
        notify({
          title: 'Nombre requerido',
          message: 'Ingresá el nombre del tipo de cena antes de guardar.',
          type: 'warning'
        });
        return;
      }
    }

    setSavingAll(true);
    setError(null);
    try {
      for (const item of pending) {
        const payload = {
          nombre: item.draft.nombre.trim(),
          precioAlojado: Number(item.draft.precioAlojado || 0),
          precioExterno: Number(item.draft.precioExterno || 0)
        };
        if (item.key === NEW_KEY) await createTipoCena(payload);
        else await updateTipoCena(item.tipo.id, payload);
      }
      writeStoredDrafts({});
      setDrafts({});
      await load();
      notify({
        title: 'Guardado',
        message: 'Precios de cenas actualizados.',
        type: 'success',
        autoDismiss: true
      });
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSavingAll(false);
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
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[tipo.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    }
  };

  const addRow = () => {
    setDrafts((prev) => (prev[NEW_KEY] ? prev : { ...prev, [NEW_KEY]: toDraft(null) }));
  };

  const busyAny = savingAll || savingKey != null;

  return (
    <div className={styles.wrap} data-testid="cenas-tab">
      {confirmDialog}
      {noticeDialog}
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Cenas</h2>
        <div className={styles.toolbarActions}>
          {hasDirty ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={saveAllDirty}
              disabled={busyAny}
              data-testid="cenas-save-all"
            >
              <FiCheck aria-hidden="true" />
              {savingAll ? 'Guardando…' : 'Guardar cambios'}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={addRow}
            disabled={Boolean(drafts[NEW_KEY]) || busyAny}
          >
            <FiPlus aria-hidden="true" />
            Tipo de cena
          </button>
        </div>
      </div>

      {hasDirty ? (
        <p className={styles.dirtyHint} role="status">
          Hay cambios sin guardar. Usá Guardar en la fila o Guardar cambios arriba.
        </p>
      ) : null}

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
                const busy = savingKey === key || savingAll;
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
                              className={styles.saveBtn}
                              onClick={() => saveRow(key, tipo)}
                              disabled={busy || !draft.nombre.trim()}
                              aria-label="Guardar"
                              data-testid={`cenas-save-row-${key}`}
                            >
                              <FiCheck aria-hidden="true" />
                              {busy && savingKey === key ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              onClick={() => cancelRow(key, tipo)}
                              disabled={busy}
                              aria-label="Cancelar"
                            >
                              <FiX aria-hidden="true" />
                              Cancelar
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
                            <FiTrash2 />
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
