const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateTipoCargoSystem() {
  console.log('🔄 Iniciando migración del sistema de tipos de cargo...');
  
  try {
    // 1. Verificar si la tabla TipoCargo ya existe
    let tipoCargoExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "TipoCargo" LIMIT 1`;
      tipoCargoExists = true;
      console.log('✅ Tabla TipoCargo ya existe');
    } catch (error) {
      console.log('📋 Tabla TipoCargo no existe, necesita ser creada');
    }

    // 2. Si no existe, crear la tabla TipoCargo manualmente
    if (!tipoCargoExists) {
      console.log('🏗️ Creando tabla TipoCargo...');
      
      await prisma.$executeRaw`
        CREATE TABLE "TipoCargo" (
          id SERIAL PRIMARY KEY,
          codigo VARCHAR(50) UNIQUE NOT NULL,
          nombre VARCHAR(100) NOT NULL,
          descripcion TEXT,
          color VARCHAR(7) DEFAULT '#9e9e9e',
          "esHardcoded" BOOLEAN DEFAULT false,
          "esActivo" BOOLEAN DEFAULT true,
          "ordenIndex" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      console.log('✅ Tabla TipoCargo creada');
    }

    // 3. Poblar tipos hardcodeados si no existen
    console.log('📦 Poblando tipos de cargo hardcodeados...');
    
    const tiposHardcodeados = [
      {
        codigo: 'ALOJAMIENTO',
        nombre: 'Alojamiento',
        descripcion: 'Cargos relacionados con el alojamiento base',
        color: '#4caf50',
        esHardcoded: true,
        ordenIndex: 1
      },
      {
        codigo: 'SERVICIO',
        nombre: 'Servicios',
        descripcion: 'Servicios adicionales del hotel',
        color: '#2196f3',
        esHardcoded: true,
        ordenIndex: 2
      },
      {
        codigo: 'CONSUMO',
        nombre: 'Consumos',
        descripcion: 'Consumos de bar, restaurante y minibar',
        color: '#ff9800',
        esHardcoded: true,
        ordenIndex: 3
      },
      {
        codigo: 'OTRO',
        nombre: 'Otros',
        descripcion: 'Otros cargos no clasificados',
        color: '#9e9e9e',
        esHardcoded: true,
        ordenIndex: 4
      }
    ];

    for (const tipo of tiposHardcodeados) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "TipoCargo" (codigo, nombre, descripcion, color, "esHardcoded", "ordenIndex")
          VALUES (${tipo.codigo}, ${tipo.nombre}, ${tipo.descripcion}, ${tipo.color}, ${tipo.esHardcoded}, ${tipo.ordenIndex})
          ON CONFLICT (codigo) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            descripcion = EXCLUDED.descripcion,
            color = EXCLUDED.color,
            "esHardcoded" = EXCLUDED."esHardcoded",
            "ordenIndex" = EXCLUDED."ordenIndex"
        `;
        console.log(`  ✅ Tipo "${tipo.nombre}" insertado/actualizado`);
      } catch (error) {
        console.error(`  ❌ Error con tipo "${tipo.nombre}":`, error.message);
      }
    }

    // 4. Verificar si la columna tipoCargoId ya existe en Cargo
    let tipoCargoIdExists = false;
    try {
      await prisma.$queryRaw`SELECT "tipoCargoId" FROM "Cargo" LIMIT 1`;
      tipoCargoIdExists = true;
      console.log('✅ Columna tipoCargoId ya existe en Cargo');
    } catch (error) {
      console.log('📋 Columna tipoCargoId no existe, necesita ser agregada');
    }

    // 5. Si no existe, agregar la columna tipoCargoId con valor por defecto
    if (!tipoCargoIdExists) {
      console.log('🔧 Agregando columna tipoCargoId a tabla Cargo...');
      
      // Obtener el ID del tipo "OTRO" para usar como defecto
      const tipoOtro = await prisma.$queryRaw`
        SELECT id FROM "TipoCargo" WHERE codigo = 'OTRO' LIMIT 1
      `;
      
      if (tipoOtro.length === 0) {
        throw new Error('No se encontró el tipo OTRO para usar como defecto');
      }
      
      const tipoOtroId = tipoOtro[0].id;
      console.log(`📌 Usando tipo OTRO (ID: ${tipoOtroId}) como valor por defecto`);
      
      // Agregar columna con valor por defecto
      await prisma.$executeRaw`
        ALTER TABLE "Cargo" 
        ADD COLUMN "tipoCargoId" INTEGER DEFAULT ${tipoOtroId}
      `;
      
      console.log('✅ Columna tipoCargoId agregada');
    }

    // 6. Migrar datos existentes basándose en el campo 'tipo' actual
    console.log('🔄 Migrando datos existentes...');
    
    const cargosExistentes = await prisma.$queryRaw`
      SELECT id, tipo FROM "Cargo" WHERE tipo IS NOT NULL
    `;
    
    console.log(`📊 Encontrados ${cargosExistentes.length} cargos para migrar`);
    
    for (const cargo of cargosExistentes) {
      let codigoTipo = 'OTRO'; // Por defecto
      
      // Mapear tipos antiguos a nuevos códigos
      switch (cargo.tipo) {
        case 'ALOJAMIENTO':
          codigoTipo = 'ALOJAMIENTO';
          break;
        case 'SERVICIO':
          codigoTipo = 'SERVICIO';
          break;
        case 'CONSUMO':
          codigoTipo = 'CONSUMO';
          break;
        default:
          codigoTipo = 'OTRO';
      }
      
      // Obtener el ID del tipo correspondiente
      const tipoResult = await prisma.$queryRaw`
        SELECT id FROM "TipoCargo" WHERE codigo = ${codigoTipo} LIMIT 1
      `;
      
      if (tipoResult.length > 0) {
        const tipoId = tipoResult[0].id;
        
        await prisma.$executeRaw`
          UPDATE "Cargo" 
          SET "tipoCargoId" = ${tipoId} 
          WHERE id = ${cargo.id}
        `;
        
        console.log(`  ✅ Cargo ${cargo.id}: ${cargo.tipo} → ${codigoTipo} (ID: ${tipoId})`);
      }
    }

    // 7. Hacer la columna tipoCargoId NOT NULL y agregar constraint
    if (!tipoCargoIdExists) {
      console.log('🔒 Estableciendo constraints...');
      
      await prisma.$executeRaw`
        ALTER TABLE "Cargo" 
        ALTER COLUMN "tipoCargoId" SET NOT NULL
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "Cargo" 
        ADD CONSTRAINT "Cargo_tipoCargoId_fkey" 
        FOREIGN KEY ("tipoCargoId") REFERENCES "TipoCargo"(id) ON DELETE RESTRICT
      `;
      
      console.log('✅ Constraints establecidos');
    }

    // 8. Verificar el resultado
    console.log('📊 Verificando migración...');
    
    const tiposCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "TipoCargo"`;
    const cargosCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Cargo" WHERE "tipoCargoId" IS NOT NULL
    `;
    
    console.log(`  ✅ Tipos de cargo: ${tiposCount[0].count}`);
    console.log(`  ✅ Cargos migrados: ${cargosCount[0].count}`);

    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('📋 Próximos pasos:');
    console.log('  1. Ejecutar: npx prisma generate');
    console.log('  2. Reiniciar el servidor backend');
    console.log('  3. La columna "tipo" antigua se puede eliminar en una próxima migración');

    return {
      success: true,
      tiposCreados: tiposCount[0].count,
      cargosMigrados: cargosCount[0].count
    };

  } catch (error) {
    console.error('\n❌ Error durante la migración:');
    console.error(error.message);
    console.error('\n🔄 La migración no se completó. Verifica los errores y vuelve a intentar.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateTipoCargoSystem()
    .then((result) => {
      console.log('\n✅ Migración finalizada exitosamente');
      console.log(`📊 Resultado: ${result.tiposCreados} tipos, ${result.cargosMigrados} cargos migrados`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migración falló:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateTipoCargoSystem };
