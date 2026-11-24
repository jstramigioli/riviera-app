import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
  normalizePageSize,
  pageRange,
  totalPagesFor,
} from '../utils/tablePagination';
import styles from '../pages/Cobros.module.css';

/**
 * Paginación cliente reutilizable: default 50, opciones 20/50/100.
 */
export default function TablePager({
  total,
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onPageSizeChange,
  label = 'Paginación',
  alwaysShowSize = false,
}) {
  const size = normalizePageSize(pageSize);
  const totalPages = totalPagesFor(total, size);
  const safePage = clampPage(page, totalPages);
  const range = pageRange(total, safePage, size);
  const showPager = total > size;
  const showSize = alwaysShowSize || total > PAGE_SIZE_OPTIONS[0];

  if (!showPager && !showSize) return null;

  return (
    <div className={styles.pager} role="navigation" aria-label={label}>
      {showSize ? (
        <label className={styles.pagerSize}>
          <span className={styles.pagerSizeLabel}>Filas</span>
          <select
            className={styles.pagerSizeSelect}
            aria-label="Filas por página"
            value={size}
            onChange={(e) => {
              const next = normalizePageSize(e.target.value);
              // El padre debe resetear a página 1 al cambiar pageSize
              // (evitar un segundo setState que pise el tamaño nuevo).
              onPageSizeChange?.(next);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showPager ? (
        <>
          <button
            type="button"
            className={styles.pagerBtn}
            aria-label="Página anterior"
            disabled={safePage <= 1}
            onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
          >
            <FiChevronLeft aria-hidden="true" />
            Anterior
          </button>
          <span className={styles.pagerStatus}>
            {range.from}–{range.to} de {total} · Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            className={styles.pagerBtn}
            aria-label="Página siguiente"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
          >
            Siguiente
            <FiChevronRight aria-hidden="true" />
          </button>
        </>
      ) : (
        <span className={styles.pagerStatus}>
          {total} resultado{total === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
