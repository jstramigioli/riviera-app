import React, { useEffect, useState } from "react";
import DynamicPricingWeightsEditor from "./DynamicPricingWeightsEditor";

const defaultConfig = {
  enabled: false,
  occupancy: 25,
  anticipation: 20,
  weekend: 15,
  holiday: 10,
  demand: 15,
  weather: 5,
  events: 10,
  maxAdjustmentPercentage: 0.4,
  anticipationThresholds: [21, 14, 7, 3],
  enableGapPromos: true,
  enableWeatherApi: false,
  enableRecentDemand: false,
  // Nueva configuración de anticipación
  anticipationMode: 'ESCALONADO',
  anticipationMaxDays: 30,
  anticipationSteps: [
    { days: 21, weight: 1.0 },
    { days: 14, weight: 0.7 },
    { days: 7, weight: 0.4 },
    { days: 3, weight: 0.2 }
  ],
  // Configuración de días de fin de semana (0=Domingo, 6=Sábado)
  weekendDays: [0, 6],
};

const maxAdjustmentOptions = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50];

export default function DynamicPricingConfigPanel({ hotelId = "default-hotel" }) {
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    console.log('DynamicPricingConfigPanel - Loading config from API...');
    fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('DynamicPricingConfigPanel - Raw data from API:', data);

        
        // Mapear los campos del backend al frontend
        const mappedData = {
          ...defaultConfig,
          enabled: data.enabled !== undefined ? data.enabled : defaultConfig.enabled,
          // Convertir de decimal a porcentaje y mapear campos con validación
          occupancy: data.globalOccupancyWeight !== undefined && data.globalOccupancyWeight !== null ? Math.round(data.globalOccupancyWeight * 100) : defaultConfig.occupancy,
          anticipation: data.anticipationWeight !== undefined && data.anticipationWeight !== null ? Math.round(data.anticipationWeight * 100) : defaultConfig.anticipation,
          weekend: data.isWeekendWeight !== undefined && data.isWeekendWeight !== null ? Math.round(data.isWeekendWeight * 100) : defaultConfig.weekend,
          holiday: data.isHolidayWeight !== undefined && data.isHolidayWeight !== null ? Math.round(data.isHolidayWeight * 100) : defaultConfig.holiday,
          demand: data.demandIndexWeight !== undefined && data.demandIndexWeight !== null ? Math.round(data.demandIndexWeight * 100) : defaultConfig.demand,
          weather: data.weatherScoreWeight !== undefined && data.weatherScoreWeight !== null ? Math.round(data.weatherScoreWeight * 100) : defaultConfig.weather,
          events: data.eventImpactWeight !== undefined && data.eventImpactWeight !== null ? Math.round(data.eventImpactWeight * 100) : defaultConfig.events,
          // Mantener otros campos del backend
          maxAdjustmentPercentage: data.maxAdjustmentPercentage || defaultConfig.maxAdjustmentPercentage,
          anticipationThresholds: data.anticipationThresholds || defaultConfig.anticipationThresholds,
          enableGapPromos: data.enableGapPromos !== undefined ? data.enableGapPromos : defaultConfig.enableGapPromos,
          enableWeatherApi: data.enableWeatherApi !== undefined ? data.enableWeatherApi : defaultConfig.enableWeatherApi,
          enableRecentDemand: data.enableRecentDemand !== undefined ? data.enableRecentDemand : defaultConfig.enableRecentDemand,
          // Nueva configuración de anticipación
          anticipationMode: data.anticipationMode || defaultConfig.anticipationMode,
          anticipationMaxDays: data.anticipationMaxDays || defaultConfig.anticipationMaxDays,
          anticipationSteps: data.anticipationSteps || defaultConfig.anticipationSteps,
          // Configuración de días de fin de semana
          weekendDays: data.weekendDays !== undefined ? data.weekendDays : defaultConfig.weekendDays,
        };
        
        console.log('DynamicPricingConfigPanel - Mapped data:', mappedData);
        console.log('DynamicPricingConfigPanel - weekendDays from API:', data.weekendDays);
        console.log('DynamicPricingConfigPanel - weekendDays in mapped data:', mappedData.weekendDays);

        setConfig(mappedData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('DynamicPricingConfigPanel - Error loading config:', error);
        setLoading(false);
      });
  }, [hotelId]);

























  // Función helper para guardar automáticamente
  const saveConfig = async (newConfig, skipReload = false) => {
    try {
      const response = await fetch(`/api/dynamic-pricing/config/${hotelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (response.ok) {
        if (!skipReload) {
          // Recargar la configuración desde el backend
          const reloadResponse = await fetch(`/api/dynamic-pricing/config/${hotelId}`);
          if (reloadResponse.ok) {
            const reloadedData = await reloadResponse.json();
            setConfig(reloadedData);
          }
        }
      } else {
        console.error('Error al guardar la configuración:', response.statusText);
      }
    } catch (error) {
      console.error('Error al guardar la configuración:', error);
    }
  };

  const handleChange = async (field, value) => {
    let newConfig;
    
    if (field === 'anticipationConfig') {
      // Caso especial para configuración de anticipación
      newConfig = { ...config, ...value };
    } else if (field === 'weekendConfig') {
      // Caso especial para configuración de fin de semana
      newConfig = { ...config, ...value };
    } else {
      // Caso normal para otros campos
      newConfig = { ...config, [field]: value };
    }
    
    // Para la configuración de fin de semana, guardar inmediatamente sin recargar
    if (field === 'weekendConfig') {
      await saveConfig(newConfig, true); // skipReload = true
      
      // Forzar una actualización del estado después de guardar
      setConfig(prevConfig => ({
        ...prevConfig,
        weekendDays: newConfig.weekendDays
      }));
    } else {
      // Para otros campos, guardar de forma asíncrona
      saveConfig(newConfig);
    }
  };







  if (loading) return <div>Cargando configuración...</div>;

  return (
    <div style={{ 
      padding: '20px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h3 style={{ color: '#2c3e50', margin: 0 }}>Configuración de Tarifas Dinámicas</h3>
        
        {/* Toggle switch para activar/desactivar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '14px', 
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
          padding: '16px',
          marginBottom: '20px',
          color: '#856404'
        }}>
          <strong>⚠️ Precios dinámicos desactivados</strong>
          <br />
          Los precios se calcularán usando solo la curva estacional sin ajustes dinámicos por ocupación, anticipación, etc.
        </div>
      )}
      
      {config.enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
          <div>
            <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Pesos de Factores</h4>
            <DynamicPricingWeightsEditor
              key={JSON.stringify(config.weekendDays)}
              weights={{
                occupancy: config.occupancy,
                anticipation: config.anticipation,
                weekend: config.weekend,
                holiday: config.holiday,
                demand: config.demand,
                weather: config.weather,
                events: config.events
              }}
              onChange={(newWeights) => {
                setConfig(prev => ({
                  ...prev,
                  ...newWeights
                }));
              }}
              config={config}
              onConfigChange={handleChange}
            />
          </div>

          <div>
            <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Ajuste Máximo</h4>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Máximo Ajuste: {(config.maxAdjustmentPercentage * 100).toFixed(0)}%
              </label>
              <select
                value={config.maxAdjustmentPercentage}
                onChange={(e) => handleChange("maxAdjustmentPercentage", parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                {maxAdjustmentOptions.map(option => (
                  <option key={option} value={option}>
                    {(option * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
              <div style={{ 
                fontSize: '14px', 
                color: '#6c757d', 
                fontStyle: 'italic',
                marginTop: '5px'
              }}>
                Define el porcentaje máximo que puede variar el precio respecto al precio base.
              </div>
            </div>

            <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Características</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={!!config.enableGapPromos}
                    onChange={(e) => handleChange("enableGapPromos", e.target.checked)}
                  />
                  Descuentos por huecos
                </label>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6c757d', 
                  fontStyle: 'italic',
                  marginLeft: '25px',
                  marginTop: '5px'
                }}>
                  Aplica descuentos automáticos para huecos de 1-2 días entre reservas.
                </div>
              </div>
              
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={!!config.enableRecentDemand}
                    onChange={(e) => handleChange("enableRecentDemand", e.target.checked)}
                  />
                  Demanda reciente
                </label>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6c757d', 
                  fontStyle: 'italic',
                  marginLeft: '25px',
                  marginTop: '5px'
                }}>
                  Considera la demanda de reservas recientes para ajustar precios.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 