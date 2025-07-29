import { useState, useCallback } from 'react';

export function useFormValidation(validationRules = {}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((name, value, rules = {}) => {
    const fieldRules = rules[name] || validationRules[name] || [];
    const fieldErrors = [];

    fieldRules.forEach(rule => {
      const { type, message, validator } = rule;

      switch (type) {
        case 'required':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            fieldErrors.push(message || 'Este campo es requerido');
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (value && !emailRegex.test(value)) {
            fieldErrors.push(message || 'Formato de email inválido');
          }
          break;

        case 'minLength':
          if (value && value.length < rule.value) {
            fieldErrors.push(message || `Mínimo ${rule.value} caracteres`);
          }
          break;

        case 'maxLength':
          if (value && value.length > rule.value) {
            fieldErrors.push(message || `Máximo ${rule.value} caracteres`);
          }
          break;

        case 'min':
          if (value && parseFloat(value) < rule.value) {
            fieldErrors.push(message || `Valor mínimo: ${rule.value}`);
          }
          break;

        case 'max':
          if (value && parseFloat(value) > rule.value) {
            fieldErrors.push(message || `Valor máximo: ${rule.value}`);
          }
          break;

        case 'pattern':
          if (value && !rule.value.test(value)) {
            fieldErrors.push(message || 'Formato inválido');
          }
          break;

        case 'custom':
          if (validator && !validator(value)) {
            fieldErrors.push(message || 'Validación fallida');
          }
          break;

        default:
          break;
      }
    });

    return fieldErrors;
  }, [validationRules]);

  const validateForm = useCallback((formData) => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const fieldErrors = validateField(fieldName, formData[fieldName]);
      if (fieldErrors.length > 0) {
        newErrors[fieldName] = fieldErrors;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [validationRules, validateField]);

  const validateSingleField = useCallback((name, value) => {
    const fieldErrors = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: fieldErrors
    }));
    return fieldErrors.length === 0;
  }, [validateField]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  }, []);

  const handleChange = useCallback((name, value) => {
    if (touched[name]) {
      validateSingleField(name, value);
    }
  }, [touched, validateSingleField]);

  const resetErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const isFieldTouched = (fieldName) => touched[fieldName];
  const getFieldErrors = (fieldName) => errors[fieldName] || [];

  return {
    errors,
    touched,
    hasErrors,
    isFieldTouched,
    getFieldErrors,
    validateForm,
    validateSingleField,
    handleBlur,
    handleChange,
    resetErrors
  };
}

// Reglas de validación predefinidas
export const validationRules = {
  // Reglas para reservas
  reservation: {
    checkIn: [
      { type: 'required', message: 'Fecha de check-in es requerida' },
      { type: 'custom', validator: (value) => new Date(value) >= new Date(), message: 'Check-in no puede ser en el pasado' }
    ],
    checkOut: [
      { type: 'required', message: 'Fecha de check-out es requerida' },
      { type: 'custom', validator: (value, formData) => {
        if (!formData.checkIn) return true;
        return new Date(value) > new Date(formData.checkIn);
      }, message: 'Check-out debe ser después del check-in' }
    ],
    roomId: [
      { type: 'required', message: 'Habitación es requerida' }
    ],
    guestName: [
      { type: 'required', message: 'Nombre del huésped es requerido' },
      { type: 'minLength', value: 2, message: 'Nombre debe tener al menos 2 caracteres' }
    ]
  },

  // Reglas para clientes
  client: {
    name: [
      { type: 'required', message: 'Nombre es requerido' },
      { type: 'minLength', value: 2, message: 'Nombre debe tener al menos 2 caracteres' }
    ],
    email: [
      { type: 'email', message: 'Email inválido' }
    ],
    phone: [
      { type: 'pattern', value: /^[\d\s\-\+\(\)]+$/, message: 'Teléfono inválido' }
    ],
    documentNumber: [
      { type: 'required', message: 'Número de documento es requerido' },
      { type: 'minLength', value: 7, message: 'Documento debe tener al menos 7 caracteres' }
    ]
  },

  // Reglas para habitaciones
  room: {
    name: [
      { type: 'required', message: 'Nombre de habitación es requerido' }
    ],
    roomTypeId: [
      { type: 'required', message: 'Tipo de habitación es requerido' }
    ]
  },

  // Reglas para precios
  price: {
    value: [
      { type: 'required', message: 'Precio es requerido' },
      { type: 'min', value: 0, message: 'Precio debe ser mayor a 0' }
    ],
    date: [
      { type: 'required', message: 'Fecha es requerida' }
    ]
  }
}; 