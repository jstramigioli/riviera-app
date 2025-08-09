// Mapeo de tipos de documento a abreviaciones
export const documentTypeAbbreviations = {
  'DNI': 'DNI',
  'CÉDULA DE IDENTIDAD': 'CI',
  'CUIT': 'CUIT',
  'LIBRETA CÍVICA': 'LC',
  'LIBRETA DE ENROLAMENTO': 'LE',
  'LIBRETA DE EMBARQUE': 'LEM',
  'PASAPORTE': 'PAS',
  'OTRO': 'OTRO'
};

// Función para obtener la abreviación del tipo de documento
export function getDocumentAbbreviation(documentType) {
  return documentTypeAbbreviations[documentType] || documentType;
} 