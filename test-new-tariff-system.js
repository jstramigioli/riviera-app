#!/usr/bin/env node

const API_URL = 'http://localhost:3001/api';

async function testNewTariffSystem() {
  console.log('🧪 Probando el nuevo sistema de tarifas...\n');

  try {
    // 1. Probar configuración de redondeo
    console.log('1️⃣ Probando configuración de redondeo...');
    const roundingResponse = await fetch(`${API_URL}/rounding-config?hotelId=default-hotel`);
    const roundingData = await roundingResponse.json();
    console.log('✅ Configuración de redondeo:', roundingData.data);

    // 2. Probar tipos de servicio
    console.log('\n2️⃣ Probando tipos de servicio...');
    const serviceTypesResponse = await fetch(`${API_URL}/service-types?hotelId=default-hotel`);
    const serviceTypesData = await serviceTypesResponse.json();
    console.log('✅ Tipos de servicio:', serviceTypesData.data?.length || 0, 'encontrados');

    // 3. Probar tipos de habitación
    console.log('\n3️⃣ Probando tipos de habitación...');
    const roomTypesResponse = await fetch(`${API_URL}/room-types`);
    const roomTypesData = await roomTypesResponse.json();
    console.log('✅ Tipos de habitación:', roomTypesData?.length || 0, 'encontrados');

    // 4. Probar bloques de temporada
    console.log('\n4️⃣ Probando bloques de temporada...');
    const blocksResponse = await fetch(`${API_URL}/season-blocks?hotelId=default-hotel`);
    const blocksData = await blocksResponse.json();
    console.log('✅ Bloques de temporada:', blocksData.data?.length || 0, 'encontrados');

    if (blocksData.data && blocksData.data.length > 0) {
      const firstBlock = blocksData.data[0];
      console.log('📊 Primer bloque:', {
        id: firstBlock.id,
        name: firstBlock.name,
        useProportions: firstBlock.useProportions,
        serviceAdjustmentMode: firstBlock.serviceAdjustmentMode,
        prices: firstBlock.seasonPrices?.length || 0,
        coefficients: firstBlock.proportionCoefficients?.length || 0,
        adjustments: firstBlock.serviceAdjustments?.length || 0
      });

      // 5. Probar precios calculados
      console.log('\n5️⃣ Probando precios calculados...');
      const calculatedResponse = await fetch(`${API_URL}/season-blocks/${firstBlock.id}/calculated-prices?hotelId=default-hotel`);
      const calculatedData = await calculatedResponse.json();
      console.log('✅ Precios calculados disponibles:', calculatedData.data ? 'Sí' : 'No');
      
      if (calculatedData.data && calculatedData.data.calculatedPrices) {
        console.log('💰 Ejemplos de precios calculados:');
        calculatedData.data.calculatedPrices.slice(0, 3).forEach(price => {
          console.log(`   - ${price.roomType?.name} + ${price.serviceType?.name}: $${price.roundedPrice} ${price.wasRounded ? '(redondeado)' : ''}`);
        });
      }
    }

    // 6. Crear bloque de prueba
    console.log('\n6️⃣ Creando bloque de prueba...');
    const newBlockData = {
      name: 'Bloque de Prueba V2',
      description: 'Bloque creado para probar el nuevo sistema',
      startDate: '2024-12-01',
      endDate: '2024-12-31',
      useProportions: true,
      referenceRoomTypeId: roomTypesData[0]?.id,
      serviceAdjustmentMode: 'PERCENTAGE',
      prices: [],
      serviceAdjustments: []
    };

    // Crear precios para cada combinación habitación-servicio
    if (roomTypesData && serviceTypesData.data) {
      roomTypesData.forEach(roomType => {
        serviceTypesData.data.forEach(serviceType => {
          newBlockData.prices.push({
            roomTypeId: roomType.id,
            serviceTypeId: serviceType.id,
            basePrice: Math.floor(Math.random() * 5000) + 1000 // Precio aleatorio entre 1000-6000
          });
        });
      });

      // Crear ajustes para cada servicio
      serviceTypesData.data.forEach(serviceType => {
        if (serviceType.name !== 'Solo Alojamiento') {
          newBlockData.serviceAdjustments.push({
            serviceTypeId: serviceType.id,
            mode: 'PERCENTAGE',
            value: Math.floor(Math.random() * 50) + 10 // Entre 10% y 60%
          });
        }
      });
    }

    const createResponse = await fetch(`${API_URL}/season-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newBlockData)
    });

    if (createResponse.ok) {
      const createdBlock = await createResponse.json();
      console.log('✅ Bloque de prueba creado:', createdBlock.data.id);
      
      // 7. Probar actualización de configuración de redondeo
      console.log('\n7️⃣ Actualizando configuración de redondeo...');
      const updateRoundingResponse = await fetch(`${API_URL}/rounding-config?hotelId=default-hotel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          multiple: 100,
          mode: 'nearest'
        })
      });

      if (updateRoundingResponse.ok) {
        console.log('✅ Configuración de redondeo actualizada');
        
        // Probar precios con nuevo redondeo
        const newCalculatedResponse = await fetch(`${API_URL}/season-blocks/${createdBlock.data.id}/calculated-prices?hotelId=default-hotel`);
        const newCalculatedData = await newCalculatedResponse.json();
        
        if (newCalculatedData.data && newCalculatedData.data.calculatedPrices) {
          console.log('💰 Precios con redondeo a 100:');
          newCalculatedData.data.calculatedPrices.slice(0, 3).forEach(price => {
            console.log(`   - ${price.roomType?.name} + ${price.serviceType?.name}: $${price.calculatedPrice.toFixed(2)} → $${price.roundedPrice}`);
          });
        }
      }

      // 8. Limpiar - Eliminar bloque de prueba
      console.log('\n8️⃣ Limpiando bloque de prueba...');
      const deleteResponse = await fetch(`${API_URL}/season-blocks/${createdBlock.data.id}`, {
        method: 'DELETE'
      });

      if (deleteResponse.ok) {
        console.log('✅ Bloque de prueba eliminado');
      }
    } else {
      const errorData = await createResponse.json();
      console.log('❌ Error al crear bloque de prueba:', errorData.errors);
    }

    console.log('\n🎉 ¡Todas las pruebas del nuevo sistema completadas!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    console.error('Asegúrate de que el servidor backend esté ejecutándose en http://localhost:3001');
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  testNewTariffSystem();
}

module.exports = { testNewTariffSystem }; 