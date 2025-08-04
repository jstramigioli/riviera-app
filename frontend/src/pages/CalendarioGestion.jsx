import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaChevronLeft, FaChevronRight, FaHotel, FaTimes, FaDollarSign, FaCalendarAlt } from 'react-icons/fa';
import DayEditPanel from '../components/DayEditPanel';
import { fetchOpenDays, fetchRoomTypes, createOpenDay, updateOpenDay, deleteOpenDay } from '../services/api';
import styles from '../styles/CalendarioGestion.module.css';

export default function CalendarioGestion() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayEditPanelOpen, setIsDayEditPanelOpen] = useState(false);
  const [openDays, setOpenDays] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generar días del mes actual
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Agregar días del mes anterior para completar la primera semana
  const firstDayOfWeek = monthStart.getDay();
  const daysFromPrevMonth = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    daysFromPrevMonth.push(new Date(monthStart.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
  }

  // Agregar días del mes siguiente para completar la última semana
  const lastDayOfWeek = monthEnd.getDay();
  const daysFromNextMonth = [];
  for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
    daysFromNextMonth.push(new Date(monthEnd.getTime() + i * 24 * 60 * 60 * 1000));
  }

  const allDays = [...daysFromPrevMonth, ...daysInMonth, ...daysFromNextMonth];

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar días abiertos para el mes actual
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      try {
        console.log('Loading data for month:', startDate, 'to', endDate);
        
        const [openDaysData, roomTypesData] = await Promise.all([
          fetchOpenDays(startDate, endDate),
          fetchRoomTypes()
        ]);
        
        console.log('Loaded open days from API:', openDaysData);
        console.log('Loaded room types from API:', roomTypesData);
        
        // Normalizar las fechas para que coincidan con el formato del frontend
        const normalizedOpenDays = openDaysData.map(day => ({
          ...day,
          date: format(parseISO(day.date), 'yyyy-MM-dd')
        }));
        
        console.log('Normalized open days:', normalizedOpenDays);
        
        setOpenDays(normalizedOpenDays);
        setRoomTypes(roomTypesData);
      } catch (apiError) {
        console.error('Error loading from API:', apiError);
        // Solo usar mock si hay un error real de conexión
        if (apiError.message.includes('Failed to fetch') || apiError.message.includes('NetworkError')) {
          console.log('Using mock data due to connection error');
          const mockOpenDays = [
            { date: '2025-01-15', isClosed: false, isHoliday: false, fixedPrice: 7500, notes: 'Precio especial' },
            { date: '2025-01-20', isClosed: false, isHoliday: false, fixedPrice: null, notes: 'Precio dinámico' },
            { date: '2025-01-25', isClosed: false, isHoliday: false, fixedPrice: 8000, notes: 'Evento especial' },
            { date: '2025-01-10', isClosed: true, isHoliday: true, fixedPrice: null, notes: 'Feriado nacional' }
          ];
          
          setOpenDays(mockOpenDays);
          
          const mockRoomTypes = [
            { id: 1, name: 'Estándar', multiplier: 1.0 },
            { id: 2, name: 'Doble', multiplier: 1.3 },
            { id: 3, name: 'Suite', multiplier: 1.8 }
          ];
          setRoomTypes(mockRoomTypes);
        } else {
          // Si es otro tipo de error, mostrar el error pero no usar mock
          console.error('API Error:', apiError);
          setOpenDays([]);
          setRoomTypes([]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    setIsDayEditPanelOpen(true);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const isDayOpen = (day) => {
    const dayData = getDayData(day);
    return dayData && !dayData.isClosed;
  };

  const isDayHoliday = (day) => {
    const dayData = getDayData(day);
    return dayData && dayData.isHoliday;
  };

  const getDayData = (day) => {
    if (!day) return null;
    const dayStr = format(day, 'yyyy-MM-dd');
    console.log('Looking for day:', dayStr, 'in openDays:', openDays);
    
    return openDays.find(openDay => {
      // Normalizar la fecha del openDay para comparación
      // Usar parseISO para evitar problemas de zona horaria
      const openDayDate = parseISO(openDay.date);
      const openDayStr = format(openDayDate, 'yyyy-MM-dd');
      console.log('Comparing:', openDayStr, 'with', dayStr);
      return openDayStr === dayStr;
    });
  };

  const getDayPrice = (day) => {
    const dayData = getDayData(day);
    if (!dayData) return null;
    return dayData.fixedPrice;
  };

  const isCurrentMonth = (day) => {
    return isSameMonth(day, currentDate);
  };

  const isToday = (day) => {
    return isSameDay(day, new Date());
  };

  if (loading) {
    return <div className={styles.loading}>Cargando calendario...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <FaCalendarAlt className={styles.titleIcon} />
          Calendario de Gestión
        </h1>
        <p className={styles.subtitle}>
          Gestiona los días abiertos, precios y eventos especiales del hotel
        </p>
      </div>

      <div className={styles.calendarContainer}>
        {/* Navegación del mes */}
        <div className={styles.monthNavigation}>
          <button 
            className={styles.navButton}
            onClick={handlePreviousMonth}
          >
            <FaChevronLeft />
          </button>
          <h2 className={styles.monthTitle}>
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <button 
            className={styles.navButton}
            onClick={handleNextMonth}
          >
            <FaChevronRight />
          </button>
        </div>

        {/* Calendario */}
        <div className={styles.calendar}>
          {/* Días de la semana */}
          <div className={styles.weekDays}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className={styles.daysGrid}>
            {allDays.map((day, index) => {
              const isOpen = isDayOpen(day);
              const dayData = getDayData(day);
              const price = getDayPrice(day);
              const isCurrentMonthDay = isCurrentMonth(day);
              const isTodayDay = isToday(day);

              return (
                <div
                  key={index}
                  className={`${styles.dayCell} ${
                    !isCurrentMonthDay ? styles.otherMonth : ''
                  } ${isTodayDay ? styles.today : ''} ${
                    isOpen ? styles.openDay : 
                    isDayHoliday(day) ? styles.holidayDay : styles.closedDay
                  }`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={styles.dayNumber}>
                    {format(day, 'd')}
                  </div>
                  
                  {isOpen && (
                    <div className={styles.dayInfo}>
                      <div className={styles.dayStatus}>
                        <FaHotel className={styles.hotelIcon} />
                      </div>
                      
                      {price && (
                        <div className={styles.dayPrice}>
                          <FaDollarSign />
                          {(price / 100).toFixed(0)}
                        </div>
                      )}
                      
                      {dayData?.notes && (
                        <div className={styles.dayNotes} title={dayData.notes}>
                          <FaTimes />
                        </div>
                      )}
                    </div>
                  )}
                  
                                     {!isOpen && (
                     <div className={styles.closedIndicator}>
                       {isDayHoliday(day) ? '🏖️' : <FaTimes />}
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.openDay}`}></div>
            <span>Día abierto</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.closedDay}`}></div>
            <span>Día cerrado</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.holidayDay}`}></div>
            <span>Feriado/Fin de semana largo</span>
          </div>
          <div className={styles.legendItem}>
            <FaDollarSign className={styles.legendIcon} />
            <span>Precio fijo</span>
          </div>
          <div className={styles.legendItem}>
            <FaTimes className={styles.legendIcon} />
            <span>Evento especial</span>
          </div>
        </div>
      </div>

      {/* Panel de edición del día */}
      <DayEditPanel
        isOpen={isDayEditPanelOpen}
        onClose={() => setIsDayEditPanelOpen(false)}
        selectedDate={selectedDate}
        dayData={selectedDate ? getDayData(selectedDate) : null}
        roomTypes={roomTypes}
        key={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'new'}
        onSave={async (updatedData) => {
          try {
            console.log('Saving day data:', updatedData);
            console.log('Selected date:', selectedDate);
            console.log('Formatted date:', format(selectedDate, 'yyyy-MM-dd'));
            
            if (!updatedData.isClosed) {
              // Intentar actualizar primero
              try {
                console.log('Attempting to update existing day');
                await updateOpenDay(updatedData.date, updatedData);
                console.log('Day updated successfully');
              } catch (updateError) {
                console.log('Update failed:', updateError);
                // Si la actualización falla con 404, intentar crear
                if (updateError.status === 404) {
                  console.log('Day not found, creating new day');
                  await createOpenDay(updatedData);
                  console.log('Day created successfully');
                } else {
                  throw updateError;
                }
              }
            } else {
              // Si está cerrado, eliminar el día si existe
              const existingDayData = getDayData(selectedDate);
              if (existingDayData) {
                await deleteOpenDay(updatedData.date);
              }
            }
            
            // Recargar datos
            console.log('Reloading data after save...');
            await loadData();
            console.log('Data reloaded successfully');
            setIsDayEditPanelOpen(false);
          } catch (error) {
            console.error('Error saving day data:', error);
            alert('Error al guardar los datos del día');
          }
        }}
      />
    </div>
  );
} 