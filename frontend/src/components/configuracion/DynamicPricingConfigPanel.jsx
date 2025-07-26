import React, { useEffect, useState } from "react";

const defaultConfig = {
  globalOccupancyWeight: 0.25,
  anticipationWeight: 0.3,
  isWeekendWeight: 0.15,
  isHolidayWeight: 0.1,
  demandIndexWeight: 0.1,
  weatherScoreWeight: 0.05,
  eventImpactWeight: 0.05,
  maxAdjustmentPercentage: 0.4,
  anticipationThresholds: [21, 14, 7, 3],
  enableGapPromos: true,
  enableWeatherApi: false,
  enableRecentDemand: false,
};

const weightDescriptions = {
  globalOccupancyWeight: "Peso de la ocupación general del hotel. Afecta directamente el precio base según qué tan lleno esté el hotel.",
  anticipationWeight: "Peso del factor de anticipación. Cuanto más cerca de la fecha, mayor puede ser el ajuste de precio.",
  isWeekendWeight: "Peso para días de fin de semana. Los fines de semana suelen tener mayor demanda.",
  isHolidayWeight: "Peso para días festivos. Los días festivos tienen demanda especial.",
  demandIndexWeight: "Peso del índice de demanda histórica. Se basa en reservas previas para fechas similares.",
  weatherScoreWeight: "Peso del factor climático. Afecta según las condiciones meteorológicas esperadas.",
  eventImpactWeight: "Peso del impacto de eventos. Considera eventos locales que pueden afectar la demanda."
};

const maxAdjustmentOptions = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50];

export default function DynamicPricingConfigPanel({ hotelId = "default-hotel" }) {
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightSum, setWeightSum] = useState(1);

  useEffect(() => {
    fetch(`/api/dynamic-pricing/config/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        setConfig({ ...defaultConfig, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hotelId]);

  useEffect(() => {
    // Calcular suma de pesos
    const sum = Object.keys(weightDescriptions).reduce((total, key) => {
      return total + (config[key] || 0);
    }, 0);
    setWeightSum(sum);
  }, [config]);

  const handleChange = (field, value) => {
    setConfig((c) => ({ ...c, [field]: value }));
  };

  const handleWeightChange = (field, value) => {
    const newValue = parseFloat(value) || 0;
    setConfig((c) => ({ ...c, [field]: newValue }));
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
    // Validar que la suma de pesos sea 1
    if (Math.abs(weightSum - 1) > 0.01) {
      alert(`La suma de los pesos debe ser exactamente 1. Actualmente es ${weightSum.toFixed(2)}. Por favor ajuste los valores.`);
      return;
    }

    setSaving(true);
    try {
      await fetch(`/api/dynamic-pricing/config/${hotelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
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
      <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Configuración de Tarifas Dinámicas</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
        <div>
          <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Pesos de Factores</h4>
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px', 
            background: weightSum === 1 ? '#d4edda' : '#f8d7da', 
            borderRadius: '4px',
            border: `1px solid ${weightSum === 1 ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            <strong>Suma de pesos: {weightSum.toFixed(2)}</strong>
            {weightSum !== 1 && (
              <div style={{ color: '#721c24', fontSize: '14px', marginTop: '5px' }}>
                ⚠️ La suma debe ser exactamente 1.00
              </div>
            )}
          </div>
          
          {Object.entries(weightDescriptions).map(([field, description]) => (
            <div key={field} style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config[field]}
                    onChange={(e) => handleWeightChange(field, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config[field]}
                    onChange={(e) => handleWeightChange(field, e.target.value)}
                    style={{ width: '80px', padding: '4px 8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#6c757d', 
                fontStyle: 'italic',
                marginTop: '5px'
              }}>
                {description}
              </div>
            </div>
          ))}
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