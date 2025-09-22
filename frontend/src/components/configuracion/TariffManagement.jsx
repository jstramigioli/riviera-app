import React, { useState, useEffect } from 'react';
import SeasonBlockBarV2 from './SeasonBlockBarV2';
import DynamicPricingConfigPanel from './DynamicPricingConfigPanel';
import RoundingConfigPanel from './RoundingConfigPanel';
import ConfirmationModal from '../ConfirmationModal';
import styles from './TariffManagement.module.css';
import { FiPlus, FiSettings, FiCalendar, FiDollarSign, FiTrendingUp, FiGrid, FiPercent, FiChevronDown } from 'react-icons/fi';

export default function TariffManagement({ hotelId = 'default-hotel' }) {
  const [loading, setLoading] = useState(true);
  const [seasonBlocks, setSeasonBlocks] = useState([]);
  const [activeSection, setActiveSection] = useState('blocks'); // 'blocks', 'intelligent', 'prices', 'rounding'
  
  // Estado para key reset de bloques
  const [blockKeys, setBlockKeys] = useState({});

  // Estados para notificaciones
  const [notification, setNotification] = useState(null);

  // Estados para visualización de tarifas por fecha
  const [pricesByDate, setPricesByDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Estados para manejo de bloques concluidos
  const [showConcludedBlocks, setShowConcludedBlocks] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Función para formatear fechas en español para nombres de bloques
  const formatDateForBlockName = (date) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Crear la fecha correctamente para evitar problemas de zona horaria
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const monthName = months[month - 1]; // Los meses en el array son 0-indexed
    
    return { day, month: monthName, year };
  };

  // Función para generar el nombre por defecto del bloque basado en las fechas
  const generateDefaultBlockName = (startDate, endDate) => {
    const start = formatDateForBlockName(startDate);
    const end = formatDateForBlockName(endDate);
    
    // Si es el mismo año
    if (start.year === end.year) {
      // Si es el mismo mes
      if (start.month === end.month) {
        return `${start.day} al ${end.day} de ${start.month} (${start.year})`;
      } else {
        return `${start.day} de ${start.month} al ${end.day} de ${end.month} (${start.year})`;
      }
    } else {
      // Diferentes años
      return `${start.day} de ${start.month} (${start.year}) al ${end.day} de ${end.month} (${end.year})`;
    }
  };

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
      await loadSeasonBlocks();
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

  const handleCreateBlock = async () => {
    try {
      // Definir fechas por defecto
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 días desde hoy
      
      // Generar nombre por defecto basado en las fechas
      const defaultName = generateDefaultBlockName(startDate, endDate);
      
      // Crear un nuevo bloque automáticamente en modo borrador
      const newBlockData = {
        name: defaultName,
        description: 'Bloque creado automáticamente',
        startDate: startDate,
        endDate: endDate,
        useProportions: true,
        serviceAdjustmentMode: 'PERCENTAGE',
        useBlockServices: false,
        isDraft: true // Siempre crear en modo borrador
      };

      const response = await fetch(`${API_URL}/season-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newBlockData)
      });

      if (response.ok) {
        await response.json();
        showNotification('Bloque creado exitosamente en modo borrador', 'success');
        loadSeasonBlocks(); // Recargar la lista
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear el bloque');
      }
    } catch (error) {
      console.error('Error creating season block:', error);
      showNotification(error.message || 'Error al crear el bloque de temporada', 'error');
    }
  };







  const handleBlockSaved = (updatedBlock) => {
    showNotification('Bloque guardado exitosamente', 'success');
    loadSeasonBlocks();
  };

  const handleBlockDeleted = () => {
    showNotification('Bloque eliminado exitosamente', 'success');
    loadSeasonBlocks();
  };

  // Función para resetear un bloque específico (key reset)
  const resetBlock = (blockId) => {
    setBlockKeys(prev => ({
      ...prev,
      [blockId]: (prev[blockId] || 0) + 1
    }));
    console.log(`Resetting block ${blockId} with new key`);
  };

  // Función para verificar si un bloque ya concluyó
  const isBlockConcluded = (block) => {
    if (!block.endDate) return false;
    const today = new Date();
    const endDate = new Date(block.endDate);
    return endDate < today;
  };

  // Función para filtrar y ordenar bloques
  const getFilteredAndSortedBlocks = () => {
    const today = new Date();
    
    // Separar bloques activos/futuros de los concluidos
    const activeBlocks = seasonBlocks.filter(block => !isBlockConcluded(block));
    const concludedBlocks = seasonBlocks.filter(block => isBlockConcluded(block));
    
    // Ordenar por fecha de inicio (más recientes primero)
    const sortByStartDate = (a, b) => {
      const dateA = new Date(a.startDate || '1900-01-01');
      const dateB = new Date(b.startDate || '1900-01-01');
      return dateB - dateA; // Orden descendente (más recientes primero)
    };
    
    const sortedActiveBlocks = activeBlocks.sort(sortByStartDate);
    const sortedConcludedBlocks = concludedBlocks.sort(sortByStartDate);
    
    // Si se muestran bloques concluidos, agregarlos al final
    if (showConcludedBlocks) {
      return [...sortedActiveBlocks, ...sortedConcludedBlocks];
    }
    
    return sortedActiveBlocks;
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
          className={`${styles.navTab} ${activeSection === 'prices' ? styles.active : ''}`}
          onClick={() => setActiveSection('prices')}
        >
          <FiGrid />
          Precios por Fecha
        </button>
        <button
          className={`${styles.navTab} ${activeSection === 'rounding' ? styles.active : ''}`}
          onClick={() => setActiveSection('rounding')}
        >
          <FiPercent />
          Redondeo
        </button>
      </div>

      {/* Content Sections */}
      <div className={styles.content}>
        {activeSection === 'blocks' && (
          <div className={styles.blocksSection}>
            {/* Season Blocks List */}
            {seasonBlocks.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📅</div>
                <h3>No hay bloques de temporada</h3>
                <button
                  className={styles.primaryButton}
                  onClick={handleCreateBlock}
                >
                  Crea tu primer bloque de temporada
                </button>
              </div>
            ) : (
              <>
                <div className={styles.blocksList}>
                  {/* Tarjeta para crear nuevo bloque */}
                  <button 
                    className={styles.newBlockCard}
                    onClick={handleCreateBlock}
                    type="button"
                  >
                    <div className={styles.newBlockContent}>
                      <div className={styles.newBlockIcon}>
                        <FiPlus />
                      </div>
                      <div className={styles.newBlockText}>
                        <h3 className={styles.newBlockTitle}>Nuevo Bloque</h3>
                      </div>
                    </div>
                  </button>
                  
                  {getFilteredAndSortedBlocks().map(block => (
                    <SeasonBlockBarV2
                      key={`${block.id}-${blockKeys[block.id] || 0}`}
                      block={block}
                      onSaved={handleBlockSaved}
                      onDeleted={handleBlockDeleted}
                      onBlockUpdated={loadSeasonBlocks}
                      onResetBlock={() => resetBlock(block.id)}
                      hotelId={hotelId}
                    />
                  ))}
                </div>
                
                {/* Botón para mostrar/ocultar bloques concluidos */}
                {seasonBlocks.some(block => isBlockConcluded(block)) && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginTop: '20px',
                    padding: '16px'
                  }}>
                    <button
                      onClick={() => setShowConcludedBlocks(!showConcludedBlocks)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: showConcludedBlocks ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: showConcludedBlocks ? 'white' : 'var(--color-text-main)',
                        border: '2px solid var(--color-primary)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-small)',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {showConcludedBlocks ? (
                        <>
                          <span>Ocultar bloques anteriores</span>
                          <FiChevronDown />
                        </>
                      ) : (
                        <>
                          <span>Mostrar bloques anteriores</span>
                          <FiChevronDown />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
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

        {activeSection === 'rounding' && (
          <div className={styles.roundingSection}>
            <div className={styles.sectionHeader}>
              <h3>Configuración de Redondeo</h3>
              <p>Define cómo se redondean los precios calculados en todo el sistema</p>
            </div>
            <RoundingConfigPanel hotelId={hotelId} />
          </div>
        )}
      </div>



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