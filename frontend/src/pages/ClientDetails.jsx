import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import { FiMapPin } from 'react-icons/fi';
import {
  fetchClients,
  fetchReservations,
  getClientBalance,
  getClientDocumentPhoto,
  uploadClientDocumentPhoto,
  openClientDocumentPhoto,
  downloadClientDocumentPhoto,
  deleteClientDocumentPhoto
} from '../services/api';
import FieldEditor from '../components/FieldEditor';
import EditClientModal from '../components/EditClientModal';
import ClientBalanceMovements from '../components/ClientBalanceMovements';
import ReservationIdChip from '../components/ReservationIdChip';
import styles from './ClientDetails.module.css';
import { useAppNotice } from '../hooks/useAppNotice';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { MOTIVO_DEVOLUCION } from '../constants/billing';
import { formatMoneyArs } from '../utils/formatMoney';
import { getAddressFromNotes } from '../utils/clientAddressNotes';
import { formatBirthDateDisplay } from '../constants/clientFormFields';

const DNI_PHOTO_ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

const ClientDetails = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { notify, noticeDialog } = useAppNotice();
  const { confirm, confirmDialog } = useConfirmDialog();
  const dniPhotoInputRef = useRef(null);
  const [client, setClient] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [clientBalance, setClientBalance] = useState(null);
  const [documentPhoto, setDocumentPhoto] = useState(null);
  const [documentPhotoBusy, setDocumentPhotoBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadDocumentPhoto = useCallback(async () => {
    if (!clientId) {
      setDocumentPhoto(null);
      return;
    }
    try {
      const meta = await getClientDocumentPhoto(clientId);
      setDocumentPhoto(meta);
    } catch (err) {
      console.error('Error cargando foto de documento:', err);
      setDocumentPhoto(null);
    }
  }, [clientId]);

  const loadClientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [clientsData, reservationsData, balanceData] = await Promise.all([
        fetchClients(),
        fetchReservations(),
        getClientBalance(clientId).catch(() => null)
      ]);

      const foundClient = clientsData.find((c) => c.id === parseInt(clientId, 10));
      const clientReservations = reservationsData.filter(
        (r) => r.mainClientId === parseInt(clientId, 10)
      );

      if (!foundClient) {
        setError('Cliente no encontrado');
        return;
      }

      setClient(foundClient);
      setReservations(clientReservations);
      setClientBalance(balanceData);
      await loadDocumentPhoto();
    } catch (err) {
      console.error('Error cargando datos del cliente:', err);
      setError('Error al cargar los datos del cliente');
    } finally {
      setLoading(false);
    }
  }, [clientId, loadDocumentPhoto]);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId, loadClientData]);

  const handleEditField = (fieldName) => {
    setEditingField(fieldName);
  };

  const handleSaveField = (updatedClient) => {
    setClient(updatedClient);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
  };

  const handleClientUpdated = (updatedClient) => {
    setClient(updatedClient);
    setIsEditModalOpen(false);
  };

  const handleEmailClick = () => {
    if (client.email) {
      notify({
        title: 'Próximamente',
        message: `Funcionalidad de email próximamente disponible.\n\nSe enviará un email a: ${client.email}`,
        type: 'info'
      });
    } else {
      notify({
        title: 'Sin email',
        message:
          'Este cliente no tiene email registrado. Actualiza su información para poder contactarlo por email.',
        type: 'warning'
      });
    }
  };

  const handleWhatsAppClick = () => {
    if (client.phone) {
      notify({
        title: 'Próximamente',
        message: `Funcionalidad de WhatsApp próximamente disponible.\n\nSe enviará un mensaje al: ${client.phone}`,
        type: 'info'
      });
    } else {
      notify({
        title: 'Sin teléfono',
        message:
          'Este cliente no tiene teléfono registrado. Actualiza su información para poder contactarlo por WhatsApp.',
        type: 'warning'
      });
    }
  };

  const handleDniPhotoUpload = async (fileList) => {
    const file = fileList?.[0];
    if (!file || !client?.id || documentPhotoBusy) return;
    setDocumentPhotoBusy(true);
    try {
      const meta = await uploadClientDocumentPhoto(client.id, file);
      setDocumentPhoto(meta);
      notify({
        title: 'Foto guardada',
        message: 'La foto del documento se subió correctamente.',
        type: 'success'
      });
    } catch (err) {
      notify({
        title: 'Error',
        message: err?.message || 'No se pudo subir la foto del documento',
        type: 'error'
      });
    } finally {
      setDocumentPhotoBusy(false);
      if (dniPhotoInputRef.current) dniPhotoInputRef.current.value = '';
    }
  };

  const handleViewDniPhoto = async () => {
    if (!client?.id || !documentPhoto || documentPhotoBusy) return;
    setDocumentPhotoBusy(true);
    try {
      await openClientDocumentPhoto(client.id);
    } catch (err) {
      try {
        await downloadClientDocumentPhoto(client.id, documentPhoto.originalName);
      } catch (downloadErr) {
        notify({
          title: 'Error',
          message:
            downloadErr?.message ||
            err?.message ||
            'No se pudo abrir la foto del documento',
          type: 'error'
        });
      }
    } finally {
      setDocumentPhotoBusy(false);
    }
  };

  const handleDeleteDniPhoto = async () => {
    if (!client?.id || !documentPhoto || documentPhotoBusy) return;
    const ok = await confirm({
      title: 'Eliminar foto',
      message: '¿Eliminar la foto del documento de identidad?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    setDocumentPhotoBusy(true);
    try {
      await deleteClientDocumentPhoto(client.id);
      setDocumentPhoto(null);
      notify({
        title: 'Foto eliminada',
        message: 'Se eliminó la foto del documento.',
        type: 'success'
      });
    } catch (err) {
      notify({
        title: 'Error',
        message: err?.message || 'No se pudo eliminar la foto del documento',
        type: 'error'
      });
    } finally {
      setDocumentPhotoBusy(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      ingresada: 'Ingresada',
      checked_out: 'Check-out',
      cancelled: 'Cancelada',
      PENDIENTE: 'Pendiente',
      CONFIRMADA: 'Confirmada',
      INGRESADA: 'Ingresada',
      FINALIZADA: 'Finalizada',
      CANCELADA: 'Cancelada',
      NO_PRESENTADA: 'No presentada'
    };
    return statusLabels[status] || status;
  };

  const getReservationSaldo = (reservationId) => {
    const fromBalance = clientBalance?.reservations?.find(
      (r) => r.reservationId === reservationId
    );
    if (fromBalance) return fromBalance.saldo;
    return null;
  };

  const getActiveReservations = () => {
    return reservations.filter(
      (r) =>
        !['FINALIZADA', 'CANCELADA', 'NO_PRESENTADA', 'checked_out', 'cancelled'].includes(
          r.status
        )
    );
  };

  const getCompletedReservations = () => {
    return reservations.filter((r) => ['FINALIZADA', 'checked_out'].includes(r.status));
  };

  if (loading) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.loadingContainer}>
          <div className={styles.loading}>Cargando datos del cliente...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>{error}</div>
          <button type="button" onClick={loadClientData} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>Cliente no encontrado</div>
          <button
            type="button"
            onClick={() => navigate('/estado-de-cuentas')}
            className={styles.retryButton}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const totalBalance = clientBalance?.balance ?? 0;
  const activeReservations = getActiveReservations();
  const completedReservations = getCompletedReservations();

  const cobrosMovimientos = clientBalance?.cobros || [];
  const isDevolucionMovimiento = (cobro) =>
    String(cobro?.motivo || '') === MOTIVO_DEVOLUCION || Number(cobro?.montoARS) < 0;
  const totalDevolucionesCliente = cobrosMovimientos
    .filter(isDevolucionMovimiento)
    .reduce((sum, cobro) => sum + Math.abs(Number(cobro.montoARS) || 0), 0);
  const totalCobrosCliente = cobrosMovimientos
    .filter((cobro) => !isDevolucionMovimiento(cobro))
    .reduce((sum, cobro) => sum + Math.abs(Number(cobro.montoARS) || 0), 0);

  const documentLabel =
    client.documentType && client.documentNumber
      ? `${client.documentType} ${client.documentNumber}`
      : client.documentNumber
        ? String(client.documentNumber)
        : client.documentType
          ? String(client.documentType)
          : '';

  const birthDateLabel = formatBirthDateDisplay(client.birthDate) || '';
  const emailValue = String(client.email || '').trim();
  const phoneValue = String(client.phone || '').trim();
  const addressValue = String(getAddressFromNotes(client.notes) || '').trim();
  const countryValue = String(client.country || '').trim();
  const provinceValue = String(client.province || '').trim();
  const cityValue = String(client.city || '').trim();

  const locationLines = [
    addressValue ? { field: 'address', value: addressValue, openModal: true } : null,
    countryValue ? { field: 'country', value: countryValue } : null,
    provinceValue ? { field: 'province', value: provinceValue } : null,
    cityValue ? { field: 'city', value: cityValue } : null
  ].filter(Boolean);

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidePanel} aria-label="Ficha del cliente">
        <div className={styles.sidePanelHeader}>
          <div className={styles.sidePanelHeaderTop}>
            <h2>Cliente #{client.id}</h2>
            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className={styles.headerIconBtn}
                title="Editar cliente"
                aria-label="Editar cliente"
                data-testid="client-edit-profile"
              >
                <FaPen />
              </button>
            </div>
          </div>
          <div className={styles.guestInfo}>
            <div className={styles.guestName}>
              {client.firstName} {client.lastName}
            </div>
            {documentLabel ? (
              <button
                type="button"
                className={styles.profileTextBtn}
                onClick={() => handleEditField('document')}
                data-testid="client-profile-field-document"
              >
                {documentLabel}
              </button>
            ) : null}
            {birthDateLabel ? (
              <p
                className={styles.guestDates}
                data-testid="client-profile-field-birthDate"
              >
                {birthDateLabel}
              </p>
            ) : null}
            <div className={styles.guestDates}>
              Cliente desde {new Date(client.createdAt).getFullYear()}
            </div>
          </div>
        </div>

        <div className={styles.sidePanelContent}>
          <div className={styles.profileSheet} data-testid="client-profile-sheet">
            {emailValue ? (
              <div className={styles.profileLine} data-testid="client-profile-field-email">
                <button
                  type="button"
                  className={styles.inlineContactBtn}
                  onClick={handleEmailClick}
                  title="Enviar email"
                  aria-label="Enviar email"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.profileTextBtn}
                  onClick={() => handleEditField('email')}
                >
                  {emailValue}
                </button>
              </div>
            ) : null}
            {phoneValue ? (
              <div className={styles.profileLine} data-testid="client-profile-field-phone">
                <button
                  type="button"
                  className={styles.inlineContactBtn}
                  onClick={handleWhatsAppClick}
                  title="Enviar WhatsApp"
                  aria-label="Enviar WhatsApp"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.profileTextBtn}
                  onClick={() => handleEditField('phone')}
                >
                  {phoneValue}
                </button>
              </div>
            ) : null}
            {locationLines.length > 0 ? (
              <div className={styles.locationBlock} data-testid="client-profile-location">
                <span className={styles.locationIcon} aria-hidden="true">
                  <FiMapPin />
                </span>
                <div className={styles.locationLines}>
                  {locationLines.map((item) => (
                    <button
                      key={item.field}
                      type="button"
                      className={styles.profileTextBtn}
                      onClick={() =>
                        item.openModal ? setIsEditModalOpen(true) : handleEditField(item.field)
                      }
                      data-testid={`client-profile-field-${item.field}`}
                    >
                      {item.value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          <div className={styles.widgetsStack} data-testid="client-widgets">
            <section className={styles.widget} aria-labelledby="widget-dni-photo" data-testid="client-dni-photo-card">
              <h2 id="widget-dni-photo" className={styles.widgetTitle}>
                Foto del DNI
              </h2>
              <p className={styles.dniPhotoHint}>
                Foto del DNI o documento de identidad del cliente
              </p>
              <div className={styles.dniPhotoMeta}>
                {documentPhoto ? documentPhoto.originalName || 'Foto cargada' : 'Sin foto cargada'}
              </div>
              <div className={styles.dniPhotoActions}>
                <input
                  ref={dniPhotoInputRef}
                  id="client-dni-photo-input"
                  type="file"
                  accept={DNI_PHOTO_ACCEPT}
                  className={styles.dniPhotoInput}
                  disabled={documentPhotoBusy}
                  onChange={(e) => handleDniPhotoUpload(e.target.files)}
                />
                <button
                  type="button"
                  className={styles.uploadButton}
                  disabled={documentPhotoBusy}
                  onClick={() => dniPhotoInputRef.current?.click()}
                  data-testid="client-dni-photo-upload"
                >
                  {documentPhotoBusy
                    ? 'Procesando…'
                    : documentPhoto
                      ? 'Reemplazar foto'
                      : 'Subir foto'}
                </button>
                <button
                  type="button"
                  className={styles.viewButton}
                  disabled={documentPhotoBusy || !documentPhoto}
                  onClick={handleViewDniPhoto}
                  data-testid="client-dni-photo-view"
                >
                  Ver documento
                </button>
                {documentPhoto ? (
                  <button
                    type="button"
                    className={styles.deletePhotoButton}
                    disabled={documentPhotoBusy}
                    onClick={handleDeleteDniPhoto}
                    data-testid="client-dni-photo-delete"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </section>

            <section className={styles.widget} aria-labelledby="widget-reservas" data-testid="client-reservas-widget">
              <div className={styles.widgetHeaderRow}>
                <h2 id="widget-reservas" className={styles.widgetTitle}>
                  Reservas
                </h2>
                <div className={styles.reservationCounts} aria-label="Resumen por estado">
                  <span>Activas: {activeReservations.length}</span>
                  <span>Completadas: {completedReservations.length}</span>
                  <span>Total: {reservations.length}</span>
                </div>
              </div>
              {reservations.length === 0 ? (
                <div className={styles.noDataMessage}>
                  Este cliente no tiene reservas registradas
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.reservationsTable}>
                    <thead className={styles.tableHeader}>
                      <tr>
                        <th>ID</th>
                        <th>Habitación</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Estado</th>
                        <th>Saldo</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {reservations.map((reservation) => {
                        const saldo = getReservationSaldo(reservation.id);
                        return (
                          <tr
                            key={reservation.id}
                            className={styles.reservationRow}
                            onClick={() => navigate(`/reservations/${reservation.id}`)}
                          >
                            <td>
                              <ReservationIdChip
                                id={reservation.id}
                                source={reservation.source}
                                status={reservation.status}
                              />
                            </td>
                            <td>{reservation.room?.name || 'Sin asignar'}</td>
                            <td>{formatDate(reservation.checkIn)}</td>
                            <td>{formatDate(reservation.checkOut)}</td>
                            <td>
                              <span
                                className={`${styles.statusValue} ${styles[reservation.status] || ''}`}
                              >
                                {getStatusLabel(reservation.status)}
                              </span>
                            </td>
                            <td className={styles.totalAmount}>
                              {saldo == null
                                ? '—'
                                : `${formatMoneyArs(Math.abs(saldo))}${
                                    saldo > 0 ? ' (debe)' : saldo < 0 ? ' (a favor)' : ''
                                  }`}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.viewButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/reservations/${reservation.id}`);
                                }}
                              >
                                Ver Detalles
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

            <section
              className={styles.widget}
              aria-labelledby="widget-resumen-financiero"
              data-testid="client-resumen-financiero-widget"
            >
              <h2 id="widget-resumen-financiero" className={styles.widgetTitle}>
                Resumen financiero
              </h2>
              <div className={styles.balanceGrid}>
                <div className={styles.balanceCard}>
                  <h3>Totales</h3>
                  <div className={styles.balanceDetails}>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>
                        {totalBalance < 0
                          ? 'Saldo a favor:'
                          : totalBalance > 0
                            ? 'Saldo deudor:'
                            : 'Saldo:'}
                      </span>
                      <span
                        className={`${styles.value} ${
                          totalBalance > 0 ? styles.negative : styles.positive
                        }`}
                      >
                        {formatMoneyArs(Math.abs(totalBalance))}
                      </span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Total cargos:</span>
                      <span className={styles.value}>
                        {formatMoneyArs(clientBalance?.totalCharges || 0)}
                      </span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Total cobros:</span>
                      <span className={styles.value} data-testid="client-summary-total-cobros">
                        {formatMoneyArs(totalCobrosCliente)}
                      </span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Total devoluciones:</span>
                      <span
                        className={styles.value}
                        data-testid="client-summary-total-devoluciones"
                      >
                        {formatMoneyArs(totalDevolucionesCliente)}
                      </span>
                    </div>
                    <div className={styles.balanceItem}>
                      <span className={styles.label}>Última actividad:</span>
                      <span className={styles.value}>
                        {reservations.length > 0
                          ? formatDate(reservations[0].createdAt)
                          : 'Sin actividad'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <ClientBalanceMovements
                cargos={clientBalance?.cargos || []}
                cobros={clientBalance?.cobros || []}
                onChanged={() => loadClientData()}
              />
            </section>
          </div>
        </div>
      </div>

      {editingField && (
        <FieldEditor
          fieldName={editingField}
          currentValue={client[editingField]}
          onSave={handleSaveField}
          onCancel={handleCancelEdit}
          clientId={client.id}
          client={client}
        />
      )}
      <EditClientModal
        client={client}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onClientUpdated={handleClientUpdated}
      />
      {noticeDialog}
      {confirmDialog}
    </div>
  );
};

export default ClientDetails;
