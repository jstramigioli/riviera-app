import React, { useMemo, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import CobroForm from './CobroForm';
import { deleteCargo, deleteCobro, updateCargo } from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { formatMoneyArs } from '../utils/formatMoney';
import styles from './ClientBalanceMovements.module.css';

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Tablas de cargos y cobros del perfil cliente (balance).
 * Filas seleccionables → panel de detalle; edición vía modal/CobroForm.
 */
const ClientBalanceMovements = ({
  cargos = [],
  cobros = [],
  formatPrice = formatMoneyArs,
  onChanged
}) => {
  const { notify, noticeDialog } = useAppNotice();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [selected, setSelected] = useState(null); // { type: 'cargo'|'cobro', id, imputacionId? }
  const [editingCobro, setEditingCobro] = useState(null);
  const [editingCargo, setEditingCargo] = useState(null);
  const [cargoDraft, setCargoDraft] = useState({ descripcion: '', monto: '', notas: '' });
  const [savingCargo, setSavingCargo] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const cargoEditOverlayDismiss = useOverlayDismiss(
    () => setEditingCargo(null),
    { enabled: !savingCargo }
  );

  const selectedCargo = useMemo(() => {
    if (!selected || selected.type !== 'cargo') return null;
    return cargos.find((c) => c.id === selected.id) || null;
  }, [selected, cargos]);

  const selectedCobro = useMemo(() => {
    if (!selected || selected.type !== 'cobro') return null;
    return (
      cobros.find(
        (p) =>
          p.id === selected.id &&
          (selected.imputacionId == null || p.imputacionId === selected.imputacionId)
      ) || null
    );
  }, [selected, cobros]);

  const selectCargo = (cargo) => {
    setSelected({ type: 'cargo', id: cargo.id });
  };

  const selectCobro = (cobro) => {
    setSelected({
      type: 'cobro',
      id: cobro.id,
      imputacionId: cobro.imputacionId ?? null
    });
  };

  const openEditCargo = (cargo) => {
    if (!cargo.editable) {
      notify({
        title: 'No editable',
        message:
          'Los cargos de alojamiento se generan con la reserva y no se editan a mano desde aquí.',
        type: 'warning'
      });
      return;
    }
    setEditingCargo(cargo);
    setCargoDraft({
      descripcion: cargo.descripcion || '',
      monto: String(cargo.monto ?? ''),
      notas: cargo.notas || ''
    });
  };

  const openEditCobro = (cobro) => {
    setEditingCobro(cobro);
  };

  const clearSelectionIf = (predicate) => {
    setSelected((prev) => (prev && predicate(prev) ? null : prev));
  };

  const handleDeleteCargo = async (cargo) => {
    if (!cargo?.id || deletingId === `cargo-${cargo.id}`) return;
    if (!cargo.editable) {
      notify({
        title: 'No eliminable',
        message:
          'Los cargos de alojamiento se generan con la reserva y no se eliminan a mano desde aquí.',
        type: 'warning'
      });
      return;
    }
    const ok = await confirm({
      title: 'Eliminar cargo',
      message: `¿Eliminar el cargo "${cargo.descripcion || 'Cargo'}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar'
    });
    if (!ok) return;

    setDeletingId(`cargo-${cargo.id}`);
    try {
      await deleteCargo(cargo.id);
      clearSelectionIf((s) => s.type === 'cargo' && s.id === cargo.id);
      if (editingCargo?.id === cargo.id) setEditingCargo(null);
      notify({ title: 'Cargo eliminado', message: 'El cargo se eliminó correctamente.', type: 'success' });
      if (onChanged) await onChanged();
    } catch (err) {
      notify({
        title: 'No se pudo eliminar',
        message: err?.message || 'Error al eliminar el cargo',
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCobro = async (cobro) => {
    if (!cobro?.id || deletingId === `cobro-${cobro.id}`) return;
    const codigo = cobro.codigo || `#${cobro.id}`;
    const ok = await confirm({
      title: 'Eliminar cobro',
      message: `¿Eliminar el cobro ${codigo}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar'
    });
    if (!ok) return;

    setDeletingId(`cobro-${cobro.id}`);
    try {
      await deleteCobro(cobro.id);
      clearSelectionIf((s) => s.type === 'cobro' && s.id === cobro.id);
      if (editingCobro?.id === cobro.id) setEditingCobro(null);
      notify({ title: 'Cobro eliminado', message: 'El cobro se eliminó correctamente.', type: 'success' });
      if (onChanged) await onChanged();
    } catch (err) {
      notify({
        title: 'No se pudo eliminar',
        message: err?.message || 'Error al eliminar el cobro',
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveCargo = async (e) => {
    e.preventDefault();
    if (!editingCargo) return;
    const monto = Number(cargoDraft.monto);
    if (!cargoDraft.descripcion.trim() || !Number.isFinite(monto)) {
      notify({
        title: 'Datos incompletos',
        message: 'Indicá descripción y un monto válido.',
        type: 'warning'
      });
      return;
    }
    try {
      setSavingCargo(true);
      await updateCargo(editingCargo.id, {
        descripcion: cargoDraft.descripcion.trim(),
        monto,
        notas: cargoDraft.notas?.trim() || null,
        subcategoriaCargoId: editingCargo.subcategoriaCargoId
      });
      setEditingCargo(null);
      if (onChanged) await onChanged();
    } catch (err) {
      notify({
        title: 'Error',
        message: err?.message || 'No se pudo guardar el cargo',
        type: 'error'
      });
    } finally {
      setSavingCargo(false);
    }
  };

  const detail = selectedCargo || selectedCobro;

  return (
    <div className={styles.wrap} data-testid="client-balance-movements">
      <div className={styles.tablesGrid}>
        <section className={styles.tableCard} aria-labelledby="client-cargos-heading">
          <div className={styles.tableHeader}>
            <h3 id="client-cargos-heading">Cargos</h3>
            <span className={styles.count}>{cargos.length}</span>
          </div>
          {cargos.length === 0 ? (
            <p className={styles.empty}>Sin cargos registrados.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.dataTable} data-testid="client-cargos-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Cuenta</th>
                    <th>Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((cargo) => {
                    const isSelected =
                      selected?.type === 'cargo' && selected.id === cargo.id;
                    return (
                      <tr
                        key={cargo.id}
                        className={isSelected ? styles.rowSelected : undefined}
                        onClick={() => selectCargo(cargo)}
                        data-testid={`client-cargo-row-${cargo.id}`}
                        aria-selected={isSelected}
                      >
                        <td>{formatDate(cargo.fecha)}</td>
                        <td>{cargo.descripcion || 'Cargo'}</td>
                        <td>{cargo.accountLabel || '—'}</td>
                        <td className={styles.montoCell}>{formatPrice(cargo.monto)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Editar cargo"
                              aria-label="Editar cargo"
                              data-testid={`client-cargo-edit-${cargo.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectCargo(cargo);
                                openEditCargo(cargo);
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Eliminar cargo"
                              aria-label="Eliminar cargo"
                              data-testid={`client-cargo-delete-${cargo.id}`}
                              disabled={deletingId === `cargo-${cargo.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectCargo(cargo);
                                handleDeleteCargo(cargo);
                              }}
                            >
                              <FaTrash aria-hidden="true" />
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
        </section>

        <section className={styles.tableCard} aria-labelledby="client-cobros-heading">
          <div className={styles.tableHeader}>
            <h3 id="client-cobros-heading">Cobros</h3>
            <span className={styles.count}>{cobros.length}</span>
          </div>
          {cobros.length === 0 ? (
            <p className={styles.empty}>Sin cobros registrados.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.dataTable} data-testid="client-cobros-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Cuenta</th>
                    <th>Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cobros.map((cobro) => {
                    const rowKey = `${cobro.id}-${cobro.imputacionId ?? 'full'}`;
                    const isSelected =
                      selected?.type === 'cobro' &&
                      selected.id === cobro.id &&
                      (selected.imputacionId ?? null) === (cobro.imputacionId ?? null);
                    const codigo = cobro.codigo || `#${cobro.id}`;
                    return (
                      <tr
                        key={rowKey}
                        className={isSelected ? styles.rowSelected : undefined}
                        onClick={() => selectCobro(cobro)}
                        data-testid={`client-cobro-row-${rowKey}`}
                        aria-selected={isSelected}
                      >
                        <td>
                          {codigo}
                          {cobro.esImputacionParcial ? ' · parcial' : ''}
                        </td>
                        <td>{formatDate(cobro.fecha)}</td>
                        <td>{cobro.accountLabel || '—'}</td>
                        <td className={styles.montoCell}>{formatPrice(cobro.montoARS)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Editar cobro"
                              aria-label="Editar cobro"
                              data-testid={`client-cobro-edit-${cobro.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectCobro(cobro);
                                openEditCobro(cobro);
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Eliminar cobro"
                              aria-label="Eliminar cobro"
                              data-testid={`client-cobro-delete-${cobro.id}`}
                              disabled={deletingId === `cobro-${cobro.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectCobro(cobro);
                                handleDeleteCobro(cobro);
                              }}
                            >
                              <FaTrash aria-hidden="true" />
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
        </section>
      </div>

      <aside
        className={styles.detailPanel}
        aria-label="Detalle del movimiento"
        data-testid="client-balance-detail"
      >
        <h3>Detalle</h3>
        {!detail ? (
          <p className={styles.empty}>Seleccioná un cargo o un cobro para ver el detalle.</p>
        ) : selectedCargo ? (
          <dl className={styles.detailList}>
            <div>
              <dt>Tipo</dt>
              <dd>Cargo</dd>
            </div>
            <div>
              <dt>Descripción</dt>
              <dd>{selectedCargo.descripcion || '—'}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(selectedCargo.fecha)}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{formatPrice(selectedCargo.monto)}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{selectedCargo.accountLabel || '—'}</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>
                {selectedCargo.subcategoriaNombre ||
                  selectedCargo.tipoCargo ||
                  (selectedCargo.editable ? '—' : 'Alojamiento')}
              </dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd>{selectedCargo.notas || '—'}</dd>
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => openEditCargo(selectedCargo)}
                data-testid="client-cargo-detail-edit"
              >
                <FaEdit aria-hidden="true" /> Editar cargo
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDeleteCargo(selectedCargo)}
                data-testid="client-cargo-detail-delete"
                disabled={deletingId === `cargo-${selectedCargo.id}`}
              >
                <FaTrash aria-hidden="true" /> Eliminar cargo
              </button>
            </div>
          </dl>
        ) : (
          <dl className={styles.detailList}>
            <div>
              <dt>Tipo</dt>
              <dd>Cobro</dd>
            </div>
            <div>
              <dt>Código</dt>
              <dd>{selectedCobro.codigo || `#${selectedCobro.id}`}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(selectedCobro.fecha)}</dd>
            </div>
            <div>
              <dt>Monto imputado</dt>
              <dd>{formatPrice(selectedCobro.montoARS)}</dd>
            </div>
            {selectedCobro.esImputacionParcial ? (
              <div>
                <dt>Total del cobro</dt>
                <dd>{formatPrice(selectedCobro.pagoTotalARS)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Moneda</dt>
              <dd>
                {selectedCobro.moneda || 'ARS'}
                {selectedCobro.moneda === 'USD' && selectedCobro.tipoCambio
                  ? ` · TC ${selectedCobro.tipoCambio}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{selectedCobro.metodo || '—'}</dd>
            </div>
            {String(selectedCobro.metodo || '')
              .trim()
              .toLowerCase() === 'efectivo' ? (
              <>
                <div>
                  <dt>Dinero recibido</dt>
                  <dd>
                    {selectedCobro.dineroRecibido != null
                      ? formatPrice(selectedCobro.dineroRecibido)
                      : formatPrice(Math.abs(Number(selectedCobro.monto) || 0))}
                    {selectedCobro.moneda && selectedCobro.moneda !== 'ARS'
                      ? ` ${selectedCobro.moneda}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>Vuelto</dt>
                  <dd>
                    {formatPrice(
                      selectedCobro.vueltoARS != null ? selectedCobro.vueltoARS : 0
                    )}{' '}
                    ARS
                  </dd>
                </div>
                <div>
                  <dt>Monto ingresado</dt>
                  <dd>
                    {formatPrice(Math.abs(Number(selectedCobro.monto) || 0))}
                    {selectedCobro.moneda && selectedCobro.moneda !== 'ARS'
                      ? ` ${selectedCobro.moneda}`
                      : ''}
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Motivo</dt>
              <dd>{selectedCobro.motivo || 'Cobro'}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{selectedCobro.accountLabel || '—'}</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>{selectedCobro.referencia || '—'}</dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd>{selectedCobro.notas || '—'}</dd>
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => openEditCobro(selectedCobro)}
                data-testid="client-cobro-detail-edit"
              >
                <FaEdit aria-hidden="true" /> Editar cobro
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDeleteCobro(selectedCobro)}
                data-testid="client-cobro-detail-delete"
                disabled={deletingId === `cobro-${selectedCobro.id}`}
              >
                <FaTrash aria-hidden="true" /> Eliminar cobro
              </button>
            </div>
          </dl>
        )}
      </aside>

      {editingCobro ? (
        <CobroForm
          reservaId={editingCobro.reservaId || null}
          accountId={editingCobro.accountId || null}
          initialCobro={editingCobro}
          onClose={() => setEditingCobro(null)}
          onSuccess={async () => {
            setEditingCobro(null);
            if (onChanged) await onChanged();
          }}
        />
      ) : null}

      {editingCargo ? (
        <div
          className={styles.modalOverlay}
          {...cargoEditOverlayDismiss}
          data-testid="client-cargo-edit-modal"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Editar cargo</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setEditingCargo(null)}
                disabled={savingCargo}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveCargo} className={styles.modalForm}>
              <label>
                Descripción *
                <input
                  type="text"
                  required
                  value={cargoDraft.descripcion}
                  onChange={(e) =>
                    setCargoDraft((d) => ({ ...d, descripcion: e.target.value }))
                  }
                  disabled={savingCargo}
                />
              </label>
              <label>
                Monto *
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cargoDraft.monto}
                  onChange={(e) => setCargoDraft((d) => ({ ...d, monto: e.target.value }))}
                  disabled={savingCargo}
                  data-testid="client-cargo-edit-monto"
                />
              </label>
              <label>
                Notas
                <textarea
                  rows={3}
                  value={cargoDraft.notas}
                  onChange={(e) => setCargoDraft((d) => ({ ...d, notas: e.target.value }))}
                  disabled={savingCargo}
                />
              </label>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditingCargo(null)}
                  disabled={savingCargo}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={savingCargo}>
                  {savingCargo ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {noticeDialog}
      {confirmDialog}
    </div>
  );
};

export default ClientBalanceMovements;
