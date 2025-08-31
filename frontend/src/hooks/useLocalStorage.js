import { useState } from 'react';

export const useLocalStorage = (key, initialValue) => {
  // Función para obtener el valor inicial desde localStorage o usar el valor por defecto
  const getStoredValue = () => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  // Estado para almacenar el valor
  const [storedValue, setStoredValue] = useState(getStoredValue);

  // Función para establecer el valor
  const setValue = (value) => {
    try {
      // Permitir que value sea una función para que tengamos la misma API que useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Guardar en el estado
      setStoredValue(valueToStore);
      
      // Guardar en localStorage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Función para limpiar el valor
  const clearValue = () => {
    try {
      setStoredValue(initialValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, clearValue];
}; 