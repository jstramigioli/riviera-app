const fs = require('fs');
const {
  assertMime,
  assertSlot,
  toPublicMeta,
  toPublicSlots,
  saveDocumentPhoto,
  readMeta,
  readAllMeta,
  absolutePath,
  deleteDocumentPhoto,
  hasBothSlots,
  prismaFieldsForSlot,
  UPLOADS_ROOT
} = require('../../src/utils/clientDocumentPhoto');

describe('clientDocumentPhoto', () => {
  const clientId = 4242;

  afterEach(() => {
    deleteDocumentPhoto(clientId);
  });

  it('rechaza mime no permitido', () => {
    expect(assertMime('text/plain').error).toMatch(/JPG|PNG|PDF/i);
    expect(assertMime('image/jpeg').ok).toBe(true);
  });

  it('normaliza slots frente/dorso', () => {
    expect(assertSlot('front').slot).toBe('front');
    expect(assertSlot('frente').slot).toBe('front');
    expect(assertSlot('back').slot).toBe('back');
    expect(assertSlot('dorso').slot).toBe('back');
    expect(assertSlot('lado').error).toMatch(/Slot/i);
  });

  it('toPublicMeta omite storedName', () => {
    expect(
      toPublicMeta({
        originalName: 'frente.jpg',
        storedName: 'front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        updatedAt: '2026-01-01T00:00:00.000Z',
        slot: 'front'
      })
    ).toEqual({
      slot: 'front',
      originalName: 'frente.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      updatedAt: '2026-01-01T00:00:00.000Z',
      exists: true
    });
  });

  it('guarda frente y dorso por separado y reemplaza slot', () => {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    const front = saveDocumentPhoto(clientId, {
      mimetype: 'image/png',
      originalname: 'dni-frente.png',
      buffer: Buffer.from([137, 80, 78, 71]),
      size: 4
    }, 'front');
    expect(front.error).toBeUndefined();
    expect(front.meta.storedName).toBe('front.png');

    const back = saveDocumentPhoto(clientId, {
      mimetype: 'image/jpeg',
      originalname: 'dni-dorso.jpg',
      buffer: Buffer.from([255, 216, 255]),
      size: 3
    }, 'back');
    expect(back.error).toBeUndefined();
    expect(back.meta.storedName).toBe('back.jpg');

    const all = readAllMeta(clientId);
    expect(all.front.originalName).toBe('dni-frente.png');
    expect(all.back.originalName).toBe('dni-dorso.jpg');
    expect(hasBothSlots(all)).toBe(true);
    expect(toPublicSlots(all).front.exists).toBe(true);
    expect(toPublicSlots(all).back.exists).toBe(true);

    // Reemplazo de frente borra el archivo anterior del slot
    const replaced = saveDocumentPhoto(clientId, {
      mimetype: 'image/jpeg',
      originalname: 'frente-nuevo.jpg',
      buffer: Buffer.from([255, 216, 255, 0]),
      size: 4
    }, 'front');
    expect(replaced.meta.storedName).toBe('front.jpg');
    expect(fs.existsSync(absolutePath(clientId, 'front.png'))).toBe(false);
    expect(fs.existsSync(absolutePath(clientId, 'front.jpg'))).toBe(true);
    expect(readMeta(clientId, 'back').originalName).toBe('dni-dorso.jpg');

    expect(deleteDocumentPhoto(clientId, 'back').deleted).toBe(true);
    expect(readMeta(clientId, 'back')).toBeNull();
    expect(readMeta(clientId, 'front')).not.toBeNull();
    expect(deleteDocumentPhoto(clientId).deleted).toBe(true);
  });

  it('prismaFieldsForSlot mapea null y meta', () => {
    expect(prismaFieldsForSlot('front', null).documentPhotoFrontStoredName).toBeNull();
    const fields = prismaFieldsForSlot('back', {
      storedName: 'back.jpg',
      originalName: 'dorso.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12,
      updatedAt: '2026-01-02T00:00:00.000Z'
    });
    expect(fields.documentPhotoBackStoredName).toBe('back.jpg');
    expect(fields.documentPhotoBackOriginalName).toBe('dorso.jpg');
    expect(fields.documentPhotoBackSizeBytes).toBe(12);
  });
});
