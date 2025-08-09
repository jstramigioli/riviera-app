import React, { useState, useEffect } from 'react';

export default function AnticipationFactorConfig({ config, onConfigChange }) {
  const [mode, setMode] = useState(config?.anticipationMode || 'ESCALONADO');
  const [maxDays, setMaxDays] = useState(config?.anticipationMaxDays || 30);
  const [steps, setSteps] = useState(config?.anticipationSteps || [
    { days: 21, weight: 1.0 },
    { days: 14, weight: 0.7 },
    { days: 7, weight: 0.4 },
    { days: 3, weight: 0.2 }
  ]);

  useEffect(() => {
    if (config) {
      setMode(config.anticipationMode || 'ESCALONADO');
      setMaxDays(config.anticipationMaxDays || 30);
      setSteps(config.anticipationSteps || [
        { days: 21, weight: 1.0 },
        { days: 14, weight: 0.7 },
        { days: 7, weight: 0.4 },
        { days: 3, weight: 0.2 }
      ]);
    }
  }, [config]);

  const handleModeChange = (newMode) => {
    console.log('AnticipationFactorConfig - handleModeChange called with:', newMode);
    console.log('AnticipationFactorConfig - current mode:', mode);
    setMode(newMode);
    updateConfig(newMode, maxDays, steps);
  };

  const handleMaxDaysChange = (newMaxDays) => {
    setMaxDays(newMaxDays);
    updateConfig(mode, newMaxDays, steps);
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: field === 'days' ? parseInt(value) : parseFloat(value) };
    setSteps(newSteps);
    updateConfig(mode, maxDays, newSteps);
  };

  const addStep = () => {
    const newStep = { days: 7, weight: 0.5 };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    updateConfig(mode, maxDays, newSteps);
  };

  const removeStep = (index) => {
    if (steps.length <= 2) return; // Mínimo 2 pasos
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
    updateConfig(mode, maxDays, newSteps);
  };

  const updateConfig = (newMode, newMaxDays, newSteps) => {
    console.log('AnticipationFactorConfig - updateConfig called with:', { newMode, newMaxDays, newSteps });
    const updatedConfig = {
      ...config,
      anticipationMode: newMode,
      anticipationMaxDays: newMaxDays,
      anticipationSteps: newMode === 'ESCALONADO' ? newSteps : null
    };
    console.log('AnticipationFactorConfig - updatedConfig:', updatedConfig);
    onConfigChange(updatedConfig);
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          marginBottom: '12px', 
          fontWeight: '500', 
          color: '#495057', 
          fontSize: 'var(--font-size-medium)'
        }}>
          Modo de cálculo:
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="anticipationMode"
              value="ESCALONADO"
              checked={mode === 'ESCALONADO'}
              onChange={(e) => handleModeChange(e.target.value)}
            />
            <span style={{ fontSize: 'var(--font-size-medium)' }}>Escalonado</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="anticipationMode"
              value="CONTINUO"
              checked={mode === 'CONTINUO'}
              onChange={(e) => handleModeChange(e.target.value)}
            />
            <span style={{ fontSize: 'var(--font-size-medium)' }}>Continuo</span>
          </label>
        </div>
      </div>

      {mode === 'CONTINUO' && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ 
              fontWeight: '500', 
              color: '#495057', 
              fontSize: 'var(--font-size-medium)'
            }}>Días máximos:</span>
            <input
              type="number"
              min="1"
              max="365"
              value={maxDays}
              onChange={(e) => handleMaxDaysChange(parseInt(e.target.value))}
              style={{
                width: '80px',
                padding: '8px 10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: 'var(--font-size-medium)'
              }}
            />
          </label>
          <div style={{ 
            fontSize: 'var(--font-size-small)', 
            color: '#6c757d', 
            fontStyle: 'italic' 
          }}>
            El factor será máximo cuando falten {maxDays} días o más, y 0 cuando sea el día de la fecha.
          </div>
        </div>
      )}

      {mode === 'ESCALONADO' && (
        <div>
          <div style={{ 
            marginBottom: '12px', 
            fontWeight: '500', 
            color: '#495057', 
            fontSize: 'var(--font-size-medium)'
          }}>
            Pasos de anticipación:
          </div>
          <div style={{ marginBottom: '12px' }}>
            {steps.map((step, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #e9ecef'
              }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={step.days}
                  onChange={(e) => handleStepChange(index, 'days', e.target.value)}
                  style={{
                    width: '60px',
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '3px',
                    fontSize: 'var(--font-size-small)'
                  }}
                />
                <span style={{ 
                  fontSize: 'var(--font-size-small)', 
                  color: '#666' 
                }}>días =</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={step.weight}
                  onChange={(e) => handleStepChange(index, 'weight', e.target.value)}
                  style={{
                    width: '60px',
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '3px',
                    fontSize: 'var(--font-size-small)'
                  }}
                />
                <span style={{ 
                  fontSize: 'var(--font-size-small)', 
                  color: '#666' 
                }}>
                  × 100% = {Math.round(step.weight * 100)}%
                </span>
                {steps.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-medium)',
                      fontWeight: 'bold',
                      marginLeft: 'auto'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button 
            type="button" 
            onClick={addStep}
            style={{
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 18px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
              fontWeight: '500'
            }}
          >
            + Agregar paso
          </button>
          <div style={{ 
            fontSize: 'var(--font-size-small)', 
            color: '#6c757d', 
            fontStyle: 'italic', 
            marginTop: '8px' 
          }}>
            El factor será el peso del primer paso que se cumpla.
          </div>
        </div>
      )}
    </div>
  );
} 