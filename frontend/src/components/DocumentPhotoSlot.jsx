import React, { useEffect, useRef, useState } from 'react';
import styles from './DocumentPhotoSlot.module.css';

const ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

/**
 * Slot de foto de documento (frente/dorso).
 * Drag & drop + archivo + cámara móvil (capture=environment).
 * Nueva foto reemplaza la anterior (callback onSelect).
 */
export default function DocumentPhotoSlot({
  label,
  slot,
  meta = null,
  previewUrl = null,
  busy = false,
  required = false,
  onSelect,
  onView,
  onDelete,
  showDelete = true,
  testIdPrefix = 'doc-photo'
}) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function applyFile(file) {
    if (!file || busy) return;
    if (localPreview) URL.revokeObjectURL(localPreview);
    const nextPreview =
      file.type && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setLocalPreview(nextPreview);
    onSelect?.(file, slot);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    applyFile(file);
  }

  const displayPreview = localPreview || previewUrl;
  const hasPhoto = Boolean(meta || localPreview);

  return (
    <div
      className={`${styles.slot} ${dragging ? styles.dragging : ''} ${hasPhoto ? styles.hasPhoto : ''}`}
      data-testid={`${testIdPrefix}-${slot}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        <h3 className={styles.label}>
          {label}
          {required ? ' *' : ''}
        </h3>
        <span className={styles.status}>
          {hasPhoto ? meta?.originalName || 'Foto cargada' : 'Sin foto'}
        </span>
      </div>

      <div className={styles.dropzone} data-testid={`${testIdPrefix}-${slot}-dropzone`}>
        {displayPreview ? (
          <img src={displayPreview} alt="" className={styles.preview} />
        ) : (
          <p className={styles.placeholder}>
            Arrastrá una imagen o usá los botones
          </p>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className={styles.hiddenInput}
        disabled={busy}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        data-testid={`${testIdPrefix}-${slot}-file`}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        disabled={busy}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        data-testid={`${testIdPrefix}-${slot}-camera`}
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btn}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          data-testid={`${testIdPrefix}-${slot}-upload`}
        >
          {busy ? 'Procesando…' : hasPhoto ? 'Reemplazar' : 'Subir'}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          data-testid={`${testIdPrefix}-${slot}-take`}
        >
          Cámara
        </button>
        {onView ? (
          <button
            type="button"
            className={styles.btn}
            disabled={busy || !meta}
            onClick={() => onView(slot)}
            data-testid={`${testIdPrefix}-${slot}-view`}
          >
            Ver
          </button>
        ) : null}
        {showDelete && onDelete && hasPhoto ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy}
            onClick={() => onDelete(slot)}
            data-testid={`${testIdPrefix}-${slot}-delete`}
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </div>
  );
}
