import React, { useState, useEffect } from 'react';
import styles from './AnticipationConfigPanel.module.css';

export default function AnticipationConfigPanel({ config, onConfigChange }) {
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
    const updatedConfig = {
      ...config,
      anticipationMode: newMode,
      anticipationMaxDays: newMaxDays,
      anticipationSteps: newMode === 'ESCALONADO' ? newSteps : null
    };
    onConfigChange(updatedConfig);
  };

  return (
    <div className={styles.container}>
      <h3>Configuración de Anticipación</h3>
      
      <div className={styles.modeSelector}>
        <label>
          <input
            type="radio"
            name="anticipationMode"
            value="ESCALONADO"
            checked={mode === 'ESCALONADO'}
            onChange={(e) => handleModeChange(e.target.value)}
          />
          Modo Escalonado
        </label>
        <label>
          <input
            type="radio"
            name="anticipationMode"
            value="CONTINUO"
            checked={mode === 'CONTINUO'}
            onChange={(e) => handleModeChange(e.target.value)}
          />
          Modo Continuo
        </label>
      </div>

      {mode === 'CONTINUO' && (
        <div className={styles.continuousConfig}>
          <label>
            Días máximos:
            <input
              type="number"
              min="1"
              max="365"
              value={maxDays}
              onChange={(e) => handleMaxDaysChange(parseInt(e.target.value))}
            />
          </label>
          <div className={styles.explanation}>
            <p>El factor de anticipación será máximo cuando falten {maxDays} días o más, y 0 cuando sea el día de la fecha.</p>
            <p>Ejemplo: Si faltan 15 días de 30, el factor será 15/30 = 0.5 (50%)</p>
          </div>
        </div>
      )}

      {mode === 'ESCALONADO' && (
        <div className={styles.steppedConfig}>
          <h4>Pasos de anticipación:</h4>
          <div className={styles.stepsContainer}>
            {steps.map((step, index) => (
              <div key={index} className={styles.stepRow}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={step.days}
                  onChange={(e) => handleStepChange(index, 'days', e.target.value)}
                  placeholder="Días"
                />
                <span>días =</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={step.weight}
                  onChange={(e) => handleStepChange(index, 'weight', e.target.value)}
                  placeholder="Peso"
                />
                <span>× 100% = {Math.round(step.weight * 100)}%</span>
                {steps.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className={styles.removeButton}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className={styles.addButton}>
            + Agregar paso
          </button>
          <div className={styles.explanation}>
            <p>El factor de anticipación será el peso del primer paso que se cumpla.</p>
            <p>Ejemplo: Si faltan 10 días, se aplicará el peso del paso de 7 días (0.4 = 40%)</p>
          </div>
        </div>
      )}
    </div>
  );
} 