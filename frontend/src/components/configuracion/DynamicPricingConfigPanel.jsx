import React, { useEffect, useState } from "react";
import FactorConfigPanel from "./FactorConfigPanel";
import OccupancyFactorConfig from "./OccupancyFactorConfig";
import AnticipationFactorConfig from "./AnticipationFactorConfig";
import WeekendFactorConfig from "./WeekendFactorConfig";
import EditablePercentage from "./EditablePercentage";

const defaultConfig = {
  enabled: false,
  // Nuevos campos para el sistema de porcentajes individuales
  idealOccupancy: 80.0,
  occupancyAdjustmentPercentage: 20.0,
  anticipationAdjustmentPercentage: 15.0,
  weekendAdjustmentPercentage: 10.0,
  holidayAdjustmentPercentage: 25.0,
  // Configuración de anticipación
  anticipationMode: 'ESCALONADO',
  anticipationMaxDays: 30,
  anticipationSteps: [
    { days: 21, weight: 1.0 },
    { days: 14, weight: 0.7 },
    { days: 7, weight: 0.4 },
    { days: 3, weight: 0.2 }
  ],
  // Configuración de días de fin de semana
  weekendDays: [0, 6],
};

const factorConfigs = {
  occupancy: {
    name: 'Ocupación',
    color: '#667eea',
    description: 'Ajusta el precio según la ocupación real vs la ocupación ideal.',
    icon: '📊'
  },
  anticipation: {
    name: 'Anticipación',
    color: '#f0932b',
    description: 'Ajusta el precio según cuántos días faltan para la fecha.',
    icon: '⏰'
  },
  weekend: {
    name: 'Fin de Semana',
    color: '#eb4d4b',
    description: 'Aplica un recargo adicional en días de fin de semana.',
    icon: '🎉'
  },
  holiday: {
    name: 'Feriados',
    color: '#6ab04c',
    description: 'Aplica un recargo adicional en feriados y fines de semana largos.',
    icon: '🎊'
  }
};

export default function DynamicPricingConfigPanel({ hotelId = "default-hotel" }) {
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [maxAdjustments, setMaxAdjustments] = useState(null);
  const [activeFactors, setActiveFactors] = useState({
    occupancy: true,
    anticipation: true,
    weekend: true,
    holiday: true
  });

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    console.log('DynamicPricingConfigPanel - Loading config from API...');
    fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('DynamicPricingConfigPanel - Raw data from API:', data);

        // Mapear los campos del backend al frontend
        const mappedData = {
          ...defaultConfig,
          enabled: data.enabled !== undefined ? data.enabled : defaultConfig.enabled,
          // Nuevos campos para porcentajes individuales
          idealOccupancy: data.idealOccupancy || defaultConfig.idealOccupancy,
          occupancyAdjustmentPercentage: data.occupancyAdjustmentPercentage || defaultConfig.occupancyAdjustmentPercentage,
          anticipationAdjustmentPercentage: data.anticipationAdjustmentPercentage || defaultConfig.anticipationAdjustmentPercentage,
          weekendAdjustmentPercentage: data.weekendAdjustmentPercentage || defaultConfig.weekendAdjustmentPercentage,
          holidayAdjustmentPercentage: data.holidayAdjustmentPercentage || defaultConfig.holidayAdjustmentPercentage,
          // Configuración de anticipación
          anticipationMode: data.anticipationMode || defaultConfig.anticipationMode,
          anticipationMaxDays: data.anticipationMaxDays || defaultConfig.anticipationMaxDays,
          anticipationSteps: data.anticipationSteps || defaultConfig.anticipationSteps,
          // Configuración de días de fin de semana
          weekendDays: data.weekendDays !== undefined ? data.weekendDays : defaultConfig.weekendDays,
          // Estado de activación de factores
          occupancyEnabled: data.occupancyEnabled !== undefined ? data.occupancyEnabled : true,
          anticipationEnabled: data.anticipationEnabled !== undefined ? data.anticipationEnabled : true,
          weekendEnabled: data.weekendEnabled !== undefined ? data.weekendEnabled : true,
          holidayEnabled: data.holidayEnabled !== undefined ? data.holidayEnabled : true,
        };
        
        console.log('DynamicPricingConfigPanel - Mapped data:', mappedData);
        setConfig(mappedData);
        
        // Sincronizar el estado de factores activos con los datos del backend
        setActiveFactors({
          occupancy: mappedData.occupancyEnabled,
          anticipation: mappedData.anticipationEnabled,
          weekend: mappedData.weekendEnabled,
          holiday: mappedData.holidayEnabled
        });
        
        setLoading(false);
      })
      .catch((error) => {
        console.error('DynamicPricingConfigPanel - Error loading config:', error);
        alert(`Error al cargar la configuración: ${error.message}`);
        setLoading(false);
      });
  }, [hotelId]);

  // Cargar los porcentajes máximos calculados dinámicamente
  useEffect(() => {
    if (config.enabled) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      fetch(`${API_URL}/dynamic-pricing/max-adjustments/${hotelId}`)
        .then((res) => res.json())
        .then((data) => {
          setMaxAdjustments(data);
        })
        .catch((error) => {
          console.error('Error loading max adjustments:', error);
        });
    }
  }, [config.enabled, hotelId]);

  const saveConfig = async (newConfig, skipReload = false) => {
    try {
      console.log('DynamicPricingConfigPanel - saveConfig called with:', newConfig);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      console.log('DynamicPricingConfigPanel - saveConfig response status:', response.status);

      if (response.ok) {
        console.log('DynamicPricingConfigPanel - saveConfig successful');
        if (!skipReload) {
          // Recargar la configuración desde el backend
          const reloadResponse = await fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`);
          if (reloadResponse.ok) {
            const reloadedData = await reloadResponse.json();
            console.log('DynamicPricingConfigPanel - reloaded data:', reloadedData);
            
            // Mapear los datos del backend al formato del frontend
            const mappedData = {
              ...defaultConfig,
              enabled: reloadedData.enabled !== undefined ? reloadedData.enabled : defaultConfig.enabled,
              idealOccupancy: reloadedData.idealOccupancy || defaultConfig.idealOccupancy,
              occupancyAdjustmentPercentage: reloadedData.occupancyAdjustmentPercentage || defaultConfig.occupancyAdjustmentPercentage,
              anticipationAdjustmentPercentage: reloadedData.anticipationAdjustmentPercentage || defaultConfig.anticipationAdjustmentPercentage,
              weekendAdjustmentPercentage: reloadedData.weekendAdjustmentPercentage || defaultConfig.weekendAdjustmentPercentage,
              holidayAdjustmentPercentage: reloadedData.holidayAdjustmentPercentage || defaultConfig.holidayAdjustmentPercentage,
              anticipationMode: reloadedData.anticipationMode || defaultConfig.anticipationMode,
              anticipationMaxDays: reloadedData.anticipationMaxDays || defaultConfig.anticipationMaxDays,
              anticipationSteps: reloadedData.anticipationSteps || defaultConfig.anticipationSteps,
              weekendDays: reloadedData.weekendDays !== undefined ? reloadedData.weekendDays : defaultConfig.weekendDays,
              occupancyEnabled: reloadedData.occupancyEnabled !== undefined ? reloadedData.occupancyEnabled : true,
              anticipationEnabled: reloadedData.anticipationEnabled !== undefined ? reloadedData.anticipationEnabled : true,
              weekendEnabled: reloadedData.weekendEnabled !== undefined ? reloadedData.weekendEnabled : true,
              holidayEnabled: reloadedData.holidayEnabled !== undefined ? reloadedData.holidayEnabled : true,
            };
            
            setConfig(mappedData);
            
            // Sincronizar el estado de factores activos
            setActiveFactors({
              occupancy: mappedData.occupancyEnabled,
              anticipation: mappedData.anticipationEnabled,
              weekend: mappedData.weekendEnabled,
              holiday: mappedData.holidayEnabled
            });
          }
        }
        // Recargar los porcentajes máximos
        const maxAdjustmentsResponse = await fetch(`${API_URL}/dynamic-pricing/max-adjustments/${hotelId}`);
        if (maxAdjustmentsResponse.ok) {
          const maxAdjustmentsData = await maxAdjustmentsResponse.json();
          setMaxAdjustments(maxAdjustmentsData);
        }
      } else {
        const errorText = await response.text();
        console.error('Error al guardar la configuración:', response.status, errorText);
        alert(`Error al guardar la configuración: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error al guardar la configuración:', error);
      alert(`Error de conexión: ${error.message}`);
    }
  };

  const handleChange = async (field, value) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    await saveConfig(newConfig);
  };

  const handlePercentageChange = async (field, value) => {
    const newConfig = { ...config, [field]: parseFloat(value) };
    setConfig(newConfig);
    await saveConfig(newConfig);
  };

  const handleFactorToggle = async (factor) => {
    const newActiveFactors = {
      ...activeFactors,
      [factor]: !activeFactors[factor]
    };
    setActiveFactors(newActiveFactors);
    
    // Actualizar el estado en el backend
    const fieldName = `${factor}Enabled`;
    const newConfig = {
      ...config,
      [fieldName]: newActiveFactors[factor]
    };
    await saveConfig(newConfig);
  };

  if (loading) return <div>Cargando configuración...</div>;

  const generateDiscountDescription = () => {
    const conditions = [];
    
    if (activeFactors.occupancy && config.occupancyAdjustmentPercentage > 0) {
      conditions.push(`• El porcentaje de ocupación sea del 0% (${config.occupancyAdjustmentPercentage}%)`);
    }
    
    if (activeFactors.anticipation && config.anticipationAdjustmentPercentage > 0) {
      if (config.anticipationMode === 'CONTINUO') {
        conditions.push(`• Se trate de una reserva a realizarse ese mismo día (${config.anticipationAdjustmentPercentage}%)`);
      } else if (config.anticipationMode === 'ESCALONADO' && config.anticipationSteps) {
        const minDays = Math.min(...config.anticipationSteps.map(step => step.days));
        conditions.push(`• Se trate de una reserva a realizarse dentro de los próximos ${minDays} días (${config.anticipationAdjustmentPercentage}%)`);
      }
    }
    
    if (conditions.length === 0) {
      return "No hay factores de descuento configurados.";
    }
    
    return `En un día en el que:<br>${conditions.join('<br>')}`;
  };

  const generateIncreaseDescription = () => {
    const conditions = [];
    
    if (activeFactors.occupancy && config.occupancyAdjustmentPercentage > 0) {
      conditions.push(`• El porcentaje de ocupación sea del 100% (${config.occupancyAdjustmentPercentage}%)`);
    }
    
    if (activeFactors.weekend && config.weekendAdjustmentPercentage > 0) {
      const weekendDays = config.weekendDays || [0, 6];
      const dayNames = { 0: 'Domingo', 5: 'Viernes', 6: 'Sábado' };
      const selectedDays = weekendDays.map(day => dayNames[day]).join(', ');
      conditions.push(`• Se trate de un ${selectedDays} (${config.weekendAdjustmentPercentage}%)`);
    }
    
    if (activeFactors.holiday && config.holidayAdjustmentPercentage > 0) {
      conditions.push(`• Se trate de un feriado (${config.holidayAdjustmentPercentage}%)`);
    }
    
    if (conditions.length === 0) {
      return "No hay factores de recargo configurados.";
    }
    
    return `En un día en el que:<br>${conditions.join('<br>')}`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h3 style={{ 
          color: '#2c3e50', 
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: '600'
        }}>Configuración de Tarifas Dinámicas</h3>
        
        {/* Toggle switch para activar/desactivar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '1.2rem', 
            color: config.enabled ? '#27ae60' : '#e74c3c',
            fontWeight: '500'
          }}>
            {config.enabled ? 'Activado' : 'Desactivado'}
          </span>
          
          {/* Toggle Switch */}
          <div
            onClick={() => handleChange('enabled', !config.enabled)}
            style={{
              width: '50px',
              height: '24px',
              backgroundColor: config.enabled ? '#27ae60' : '#bdc3c7',
              borderRadius: '12px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transform: config.enabled ? 'translateX(26px)' : 'translateX(0px)',
                transition: 'transform 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Mensaje cuando está desactivado */}
      {!config.enabled && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          color: '#856404',
          fontSize: 'var(--font-size-large)'
        }}>
          <strong style={{ fontSize: '1.2rem' }}>⚠️ Precios dinámicos desactivados</strong>
          <br />
          Los precios se calcularán usando solo la curva estacional sin ajustes dinámicos por ocupación, anticipación, etc.
        </div>
      )}
      
      {config.enabled && (
        <>
          {/* Paneles de configuración de factores */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '20px',
            alignItems: 'stretch',
            width: '100%',
            height: 'auto',
            marginBottom: '24px',
            maxWidth: '100%',
            overflow: 'visible'
          }}>
            
            {/* Panel de Ocupación */}
            <div style={{ height: '100%', minHeight: '400px' }}>
              <FactorConfigPanel
                name={factorConfigs.occupancy.name}
                color={factorConfigs.occupancy.color}
                description={factorConfigs.occupancy.description}
                isActive={activeFactors.occupancy}
                onToggle={() => handleFactorToggle('occupancy')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <OccupancyFactorConfig
                    percentage={config.occupancyAdjustmentPercentage}
                    idealOccupancy={config.idealOccupancy}
                    onPercentageChange={(value) => handlePercentageChange('occupancyAdjustmentPercentage', value)}
                    onIdealOccupancyChange={(value) => handleChange('idealOccupancy', value)}
                  />
                </div>
              </FactorConfigPanel>
            </div>

            {/* Panel de Anticipación */}
            <div style={{ height: '100%', minHeight: '400px' }}>
              <FactorConfigPanel
                name={factorConfigs.anticipation.name}
                color={factorConfigs.anticipation.color}
                description={factorConfigs.anticipation.description}
                isActive={activeFactors.anticipation}
                onToggle={() => handleFactorToggle('anticipation')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <AnticipationFactorConfig
                    config={{
                      anticipationMode: config.anticipationMode,
                      anticipationMaxDays: config.anticipationMaxDays,
                      anticipationSteps: config.anticipationSteps
                    }}
                    onConfigChange={(anticipationConfig) => {
                      console.log('DynamicPricingConfigPanel - anticipationConfig received:', anticipationConfig);
                      const newConfig = {
                        ...config,
                        anticipationMode: anticipationConfig.anticipationMode,
                        anticipationMaxDays: anticipationConfig.anticipationMaxDays,
                        anticipationSteps: anticipationConfig.anticipationSteps
                      };
                      console.log('DynamicPricingConfigPanel - newConfig:', newConfig);
                      setConfig(newConfig);
                      saveConfig(newConfig);
                    }}
                  />
                  <EditablePercentage
                    value={config.anticipationAdjustmentPercentage}
                    onValueChange={(value) => handlePercentageChange('anticipationAdjustmentPercentage', value)}
                    color={factorConfigs.anticipation.color}
                    min={0}
                    max={50}
                    step={1}
                    label="Máximo ajuste por anticipación (%)"
                  />
                </div>
              </FactorConfigPanel>
            </div>

            {/* Panel de Fin de Semana */}
            <div style={{ height: '100%', minHeight: '400px' }}>
              <FactorConfigPanel
                name={factorConfigs.weekend.name}
                color={factorConfigs.weekend.color}
                description={factorConfigs.weekend.description}
                isActive={activeFactors.weekend}
                onToggle={() => handleFactorToggle('weekend')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <WeekendFactorConfig
                    config={{
                      weekendDays: config.weekendDays
                    }}
                    onConfigChange={(weekendConfig) => {
                      const newConfig = {
                        ...config,
                        weekendDays: weekendConfig.weekendDays
                      };
                      setConfig(newConfig);
                      saveConfig(newConfig);
                    }}
                  />
                  <EditablePercentage
                    value={config.weekendAdjustmentPercentage}
                    onValueChange={(value) => handlePercentageChange('weekendAdjustmentPercentage', value)}
                    color={factorConfigs.weekend.color}
                    min={0}
                    max={50}
                    step={1}
                    label="Ajuste por fin de semana (%)"
                  />
                </div>
              </FactorConfigPanel>
            </div>

            {/* Panel de Feriados */}
            <div style={{ height: '100%', minHeight: '400px' }}>
              <FactorConfigPanel
                name={factorConfigs.holiday.name}
                color={factorConfigs.holiday.color}
                description={factorConfigs.holiday.description}
                isActive={activeFactors.holiday}
                onToggle={() => handleFactorToggle('holiday')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <EditablePercentage
                    value={config.holidayAdjustmentPercentage}
                    onValueChange={(value) => handlePercentageChange('holidayAdjustmentPercentage', value)}
                    color={factorConfigs.holiday.color}
                    min={0}
                    max={50}
                    step={1}
                    label="Ajuste por feriados (%)"
                  />
                  <div style={{ 
                    fontSize: 'var(--font-size-small)', 
                    color: '#666', 
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    Se aplica un recargo adicional en feriados y fines de semana largos.
                  </div>
                </div>
              </FactorConfigPanel>
            </div>

          </div>

          {/* Resumen de porcentajes máximos */}
          {maxAdjustments && (
            <div style={{
              backgroundColor: 'var(--color-bg-white)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                color: 'var(--color-text-dark)',
                fontSize: '1.3rem',
                fontWeight: '600'
              }}>
                📊 Resumen de Ajustes Máximos
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: 'var(--font-size-medium)', 
                    color: '#666', 
                    marginBottom: '16px',
                    textAlign: 'left',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                  }}
                    dangerouslySetInnerHTML={{ __html: generateDiscountDescription() }}
                  />
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: '#e74c3c',
                    marginBottom: '8px'
                  }}>
                    -{maxAdjustments.maxDiscountPercentage.toFixed(1)}%
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    color: '#666'
                  }}>
                    Máximo descuento posible
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: 'var(--font-size-medium)', 
                    color: '#666', 
                    marginBottom: '16px',
                    textAlign: 'left',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                  }}
                    dangerouslySetInnerHTML={{ __html: generateIncreaseDescription() }}
                  />
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: '#27ae60',
                    marginBottom: '8px'
                  }}>
                    +{maxAdjustments.maxIncreasePercentage.toFixed(1)}%
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    color: '#666'
                  }}>
                    Máximo recargo posible
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 