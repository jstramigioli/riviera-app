import { useMemo } from 'react';
import { addMonths, subMonths } from 'date-fns';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function useSeasonalCurveCalculations(keyframes, selectedRoomType, selectedPriceType, roomTypeCoefficients, currentPeriod, zoomLevel) {
  // Ordenar keyframes por fecha
  const sortedKeyframes = useMemo(() => {
    return [...keyframes].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [keyframes]);

  // Función para obtener el rango de fechas basado en el período actual
  const dateRange = useMemo(() => {
    const period = currentPeriod;
    
    switch (zoomLevel) {
      case 'month': {
        const monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
        const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0);
        return { minDate: monthStart, maxDate: monthEnd };
      }
      case 'quarter': {
        const quarterStart = new Date(period.getFullYear(), period.getMonth() - 1, 1);
        const quarterEnd = new Date(period.getFullYear(), period.getMonth() + 2, 0);
        return { minDate: quarterStart, maxDate: quarterEnd };
      }
      default: {
        const minDate = new Date(sortedKeyframes[0]?.date || period);
        const maxDate = new Date(sortedKeyframes[sortedKeyframes.length - 1]?.date || period);
        return { minDate, maxDate };
      }
    }
  }, [currentPeriod, zoomLevel, sortedKeyframes]);

  // Calcular valores ajustados considerando el tipo de habitación y precio seleccionado
  const adjustedValues = useMemo(() => {
    const calculateAdjustedValue = (baseValue) => {
      const basePriceForType = Math.round(baseValue * roomTypeCoefficients[selectedRoomType]);
      
      switch (selectedPriceType) {
        case 'breakfast':
          return Math.round(basePriceForType * 1.15);
        case 'halfBoard':
          return Math.round(basePriceForType * 1.35);
        default:
          return basePriceForType;
      }
    };

    return sortedKeyframes.map(k => calculateAdjustedValue(k.value));
  }, [sortedKeyframes, selectedRoomType, selectedPriceType, roomTypeCoefficients]);

  const normalizeDate = (date) => {
    const { minDate, maxDate } = dateRange;
    const totalRange = maxDate - minDate;
    return (date - minDate) / totalRange;
  };

  const dateToX = (date) => {
    const normalized = normalizeDate(new Date(date));
    return normalized * 800; // Ancho del canvas
  };

  const curveDateToX = (date) => {
    const normalized = normalizeDate(new Date(date));
    return normalized * 800;
  };

  const xToCurveDate = (x) => {
    const { minDate, maxDate } = dateRange;
    const normalized = x / 800;
    return new Date(minDate.getTime() + normalized * (maxDate - minDate));
  };

  const valueToY = (value) => {
    const minValue = Math.min(...adjustedValues, 0);
    const maxValue = Math.max(...adjustedValues, 1000);
    const range = maxValue - minValue;
    const normalized = (value - minValue) / range;
    return 400 - (normalized * 400); // Invertir Y y usar altura de 400
  };

  const getInterpolatedPrice = (date) => {
    if (sortedKeyframes.length === 0) return 0;
    if (sortedKeyframes.length === 1) return sortedKeyframes[0].value;

    const targetDate = new Date(date);
    
    // Encontrar los keyframes que rodean la fecha objetivo
    let beforeKeyframe = null;
    let afterKeyframe = null;

    for (let i = 0; i < sortedKeyframes.length; i++) {
      const keyframeDate = new Date(sortedKeyframes[i].date);
      
      if (keyframeDate <= targetDate) {
        beforeKeyframe = sortedKeyframes[i];
      } else {
        afterKeyframe = sortedKeyframes[i];
        break;
      }
    }

    // Si no hay keyframe anterior, usar el primero
    if (!beforeKeyframe) {
      return sortedKeyframes[0].value;
    }

    // Si no hay keyframe posterior, usar el último
    if (!afterKeyframe) {
      return sortedKeyframes[sortedKeyframes.length - 1].value;
    }

    // Interpolar entre los dos keyframes
    const beforeDate = new Date(beforeKeyframe.date);
    const afterDate = new Date(afterKeyframe.date);
    const totalRange = afterDate - beforeDate;
    const targetRange = targetDate - beforeDate;
    const t = targetRange / totalRange;

    return lerp(beforeKeyframe.value, afterKeyframe.value, t);
  };

  const navigatePeriod = (direction) => {
    const newPeriod = direction === 'next' 
      ? addMonths(currentPeriod, 1)
      : subMonths(currentPeriod, 1);
    return newPeriod;
  };

  return {
    sortedKeyframes,
    dateRange,
    adjustedValues,
    dateToX,
    valueToY,
    getInterpolatedPrice,
    navigatePeriod
  };
} 