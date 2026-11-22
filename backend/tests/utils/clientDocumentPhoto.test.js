const fs = require('fs');
const {
  assertMime,
  toPublicMeta,
  saveDocumentPhoto,
  readMeta,
  absolutePath,
  deleteDocumentPhoto,
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

  it('toPublicMeta omite storedName', () => {
    expect(
      toPublicMeta({
        originalName: 'frente.jpg',
        storedName: 'dni.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    ).toEqual({
      originalName: 'frente.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      updatedAt: '2026-01-01T00:00:00.000Z',
      exists: true
    });
  });

  it('guarda y lee meta en filesystem', () => {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    const result = saveDocumentPhoto(clientId, {
      mimetype: 'image/png',
      originalname: 'dni-frente.png',
      buffer: Buffer.from([137, 80, 78, 71]),
      size: 4
    });
    expect(result.error).toBeUndefined();
    expect(result.meta.originalName).toBe('dni-frente.png');
    const meta = readMeta(clientId);
    expect(meta.storedName).toBe('dni.png');
    expect(fs.existsSync(absolutePath(clientId, meta.storedName))).toBe(true);
    expect(deleteDocumentPhoto(clientId).deleted).toBe(true);
    expect(readMeta(clientId)).toBeNull();
  });
});
