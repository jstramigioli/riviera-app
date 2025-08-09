import { useState, useCallback } from 'react';

export function useLoadingState(initialStates = {}) {
  const [loadingStates, setLoadingStates] = useState(initialStates);
  const [errors, setErrors] = useState({});

  const setLoading = useCallback((key, isLoading = true) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const setError = useCallback((key, error = null) => {
    setErrors(prev => ({
      ...prev,
      [key]: error
    }));
  }, []);

  const clearError = useCallback((key) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const withLoading = useCallback(async (key, asyncFunction) => {
    try {
      setLoading(key, true);
      setError(key, null);
      const result = await asyncFunction();
      return result;
    } catch (error) {
      setError(key, error.message || 'Error inesperado');
      throw error;
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  const isLoading = (key) => loadingStates[key] || false;
  const hasError = (key) => !!errors[key];
  const getError = (key) => errors[key];
  const isAnyLoading = Object.values(loadingStates).some(Boolean);
  const hasAnyError = Object.keys(errors).length > 0;

  return {
    loadingStates,
    errors,
    isLoading,
    hasError,
    getError,
    isAnyLoading,
    hasAnyError,
    setLoading,
    setError,
    clearError,
    clearAllErrors,
    withLoading
  };
}

// Hook específico para operaciones CRUD
export function useCRUDLoading() {
  const {
    loadingStates,
    errors,
    isLoading,
    hasError,
    getError,
    setLoading,
    setError,
    clearError,
    withLoading
  } = useLoadingState({
    create: false,
    read: false,
    update: false,
    delete: false
  });

  const createLoading = isLoading('create');
  const readLoading = isLoading('read');
  const updateLoading = isLoading('update');
  const deleteLoading = isLoading('delete');

  const createError = getError('create');
  const readError = getError('read');
  const updateError = getError('update');
  const deleteError = getError('delete');

  const withCreateLoading = (asyncFunction) => withLoading('create', asyncFunction);
  const withReadLoading = (asyncFunction) => withLoading('read', asyncFunction);
  const withUpdateLoading = (asyncFunction) => withLoading('update', asyncFunction);
  const withDeleteLoading = (asyncFunction) => withLoading('delete', asyncFunction);

  return {
    // Estados de loading
    createLoading,
    readLoading,
    updateLoading,
    deleteLoading,
    isAnyLoading: createLoading || readLoading || updateLoading || deleteLoading,

    // Estados de error
    createError,
    readError,
    updateError,
    deleteError,
    hasAnyError: !!createError || !!readError || !!updateError || !!deleteError,

    // Funciones de loading
    withCreateLoading,
    withReadLoading,
    withUpdateLoading,
    withDeleteLoading,

    // Funciones de error
    setCreateError: (error) => setError('create', error),
    setReadError: (error) => setError('read', error),
    setUpdateError: (error) => setError('update', error),
    setDeleteError: (error) => setError('delete', error),

    clearCreateError: () => clearError('create'),
    clearReadError: () => clearError('read'),
    clearUpdateError: () => clearError('update'),
    clearDeleteError: () => clearError('delete'),

    // Funciones de loading directas
    setCreateLoading: (loading) => setLoading('create', loading),
    setReadLoading: (loading) => setLoading('read', loading),
    setUpdateLoading: (loading) => setLoading('update', loading),
    setDeleteLoading: (loading) => setLoading('delete', loading)
  };
}

// Hook específico para formularios
export function useFormLoading() {
  const {
    loadingStates,
    errors,
    isLoading,
    hasError,
    getError,
    setLoading,
    setError,
    clearError,
    withLoading
  } = useLoadingState({
    submit: false,
    validate: false,
    save: false
  });

  const submitLoading = isLoading('submit');
  const validateLoading = isLoading('validate');
  const saveLoading = isLoading('save');

  const submitError = getError('submit');
  const validateError = getError('validate');
  const saveError = getError('save');

  const withSubmitLoading = (asyncFunction) => withLoading('submit', asyncFunction);
  const withValidateLoading = (asyncFunction) => withLoading('validate', asyncFunction);
  const withSaveLoading = (asyncFunction) => withLoading('save', asyncFunction);

  return {
    // Estados de loading
    submitLoading,
    validateLoading,
    saveLoading,
    isAnyLoading: submitLoading || validateLoading || saveLoading,

    // Estados de error
    submitError,
    validateError,
    saveError,
    hasAnyError: !!submitError || !!validateError || !!saveError,

    // Funciones de loading
    withSubmitLoading,
    withValidateLoading,
    withSaveLoading,

    // Funciones de error
    setSubmitError: (error) => setError('submit', error),
    setValidateError: (error) => setError('validate', error),
    setSaveError: (error) => setError('save', error),

    clearSubmitError: () => clearError('submit'),
    clearValidateError: () => clearError('validate'),
    clearSaveError: () => clearError('save'),

    // Funciones de loading directas
    setSubmitLoading: (loading) => setLoading('submit', loading),
    setValidateLoading: (loading) => setLoading('validate', loading),
    setSaveLoading: (loading) => setLoading('save', loading)
  };
} 