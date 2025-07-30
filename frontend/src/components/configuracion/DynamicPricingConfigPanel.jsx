import React, { useEffect, useState } from "react";
import DynamicPricingWeightsEditor from "./DynamicPricingWeightsEditor";

const defaultConfig = {
  enabled: false,
  occupancy: 30,
  anticipation: 25,
  season: 30,
  events: 15,
  maxAdjustmentPercentage: 0.4,
  anticipationThresholds: [21, 14, 7, 3],
  enableGapPromos: true,
  enableWeatherApi: false,
  enableRecentDemand: false,
};

const maxAdjustmentOptions = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50];

export default function DynamicPricingConfigPanel({ hotelId = "default-hotel" }) {
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightSum, setWeightSum] = useState(1);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        // Mapear los campos del backend al frontend
        const mappedData = {
          ...defaultConfig,
          enabled: data.enabled !== undefined ? data.enabled : defaultConfig.enabled,
          // Convertir de decimal a porcentaje y mapear campos
          occupancy: data.globalOccupancyWeight ? Math.round(data.globalOccupancyWeight * 100) : defaultConfig.occupancy,
          anticipation: data.anticipationWeight ? Math.round(data.anticipationWeight * 100) : defaultConfig.anticipation,
          season: data.isWeekendWeight ? Math.round(data.isWeekendWeight * 100) : defaultConfig.season,
          events: data.isHolidayWeight ? Math.round(data.isHolidayWeight * 100) : defaultConfig.events,
          // Mantener otros campos del backend
          maxAdjustmentPercentage: data.maxAdjustmentPercentage || defaultConfig.maxAdjustmentPercentage,
          anticipationThresholds: data.anticipationThresholds || defaultConfig.anticipationThresholds,
          enableGapPromos: data.enableGapPromos !== undefined ? data.enableGapPromos : defaultConfig.enableGapPromos,
          enableWeatherApi: data.enableWeatherApi !== undefined ? data.enableWeatherApi : defaultConfig.enableWeatherApi,
          enableRecentDemand: data.enableRecentDemand !== undefined ? data.enableRecentDemand : defaultConfig.enableRecentDemand,
        };
        setConfig(mappedData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hotelId]);

  useEffect(() => {
    // Calcular suma de pesos
    const sum = Object.values(config).filter((value, key) => 
      ['occupancy', 'anticipation', 'season', 'events'].includes(key)
    ).reduce((total, value) => total + (value || 0), 0);
    setWeightSum(sum);
  }, [config]);

  const handleChange = (field, value) => {
    setConfig((c) => ({ ...c, [field]: value }));
  };



  const handleThresholdChange = (idx, value) => {
    const arr = [...config.anticipationThresholds];
    arr[idx] = Number(value);
    setConfig((c) => ({ ...c, anticipationThresholds: arr }));
  };

  const addThreshold = () => {
    setConfig((c) => ({
      ...c,
      anticipationThresholds: [...c.anticipationThresholds, 1],
    }));
  };

  const removeThreshold = (idx) => {
    setConfig((c) => ({
      ...c,
      anticipationThresholds: c.anticipationThresholds.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    // Validar que la suma de pesos sea 100
    if (Math.abs(weightSum - 100) > 1) {
      alert(`La suma de los pesos debe ser exactamente 100%. Actualmente es ${weightSum.toFixed(0)}%. Por favor ajuste los valores.`);
      return;
    }

    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Mapear los datos del frontend al formato del backend
      const backendData = {
        enabled: config.enabled,
        // Convertir de porcentaje a decimal y mapear campos
        globalOccupancyWeight: config.occupancy / 100,
        anticipationWeight: config.anticipation / 100,
        isWeekendWeight: config.season / 100,
        isHolidayWeight: config.events / 100,
        demandIndexWeight: 0.1, // Valores por defecto
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.05,
        anticipationThresholds: config.anticipationThresholds,
        maxAdjustmentPercentage: config.maxAdjustmentPercentage,
        enableGapPromos: config.enableGapPromos,
        enableWeatherApi: config.enableWeatherApi,
        enableRecentDemand: config.enableRecentDemand,
      };
      
      await fetch(`${API_URL}/dynamic-pricing/config/${hotelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendData),
      });
      alert("Configuración guardada exitosamente");
    } catch {
      alert("Error al guardar la configuración");
    }
    setSaving(false);
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
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
        <div>
          <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Pesos de Factores</h4>
          <DynamicPricingWeightsEditor
            weights={{
              occupancy: config.occupancy,
              anticipation: config.anticipation,
              season: config.season,
              events: config.events
            }}
            onChange={(newWeights) => {
              setConfig(prev => ({
                ...prev,
                ...newWeights
              }));
            }}
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

          <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Umbrales de Anticipación</h4>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#6c757d', 
              fontStyle: 'italic',
              marginBottom: '10px'
            }}>
              Días antes de la fecha para aplicar ajuste por cercanía. Cuanto más cerca de la fecha, mayor puede ser el ajuste.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {config.anticipationThresholds.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="number"
                    min={1}
                    value={v}
                    onChange={(e) => handleThresholdChange(idx, e.target.value)}
                    style={{ width: '60px', padding: '5px', border: '1px solid #ced4da', borderRadius: '4px' }}
                  />
                  <button 
                    onClick={() => removeThreshold(idx)} 
                    disabled={config.anticipationThresholds.length <= 1}
                    style={{ 
                      padding: '2px 6px', 
                      background: '#dc3545', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button 
                onClick={addThreshold}
                style={{ 
                  padding: '5px 10px', 
                  background: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
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

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={handleSave} 
          disabled={saving || Math.abs(weightSum - 1) > 0.01}
          style={{
            padding: '12px 24px',
            background: Math.abs(weightSum - 1) > 0.01 ? '#6c757d' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: Math.abs(weightSum - 1) > 0.01 ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? "Guardando..." : "Guardar Configuración"}
        </button>
        {Math.abs(weightSum - 1) > 0.01 && (
          <div style={{ 
            marginTop: '10px', 
            color: '#dc3545', 
            fontSize: '14px' 
          }}>
            No se puede guardar hasta que la suma de pesos sea exactamente 1.00
          </div>
        )}
      </div>
    </div>
  );
} 