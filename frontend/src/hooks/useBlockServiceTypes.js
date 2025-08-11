import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../services/api';

export const useBlockServiceTypes = (seasonBlockId) => {
  const [blockServiceTypes, setBlockServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar tipos de servicio del bloque
  const loadBlockServiceTypes = useCallback(async () => {
    if (!seasonBlockId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/block-service-types/block/${seasonBlockId}`);
      if (!response.ok) throw new Error('Error fetching block service types');
      const data = await response.json();
      setBlockServiceTypes(data);
    } catch (err) {
      console.error('Error loading block service types:', err);
      setError('Error al cargar los tipos de servicio del bloque');
    } finally {
      setLoading(false);
    }
  }, [seasonBlockId]);

  // Crear nuevo tipo de servicio
  const createBlockServiceType = async (serviceTypeData) => {
    try {
      const response = await fetch(`${API_URL}/block-service-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...serviceTypeData,
          seasonBlockId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el tipo de servicio');
      }
      
      const data = await response.json();
      setBlockServiceTypes(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Error creating block service type:', err);
      throw new Error(err.message || 'Error al crear el tipo de servicio');
    }
  };

  // Actualizar tipo de servicio
  const updateBlockServiceType = async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/block-service-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el tipo de servicio');
      }
      
      const data = await response.json();
      setBlockServiceTypes(prev => 
        prev.map(st => st.id === id ? data : st)
      );
      
      return data;
    } catch (err) {
      console.error('Error updating block service type:', err);
      throw new Error(err.message || 'Error al actualizar el tipo de servicio');
    }
  };

  // Eliminar tipo de servicio
  const deleteBlockServiceType = async (id) => {
    try {
      const response = await fetch(`${API_URL}/block-service-types/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar el tipo de servicio');
      }
      
      setBlockServiceTypes(prev => prev.filter(st => st.id !== id));
    } catch (err) {
      console.error('Error deleting block service type:', err);
      throw new Error(err.message || 'Error al eliminar el tipo de servicio');
    }
  };

  // Reordenar tipos de servicio
  const reorderBlockServiceTypes = async (newOrder) => {
    try {
      const serviceTypeIds = newOrder.map(st => st.id);
      
      const response = await fetch(`${API_URL}/block-service-types/block/${seasonBlockId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceTypeIds })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al reordenar los tipos de servicio');
      }
      
      // Actualizar el estado local con el nuevo orden
      setBlockServiceTypes(newOrder);
    } catch (err) {
      console.error('Error reordering block service types:', err);
      throw new Error(err.message || 'Error al reordenar los tipos de servicio');
    }
  };

  // Toggle activar/desactivar tipo de servicio
  const toggleBlockServiceType = async (id, isActive) => {
    try {
      await updateBlockServiceType(id, { isActive });
    } catch (err) {
      console.error('Error toggling block service type:', err);
      throw err;
    }
  };

  // Cargar tipos de servicio al cambiar el seasonBlockId
  useEffect(() => {
    loadBlockServiceTypes();
  }, [loadBlockServiceTypes]);

  return {
    blockServiceTypes,
    loading,
    error,
    createBlockServiceType,
    updateBlockServiceType,
    deleteBlockServiceType,
    reorderBlockServiceTypes,
    toggleBlockServiceType,
    reload: loadBlockServiceTypes
  };
}; 