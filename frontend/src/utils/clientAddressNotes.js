/**
 * El domicilio del cliente vive embebido en Client.notes como "Domicilio: ...".
 * Misma convención que EditClientModal / Estadisticas.
 */

export function getAddressFromNotes(notes) {
  if (!notes) return '';
  const addressMatch = String(notes).match(/Domicilio:\s*(.+)/);
  return addressMatch ? addressMatch[1].trim() : '';
}

export function stripAddressFromNotes(notes) {
  if (!notes) return '';
  return String(notes).replace(/Domicilio:\s*[^\n]*\n?/, '').trim();
}

export function createNotesWithAddress(notes, address) {
  if (!address) return notes || '';

  if (notes && String(notes).includes('Domicilio:')) {
    return String(notes).replace(/Domicilio:\s*[^\n]*/, `Domicilio: ${address}`);
  }

  if (notes) {
    return `${notes}\nDomicilio: ${address}`;
  }

  return `Domicilio: ${address}`;
}
