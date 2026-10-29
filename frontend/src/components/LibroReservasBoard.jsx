import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import DayInfoSidePanel from './DayInfoSidePanel';
import FloatingActionButton from './FloatingActionButton';
import { fetchCalendar, fetchReservation } from '../services/api';
import {
  todayIsoLocal,
  shiftIso,
  daysBetween,
  formatDateUi
} from '../utils/calendarDates';
import {
  CELL,
  LABEL_W,
  ROW_H,
  MAX_WINDOW_DAYS,
  CHUNK,
  EDGE_DAYS,
  howManyDaysFit,
  blockStyle
} from '../utils/calendarGeometry';
import styles from '../styles/LibroReservasBoard.module.css';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function monthSpansFor(days) {
  const spans = [];
  for (const day of days) {
    const key = day.iso.slice(0, 7);
    const last = spans[spans.length - 1];
    if (last && last.key === key) {
      last.count += 1;
      continue;
    }
    const label = format(parseISO(day.iso), 'LLLL yyyy', { locale: es });
    spans.push({
      key,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      count: 1
    });
  }
  return spans;
}

function truncateBarLabel(firstName, lastName, widthPx) {
  const full = `${firstName || ''} ${lastName || ''}`.trim();
  if (!full) return 'Reserva';
  if (widthPx >= 90) return full;
  if (widthPx >= 56) return lastName || firstName || full;
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  return initials || 'R';
}

/**
 * Libro de Reservas — estructura tipo v2 (CalendarBoard), look v1, sin drag/resize.
 */
export default function LibroReservasBoard({
  onReservationClick,
  reservationsForDayInfo = []
}) {
  const [todayIso, setTodayIso] = useState(() => todayIsoLocal());
  const [days, setDays] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [windowStart, setWindowStart] = useState('');
  const [loadingEdge, setLoadingEdge] = useState(null);
  const [error, setError] = useState(null);
  const [visibleDays, setVisibleDays] = useState(() => howManyDaysFit(900));
  const [hoveredReservationId, setHoveredReservationId] = useState(null);
  const [hoverCell, setHoverCell] = useState(null); // { roomIndex, dayIndex }
  const [selectedDateIso, setSelectedDateIso] = useState(null);
  const [dayInfoOpen, setDayInfoOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  const scrollerRef = useRef(null);
  const measureRef = useRef(null);
  const centeredOnce = useRef(false);
  const loadingLock = useRef(false);
  const pendingScrollAdjust = useRef(null);
  const daysRef = useRef(days);
  const windowStartRef = useRef(windowStart);
  daysRef.current = days;
  windowStartRef.current = windowStart;

  const monthSpans = useMemo(() => monthSpansFor(days), [days]);

  useEffect(() => {
    setTodayIso(todayIsoLocal());
  }, []);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      setVisibleDays(howManyDaysFit(el.clientWidth, { labelWidth: LABEL_W, cellWidth: CELL }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollAdjust.current == null) return;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft += pendingScrollAdjust.current;
    pendingScrollAdjust.current = null;
  }, [days, windowStart]);

  useLayoutEffect(() => {
    if (centeredOnce.current) return;
    const scroller = scrollerRef.current;
    if (!scroller || !days.length) return;
    const idx = days.findIndex((d) => d.iso === todayIso);
    if (idx < 0) return;
    const target =
      LABEL_W +
      idx * CELL -
      Math.max(0, (scroller.clientWidth - LABEL_W) / 2 - CELL / 2);
    scroller.scrollLeft = Math.max(0, target);
    centeredOnce.current = true;
  }, [days, todayIso]);

  const loadWindow = useCallback(async (start, dayCount, opts = {}) => {
    if (loadingLock.current && opts.side !== 'replace') return;
    loadingLock.current = true;
    if (opts.side === 'left' || opts.side === 'right') setLoadingEdge(opts.side);
    setError(null);
    try {
      const capped = Math.min(MAX_WINDOW_DAYS, Math.max(1, dayCount));
      const payload = await fetchCalendar(start, capped);
      if (opts.side === 'left' && opts.prevStart) {
        const prepended = daysBetween(payload.startIso, opts.prevStart);
        if (prepended > 0) pendingScrollAdjust.current = prepended * CELL;
      }
      if (opts.side === 'right' && opts.prevStart) {
        const dropped = daysBetween(opts.prevStart, payload.startIso);
        if (dropped > 0) pendingScrollAdjust.current = -(dropped * CELL);
      }
      setWindowStart(payload.startIso);
      setDays(payload.days || []);
      setRooms(payload.rooms || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar el calendario');
    } finally {
      loadingLock.current = false;
      setLoadingEdge(null);
      setBooting(false);
    }
  }, []);

  /**
   * Focus inicial sólido (patrón v1 getAutoCenterDate + v2 window):
   * 1) hoy si hay bloques o día abierto en la ventana
   * 2) si no, inicio del próximo período abierto
   * 3) si no, primera reserva futura vía un probe amplio
   */
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const needed = Math.min(MAX_WINDOW_DAYS, Math.max(visibleDays * 2 + 7, CHUNK * 2));
      const half = Math.floor(needed / 2);
      centeredOnce.current = false;

      // Probe alrededor de hoy
      const probeStart = shiftIso(todayIso, -half);
      try {
        const probe = await fetchCalendar(probeStart, needed);
        if (cancelled) return;
        const hasBlocks = (probe.rooms || []).some((r) => (r.blocks || []).length > 0);
        const todayOpen = (probe.days || []).some((d) => d.iso === todayIso && !d.closed);
        if (hasBlocks || todayOpen || !(probe.openPeriods || []).length) {
          setWindowStart(probe.startIso);
          setDays(probe.days || []);
          setRooms(probe.rooms || []);
          setBooting(false);
          return;
        }

        // Próximo período abierto >= hoy
        const futurePeriod = (probe.openPeriods || [])
          .filter((p) => p.openTo >= todayIso)
          .sort((a, b) => a.openFrom.localeCompare(b.openFrom))[0];
        const focus = futurePeriod
          ? futurePeriod.openFrom < todayIso
            ? todayIso
            : futurePeriod.openFrom
          : (probe.openPeriods || []).slice(-1)[0]?.openFrom || todayIso;

        centeredOnce.current = false;
        await loadWindow(shiftIso(focus, -half), needed, { side: 'replace' });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar el calendario');
          setBooting(false);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [visibleDays, todayIso, loadWindow]);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || loadingLock.current) return;
    const curDays = daysRef.current;
    const curStart = windowStartRef.current;
    if (!curDays.length) return;

    const daysAreaLeft = scroller.scrollLeft;
    const daysViewport = Math.max(0, scroller.clientWidth - LABEL_W);
    const leftIdx = Math.floor(daysAreaLeft / CELL);
    const rightIdx = Math.ceil((daysAreaLeft + daysViewport) / CELL);

    if (leftIdx < EDGE_DAYS) {
      const extend = CHUNK;
      const newStart = shiftIso(curStart, -extend);
      const total = Math.min(MAX_WINDOW_DAYS, curDays.length + extend);
      void loadWindow(newStart, total, { side: 'left', prevStart: curStart });
    } else if (rightIdx > curDays.length - EDGE_DAYS) {
      const extend = CHUNK;
      let newStart = curStart;
      let total = curDays.length + extend;
      if (total > MAX_WINDOW_DAYS) {
        const drop = total - MAX_WINDOW_DAYS;
        newStart = shiftIso(curStart, drop);
        total = MAX_WINDOW_DAYS;
      }
      void loadWindow(newStart, total, { side: 'right', prevStart: curStart });
    }
  };

  function jumpToToday() {
    const real = todayIsoLocal();
    setTodayIso(real);
    centeredOnce.current = false;
    const half = Math.floor(Math.min(MAX_WINDOW_DAYS, visibleDays * 2 + 7) / 2);
    void loadWindow(shiftIso(real, -half), half * 2 + 1, { side: 'replace' });
  }

  async function handleBarClick(block) {
    if (!onReservationClick) return;
    try {
      const full = await fetchReservation(block.reservationId);
      onReservationClick(full);
    } catch (err) {
      console.error(err);
      onReservationClick({
        id: block.reservationId,
        status: block.status,
        mainClient: {
          firstName: block.guestFirstName,
          lastName: block.guestLastName
        },
        checkIn: block.startDate,
        checkOut: block.endDate,
        segments: [
          {
            id: block.segmentId,
            roomId: block.roomId,
            startDate: block.startDate,
            endDate: block.endDate,
            isActive: true
          }
        ]
      });
    }
  }

  function handleDayHeaderClick(day) {
    if (day.closed) return;
    setSelectedDateIso(day.iso);
    setDayInfoOpen(true);
  }

  const selectedDate = selectedDateIso ? parseISO(selectedDateIso) : null;

  // Reservas sintéticas desde blocks para DayInfo si no hay lista completa
  const dayInfoReservations = useMemo(() => {
    if (reservationsForDayInfo?.length) return reservationsForDayInfo;
    const byId = new Map();
    for (const room of rooms) {
      for (const b of room.blocks || []) {
        if (!byId.has(b.reservationId)) {
          byId.set(b.reservationId, {
            id: b.reservationId,
            checkIn: b.startDate,
            checkOut: b.endDate,
            mainClient: {
              firstName: b.guestFirstName,
              lastName: b.guestLastName
            },
            segments: []
          });
        }
        const r = byId.get(b.reservationId);
        r.segments.push({
          id: b.segmentId,
          roomId: b.roomId,
          startDate: b.startDate,
          endDate: b.endDate,
          isActive: true
        });
        // ampliar rango agregado
        if (b.startDate < r.checkIn) r.checkIn = b.startDate;
        if (b.endDate > r.checkOut) r.checkOut = b.endDate;
      }
    }
    return [...byId.values()];
  }, [rooms, reservationsForDayInfo]);

  if (booting && !days.length) {
    return (
      <div className={styles.board}>
        <div className={styles.emptyState}>Cargando calendario…</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.board} ref={measureRef}>
        <div className={styles.toolbar}>
          <span className={styles.toolbarHint}>
            {windowStart
              ? `${formatDateUi(windowStart)} → ${formatDateUi(shiftIso(windowStart, days.length))}`
              : null}
            {loadingEdge ? (
              <span className={styles.loadingEdge}>
                {' '}
                cargando {loadingEdge === 'left' ? '←' : '→'}
              </span>
            ) : null}
          </span>
          <div className={styles.toolbarActions}>
            <button type="button" className={styles.todayBtn} onClick={jumpToToday}>
              Hoy
            </button>
          </div>
        </div>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <div
          ref={scrollerRef}
          className={styles.scroller}
          onScroll={onScroll}
        >
          <div
            className={styles.gridInner}
            style={{ minWidth: LABEL_W + days.length * CELL }}
          >
            <div className={styles.stickyHeader}>
              <div className={styles.monthRow}>
                <div className={styles.cornerCell} style={{ height: 30 }} />
                {monthSpans.map((span) => (
                  <div
                    key={span.key}
                    className={styles.monthCell}
                    style={{ width: span.count * CELL }}
                    title={span.label}
                  >
                    <span className={styles.monthLabel}>{span.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.dayRow}>
                <div className={styles.cornerCell}>Habitación</div>
                {days.map((d) => {
                  const sunday = d.weekday === 0;
                  return (
                    <div
                      key={d.iso}
                      className={[
                        styles.dayCell,
                        sunday ? styles.daySunday : '',
                        d.iso === todayIso ? styles.dayToday : '',
                        d.closed ? styles.dayClosed : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ width: CELL }}
                      title={
                        d.closed
                          ? `${formatDateUi(d.iso)} · hotel cerrado`
                          : formatDateUi(d.iso)
                      }
                      onClick={() => handleDayHeaderClick(d)}
                    >
                      <div className={styles.dayWeekday}>{WEEKDAYS[d.weekday]}</div>
                      <div className={styles.dayLabel}>{d.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rooms.map((room, roomIndex) => (
              <div key={room.id} className={styles.roomRow} style={{ height: ROW_H }}>
                <div className={styles.roomLabel} title={room.name}>
                  <span className={styles.roomName}>{room.name}</span>
                  <span className={styles.roomCap}>(x{room.maxPeople})</span>
                </div>
                <div className={styles.cellsTrack}>
                  <div className={styles.cellsBg}>
                    {days.map((d, di) => {
                      const highlighted =
                        hoverCell &&
                        (hoverCell.roomIndex === roomIndex || hoverCell.dayIndex === di);
                      return (
                        <div
                          key={d.iso}
                          className={[
                            styles.cell,
                            d.closed ? styles.cellClosed : '',
                            highlighted ? styles.cellHighlight : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{ width: CELL }}
                          onMouseEnter={() => setHoverCell({ roomIndex, dayIndex: di })}
                          onMouseLeave={() => setHoverCell(null)}
                        />
                      );
                    })}
                  </div>
                  {(room.blocks || []).map((b) => {
                    const style = blockStyle(b.startOffset, b.span);
                    const label = truncateBarLabel(
                      b.guestFirstName,
                      b.guestLastName,
                      style.width
                    );
                    const hovered = hoveredReservationId === b.reservationId;
                    return (
                      <button
                        type="button"
                        key={`${b.segmentId}-${b.startOffset}`}
                        className={`${styles.bar} ${hovered ? styles.barHovered : ''}`}
                        style={style}
                        title={`${label} · ${formatDateUi(b.startDate)} → ${formatDateUi(b.endDate)}`}
                        onClick={() => handleBarClick(b)}
                        onMouseEnter={() => setHoveredReservationId(b.reservationId)}
                        onMouseLeave={() => setHoveredReservationId(null)}
                      >
                        <span className={styles.barText}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DayInfoSidePanel
        selectedDate={selectedDate}
        rooms={rooms}
        reservations={dayInfoReservations}
        isOpen={dayInfoOpen}
        onClose={() => {
          setDayInfoOpen(false);
          setSelectedDateIso(null);
        }}
      />

      <FloatingActionButton onCreateQuery={() => { window.location.href = '/consulta'; }} />
    </>
  );
}
