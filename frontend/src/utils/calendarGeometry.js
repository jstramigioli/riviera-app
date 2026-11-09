/** Constantes de geometría alineadas con v2 (CalendarBoard). */
export const CELL = 42;
export const LABEL_W = 140;
export const ROW_H = 30;
export const MAX_WINDOW_DAYS = 90;
export const CHUNK = 21;
export const EDGE_DAYS = 4;

export function howManyDaysFit(containerWidthPx, opts = {}) {
  const labelWidth = opts.labelWidth ?? LABEL_W;
  const cellWidth = opts.cellWidth ?? CELL;
  const minDays = opts.minDays ?? 3;
  const usable = Math.max(0, containerWidthPx - labelWidth);
  return Math.max(minDays, Math.floor(usable / cellWidth));
}

export function blockStyle(startOffset, span) {
  return {
    left: startOffset * CELL + 2,
    width: Math.max(span * CELL - 4, 8),
    top: 3,
    height: ROW_H - 6,
    position: 'absolute'
  };
}
