import { useState, useEffect, useRef } from 'react';
import { addDays, format } from 'date-fns';

function getDaysArray(start, end) {
  const arr = [];
  let dt = start;
  while (dt <= end) {
    arr.push(new Date(dt));
    dt = addDays(dt, 1);
  }
  return arr;
}

function groupDaysByMonth(days) {
  const months = [];
  let currentMonth = null;
  let currentMonthDays = [];

  days.forEach(day => {
    const monthKey = format(day, 'yyyy-MM');
    
    if (currentMonth !== monthKey) {
      if (currentMonthDays.length > 0) {
        months.push({
          month: currentMonthDays[0],
          days: currentMonthDays,
          colSpan: currentMonthDays.length
        });
      }
      currentMonth = monthKey;
      currentMonthDays = [day];
    } else {
      currentMonthDays.push(day);
    }
  });

  if (currentMonthDays.length > 0) {
    months.push({
      month: currentMonthDays[0],
      days: currentMonthDays,
      colSpan: currentMonthDays.length
    });
  }

  return months;
}

export function useReservationGridData() {
  const today = new Date();
  const [startDate, setStartDate] = useState(addDays(today, -30));
  const [endDate, setEndDate] = useState(addDays(today, 30));
  const [days, setDays] = useState(getDaysArray(addDays(today, -30), addDays(today, 30)));
  const [months, setMonths] = useState(groupDaysByMonth(getDaysArray(addDays(today, -30), addDays(today, 30))));
  const [cellWidth, setCellWidth] = useState(40);
  const [cellHeight, setCellHeight] = useState(25);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const containerRef = useRef();

  const handleScroll = () => {
    if (!containerRef.current) return;
  
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
  
    // Solo procesar scroll horizontal, ignorar scroll vertical
    // Verificar si hay scroll horizontal significativo
    const horizontalScrollThreshold = 50; // Umbral mínimo para considerar scroll horizontal
    const isHorizontalScroll = Math.abs(scrollLeft) > horizontalScrollThreshold;
    
    if (!isHorizontalScroll) return;
  
    if (scrollLeft + clientWidth >= scrollWidth - 200) {
      setEndDate(prev => {
        const newEndDate = addDays(prev, 30);
        const newDays = getDaysArray(startDate, newEndDate);
        setDays(newDays);
        setMonths(groupDaysByMonth(newDays));
        return newEndDate;
      });
    }

    if (scrollLeft <= 200) {
      setStartDate(prev => {
        const newStartDate = addDays(prev, -30);
        const newDays = getDaysArray(newStartDate, endDate);
        setDays(newDays);
        setMonths(groupDaysByMonth(newDays));
        return newStartDate;
      });
    }
  };

  const centerOnToday = () => {
    const today = new Date();
    const newStartDate = addDays(today, -30);
    const newEndDate = addDays(today, 30);
    
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    const newDays = getDaysArray(newStartDate, newEndDate);
    setDays(newDays);
    setMonths(groupDaysByMonth(newDays));
  };

  const measureCellDimensions = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const availableWidth = container.clientWidth - 120; // Restar ancho de columna de habitaciones
    const newCellWidth = Math.max(40, availableWidth / days.length);
    setCellWidth(newCellWidth);
  };

  const measureHeaderHeight = () => {
    if (!containerRef.current) return;
    
    const header = containerRef.current.querySelector('thead');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }
  };

  useEffect(() => {
    if (isInitialLoad) {
      measureCellDimensions();
      measureHeaderHeight();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, days.length]);

  useEffect(() => {
    const handleResize = () => {
      measureCellDimensions();
      measureHeaderHeight();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    startDate,
    endDate,
    days,
    months,
    cellWidth,
    cellHeight,
    headerHeight,
    containerRef,
    setStartDate,
    setEndDate,
    setDays,
    setMonths,
    setCellWidth,
    setCellHeight,
    setHeaderHeight,
    handleScroll,
    centerOnToday,
    measureCellDimensions,
    measureHeaderHeight
  };
} 