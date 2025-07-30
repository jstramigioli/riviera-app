import React, { useState, useEffect } from 'react';
import { findAvailableRooms, getCalculatedRates } from '../services/api';
import { useTags } from '../hooks/useTags';
import '../styles/variables.css';

function RoomSelectionModal({ 
  isOpen, 
  onClose, 
  onRoomSelected, 
  requirements, 
  checkIn, 
  checkOut,
  reservationType = 'con_desayuno'
}) {
  const { tags } = useTags();
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedCombination, setSelectedCombination] = useState(null);
  const [error, setError] = useState(null);
  const [roomRates, setRoomRates] = useState({});
  const [loadingRates, setLoadingRates] = useState({});

  useEffect(() => {
    if (isOpen && requirements.requiredGuests) {
      searchAvailableRooms();
    }
  }, [isOpen, requirements, checkIn, checkOut]);

  // Cargar tarifas cuando se selecciona una habitación
  useEffect(() => {
    if (selectedRoomId && checkIn && checkOut) {
      loadRoomRates(selectedRoomId);
    }
  }, [selectedRoomId, checkIn, checkOut, reservationType]);

  const loadRoomRates = async (roomId) => {
    if (!roomId || !checkIn || !checkOut) return;

    setLoadingRates(prev => ({ ...prev, [roomId]: true }));
    
    try {
      // Obtener el tipo de habitación de la habitación seleccionada
      const selectedRoom = searchResults?.availableRooms.find(room => room.id === roomId);
      if (!selectedRoom) return;

      // Mapear el tipo de servicio a los parámetros de la API
      let serviceType = 'base';
      switch (reservationType) {
        case 'con_desayuno':
          serviceType = 'breakfast';
          break;
        case 'media_pension':
          serviceType = 'halfBoard';
          break;
        default:
          serviceType = 'base';
      }

      const rates = await getCalculatedRates(
        'default-hotel', // Por ahora hardcodeado
        selectedRoom.roomType.id,
        checkIn,
        checkOut,
        serviceType
      );

      setRoomRates(prev => ({
        ...prev,
        [roomId]: rates
      }));
    } catch (error) {
      console.error('Error cargando tarifas:', error);
      setRoomRates(prev => ({
        ...prev,
        [roomId]: { error: 'Error al cargar tarifas' }
      }));
    } finally {
      setLoadingRates(prev => ({ ...prev, [roomId]: false }));
    }
  };

  const searchAvailableRooms = async () => {
    if (!checkIn || !checkOut || !requirements.requiredGuests) return;

    setLoading(true);
    setError(null);
    try {
      const params = {
        checkIn,
        checkOut,
        requiredGuests: requirements.requiredGuests,
        requiredTags: requirements.requiredTags
      };

      const result = await findAvailableRooms(params);
      setSearchResults(result);
      
      // Seleccionar automáticamente la primera habitación si hay disponibles
      if (result.availableRooms.length > 0) {
        setSelectedRoomId(result.availableRooms[0].id);
        setSelectedCombination(null);
      }
    } catch (error) {
      console.error('Error buscando habitaciones disponibles:', error);
      setError('Error al buscar habitaciones disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedRoomId) {
      // Obtener las tarifas de la habitación seleccionada
      const roomRate = roomRates[selectedRoomId];
      const totalAmount = roomRate?.totalAmount || 0;
      
      // Pasar tanto el roomId como el totalAmount
      onRoomSelected(selectedRoomId, totalAmount);
      onClose();
    } else if (selectedCombination) {
      // Aquí podrías implementar la lógica para crear múltiples reservas
      alert('Funcionalidad de múltiples reservas será implementada próximamente');
    }
  };

  const getMatchingTags = (room) => {
    if (!requirements.requiredTags.length) return [];
    const roomTagIds = room.tags.map(tag => tag.id.toString());
    return requirements.requiredTags.filter(tagId => roomTagIds.includes(tagId));
  };

  const getTagScore = (room) => {
    if (!requirements.requiredTags.length) return 0;
    const matchingTags = getMatchingTags(room);
    return Math.round((matchingTags.length / requirements.requiredTags.length) * 10);
  };

  const getCapacityMatch = (room) => {
    const capacityDiff = room.maxPeople - requirements.requiredGuests;
    if (capacityDiff === 0) return { text: 'Capacidad exacta', color: 'var(--color-success)', priority: 1 };
    if (capacityDiff > 0) return { text: `${capacityDiff} persona(s) más`, color: 'var(--color-warning)', priority: 2 };
    return { text: `${Math.abs(capacityDiff)} persona(s) menos`, color: 'var(--color-danger)', priority: 3 };
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const getServiceTypeLabel = () => {
    switch (reservationType) {
      case 'con_desayuno':
        return 'Con desayuno';
      case 'media_pension':
        return 'Media pensión';
      default:
        return 'Solo alojamiento';
    }
  };

  const renderRoomCard = (room, isSelected) => {
    const matchingTags = getMatchingTags(room);
    const capacityMatch = getCapacityMatch(room);
    const tagScore = getTagScore(room);
    const roomRate = roomRates[room.id];
    const isLoadingRates = loadingRates[room.id];
    
    return (
      <div
        key={room.id}
        onClick={() => {
          setSelectedRoomId(room.id);
          setSelectedCombination(null);
        }}
        style={{
          padding: '16px',
          border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
          borderRadius: '8px',
          backgroundColor: isSelected ? 'var(--color-primary-light)' : 'white',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text)' }}>
              {room.name}
            </h4>
            
            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              <div>Tipo: {room.roomType.name}</div>
              <div>Capacidad: {room.maxPeople} personas</div>
              <div style={{ color: capacityMatch.color }}>
                {capacityMatch.text}
              </div>
            </div>

            {/* Información de tarifas */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                {getServiceTypeLabel()}
              </div>
              
              {isLoadingRates && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Calculando tarifas...
                </div>
              )}
              
              {roomRate && !isLoadingRates && !roomRate.error && (
                <div style={{ fontSize: '14px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                    Total: {formatPrice(roomRate.totalAmount)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {roomRate.numberOfNights} noches • Promedio: {formatPrice(roomRate.averageRatePerNight)}/noche
                  </div>
                </div>
              )}
              
              {roomRate?.error && (
                <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                  Error al cargar tarifas
                </div>
              )}
            </div>

            {/* Tags */}
            {matchingTags.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Etiquetas coincidentes ({matchingTags.length}/{requirements.requiredTags.length}):
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {matchingTags.map(tagId => {
                    const tag = tags.find(t => t.id.toString() === tagId);
                    return tag ? (
                      <span
                        key={tag.id}
                        style={{
                          backgroundColor: tag.color,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}
                      >
                        {tag.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', marginLeft: '12px' }}>
            {tagScore > 0 && (
              <div style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {tagScore}/10
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCombinationCard = (combination, isSelected) => {
    return (
      <div
        key={combination.description}
        onClick={() => {
          setSelectedCombination(combination);
          setSelectedRoomId(null);
        }}
        style={{
          padding: '16px',
          border: isSelected ? '2px solid var(--color-info)' : '1px solid var(--color-border)',
          borderRadius: '8px',
          backgroundColor: isSelected ? 'var(--color-info-light)' : 'var(--color-bg-white)',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}>
          <div>
            <h4 style={{
              margin: '0 0 4px 0',
              fontSize: 'var(--font-size-medium)',
              fontWeight: '600',
              color: 'var(--color-info)'
            }}>
              Combinación de Habitaciones
            </h4>
            <div style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)'
            }}>
              {combination.description}
            </div>
          </div>
          <div style={{
            backgroundColor: 'var(--color-info)',
            color: 'var(--color-text-light)',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: 'var(--font-size-small)',
            fontWeight: '500'
          }}>
            {combination.rooms.length} hab.
          </div>
        </div>
        
        <div style={{
          fontSize: 'var(--font-size-small)',
          color: 'var(--color-text-muted)',
          marginTop: '8px'
        }}>
          Habitaciones: {combination.rooms.map(room => room.name).join(', ')}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-white)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: 0,
            color: 'var(--color-text-main)',
            fontSize: 'var(--font-size-large)',
            fontWeight: '600'
          }}>
            Seleccionar Habitación
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)'
            }}
          >
            ×
          </button>
        </div>

        {/* Resumen de requerimientos */}
        <div style={{
          backgroundColor: 'var(--color-bg)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: 'var(--font-size-medium)',
            color: 'var(--color-text-main)'
          }}>
            Requerimientos de la Reserva:
          </h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-size-medium)' }}>
              <strong>Huéspedes:</strong> {requirements.requiredGuests}
            </span>
            {requirements.requiredTags.length > 0 && (
              <span style={{ fontSize: 'var(--font-size-medium)' }}>
                <strong>Etiquetas:</strong> {requirements.requiredTags.map(tagId => {
                  const tag = tags.find(t => t.id.toString() === tagId);
                  return tag ? tag.name : '';
                }).join(', ')}
              </span>
            )}
            <span style={{ fontSize: 'var(--font-size-medium)' }}>
              <strong>Fechas:</strong> {new Date(checkIn).toLocaleDateString()} - {new Date(checkOut).toLocaleDateString()}
            </span>
          </div>
        </div>

        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-medium)'
          }}>
            Buscando habitaciones disponibles...
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: 'var(--font-size-medium)'
          }}>
            {error}
          </div>
        )}

        {!loading && !error && searchResults && (
          <>
            {/* Habitaciones de capacidad exacta */}
            {searchResults.exactCapacityCount > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: 'var(--color-success)',
                  fontSize: 'var(--font-size-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ✅ Capacidad Exacta ({searchResults.exactCapacityCount})
                  <span style={{
                    backgroundColor: 'var(--color-success)',
                    color: 'var(--color-text-light)',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Prioridad Alta
                  </span>
                </h3>
                
                <div style={{
                  display: 'grid',
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {searchResults.availableRooms
                    .filter(room => room.maxPeople === requirements.requiredGuests)
                    .map(room => renderRoomCard(room, selectedRoomId === room.id))
                  }
                </div>
              </div>
            )}

            {/* Habitaciones de mayor capacidad */}
            {searchResults.largerCapacityCount > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: 'var(--color-warning)',
                  fontSize: 'var(--font-size-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ⚠️ Mayor Capacidad ({searchResults.largerCapacityCount})
                  <span style={{
                    backgroundColor: 'var(--color-warning)',
                    color: 'var(--color-text-light)',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Prioridad Media
                  </span>
                </h3>
                
                <div style={{
                  display: 'grid',
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {searchResults.availableRooms
                    .filter(room => room.maxPeople > requirements.requiredGuests)
                    .map(room => renderRoomCard(room, selectedRoomId === room.id))
                  }
                </div>
              </div>
            )}

            {/* Combinaciones de habitaciones */}
            {searchResults.alternativeCombinations && searchResults.alternativeCombinations.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  color: 'var(--color-info)',
                  fontSize: 'var(--font-size-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔄 Combinaciones Alternativas ({searchResults.alternativeCombinations.length})
                  <span style={{
                    backgroundColor: 'var(--color-info)',
                    color: 'var(--color-text-light)',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: 'var(--font-size-small)'
                  }}>
                    Múltiples Reservas
                  </span>
                </h3>
                
                <div style={{
                  display: 'grid',
                  gap: '12px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {searchResults.alternativeCombinations.map(combination => 
                    renderCombinationCard(combination, selectedCombination === combination)
                  )}
                </div>
              </div>
            )}

            {/* Sin opciones disponibles */}
            {searchResults.totalFound === 0 && 
             (!searchResults.alternativeCombinations || searchResults.alternativeCombinations.length === 0) && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--color-warning)',
                fontSize: 'var(--font-size-medium)'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
                <div>No se encontraron habitaciones que cumplan con los requerimientos.</div>
                <div style={{ fontSize: 'var(--font-size-small)', marginTop: '8px' }}>
                  Intenta ajustar la cantidad de huéspedes, etiquetas o fechas.
                </div>
              </div>
            )}
          </>
        )}

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--color-text-muted)',
              color: 'var(--color-text-light)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-medium)'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedRoomId && !selectedCombination}
            style={{
              padding: '12px 24px',
              backgroundColor: (selectedRoomId || selectedCombination) ? 'var(--color-primary)' : 'var(--color-border)',
              color: 'var(--color-text-light)',
              border: 'none',
              borderRadius: '6px',
              cursor: (selectedRoomId || selectedCombination) ? 'pointer' : 'not-allowed',
              fontSize: 'var(--font-size-medium)',
              opacity: (selectedRoomId || selectedCombination) ? 1 : 0.6
            }}
          >
            {selectedCombination ? 'Crear Múltiples Reservas' : 'Confirmar Selección'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomSelectionModal; 