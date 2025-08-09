import { useState } from 'react';

export function useSeasonalCurveInteractions() {
  const [dragIdx, setDragIdx] = useState(null);
  const [hoveredKeyframe, setHoveredKeyframe] = useState(null);
  const [tooltip, setTooltip] = useState({ 
    show: false, 
    x: 0, 
    y: 0, 
    date: '', 
    price: 0,
    snapX: 0,
    snapY: 0
  });

  const handleMouseDown = (idx) => {
    setDragIdx(idx);
  };

  const handleMouseUp = () => {
    setDragIdx(null);
  };

  const handleMouseMove = (e, dateToX, valueToY, getInterpolatedPrice) => {
    if (!e.target.closest('svg')) return;

    const rect = e.target.closest('svg').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calcular fecha y precio interpolado
    const date = new Date(x * (24 * 60 * 60 * 1000) + new Date().getTime());
    const price = getInterpolatedPrice(date);

    setTooltip({
      show: true,
      x: e.clientX,
      y: e.clientY,
      date: date.toLocaleDateString('es-ES'),
      price: Math.round(price),
      snapX: x,
      snapY: y
    });
  };

  const handleSnapPointClick = (e, dateToX, valueToY, sortedKeyframes, onChange) => {
    if (!e.target.closest('svg')) return;

    const rect = e.target.closest('svg').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Encontrar el keyframe más cercano
    const clickedDate = new Date(x * (24 * 60 * 60 * 1000) + new Date().getTime());
    const closestKeyframe = sortedKeyframes.reduce((closest, keyframe) => {
      const distance = Math.abs(new Date(keyframe.date) - clickedDate);
      return distance < closest.distance ? { keyframe, distance } : closest;
    }, { keyframe: null, distance: Infinity });

    if (closestKeyframe.keyframe) {
      // Aquí podrías abrir el modal de edición
      console.log('Keyframe clicked:', closestKeyframe.keyframe);
    }
  };

  return {
    dragIdx,
    hoveredKeyframe,
    tooltip,
    setDragIdx,
    setHoveredKeyframe,
    setTooltip,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleSnapPointClick
  };
} 