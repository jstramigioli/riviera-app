const { PrismaClient } = require('@prisma/client');
const {
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb,
  daysBetweenCivil
} = require('../utils/calendarDates');
const { sortRooms } = require('../utils/roomSort');

const prisma = new PrismaClient();

/**
 * Temporadas abiertas: SeasonBlock no-draft (OperationalPeriod ya no está en schema).
 * Sin bloques → todos los días abiertos (semántica histórica v1).
 */
async function loadOpenPeriods(hotelId = 'default-hotel') {
  try {
    const blocks = await prisma.seasonBlock.findMany({
      where: { hotelId, isDraft: false },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' }
    });
    return blocks.map((b) => ({
      id: b.id,
      name: b.name,
      openFrom: civilFromDb(b.startDate),
      openTo: civilFromDb(b.endDate)
    }));
  } catch (err) {
    console.warn('calendar: no se pudieron cargar SeasonBlock:', err.message);
    return [];
  }
}

function isDateClosed(iso, openPeriods) {
  if (!openPeriods.length) return false;
  return !openPeriods.some((p) => iso >= p.openFrom && iso <= p.openTo);
}

/**
 * @param {string} startIso yyyy-MM-dd
 * @param {number} days
 */
async function loadCalendar(startIso, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) {
    throw new Error('start debe ser YYYY-MM-DD');
  }

  const dayCount = Math.min(120, Math.max(1, Math.floor(Number(days) || 21)));
  const start = toDateOnlyUtc(startIso);
  const endExclusive = toDateOnlyUtc(shiftIso(startIso, dayCount));
  const endIso = isoDate(endExclusive);

  const dayList = [];
  for (let i = 0; i < dayCount; i++) {
    dayList.push(shiftIso(startIso, i));
  }

  const openPeriods = await loadOpenPeriods();

  const [roomsRaw, segments] = await Promise.all([
    prisma.room.findMany({
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        maxPeople: true,
        status: true,
        orderIndex: true
      }
    }),
    prisma.reservationSegment.findMany({
      where: {
        isActive: true,
        startDate: { lt: endExclusive },
        endDate: { gt: start }
      },
      include: {
        reservation: {
          include: {
            mainClient: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    })
  ]);

  const rooms = typeof sortRooms === 'function' ? sortRooms(roomsRaw) : roomsRaw;
  const blocksByRoom = new Map();
  for (const room of rooms) blocksByRoom.set(room.id, []);

  for (const seg of segments) {
    const segStartIso = civilFromDb(seg.startDate);
    const segEndIso = civilFromDb(seg.endDate);
    if (!segStartIso || !segEndIso) continue;

    // Clip to window [startIso, endIso) like v2
    const clippedStart = segStartIso < startIso ? startIso : segStartIso;
    const clippedEnd = segEndIso > endIso ? endIso : segEndIso;
    if (clippedStart >= clippedEnd) continue;

    const startOffset = daysBetweenCivil(startIso, clippedStart);
    const span = Math.max(1, daysBetweenCivil(clippedStart, clippedEnd));
    if (startOffset >= dayCount) continue;

    const client = seg.reservation?.mainClient;
    const guestName = client
      ? `${client.lastName || ''} ${client.firstName || ''}`.trim() || null
      : null;

    blocksByRoom.get(seg.roomId)?.push({
      segmentId: seg.id,
      reservationId: seg.reservationId,
      roomId: seg.roomId,
      status: seg.reservation?.status || null,
      guestName,
      guestFirstName: client?.firstName || null,
      guestLastName: client?.lastName || null,
      startDate: segStartIso,
      endDate: segEndIso,
      startOffset,
      span
    });
  }

  const daysOut = dayList.map((iso) => {
    const d = toDateOnlyUtc(iso);
    return {
      iso,
      label: String(d.getUTCDate()),
      weekday: d.getUTCDay(),
      closed: isDateClosed(iso, openPeriods)
    };
  });

  return {
    startIso,
    endIso,
    dayCount,
    days: daysOut,
    openPeriods,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      maxPeople: r.maxPeople,
      status: r.status,
      blocks: blocksByRoom.get(r.id) || []
    }))
  };
}

module.exports = { loadCalendar, loadOpenPeriods, isDateClosed };
