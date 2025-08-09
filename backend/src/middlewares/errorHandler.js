// Middleware para manejo centralizado de errores
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Errores de validación de Prisma
  if (err.code === 'P2002') {
    return res.status(400).json({
      error: 'Conflicto de datos',
      message: 'Ya existe un registro con estos datos únicos'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'No encontrado',
      message: 'El registro solicitado no existe'
    });
  }

  if (err.code === 'P2003') {
    return res.status(400).json({
      error: 'Error de referencia',
      message: 'No se puede eliminar/modificar debido a referencias existentes'
    });
  }

  // Errores de validación personalizados
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      message: err.message
    });
  }

  // Errores de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON inválido',
      message: 'El cuerpo de la petición contiene JSON malformado'
    });
  }

  // Error por defecto
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : err.message
  });
};

module.exports = errorHandler; 