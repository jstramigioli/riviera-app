import React, { useRef, useState } from "react";

const roomTypeCoefficients = {
  'single': 0.62,
  'doble': 1.00,
  'triple': 1.25,
  'cuadruple': 1.50,
  'quintuple': 1.75
};

const roomTypeNames = {
  'single': 'Single',
  'doble': 'Doble',
  'triple': 'Triple',
  'cuadruple': 'Cuádruple',
  'quintuple': 'Quíntuple'
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getMonthName(date) {
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  return months[date.getMonth()];
}

export default function SeasonalCurveEditor({ keyframes = [], onChange, onSave }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [editingPoint, setEditingPoint] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const svgRef = useRef();

  // Ordenar keyframes por fecha
  const sorted = [...keyframes].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (sorted.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No hay puntos de referencia configurados</p>
        <button 
          onClick={() => {
            console.log('Abriendo modal de agregar punto');
            setShowAddModal(true);
          }}
          style={{
            padding: '8px 16px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Agregar primer punto
        </button>
      </div>
    );
  }

  const minDate = new Date(sorted[0]?.date || new Date());
  const maxDate = new Date(sorted[sorted.length - 1]?.date || new Date());
  const minValue = Math.min(...sorted.map((k) => k.value));
  const maxValue = Math.max(...sorted.map((k) => k.value));

  // Escalas
  const width = 600, height = 300, margin = 60;
  const dateToX = (date) =>
    margin +
    ((new Date(date) - minDate) / (maxDate - minDate || 1)) * (width - 2 * margin);
  const valueToY = (value) =>
    height - margin - ((value - minValue) / (maxValue - minValue || 1)) * (height - 2 * margin);

  // Interpolación para la curva
  const points = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const date = new Date(lerp(new Date(a.date).getTime(), new Date(b.date).getTime(), t));
      const value = lerp(a.value, b.value, t);
      points.push({ x: dateToX(date), y: valueToY(value) });
    }
  }

  // Drag & drop handlers
  const handleMouseDown = (idx) => setDragIdx(idx);
  const handleMouseUp = () => setDragIdx(null);
  const handleMouseMove = (e) => {
    if (dragIdx === null) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    // Invertir escalas
    const date = new Date(
      minDate.getTime() +
        ((x - margin) / (width - 2 * margin)) * (maxDate - minDate || 1)
    );
    const value =
      minValue +
      ((height - margin - y) / (height - 2 * margin)) * (maxValue - minValue || 1);
    const newKeyframes = sorted.map((k, i) =>
      i === dragIdx ? { ...k, date: date.toISOString().slice(0, 10), value: Math.round(value) } : k
    );
    onChange(newKeyframes);
  };

  // Meses de fondo
  const months = [];
  let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    months.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  // Calcular precio interpolado para una fecha
  const getInterpolatedPrice = (date) => {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0].value;
    
    const targetDate = new Date(date);
    
    // Encontrar los dos puntos más cercanos
    let before = null, after = null;
    for (let i = 0; i < sorted.length; i++) {
      const pointDate = new Date(sorted[i].date);
      if (pointDate <= targetDate) {
        before = sorted[i];
      } else {
        after = sorted[i];
        break;
      }
    }
    
    if (!before) return after.value;
    if (!after) return before.value;
    
    // Interpolar
    const t = (targetDate - new Date(before.date)) / (new Date(after.date) - new Date(before.date));
    return lerp(before.value, after.value, t);
  };

  const basePrice = getInterpolatedPrice(previewDate);

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Curva Estacional (Base: Habitación Doble)</h3>
      
      <div style={{ 
        border: '1px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px',
        background: '#fff'
      }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ 
            background: "#f8f9fa", 
            border: "1px solid #dee2e6", 
            borderRadius: "4px",
            touchAction: "none" 
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Fondo sombreado por mes */}
          {months.map((m, i) => (
            <rect
              key={i}
              x={dateToX(m)}
              y={margin}
              width={dateToX(new Date(m.getFullYear(), m.getMonth() + 1, 1)) - dateToX(m)}
              height={height - 2 * margin}
              fill={i % 2 === 0 ? "#e3f2fd" : "#fff"}
              opacity={0.3}
            />
          ))}
          
          {/* Ejes */}
          <line x1={margin} y1={height - margin} x2={width - margin} y2={height - margin} stroke="#6c757d" strokeWidth={1} />
          <line x1={margin} y1={margin} x2={margin} y2={height - margin} stroke="#6c757d" strokeWidth={1} />
          
          {/* Etiquetas de fechas en eje X */}
          {months.map((m, i) => (
            <text
              key={i}
              x={dateToX(m) + 5}
              y={height - margin + 15}
              fontSize={12}
              fill="#495057"
            >
              {getMonthName(m)}
            </text>
          ))}
          
          {/* Etiquetas de precios en eje Y */}
          {[0, 25, 50, 75, 100].map(percent => {
            const value = minValue + (maxValue - minValue) * (percent / 100);
            const y = valueToY(value);
            return (
              <g key={percent}>
                <line x1={margin - 5} y1={y} x2={margin} y2={y} stroke="#6c757d" strokeWidth={1} />
                <text x={margin - 10} y={y + 4} fontSize={10} fill="#495057" textAnchor="end">
                  ${Math.round(value).toLocaleString()}
                </text>
              </g>
            );
          })}
          
          {/* Curva interpolada */}
          <polyline
            fill="none"
            stroke="#667eea"
            strokeWidth={3}
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          />
          
          {/* Puntos clave */}
          {sorted.map((k, i) => (
            <g key={i}>
              <circle
                cx={dateToX(k.date)}
                cy={valueToY(k.value)}
                r={8}
                fill="#fff"
                stroke="#667eea"
                strokeWidth={3}
                onMouseDown={() => handleMouseDown(i)}
                onClick={() => setEditingPoint({ index: i, point: k })}
                style={{ cursor: "pointer" }}
              />
            </g>
          ))}
        </svg>
        
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            + Agregar punto
          </button>
          <button
            onClick={onSave}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Guardar Curva
          </button>
        </div>
      </div>

      {/* Previsualización de tarifas */}
      <div style={{ 
        marginTop: '30px',
        border: '1px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px',
        background: '#f8f9fa'
      }}>
        <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Previsualización de Tarifas</h4>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}>Fecha de previsualización:</label>
          <input
            type="date"
            value={previewDate}
            onChange={(e) => setPreviewDate(e.target.value)}
            style={{
              padding: '5px 10px',
              border: '1px solid #ced4da',
              borderRadius: '4px'
            }}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '4px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                Tipo de Habitación
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                Base
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                Con Desayuno
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                Media Pensión
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(roomTypeCoefficients).map(([type, coefficient]) => {
              const basePriceForType = Math.round(basePrice * coefficient);
              const breakfastPrice = Math.round(basePriceForType * 1.15); // 15% más
              const halfBoardPrice = Math.round(breakfastPrice * 1.20); // 20% más sobre desayuno
              
              return (
                <tr key={type} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>
                    {roomTypeNames[type]}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ${basePriceForType.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#28a745' }}>
                    ${breakfastPrice.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#dc3545' }}>
                    ${halfBoardPrice.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para agregar punto */}
      {showAddModal && (
        <div>
          {console.log('Renderizando modal de agregar punto')}
          <AddPointModal
            onClose={() => setShowAddModal(false)}
            onAdd={(newPoint) => {
              const newKeyframes = [...sorted, newPoint].sort((a, b) => new Date(a.date) - new Date(b.date));
              onChange(newKeyframes);
              setShowAddModal(false);
            }}
          />
        </div>
      )}

      {/* Modal para editar punto */}
      {editingPoint && (
        <EditPointModal
          point={editingPoint.point}
          onClose={() => setEditingPoint(null)}
          onSave={(updatedPoint) => {
            const newKeyframes = sorted.map((k, i) => 
              i === editingPoint.index ? updatedPoint : k
            );
            onChange(newKeyframes);
            setEditingPoint(null);
          }}
          onDelete={() => {
            const newKeyframes = sorted.filter((_, i) => i !== editingPoint.index);
            onChange(newKeyframes);
            setEditingPoint(null);
          }}
        />
      )}
    </div>
  );
}

function AddPointModal({ onClose, onAdd }) {
  console.log('AddPointModal renderizando');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submit del modal:', { date, value });
    if (!date || !value) return;
    onAdd({ date, value: parseFloat(value) });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px', 
        minWidth: '400px',
        border: '2px solid red'
      }}>
        <h3 style={{ marginBottom: '20px' }}>Agregar Punto de Referencia</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Precio Base (Habitación Doble):</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: 10000"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPointModal({ point, onClose, onSave, onDelete }) {
  // Validar que la fecha sea válida para el input type="date"
  const validDate = (() => {
    try {
      const dateObj = new Date(point.date);
      if (isNaN(dateObj.getTime())) {
        return new Date().toISOString().slice(0, 10);
      }
      return dateObj.toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();
  
  const [date, setDate] = useState(validDate);
  const [value, setValue] = useState(point.value.toString());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !value) return;
    onSave({ date, value: parseFloat(value) });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', minWidth: '400px' }}>
        <h3 style={{ marginBottom: '20px' }}>Editar Punto de Referencia</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Precio Base (Habitación Doble):</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDelete} style={{
              padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Eliminar
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 