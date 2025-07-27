import React, { useEffect, useState } from "react";

const defaultRules = {
  breakfastMode: "PERCENTAGE",
  breakfastValue: 0.15,
  dinnerMode: "PERCENTAGE",
  dinnerValue: 0.2,
};

export default function MealPricingEditor({ hotelId = "default-hotel" }) {
  const [rules, setRules] = useState(defaultRules);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState({ breakfast: 0, halfBoard: 0 });

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`)
      .then((res) => res.json())
      .then((data) => setRules({ ...defaultRules, ...data }))
      .catch(() => {
        // Si no hay reglas configuradas, usar las por defecto
        setRules(defaultRules);
      });
  }, [hotelId]);

  useEffect(() => {
    // Previsualización con tarifa base de ejemplo
    const base = 10000;
    let breakfast = rules.breakfastMode === "FIXED"
      ? base + Number(rules.breakfastValue)
      : base * (1 + Number(rules.breakfastValue));
    let halfBoard = rules.dinnerMode === "FIXED"
      ? breakfast + Number(rules.dinnerValue)
      : breakfast * (1 + Number(rules.dinnerValue));
    setPreview({
      breakfast: Math.round(breakfast),
      halfBoard: Math.round(halfBoard),
    });
  }, [rules]);

  const handleChange = (field, value) => {
    setRules((r) => ({ ...r, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      await fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      alert("Reglas guardadas exitosamente");
    } catch {
      alert("Error al guardar las reglas");
    }
    setSaving(false);
  };

  return (
    <div style={{ 
      padding: '20px'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Configuración de Desayuno y Cena</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
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
              onChange={(e) => handleChange("breakfastMode", e.target.value)}
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
              min={0}
              step={rules.breakfastMode === "FIXED" ? 100 : 0.01}
              onChange={(e) => handleChange("breakfastValue", e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <small style={{ color: '#6c757d' }}>
              {rules.breakfastMode === "FIXED" ? "Monto en pesos" : "Porcentaje (ej: 0.15 = 15%)"}
            </small>
          </div>
        </div>

        {/* Configuración de Cena */}
        <div style={{ 
          border: '1px solid #e9ecef', 
          borderRadius: '8px', 
          padding: '20px',
          background: '#fff'
        }}>
          <h4 style={{ marginBottom: '15px', color: '#34495e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🍽️ Cena
          </h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Modo:
            </label>
            <select
              value={rules.dinnerMode}
              onChange={(e) => handleChange("dinnerMode", e.target.value)}
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
              min={0}
              step={rules.dinnerMode === "FIXED" ? 100 : 0.01}
              onChange={(e) => handleChange("dinnerValue", e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <small style={{ color: '#6c757d' }}>
              {rules.dinnerMode === "FIXED" ? "Monto en pesos" : "Porcentaje (ej: 0.20 = 20%)"}
            </small>
          </div>
        </div>
      </div>

      {/* Previsualización */}
      <div style={{ 
        marginTop: '30px',
        border: '1px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px',
        background: '#f8f9fa'
      }}>
        <h4 style={{ marginBottom: '15px', color: '#34495e' }}>
          📊 Previsualización (tarifa base $10.000)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={{ 
            background: '#fff', 
            padding: '15px', 
            borderRadius: '6px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '5px' }}>
              Con desayuno:
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
              ${preview.breakfast.toLocaleString()}
            </div>
          </div>
          <div style={{ 
            background: '#fff', 
            padding: '15px', 
            borderRadius: '6px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '5px' }}>
              Con desayuno + cena:
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545' }}>
              ${preview.halfBoard.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={handleSave} 
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? "Guardando..." : "Guardar Reglas"}
        </button>
      </div>
    </div>
  );
} 