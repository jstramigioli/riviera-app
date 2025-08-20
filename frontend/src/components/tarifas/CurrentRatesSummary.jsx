import React, { useState, useEffect } from 'react';
import styles from '../../styles/TariffDashboard.module.css';

export default function CurrentRatesSummary() {
  const [roomTypes, setRoomTypes] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [seasonBlocks, setSeasonBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar tipos de habitación
        const roomTypesResponse = await fetch('/api/room-types');
        const roomTypesData = await roomTypesResponse.json();
        setRoomTypes(roomTypesData);

        // Cargar tipos de servicio
        const serviceTypesResponse = await fetch('/api/service-types');
        const serviceTypesData = await serviceTypesResponse.json();
        setServiceTypes(serviceTypesData);

        // Cargar bloques de temporada
        const seasonBlocksResponse = await fetch('/api/season-blocks');
        const seasonBlocksData = await seasonBlocksResponse.json();
        
        // Filtrar solo bloques confirmados y ordenar por fecha de inicio
        const confirmedBlocks = seasonBlocksData
          .filter(block => !block.isDraft)
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        setSeasonBlocks(confirmedBlocks);

        // Encontrar el bloque activo actual
        const today = new Date();
        const activeBlock = confirmedBlocks.find(block => {
          const startDate = new Date(block.startDate);
          const endDate = new Date(block.endDate);
          return today >= startDate && today <= endDate;
        });

        // Si hay un bloque activo, seleccionarlo por defecto
        if (activeBlock) {
          setSelectedBlockId(activeBlock.id);
          setSelectedBlock(activeBlock);
        } else if (confirmedBlocks.length > 0) {
          // Si no hay bloque activo, seleccionar el más reciente
          setSelectedBlockId(confirmedBlocks[0].id);
          setSelectedBlock(confirmedBlocks[0]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading rates:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Cargar precios cuando cambia el bloque seleccionado
  useEffect(() => {
    const loadPrices = async () => {
      if (!selectedBlockId) return;

      try {
        const pricesResponse = await fetch(`/api/season-blocks/${selectedBlockId}/calculated-prices?hotelId=default-hotel`);
        const pricesData = await pricesResponse.json();
        if (pricesData.data && pricesData.data.calculatedPrices) {
          setSeasonPrices(pricesData.data.calculatedPrices);
        }
      } catch (error) {
        console.error('Error loading prices:', error);
        setSeasonPrices([]);
      }
    };

    loadPrices();
  }, [selectedBlockId]);

  const handleBlockChange = (blockId) => {
    setSelectedBlockId(blockId);
    const block = seasonBlocks.find(b => b.id === blockId);
    setSelectedBlock(block);
  };

  const getPriceForRoomAndService = (roomTypeId, serviceTypeId) => {
    const price = seasonPrices.find(p => 
      p.roomTypeId === roomTypeId && p.serviceTypeId === serviceTypeId
    );
    return price?.roundedPrice || price?.calculatedPrice || price?.basePrice || 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isCurrentlyActive = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return today >= start && today <= end;
  };

  if (loading) {
    return (
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>📊 Tarifas Actuales</h3>
        <div className={styles.loading}>Cargando tarifas...</div>
      </div>
    );
  }

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}>📊 Tarifas por Bloque de Temporada</h3>
      
      {seasonBlocks.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay bloques de temporada configurados</p>
        </div>
      ) : (
        <>
          <div className={styles.blockSelector}>
            <label htmlFor="blockSelect" className={styles.selectorLabel}>
              Seleccionar bloque de temporada:
            </label>
            <select
              id="blockSelect"
              value={selectedBlockId || ''}
              onChange={(e) => handleBlockChange(e.target.value)}
              className={styles.blockSelect}
            >
              {seasonBlocks.map(block => {
                const isActive = isCurrentlyActive(block.startDate, block.endDate);
                const status = isActive ? ' (Activo)' : '';
                return (
                  <option key={block.id} value={block.id}>
                    {block.name} - {formatDate(block.startDate)} a {formatDate(block.endDate)}{status}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedBlock && (
            <div className={styles.selectedBlockInfo}>
              <div className={styles.blockName}>
                <strong>Bloque seleccionado:</strong> {selectedBlock.name}
              </div>
              <div className={styles.blockDates}>
                {formatDate(selectedBlock.startDate)} - {formatDate(selectedBlock.endDate)}
                {isCurrentlyActive(selectedBlock.startDate, selectedBlock.endDate) && (
                  <span className={styles.activeIndicator}> 🟢 Activo</span>
                )}
              </div>
              <div className={styles.blockMode}>
                Modo de ajuste: {selectedBlock.serviceAdjustmentMode === 'PERCENTAGE' ? 'Porcentaje' : 'Monto Fijo'}
              </div>
            </div>
          )}

          {roomTypes.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay tipos de habitación configurados</p>
            </div>
          ) : (
            <div className={styles.ratesList}>
              {roomTypes.map(roomType => (
                <div key={roomType.id} className={styles.rateItem}>
                  <div className={styles.roomTypeInfo}>
                    <span className={styles.roomTypeName}>{roomType.name}</span>
                    <span className={styles.roomTypeCapacity}>
                      ({roomType.capacity} personas)
                    </span>
                  </div>
                  
                  {selectedBlock && serviceTypes.length > 0 && (
                    <div className={styles.serviceRates}>
                      {serviceTypes.map(serviceType => {
                        const price = getPriceForRoomAndService(roomType.id, serviceType.id);
                        return (
                          <div key={serviceType.id} className={styles.serviceRate}>
                            <span className={styles.serviceName}>
                              {serviceType.name}:
                            </span>
                            <span className={styles.servicePrice}>
                              ${price.toLocaleString('es-AR')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {(!selectedBlock || serviceTypes.length === 0) && (
                    <div className={styles.rateInfo}>
                      <span className={styles.ratePrice}>
                        Sin tarifa configurada
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      <div className={styles.cardFooter}>
        <small className={styles.lastUpdate}>
          Última actualización: {new Date().toLocaleDateString('es-AR')}
        </small>
      </div>
    </div>
  );
} 