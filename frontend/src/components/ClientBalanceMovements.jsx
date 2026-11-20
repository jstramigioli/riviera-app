import React, { useMemo, useState } from 'react';
import { FaEdit } from 'react-icons/fa';
import PaymentForm from './PaymentForm';
import { updateCargo } from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
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
 * Tablas de cargos y pagos del perfil cliente (balance).
 * Filas seleccionables → panel de detalle; edición vía modal/PaymentForm.
 */
const ClientBalanceMovements = ({
  cargos = [],
  pagos = [],
  formatPrice,
  onChanged
}) => {
  const { notify, noticeDialog } = useAppNotice();
  const [selected, setSelected] = useState(null); // { type: 'cargo'|'pago', id, imputacionId? }
  const [editingPago, setEditingPago] = useState(null);
  const [editingCargo, setEditingCargo] = useState(null);
  const [cargoDraft, setCargoDraft] = useState({ descripcion: '', monto: '', notas: '' });
  const [savingCargo, setSavingCargo] = useState(false);

  const selectedCargo = useMemo(() => {
    if (!selected || selected.type !== 'cargo') return null;
    return cargos.find((c) => c.id === selected.id) || null;
  }, [selected, cargos]);

  const selectedPago = useMemo(() => {
    if (!selected || selected.type !== 'pago') return null;
    return (
      pagos.find(
        (p) =>
          p.id === selected.id &&
          (selected.imputacionId == null || p.imputacionId === selected.imputacionId)
      ) || null
    );
  }, [selected, pagos]);

  const selectCargo = (cargo) => {
    setSelected({ type: 'cargo', id: cargo.id });
  };

  const selectPago = (pago) => {
    setSelected({
      type: 'pago',
      id: pago.id,
      imputacionId: pago.imputacionId ?? null
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

  const openEditPago = (pago) => {
    setEditingPago(pago);
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

  const detail = selectedCargo || selectedPago;

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
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Editar cargo"
                            data-testid={`client-cargo-edit-${cargo.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCargo(cargo);
                              openEditCargo(cargo);
                            }}
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.tableCard} aria-labelledby="client-pagos-heading">
          <div className={styles.tableHeader}>
            <h3 id="client-pagos-heading">Pagos</h3>
            <span className={styles.count}>{pagos.length}</span>
          </div>
          {pagos.length === 0 ? (
            <p className={styles.empty}>Sin pagos registrados.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.dataTable} data-testid="client-pagos-table">
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
                  {pagos.map((pago) => {
                    const rowKey = `${pago.id}-${pago.imputacionId ?? 'full'}`;
                    const isSelected =
                      selected?.type === 'pago' &&
                      selected.id === pago.id &&
                      (selected.imputacionId ?? null) === (pago.imputacionId ?? null);
                    const codigo = pago.codigo || `#${pago.id}`;
                    return (
                      <tr
                        key={rowKey}
                        className={isSelected ? styles.rowSelected : undefined}
                        onClick={() => selectPago(pago)}
                        data-testid={`client-pago-row-${rowKey}`}
                        aria-selected={isSelected}
                      >
                        <td>
                          {codigo}
                          {pago.esImputacionParcial ? ' · parcial' : ''}
                        </td>
                        <td>{formatDate(pago.fecha)}</td>
                        <td>{pago.accountLabel || '—'}</td>
                        <td className={styles.montoCell}>{formatPrice(pago.montoARS)}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Editar pago"
                            data-testid={`client-pago-edit-${pago.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPago(pago);
                              openEditPago(pago);
                            }}
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
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
          <p className={styles.empty}>Seleccioná un cargo o un pago para ver el detalle.</p>
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
            </div>
          </dl>
        ) : (
          <dl className={styles.detailList}>
            <div>
              <dt>Tipo</dt>
              <dd>Pago</dd>
            </div>
            <div>
              <dt>Código</dt>
              <dd>{selectedPago.codigo || `#${selectedPago.id}`}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(selectedPago.fecha)}</dd>
            </div>
            <div>
              <dt>Monto imputado</dt>
              <dd>{formatPrice(selectedPago.montoARS)}</dd>
            </div>
            {selectedPago.esImputacionParcial ? (
              <div>
                <dt>Total del pago</dt>
                <dd>{formatPrice(selectedPago.pagoTotalARS)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Moneda</dt>
              <dd>
                {selectedPago.moneda || 'ARS'}
                {selectedPago.moneda === 'USD' && selectedPago.tipoCambio
                  ? ` · TC ${selectedPago.tipoCambio}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{selectedPago.metodo || '—'}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{selectedPago.motivo || 'Pago'}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{selectedPago.accountLabel || '—'}</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>{selectedPago.referencia || '—'}</dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd>{selectedPago.notas || '—'}</dd>
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => openEditPago(selectedPago)}
                data-testid="client-pago-detail-edit"
              >
                <FaEdit aria-hidden="true" /> Editar pago
              </button>
            </div>
          </dl>
        )}
      </aside>

      {editingPago ? (
        <PaymentForm
          reservaId={editingPago.reservaId || null}
          accountId={editingPago.accountId || null}
          initialPago={editingPago}
          onClose={() => setEditingPago(null)}
          onSuccess={async () => {
            setEditingPago(null);
            if (onChanged) await onChanged();
          }}
        />
      ) : null}

      {editingCargo ? (
        <div
          className={styles.modalOverlay}
          onClick={() => !savingCargo && setEditingCargo(null)}
          data-testid="client-cargo-edit-modal"
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
};

export default ClientBalanceMovements;
