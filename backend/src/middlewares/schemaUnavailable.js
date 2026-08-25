/**
 * Contiene endpoints cuyos modelos Prisma ya no existen en el schema.
 * Evita 500 opacos y documenta el estado para el MVP.
 */
function schemaUnavailable(featureName) {
  return (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad no disponible',
      message: `${featureName} fue eliminado del esquema actual y no forma parte del MVP.`,
      code: 'SCHEMA_UNAVAILABLE'
    });
  };
}

module.exports = { schemaUnavailable };
