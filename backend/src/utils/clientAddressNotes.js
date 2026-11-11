/**
 * Domicilio del cliente embebido en Client.notes como "Domicilio: ...".
 * Misma convención que el frontend (EditClientModal / check-in público).
 */

function getAddressFromNotes(notes) {
  if (!notes) return '';
  const addressMatch = String(notes).match(/Domicilio:\s*(.+)/);
  return addressMatch ? addressMatch[1].trim() : '';
}

function stripAddressFromNotes(notes) {
  if (!notes) return '';
  return String(notes).replace(/Domicilio:\s*[^\n]*\n?/, '').trim();
}

function createNotesWithAddress(notes, address) {
  if (!address) return notes || '';

  if (notes && String(notes).includes('Domicilio:')) {
    return String(notes).replace(/Domicilio:\s*[^\n]*/, `Domicilio: ${address}`);
  }

  if (notes) {
    return `${notes}\nDomicilio: ${address}`;
  }

  return `Domicilio: ${address}`;
}

module.exports = {
  getAddressFromNotes,
  stripAddressFromNotes,
  createNotesWithAddress
};
