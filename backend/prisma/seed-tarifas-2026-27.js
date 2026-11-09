/**
 * Seed idempotente de tarifas reales 2026/27 (Hotel Riviera).
 *
 * Fuente: backend/data/tarifas-2026-27.json
 * (extra├¡do de Calculadora_de_tarifas_Hotel_Riviera_2026_27.xlsx)
 *
 * Modelo can├│nico: Hotel + RoomType + ServiceType + RoundingConfig
 *   + SeasonBlock + SeasonPrice + BlockServiceSelection
 *   (+ OpenDay opcionales para el per├¡odo operativo)
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
 *   --with-rooms       Asegura habitaciones f├¡sicas m├¡nimas (idempotente por nombre)
 *   --with-open-days   Marca isClosed=false cada d├¡a del per├¡odo operativo 2026/27
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
    throw new Error(`No se encontr├│ ${DATA_PATH}. Regener├í con: node scripts/extract-tarifas-2026-27.js`);
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
    console.log(`Ô£à Hotel existente: ${existing.name} (${existing.id})`);
    return existing;
  }
  if (dryRun) {
    console.log(`­ƒöÄ [dry-run] crear├¡a hotel ${hotelData.name}`);
    return { id: hotelData.id, name: hotelData.name };
  }
  const hotel = await prisma.hotel.create({
    data: {
      id: hotelData.id,
      name: hotelData.name,
      description: hotelData.description,
    },
  });
  console.log(`Ô£à Hotel creado: ${hotel.name}`);
  return hotel;
}

async function ensureRounding(hotelId, rounding, dryRun) {
  const existing = await prisma.roundingConfig.findUnique({ where: { hotelId } });
  if (dryRun) {
    console.log(`­ƒöÄ [dry-run] rounding multiple=${rounding.multiple} mode=${rounding.mode}`);
    return existing;
  }
  if (existing) {
    const updated = await prisma.roundingConfig.update({
      where: { hotelId },
      data: { multiple: rounding.multiple, mode: rounding.mode },
    });
    console.log(`Ô£à RoundingConfig actualizado: ├ù${updated.multiple} (${updated.mode})`);
    return updated;
  }
  const created = await prisma.roundingConfig.create({
    data: {
      hotelId,
      multiple: rounding.multiple,
      mode: rounding.mode,
    },
  });
  console.log(`Ô£à RoundingConfig creado: ├ù${created.multiple} (${created.mode})`);
  return created;
}

/**
 * Nombres legacy del hotel que equivalen a los del Excel/seed.
 * El primer nombre de cada lista es el can├│nico del seed.
 * Unificar: Solo AlojamientoÔåöSin desayuno, Desayuno RivieraÔåöCon Desayuno,
 * Desayuno y Media Pensi├│nÔåöMedia Pensi├│n.
 */
const SERVICE_NAME_ALIASES = {
  solo_alojamiento: ['Solo Alojamiento', 'Sin desayuno', 'Solo alojamiento'],
  desayuno_riviera: ['Desayuno Riviera', 'Con Desayuno', 'Con desayuno'],
  media_pension: ['Desayuno y Media Pensi├│n', 'Media Pensi├│n', 'Media pensi├│n'],
};

function normalizeServiceName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function aliasSetForKey(key, canonicalName) {
  const names = new Set([canonicalName, ...(SERVICE_NAME_ALIASES[key] || [])]);
  return new Set([...names].map(normalizeServiceName));
}

/**
 * Reasigna FKs de un ServiceType legacy al can├│nico y elimina el legacy.
 * SeasonPrices/selecciones que ya existen en el can├│nico se borran (no se duplican).
 */
async function mergeServiceTypeInto(keepId, dropId, dryRun) {
  if (keepId === dropId) return;

  const dropPrices = await prisma.seasonPrice.findMany({ where: { serviceTypeId: dropId } });
  const dropSels = await prisma.blockServiceSelection.findMany({ where: { serviceTypeId: dropId } });
  const dropCargos = await prisma.cargo.count({ where: { serviceTypeId: dropId } });
  const segments = await prisma.reservationSegment.findMany({
    where: { services: { has: dropId } },
    select: { id: true, services: true },
  });

  console.log(
    `   ­ƒöÇ merge ${dropId} ÔåÆ ${keepId}: prices=${dropPrices.length} sels=${dropSels.length} cargos=${dropCargos} segments=${segments.length}`
  );

  if (dryRun) return;

  for (const price of dropPrices) {
    const collision = await prisma.seasonPrice.findFirst({
      where: {
        seasonBlockId: price.seasonBlockId,
        roomTypeId: price.roomTypeId,
        serviceTypeId: keepId,
      },
    });
    if (collision) {
      await prisma.seasonPrice.delete({ where: { id: price.id } });
    } else {
      await prisma.seasonPrice.update({
        where: { id: price.id },
        data: { serviceTypeId: keepId },
      });
    }
  }

  for (const sel of dropSels) {
    const collision = await prisma.blockServiceSelection.findFirst({
      where: {
        seasonBlockId: sel.seasonBlockId,
        serviceTypeId: keepId,
      },
    });
    if (collision) {
      await prisma.blockServiceSelection.delete({ where: { id: sel.id } });
    } else {
      await prisma.blockServiceSelection.update({
        where: { id: sel.id },
        data: { serviceTypeId: keepId },
      });
    }
  }

  if (dropCargos > 0) {
    await prisma.cargo.updateMany({
      where: { serviceTypeId: dropId },
      data: { serviceTypeId: keepId },
    });
  }

  for (const seg of segments) {
    const next = [...new Set(seg.services.map((id) => (id === dropId ? keepId : id)))];
    await prisma.reservationSegment.update({
      where: { id: seg.id },
      data: { services: next },
    });
  }

  await prisma.serviceType.delete({ where: { id: dropId } });
}

async function ensureServiceTypes(hotelId, serviceTypes, dryRun) {
  const all = await prisma.serviceType.findMany({ where: { hotelId } });
  const byKey = {};

  for (const st of serviceTypes) {
    const aliases = aliasSetForKey(st.key, st.name);
    const matches = all.filter((row) => aliases.has(normalizeServiceName(row.name)));

    // Preferir el que ya tiene el nombre can├│nico; si no, el de m├ís SeasonPrices.
    let keep = matches.find((row) => row.name === st.name) || null;
    if (!keep && matches.length > 0) {
      const scored = await Promise.all(
        matches.map(async (row) => ({
          row,
          n: await prisma.seasonPrice.count({ where: { serviceTypeId: row.id } }),
        }))
      );
      scored.sort((a, b) => b.n - a.n);
      keep = scored[0].row;
    }

    if (!keep) {
      if (dryRun) {
        console.log(`­ƒöÄ [dry-run] crear├¡a ServiceType ${st.name}`);
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
      all.push(created);
      byKey[st.key] = created;
      console.log(`Ô£à ServiceType creado: ${st.name}`);
      continue;
    }

    const duplicates = matches.filter((row) => row.id !== keep.id);
    for (const dup of duplicates) {
      console.log(`­ƒùæ´©Å  Unificando legacy "${dup.name}" ÔåÆ "${st.name}"`);
      await mergeServiceTypeInto(keep.id, dup.id, dryRun);
      const idx = all.findIndex((row) => row.id === dup.id);
      if (idx >= 0) all.splice(idx, 1);
    }

    if (!dryRun) {
      keep = await prisma.serviceType.update({
        where: { id: keep.id },
        data: {
          name: st.name,
          description: st.description,
          orderIndex: st.orderIndex,
          isActive: true,
        },
      });
      const idx = all.findIndex((row) => row.id === keep.id);
      if (idx >= 0) all[idx] = keep;
    }

    byKey[st.key] = { ...keep, name: st.name };
    console.log(
      `Ô£à ServiceType: ${st.name} (id=${keep.id}${duplicates.length ? `, fusion├│ ${duplicates.length} legacy` : ''})`
    );
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
      console.log(`Ô£à RoomType: ${existing.name} (id=${existing.id})`);
      continue;
    }
    if (dryRun) {
      console.log(`­ƒöÄ [dry-run] crear├¡a RoomType ${rt.name}`);
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
    console.log(`Ô£à RoomType creado: ${created.name}`);
  }
  return byName;
}

async function deleteSeedBlocks(hotelId, dryRun) {
  const existing = await prisma.seasonBlock.findMany({
    where: {
      hotelId,
      OR: [
        { description: { contains: `[seed:${SEED_TAG}]` } },
        { name: { startsWith: '2026/27 ┬À' } },
      ],
    },
    select: { id: true, name: true },
  });
  if (existing.length === 0) {
    console.log('Ôä╣´©Å  No hay bloques previos del seed para borrar');
    return;
  }
  console.log(`­ƒùæ´©Å  Borrando ${existing.length} bloques del seed...`);
  if (dryRun) {
    existing.forEach((b) => console.log(`   [dry-run] ${b.name}`));
    return;
  }
  const ids = existing.map((b) => b.id);
  await prisma.seasonPrice.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.blockServiceSelection.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.proportionCoefficient.deleteMany({ where: { seasonBlockId: { in: ids } } });
  await prisma.seasonBlock.deleteMany({ where: { id: { in: ids } } });
  console.log('Ô£à Bloques anteriores eliminados');
}

async function upsertSeasonBlock(hotelId, block, serviceByKey, roomByName, dryRun) {
  const startDate = noonUTC(block.startDate);
  const endDate = noonUTC(block.endDate);

  let seasonBlock = await prisma.seasonBlock.findFirst({
    where: { hotelId, name: block.name },
  });

  if (dryRun) {
    console.log(
      `­ƒöÄ [dry-run] ${seasonBlock ? 'actualizar├¡a' : 'crear├¡a'} ${block.name} (${block.startDate} ÔåÆ ${block.endDate}) ┬À ${block.prices.length} precios`
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

  // Service selections: precios ya son finales ÔåÆ percentageAdjustment = 0
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
        `ÔÜá´©Å  Precio omitido: room=${price.roomTypeName} service=${price.serviceKey}`
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
    `Ô£à ${seasonBlock.name}: ${block.startDate} ÔåÆ ${block.endDate} ┬À ${block.prices.length} precios ┬À draft=${seasonBlock.isDraft}`
  );
  return seasonBlock;
}

async function ensureMinimalRooms(roomByName, dryRun) {
  // Habitaciones num├®ricas t├¡picas + departamentos (idempotente por nombre)
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
      console.warn(`ÔÜá´©Å  Sin RoomType para ${plan.name} (${plan.roomTypeName})`);
      continue;
    }
    if (dryRun) {
      created += 1;
      continue;
    }
    await prisma.room.create({
      data: {
        name: plan.name,
        description: `Habitaci├│n ${plan.name}`,
        maxPeople: plan.maxPeople,
        status: 'available',
        orderIndex: i,
        roomTypeId: roomType.id,
      },
    });
    created += 1;
  }
  console.log(`Ô£à Rooms: ${created} creadas, ${skipped} ya exist├¡an`);
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
  console.log(`Ô£à OpenDays abiertos: ${upserts} d├¡as (${startIso} ÔåÆ ${endIso})`);
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log('­ƒî▒ Seed tarifas 2026/27');
  console.log('   flags:', opts);
  console.log('   data:', DATA_PATH);

  const data = loadData();
  if (data.meta?.seedTag !== SEED_TAG) {
    console.warn(`ÔÜá´©Å  meta.seedTag inesperado: ${data.meta?.seedTag}`);
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
          { name: { startsWith: '2026/27 ┬À' } },
        ],
      },
    });
    const prices = await prisma.seasonPrice.count({
      where: {
        seasonBlock: {
          hotelId: hotel.id,
          name: { startsWith: '2026/27 ┬À' },
        },
      },
    });
    console.log('\n­ƒôè Resumen');
    console.log(`   Bloques seed: ${count}`);
    console.log(`   SeasonPrices: ${prices}`);
    console.log(`   Hotel id: ${hotel.id}`);
  }

  console.log('\nÔ£¿ Listo. Cotiz├í fechas dentro de 2026-12-05 ÔÇª 2027-03-25.');
}

main()
  .catch((err) => {
    console.error('ÔØî Error en seed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
