/**
 * Cumplimiento de etiquetas requeridas vs tags de habitación.
 * Seguro si room.tags es undefined (prefill de edición / virtuales).
 */
export function roomRequirementsCompliance(room, requiredTagIds = []) {
  const required = Array.isArray(requiredTagIds) ? requiredTagIds : [];
  if (required.length === 0) {
    return { complies: true, message: 'No hay etiquetas requeridas', score: 0 };
  }

  const roomTags = Array.isArray(room?.tags) ? room.tags : [];
  const roomTagIds = roomTags.map((tag) => tag.id);
  const missingTags = required.filter((tagId) => !roomTagIds.includes(tagId));
  const matchingTags = roomTags.filter((tag) => required.includes(tag.id));
  const complianceScore = matchingTags.length / required.length;
  const tagNames = matchingTags.map((tag) => tag.name);

  if (missingTags.length === 0) {
    return {
      complies: true,
      message: tagNames.length > 0 ? tagNames.join(', ') : 'Cumple con todos los requerimientos',
      score: complianceScore
    };
  }

  return {
    complies: false,
    message: tagNames.length > 0 ? tagNames.join(', ') : 'No cumple con los requerimientos',
    score: complianceScore
  };
}
