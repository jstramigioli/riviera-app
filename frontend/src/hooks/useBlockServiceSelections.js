import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useBlockServiceSelections = (seasonBlockId) => {
  const [selections, setSelections] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar selecciones de servicios del bloque
  const loadSelections = useCallback(async () => {
    if (!seasonBlockId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/block-service-selections/block/${seasonBlockId}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar selecciones de servicios');
      }

      const data = await response.json();
      setSelections(data);
    } catch (err) {
      console.error('Error loading block service selections:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [seasonBlockId]);

  // Cargar servicios disponibles
  const loadAvailableServices = useCallback(async () => {
    if (!seasonBlockId) return;

    try {
      const response = await fetch(`${API_URL}/block-service-selections/block/${seasonBlockId}/available`);
      
      if (!response.ok) {
        throw new Error('Error al cargar servicios disponibles');
      }

      const data = await response.json();
      setAvailableServices(data);
    } catch (err) {
      console.error('Error loading available services:', err);
      setError(err.message);
    }
  }, [seasonBlockId]);

  // Crear nueva selección de servicio
  const createSelection = useCallback(async (selectionData) => {
    try {
      const response = await fetch(`${API_URL}/block-service-selections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...selectionData,
          seasonBlockId
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear selección de servicio');
      }

      const newSelection = await response.json();
      setSelections(prev => [...prev, newSelection]);
      await loadAvailableServices(); // Recargar servicios disponibles
      
      return newSelection;
    } catch (err) {
      console.error('Error creating service selection:', err);
      setError(err.message);
      throw err;
    }
  }, [seasonBlockId, loadAvailableServices]);

  // Actualizar selección de servicio
  const updateSelection = useCallback(async (id, updateData) => {
    try {
      console.log('Enviando petición PUT a:', `${API_URL}/block-service-selections/${id}`);
      console.log('Datos enviados:', updateData);

      const response = await fetch(`${API_URL}/block-service-selections/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('Respuesta del servidor:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response data:', errorData);
        throw new Error(errorData.error || 'Error al actualizar selección de servicio');
      }

      const updatedSelection = await response.json();
      console.log('Selección actualizada exitosamente:', updatedSelection);
      
      setSelections(prev => 
        prev.map(selection => 
          selection.id === id ? updatedSelection : selection
        )
      );

      return updatedSelection;
    } catch (err) {
      console.error('Error updating service selection:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Eliminar selección de servicio
  const deleteSelection = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/block-service-selections/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar selección de servicio');
      }

      setSelections(prev => prev.filter(selection => selection.id !== id));
      await loadAvailableServices(); // Recargar servicios disponibles
    } catch (err) {
      console.error('Error deleting service selection:', err);
      setError(err.message);
      throw err;
    }
  }, [loadAvailableServices]);

  // Reordenar selecciones
  const reorderSelections = useCallback(async (newOrder) => {
    try {
      const response = await fetch(`${API_URL}/block-service-selections/block/${seasonBlockId}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selections: newOrder }),
      });

      if (!response.ok) {
        throw new Error('Error al reordenar selecciones');
      }

      const updatedSelections = await response.json();
      setSelections(updatedSelections);
    } catch (err) {
      console.error('Error reordering selections:', err);
      setError(err.message);
      throw err;
    }
  }, [seasonBlockId]);

  // Toggle habilitar/deshabilitar selección
  const toggleSelection = useCallback(async (id, isEnabled) => {
    return updateSelection(id, { isEnabled });
  }, [updateSelection]);

  // Cargar datos iniciales
  useEffect(() => {
    if (seasonBlockId) {
      loadSelections();
      loadAvailableServices();
    }
  }, [seasonBlockId, loadSelections, loadAvailableServices]);

  return {
    selections,
    availableServices,
    loading,
    error,
    createSelection,
    updateSelection,
    deleteSelection,
    reorderSelections,
    toggleSelection,
    refreshSelections: loadSelections,
    refreshAvailableServices: loadAvailableServices
  };
}; 