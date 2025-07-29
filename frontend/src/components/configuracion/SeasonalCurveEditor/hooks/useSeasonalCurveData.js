import { useState, useEffect } from 'react';
import { fetchRoomTypes, fetchOperationalPeriods } from '../../../../services/api';

export function useSeasonalCurveData(hotelId) {
  const [selectedRoomType, setSelectedRoomType] = useState('doble');
  const [selectedPriceType, setSelectedPriceType] = useState('base');
  const [zoomLevel, setZoomLevel] = useState('month');
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomTypeCoefficients, setRoomTypeCoefficients] = useState({});
  const [mealRules, setMealRules] = useState({
    breakfastMode: "PERCENTAGE",
    breakfastValue: 0.15,
    dinnerMode: "PERCENTAGE",
    dinnerValue: 0.2,
  });
  const [periodsData, setPeriodsData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [roomTypesData, periodsData] = await Promise.all([
          fetchRoomTypes(),
          fetchOperationalPeriods(hotelId)
        ]);

        setRoomTypes(roomTypesData);
        setPeriodsData(periodsData);

        // Configurar coeficientes por defecto
        const defaultCoefficients = {};
        roomTypesData.forEach(type => {
          defaultCoefficients[type.id] = type.multiplier || 1.0;
        });
        setRoomTypeCoefficients(defaultCoefficients);
      } catch (error) {
        console.error('Error loading seasonal curve data:', error);
      }
    };

    loadData();
  }, [hotelId]);

  return {
    selectedRoomType,
    selectedPriceType,
    zoomLevel,
    currentPeriod,
    roomTypes,
    roomTypeCoefficients,
    mealRules,
    periodsData,
    setSelectedRoomType,
    setSelectedPriceType,
    setZoomLevel,
    setCurrentPeriod,
    setRoomTypeCoefficients,
    setMealRules
  };
} 