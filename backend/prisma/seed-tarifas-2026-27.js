/**
 * Seed idempotente de tarifas reales 2026/27 (Hotel Riviera).
 *
 * Fuente: backend/data/tarifas-2026-27.json
 * (extraído de Calculadora_de_tarifas_Hotel_Riviera_2026_27.xlsx)
 *
 * Modelo canónico: Hotel + RoomType + ServiceType + RoundingConfig
 *   + SeasonBlock + SeasonPrice + BlockServiceSelection
 *   (+ OpenDay opcionales para el período operativo)
 *
 * Uso:
 *   cd backend
 *   node prisma/seed-tarifas-2026-27.js
 *   node prisma/seed-tarifas-2026-27.js --replace
 *   node prisma/seed-tarifas-2026-27.js --with-rooms --with-open-days --with-diversidad
 *   npm run seed:tarifas-2026-27
 *
 * Flags:
 *   --replace          Reemplaza bloques/tag del seed (borra SeasonBlock con tag y recrea)
 *   --with-rooms       Asegura habitaciones físicas mínimas (idempotente por nombre)
 *   --with-open-days   Marca isClosed=false cada día del período operativo 2026/27
 *   --with-diversidad  Incluye bloque borrador "Diversidad cultural"
 *   --dry-run          Solo muestra el plan, no escribe
 *
 * NO ejecuta migrate reset. Seguro para aplicar sobre riviera_v1 existente.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DATA_PATH = path.join(__dirname, '../data/tarifas-2026-27.json');
const SEED_TAG = 'tarifas-2026-27';

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    replace: flags.has('--replace'),
    withRooms: flags.has('--with-rooms'),
    withOpenDays: flags.has('--with-open-days'),
    withDiversidad: flags.has('--with-diversidad'),
    dryRun: flags.has('--dry-run'),
  };
}

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`No se encontró ${DATA_PATH}. Regenerá con: node scripts/extract-tarifas-2026-27.js`);
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function noonUTC(isoDate) {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function eachDateInclusive(startIso, endIso) {
  const dates = [];
  const cur = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function ensureHotel(hotelData, dryRun) {
  const existing = await prisma.hotel.findFirst({
    where: { OR: [{ id: hotelData.id }, { name: hotelData.name }] },
  });
  if (existing) {
    console.log(`✅ Hotel existente: ${existing.name} (${existing.id})`);
    return existing;
  }
  if (dryRun) {
    console.log(`🔎 [dry-run] crearía hotel ${hotelData.name}`);
    return { id: hotelData.id, name: hotelData.name };
  }
  const hotel = await prisma.hotel.create({
    data: {
      id: hotelData.id,
      name: hotelData.name,
      description: hotelData.description,
    },
  });
  console.log(`✅ Hotel creado: ${hotel.name}`);
  return hotel;
}

async function ensureRounding(hotelId, rounding, dryRun) {
  const existing = await prisma.roundingConfig.findUnique({ where: { hotelId } });
  if (dryRun) {
    console.log(`🔎 [dry-run] rounding multiple=${rounding.multiple} mode=${rounding.mode}`);
    return existing;
  }
  if (existing) {
    const updated = await prisma.roundingConfig.update({
      where: { hotelId },
      data: { multiple: rounding.multiple, mode: rounding.mode },
    });
    console.log(`✅ RoundingConfig actualizado: ×${updated.multiple} (${updated.mode})`);
    return updated;
  }
  const created = await prisma.roundingConfig.create({
    data: {
      hotelId,
      multiple: rounding.multiple,
      mode: rounding.mode,
    },
  });
  console.log(`✅ RoundingConfig creado: ×${created.multiple} (${created.mode})`);
  return created;
}

async function ensureServiceTypes(hotelId, serviceTypes, dryRun) {
  const byKey = {};
  for (const st of serviceTypes) {
    const existing = await prisma.serviceType.findFirst({
      where: { hotelId, name: st.name },
    });
    if (existing) {
      if (!dryRun) {
        await prisma.serviceType.update({
          where: { id: existing.id },
          data: {
            description: st.description,
            orderIndex: st.orderIndex,
            isActive: true,
          },
        });
      }
      byKey[st.key] = existing;
      console.log(`✅ ServiceType: ${st.name}`);
      continue;
    }
    if (dryRun) {
      console.log(`🔎 [dry-run] crearía ServiceType ${st.name}`);
      byKey[st.key] = { id: `dry-${st.key}`, name: st.name };
      continue;
    }
    const created = await prisma.serviceType.create({
      data: {
        hotelId,
        name: st.name,
        description: st.description,
        orderIndex: st.orderIndex,
        isActive: true,
      },
    });
    byKey[st.key] = created;
    console.log(`✅ ServiceType creado: ${st.name}`);
  }
  return byKey;
}

async function ensureRoomTypes(roomTypes, dryRun) {
  const byName = {};
  for (const rt of roomTypes) {
    let existing = await prisma.roomType.findFirst({ where: { name: rt.name } });
    // Alias legacy display names
    if (!existing && rt.displayName) {
      existing = await prisma.roomType.findFirst({
        where: {
          OR: [
            { name: rt.displayName },
            { name: rt.excelName },
            { name: rt.name.replace('departamento ', '') },
          ],
        },
      });
    }
    if (existing) {
      if (!dryRun) {
        await prisma.roomType.update({
          where: { id: existing.id },
          data: {
            maxPeople: rt.maxPeople,
            orderIndex: rt.orderIndex,
            description: existing.description || rt.displayName,
          },
        });
      }
      byName[rt.name] = existing;
      console.log(`✅ RoomType: ${existing.name} (id=${existing.id})`);
      continue;
    }
    if (dryRun) {
      console.log(`🔎 [dry-run] crearía RoomType ${rt.name}`);
      byName[rt.name] = { id: -1, name: rt.name };
      continue;
    }
    const created = await prisma.roomType.create({
      data: {
        name: rt.name,
        description: rt.displayName,
        maxPeople: rt.maxPeople,
        orderIndex: rt.orderIndex,
      },
    });
    byName[rt.name] = created;
    console.log(`✅ RoomType creado: ${created.name}`);
  }
  return byName;
}

async function deleteSeedBlocks(hotelId, dryRun) {
  const existing = await prisma.seasonBlock.findMany({
    where: {
      hotelId,
      OR: [
        { description: { contains: `[seed:${SEED_TAG}]` } },
        { name: { startsWith: '2026/27 ·' } },
      ],
    },
    select: { id: true, name: true },
  });
  if (existing.length === 0) {
    console.log('ℹ️  No hay bloques previos del seed para borrar');
    return;
  }
  console.log(`🗑️  Borrando ${existing.length} bloques del seed...`);
  if (dryRun) {
    existing.forEach((b) => console.log(`   [dry-run] ${b.name}`));
    return;
  }
  const ids = existing.map((b) => b.id);
  await prisma.seasonPrice.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.blockServiceSelection.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.proportionCoefficient.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.seasonBlock.deleteMany({ where: { id: { in: ids } } });
  console.log('✅ Bloques anteriores eliminados');
}

async function upsertSeasonBlock(hotelId, block, serviceByKey, roomByName, dryRun) {
  const startDate = noonUTC(block.startDate);
  const endDate = noonUTC(block.endDate);

  let seasonBlock = await prisma.seasonBlock.findFirst({
    where: { hotelId, name: block.name },
  });

  if (dryRun) {
    console.log(
      `🔎 [dry-run] ${seasonBlock ? 'actualizaría' : 'crearía'} ${block.name} (${block.startDate} → ${block.endDate}) · ${block.prices.length} precios`
    );
    return seasonBlock;
  }

  if (seasonBlock) {
    seasonBlock = await prisma.seasonBlock.update({
      where: { id: seasonBlock.id },
      data: {
        description: block.description,
        startDate,
        endDate,
        orderIndex: block.orderIndex,
        isDraft: block.isDraft ?? false,
        useBlockServices: true,
        serviceAdjustmentMode: 'PERCENTAGE',
        lastSavedAt: new Date(),
      },
    });
  } else {
    seasonBlock = await prisma.seasonBlock.create({
      data: {
        hotelId,
        name: block.name,
        description: block.description,
        startDate,
        endDate,
        orderIndex: block.orderIndex,
        isDraft: block.isDraft ?? false,
        useBlockServices: true,
        serviceAdjustmentMode: 'PERCENTAGE',
        lastSavedAt: new Date(),
      },
    });
  }

  // Service selections: precios ya son finales → percentageAdjustment = 0
  let orderIndex = 0;
  for (const [key, service] of Object.entries(serviceByKey)) {
    await prisma.blockServiceSelection.upsert({
      where: {
        seasonBlockId_serviceTypeId: {
          seasonBlockId: seasonBlock.id,
          serviceTypeId: service.id,
        },
      },
      create: {
        seasonBlockId: seasonBlock.id,
        serviceTypeId: service.id,
        isEnabled: true,
        orderIndex,
        isDraft: false,
        percentageAdjustment: 0,
      },
      update: {
        isEnabled: true,
        orderIndex,
        isDraft: false,
        percentageAdjustment: 0,
      },
    });
    orderIndex += 1;
  }

  for (const price of block.prices) {
    const roomType = roomByName[price.roomTypeName];
    const service = serviceByKey[price.serviceKey];
    if (!roomType || !service) {
      console.warn(
        `⚠️  Precio omitido: room=${price.roomTypeName} service=${price.serviceKey}`
      );
      continue;
    }
    await prisma.seasonPrice.upsert({
      where: {
        seasonBlockId_roomTypeId_serviceTypeId: {
          seasonBlockId: seasonBlock.id,
          roomTypeId: roomType.id,
          serviceTypeId: service.id,
        },
      },
      create: {
        seasonBlockId: seasonBlock.id,
        roomTypeId: roomType.id,
        serviceTypeId: service.id,
        basePrice: price.basePrice,
        isDraft: false,
      },
      update: {
        basePrice: price.basePrice,
        isDraft: false,
      },
    });
  }

  console.log(
    `✅ ${seasonBlock.name}: ${block.startDate} → ${block.endDate} · ${block.prices.length} precios · draft=${seasonBlock.isDraft}`
  );
  return seasonBlock;
}

async function ensureMinimalRooms(roomByName, dryRun) {
  // Habitaciones numéricas típicas + departamentos (idempotente por nombre)
  const rooms = [];
  for (let n = 1; n <= 36; n += 1) {
    if (n === 4 || n === 20) continue;
    let roomTypeName = 'doble';
    let maxPeople = 2;
    if (n <= 2) {
      roomTypeName = 'single';
      maxPeople = 1;
    } else if (n >= 30 && n <= 33) {
      roomTypeName = 'triple';
      maxPeople = 3;
    } else if (n >= 34) {
      roomTypeName = 'cuadruple';
      maxPeople = 4;
    }
    rooms.push({ name: String(n), roomTypeName, maxPeople });
  }
  rooms.push(
    { name: 'El Romerito', roomTypeName: 'departamento El Romerito', maxPeople: 2 },
    { name: 'El Tilo', roomTypeName: 'departamento El Tilo', maxPeople: 5 },
    { name: 'Via 1', roomTypeName: 'departamento Via 1', maxPeople: 4 },
    { name: 'La Esquinita', roomTypeName: 'departamento La Esquinita', maxPeople: 4 }
  );

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    const plan = rooms[i];
    const existing = await prisma.room.findFirst({ where: { name: plan.name } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const roomType = roomByName[plan.roomTypeName];
    if (!roomType || roomType.id < 0) {
      console.warn(`⚠️  Sin RoomType para ${plan.name} (${plan.roomTypeName})`);
      continue;
    }
    if (dryRun) {
      created += 1;
      continue;
    }
    await prisma.room.create({
      data: {
        name: plan.name,
        description: `Habitación ${plan.name}`,
        maxPeople: plan.maxPeople,
        status: 'available',
        orderIndex: i,
        roomTypeId: roomType.id,
      },
    });
    created += 1;
  }
  console.log(`✅ Rooms: ${created} creadas, ${skipped} ya existían`);
}

async function ensureOpenDays(hotelId, startIso, endIso, dryRun) {
  const dates = eachDateInclusive(startIso, endIso);
  let upserts = 0;
  for (const date of dates) {
    if (dryRun) {
      upserts += 1;
      continue;
    }
    const existing = await prisma.openDay.findFirst({
      where: { hotelId, date },
    });
    if (existing) {
      await prisma.openDay.update({
        where: { id: existing.id },
        data: {
          isClosed: false,
          notes: existing.notes || `[seed:${SEED_TAG}] temporada abierta`,
        },
      });
    } else {
      await prisma.openDay.create({
        data: {
          hotelId,
          date,
          isClosed: false,
          isHoliday: false,
          notes: `[seed:${SEED_TAG}] temporada abierta`,
        },
      });
    }
    upserts += 1;
  }
  console.log(`✅ OpenDays abiertos: ${upserts} días (${startIso} → ${endIso})`);
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log('🌱 Seed tarifas 2026/27');
  console.log('   flags:', opts);
  console.log('   data:', DATA_PATH);

  const data = loadData();
  if (data.meta?.seedTag !== SEED_TAG) {
    console.warn(`⚠️  meta.seedTag inesperado: ${data.meta?.seedTag}`);
  }

  const hotel = await ensureHotel(data.hotel, opts.dryRun);
  await ensureRounding(hotel.id, data.roundingConfig, opts.dryRun);
  const serviceByKey = await ensureServiceTypes(hotel.id, data.serviceTypes, opts.dryRun);
  const roomByName = await ensureRoomTypes(data.roomTypes, opts.dryRun);

  if (opts.replace) {
    await deleteSeedBlocks(hotel.id, opts.dryRun);
  }

  const blocks = [...data.seasonBlocks];
  if (opts.withDiversidad && data.diversidadCultural) {
    blocks.push(data.diversidadCultural);
  }

  for (const block of blocks) {
    await upsertSeasonBlock(hotel.id, block, serviceByKey, roomByName, opts.dryRun);
  }

  if (opts.withRooms) {
    await ensureMinimalRooms(roomByName, opts.dryRun);
  }

  if (opts.withOpenDays && data.meta?.operationalPeriod) {
    await ensureOpenDays(
      hotel.id,
      data.meta.operationalPeriod.startDate,
      data.meta.operationalPeriod.endDate,
      opts.dryRun
    );
  }

  // Resumen
  if (!opts.dryRun) {
    const count = await prisma.seasonBlock.count({
      where: {
        hotelId: hotel.id,
        OR: [
          { description: { contains: `[seed:${SEED_TAG}]` } },
          { name: { startsWith: '2026/27 ·' } },
        ],
      },
    });
    const prices = await prisma.seasonPrice.count({
      where: {
        seasonBlock: {
          hotelId: hotel.id,
          name: { startsWith: '2026/27 ·' },
        },
      },
    });
    console.log('\n📊 Resumen');
    console.log(`   Bloques seed: ${count}`);
    console.log(`   SeasonPrices: ${prices}`);
    console.log(`   Hotel id: ${hotel.id}`);
  }

  console.log('\n✨ Listo. Cotizá fechas dentro de 2026-12-05 … 2027-03-25.');
}

main()
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
