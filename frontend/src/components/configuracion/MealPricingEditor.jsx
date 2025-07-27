import React, { useEffect, useState } from "react";

const defaultRules = {
  breakfastMode: "PERCENTAGE",
  breakfastValue: 15, // Cambiado a entero (15% en lugar de 0.15)
  dinnerMode: "PERCENTAGE",
  dinnerValue: 20, // Cambiado a entero (20% en lugar de 0.2)
};

export default function MealPricingEditor({ hotelId = "default-hotel" }) {
  const [rules, setRules] = useState(defaultRules);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        // Convertir valores decimales a enteros para porcentajes
        const convertedData = {
          ...data,
          breakfastValue: data.breakfastMode === "PERCENTAGE" ? Math.round(data.breakfastValue * 100) : data.breakfastValue,
          dinnerValue: data.dinnerMode === "PERCENTAGE" ? Math.round(data.dinnerValue * 100) : data.dinnerValue
        };
        setRules({ ...defaultRules, ...convertedData });
      })
      .catch(() => {
        // Si no hay reglas configuradas, usar las por defecto
        setRules(defaultRules);
      });
  }, [hotelId]);

  const handleChange = (field, value) => {
    setRules((r) => ({ ...r, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleModeChange = (mealType, newMode) => {
    setRules((r) => ({ 
      ...r, 
      [`${mealType}Mode`]: newMode,
      [`${mealType}Value`]: '' // Limpiar el valor al cambiar modo
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Convertir porcentajes a decimales para el backend
      const dataToSend = {
        ...rules,
        breakfastValue: rules.breakfastMode === "PERCENTAGE" ? rules.breakfastValue / 100 : rules.breakfastValue,
        dinnerValue: rules.dinnerMode === "PERCENTAGE" ? rules.dinnerValue / 100 : rules.dinnerValue
      };
      
      await fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      alert("Reglas guardadas exitosamente");
      setHasUnsavedChanges(false);
    } catch {
      alert("Error al guardar las reglas");
    }
    setSaving(false);
  };

  return (
    <div style={{ 
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'fit-content'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Configuración de Desayuno y Media Pensión</h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Configuración de Desayuno */}
        <div style={{ 
          border: '1px solid #e9ecef', 
          borderRadius: '8px', 
          padding: '20px',
          background: '#fff'
        }}>
          <h4 style={{ marginBottom: '15px', color: '#34495e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🍳 Desayuno
          </h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Modo:
            </label>
            <select
              value={rules.breakfastMode}
              onChange={(e) => handleModeChange("breakfast", e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="FIXED">Fijo (monto adicional)</option>
              <option value="PERCENTAGE">Porcentaje</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Valor:
            </label>
            <input
              type="number"
              value={rules.breakfastValue}
              onChange={(e) => handleChange("breakfastValue", parseFloat(e.target.value) || 0)}
              placeholder={rules.breakfastMode === "PERCENTAGE" ? "15" : "1500"}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <small style={{ color: '#6c757d', fontSize: '12px' }}>
              {rules.breakfastMode === "PERCENTAGE" ? "Porcentaje (ej: 15 para 15%)" : "Monto fijo en pesos"}
            </small>
          </div>
        </div>

        {/* Configuración de Media Pensión */}
        <div style={{ 
          border: '1px solid #e9ecef', 
          borderRadius: '8px', 
          padding: '20px',
          background: '#fff'
        }}>
          <h4 style={{ marginBottom: '15px', color: '#34495e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🍽️ Media Pensión
          </h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Modo:
            </label>
            <select
              value={rules.dinnerMode}
              onChange={(e) => handleModeChange("dinner", e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="FIXED">Fijo (monto adicional)</option>
              <option value="PERCENTAGE">Porcentaje</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Valor:
            </label>
            <input
              type="number"
              value={rules.dinnerValue}
              onChange={(e) => handleChange("dinnerValue", parseFloat(e.target.value) || 0)}
              placeholder={rules.dinnerMode === "PERCENTAGE" ? "20" : "2000"}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <small style={{ color: '#6c757d', fontSize: '12px' }}>
              {rules.dinnerMode === "PERCENTAGE" ? "Porcentaje (ej: 20 para 20%)" : "Monto fijo en pesos"}
            </small>
          </div>
        </div>
      </div>

      {/* Botón de guardado */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={handleSave} 
          disabled={saving || !hasUnsavedChanges}
          style={{
            padding: '12px 24px',
            background: hasUnsavedChanges ? '#667eea' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? "Guardando..." : hasUnsavedChanges ? "Guardar Reglas" : "Sin cambios"}
        </button>
      </div>
    </div>
  );
} 