import React, { useState, useEffect } from 'react';
import SeasonBlockCard from './SeasonBlockCard';
import SeasonBlockModal from './SeasonBlockModal';
import ServiceTypesModal from './ServiceTypesModal';
import DynamicPricingConfigPanel from './DynamicPricingConfigPanel';
import SeasonalCurveWrapper from './SeasonalCurveWrapper';
import ConfirmationModal from '../ConfirmationModal';
import styles from './TariffManagement.module.css';
import { FiPlus, FiSettings, FiCalendar, FiDollarSign, FiTrendingUp, FiGrid } from 'react-icons/fi';

export default function TariffManagement({ hotelId = 'default-hotel' }) {
  const [loading, setLoading] = useState(true);
  const [seasonBlocks, setSeasonBlocks] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [activeSection, setActiveSection] = useState('blocks'); // 'blocks', 'intelligent', 'seasonal', 'prices'
  
  // Estados para modales
  const [showSeasonBlockModal, setShowSeasonBlockModal] = useState(false);
  const [showServiceTypesModal, setShowServiceTypesModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Estados para notificaciones
  const [notification, setNotification] = useState(null);

  // Estados para visualización de tarifas por fecha
  const [pricesByDate, setPricesByDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    loadInitialData();
  }, [hotelId]);

  useEffect(() => {
    if (activeSection === 'prices' && selectedDate) {
      loadPricesByDate(selectedDate);
    }
  }, [activeSection, selectedDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSeasonBlocks(),
        loadServiceTypes(),
        loadRoomTypes()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Error al cargar los datos iniciales', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonBlocks = async () => {
    try {
      const response = await fetch(`${API_URL}/season-blocks?hotelId=${hotelId}`);
      if (response.ok) {
        const result = await response.json();
        setSeasonBlocks(result.data || []);
      } else {
        throw new Error('Error al cargar bloques de temporada');
      }
    } catch (error) {
      console.error('Error loading season blocks:', error);
      showNotification('Error al cargar los bloques de temporada', 'error');
    }
  };

  const loadServiceTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/service-types?hotelId=${hotelId}`);
      if (response.ok) {
        const result = await response.json();
        setServiceTypes(result.data || []);
      } else {
        throw new Error('Error al cargar tipos de servicio');
      }
    } catch (error) {
      console.error('Error loading service types:', error);
      showNotification('Error al cargar los tipos de servicio', 'error');
    }
  };

  const loadRoomTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/room-types/${hotelId}`);
      if (response.ok) {
        const roomTypesData = await response.json();
        setRoomTypes(roomTypesData || []);
      } else {
        throw new Error('Error al cargar tipos de habitación');
      }
    } catch (error) {
      console.error('Error loading room types:', error);
      showNotification('Error al cargar los tipos de habitación', 'error');
    }
  };

  const loadPricesByDate = async (date) => {
    setLoadingPrices(true);
    try {
      const response = await fetch(`${API_URL}/tariff-calculations/prices-by-date?fecha=${date}&hotelId=${hotelId}`);
      if (response.ok) {
        const result = await response.json();
        setPricesByDate(result.data);
      } else {
        throw new Error('Error al cargar precios por fecha');
      }
    } catch (error) {
      console.error('Error loading prices by date:', error);
      showNotification('Error al cargar los precios para la fecha seleccionada', 'error');
    } finally {
      setLoadingPrices(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateBlock = () => {
    setEditingBlock(null);
    setShowSeasonBlockModal(true);
  };

  const handleEditBlock = (block) => {
    setEditingBlock(block);
    setShowSeasonBlockModal(true);
  };

  const handleDeleteBlock = (block) => {
    setConfirmDelete({
      type: 'danger',
      title: 'Eliminar Bloque de Temporada',
      message: `¿Estás seguro de que deseas eliminar el bloque "${block.name}"? Esta acción eliminará también todos los precios y ajustes asociados.`,
      onConfirm: () => confirmDeleteBlock(block.id)
    });
  };

  const confirmDeleteBlock = async (blockId) => {
    try {
      const response = await fetch(`${API_URL}/season-blocks/${blockId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSeasonBlocks();
        showNotification('Bloque de temporada eliminado correctamente', 'success');
      } else {
        const result = await response.json();
        throw new Error(result.errors?.[0] || 'Error al eliminar el bloque');
      }
    } catch (error) {
      console.error('Error deleting season block:', error);
      showNotification(error.message, 'error');
    }
    setConfirmDelete(null);
  };

  const handleBlockSaved = () => {
    setShowSeasonBlockModal(false);
    setEditingBlock(null);
    loadSeasonBlocks();
    showNotification(
      editingBlock ? 'Bloque actualizado correctamente' : 'Bloque creado correctamente',
      'success'
    );
  };

  const handleServiceTypesSaved = () => {
    setShowServiceTypesModal(false);
    loadServiceTypes();
    showNotification('Tipos de servicio actualizados correctamente', 'success');
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando configuración de tarifas...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>
              <FiDollarSign className={styles.titleIcon} />
              Gestión de Tarifas
            </h2>
            <p className={styles.subtitle}>
              Configura bloques de temporada, precios inteligentes y ajustes por servicio
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setShowServiceTypesModal(true)}
            >
              <FiSettings />
              Tipos de Servicio
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleCreateBlock}
            >
              <FiPlus />
              Nuevo Bloque
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.navigationTabs}>
        <button
          className={`${styles.navTab} ${activeSection === 'blocks' ? styles.active : ''}`}
          onClick={() => setActiveSection('blocks')}
        >
          <FiCalendar />
          Bloques de Temporada
        </button>
        <button
          className={`${styles.navTab} ${activeSection === 'intelligent' ? styles.active : ''}`}
          onClick={() => setActiveSection('intelligent')}
        >
          <FiTrendingUp />
          Precios Inteligentes
        </button>
        <button
          className={`${styles.navTab} ${activeSection === 'seasonal' ? styles.active : ''}`}
          onClick={() => setActiveSection('seasonal')}
        >
          <span>📊</span>
          Curva Estacional
        </button>
        <button
          className={`${styles.navTab} ${activeSection === 'prices' ? styles.active : ''}`}
          onClick={() => setActiveSection('prices')}
        >
          <FiGrid />
          Precios por Fecha
        </button>
      </div>

      {/* Content Sections */}
      <div className={styles.content}>
        {activeSection === 'blocks' && (
          <div className={styles.blocksSection}>
            {/* Stats */}
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <FiCalendar />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{seasonBlocks.length}</div>
                  <div className={styles.statLabel}>Bloques de Temporada</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <FiSettings />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{serviceTypes.length}</div>
                  <div className={styles.statLabel}>Tipos de Servicio</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <FiDollarSign />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{roomTypes.length}</div>
                  <div className={styles.statLabel}>Tipos de Habitación</div>
                </div>
              </div>
            </div>

            {/* Season Blocks Grid */}
            {seasonBlocks.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📅</div>
                <h3>No hay bloques de temporada</h3>
                <p>Crea tu primer bloque de temporada para comenzar a gestionar las tarifas</p>
                <button
                  className={styles.primaryButton}
                  onClick={handleCreateBlock}
                >
                  <FiPlus />
                  Crear Primer Bloque
                </button>
              </div>
            ) : (
              <div className={styles.blocksGrid}>
                {seasonBlocks.map(block => (
                  <SeasonBlockCard
                    key={block.id}
                    block={block}
                    onEdit={handleEditBlock}
                    onDelete={handleDeleteBlock}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'intelligent' && (
          <div className={styles.intelligentSection}>
            <div className={styles.sectionHeader}>
              <h3>Configuración de Precios Inteligentes</h3>
              <p>Gestiona los factores dinámicos que ajustan automáticamente los precios</p>
            </div>
            <DynamicPricingConfigPanel hotelId={hotelId} />
          </div>
        )}

        {activeSection === 'seasonal' && (
          <div className={styles.seasonalSection}>
            <div className={styles.sectionHeader}>
              <h3>Curva Estacional</h3>
              <p>Configura la curva de precios base a lo largo del año</p>
            </div>
            <SeasonalCurveWrapper hotelId={hotelId} />
          </div>
        )}

        {activeSection === 'prices' && (
          <div className={styles.pricesSection}>
            <div className={styles.sectionHeader}>
              <h3>Precios por Fecha</h3>
              <p>Visualiza las tarifas calculadas para una fecha específica</p>
            </div>
            
            {/* Date Selector */}
            <div className={styles.dateSelector}>
              <label htmlFor="date-selector">Seleccionar fecha:</label>
              <input
                id="date-selector"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  loadPricesByDate(e.target.value);
                }}
                className={styles.dateInput}
              />
            </div>

            {/* Loading State */}
            {loadingPrices && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Cargando precios para {selectedDate}...</p>
              </div>
            )}

            {/* Prices Table */}
            {!loadingPrices && pricesByDate && (
              <div className={styles.pricesTableContainer}>
                {pricesByDate.empty ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📅</div>
                    <h3>No hay precios disponibles</h3>
                    <p>{pricesByDate.message}</p>
                  </div>
                ) : (
                  <div className={styles.pricesInfo}>
                    <div className={styles.seasonBlockInfo}>
                      <h4>Bloque de Temporada: {pricesByDate.seasonBlock.name}</h4>
                      <p>{pricesByDate.seasonBlock.description}</p>
                      <p>Período: {new Date(pricesByDate.seasonBlock.startDate).toLocaleDateString()} - {new Date(pricesByDate.seasonBlock.endDate).toLocaleDateString()}</p>
                    </div>
                    
                    <div className={styles.pricesTable}>
                      <table>
                        <thead>
                          <tr>
                            <th>Tipo de Habitación</th>
                            {pricesByDate.serviceTypes.map(service => (
                              <th key={service.id}>{service.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pricesByDate.tariffMatrix.map(room => (
                            <tr key={room.roomType.id}>
                              <td className={styles.roomTypeCell}>
                                <strong>{room.roomType.name}</strong>
                                <br />
                                <small>Base: ${room.basePrice.toLocaleString()}</small>
                              </td>
                              {room.services.map(service => (
                                <td key={service.serviceType.id} className={styles.priceCell}>
                                  <div className={styles.finalPrice}>
                                    ${service.finalPrice.toLocaleString()}
                                  </div>
                                  {service.hasAdjustment && (
                                    <div className={styles.adjustmentInfo}>
                                      <small>
                                        {service.adjustmentMode === 'FIXED' 
                                          ? `+$${service.adjustmentValue.toLocaleString()}`
                                          : `+${service.adjustmentValue}%`
                                        }
                                      </small>
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {showSeasonBlockModal && (
        <SeasonBlockModal
          isOpen={showSeasonBlockModal}
          onClose={() => {
            setShowSeasonBlockModal(false);
            setEditingBlock(null);
          }}
          onSave={handleBlockSaved}
          block={editingBlock}
          serviceTypes={serviceTypes}
          roomTypes={roomTypes}
          hotelId={hotelId}
        />
      )}

      {showServiceTypesModal && (
        <ServiceTypesModal
          isOpen={showServiceTypesModal}
          onClose={() => setShowServiceTypesModal(false)}
          onSave={handleServiceTypesSaved}
          serviceTypes={serviceTypes}
          hotelId={hotelId}
        />
      )}

      {confirmDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
          title={confirmDelete.title}
          message={confirmDelete.message}
          type={confirmDelete.type}
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      )}

      {/* Notificación */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          <div className={styles.notificationContent}>
            <span>{notification.message}</span>
            <button
              className={styles.notificationClose}
              onClick={() => setNotification(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 