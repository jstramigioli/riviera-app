#!/usr/bin/env node

const API_URL = 'http://localhost:3001/api';

async function testNewTariffSystem() {
  console.log('Probando el sistema de tarifas...\n');

  try {
    console.log('1) Tipos de servicio...');
    const serviceTypesResponse = await fetch(`${API_URL}/service-types?hotelId=default-hotel`);
    const serviceTypesData = await serviceTypesResponse.json();
    console.log('OK tipos de servicio:', serviceTypesData.data?.length || 0);

    console.log('\n2) Tipos de habitación...');
    const roomTypesResponse = await fetch(`${API_URL}/room-types`);
    const roomTypesData = await roomTypesResponse.json();
    console.log('OK tipos de habitación:', roomTypesData?.length || 0);

    console.log('\n3) Bloques de temporada...');
    const blocksResponse = await fetch(`${API_URL}/season-blocks?hotelId=default-hotel`);
    const blocksData = await blocksResponse.json();
    console.log('OK bloques:', blocksData.data?.length || 0);

    if (blocksData.data && blocksData.data.length > 0) {
      const firstBlock = blocksData.data[0];
      console.log('\n4) Precios calculados...');
      const calculatedResponse = await fetch(
        `${API_URL}/season-blocks/${firstBlock.id}/calculated-prices?hotelId=default-hotel`
      );
      const calculatedData = await calculatedResponse.json();
      console.log('OK precios calculados:', calculatedData.data ? 'Sí' : 'No');

      if (calculatedData.data?.calculatedPrices) {
        calculatedData.data.calculatedPrices.slice(0, 3).forEach((price) => {
          console.log(
            `   - ${price.roomType?.name} + ${price.serviceType?.name}: $${price.roundedPrice}`
          );
        });
      }
    }

    console.log('\nPruebas completadas.');
  } catch (error) {
    console.error('Error en las pruebas:', error.message);
    console.error('Asegurate de que el backend este en http://localhost:3001');
  }
}

if (require.main === module) {
  testNewTariffSystem();
}

module.exports = { testNewTariffSystem };
