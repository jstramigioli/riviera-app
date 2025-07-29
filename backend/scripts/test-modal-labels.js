const http = require('http');

async function testModalLabels() {
  try {
    console.log('🧪 Probando correcciones de labels del modal...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // Simular diferentes configuraciones de tipos de habitación
    console.log('\n📊 1. Simulando diferentes tipos de habitación:');
    
    const roomTypes = ['single', 'doble', 'triple', 'cuadruple'];
    const roomTypeNames = {
      'single': 'Individual',
      'doble': 'Doble', 
      'triple': 'Triple',
      'cuadruple': 'Cuádruple'
    };
    
    roomTypes.forEach(type => {
      console.log(`   ${type} → ${roomTypeNames[type]}`);
    });
    
    // Simular diferentes tipos de precio
    console.log('\n📊 2. Simulando diferentes tipos de precio:');
    
    const priceTypes = ['base', 'breakfast', 'halfBoard'];
    const priceTypeNames = {
      'base': 'Precio Base',
      'breakfast': 'Con Desayuno',
      'halfBoard': 'Media Pensión'
    };
    
    priceTypes.forEach(type => {
      console.log(`   ${type} → ${priceTypeNames[type]}`);
    });
    
    // Simular combinaciones
    console.log('\n📊 3. Simulando combinaciones de modal:');
    
    const testCombinations = [
      { roomType: 'single', priceType: 'base' },
      { roomType: 'doble', priceType: 'breakfast' },
      { roomType: 'triple', priceType: 'halfBoard' }
    ];
    
    testCombinations.forEach(combo => {
      const roomName = roomTypeNames[combo.roomType];
      const priceName = priceTypeNames[combo.priceType];
      console.log(`   Modal: "Precio Base (${roomName}):"`);
      console.log(`   Texto: "Precio actual para ${roomName} con ${priceName.toLowerCase()}: $X"`);
    });
    
    console.log('\n🎉 Pruebas completadas!');
    console.log('\n📝 Instrucciones para verificar en el frontend:');
    console.log('   1. Ve al frontend y navega a Configuración > Curva Estacional');
    console.log('   2. Cambia el tipo de habitación a "Triple"');
    console.log('   3. Cambia el tipo de precio a "Con Desayuno"');
    console.log('   4. Haz clic en un keyframe operacional');
    console.log('   5. Verifica que el modal muestre: "Precio Base (Triple):"');
    console.log('   6. Verifica que el texto debajo muestre: "Precio actual para Triple con desayuno: $X"');
    console.log('   7. Cambia a otros tipos de habitación y precio para verificar');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

testModalLabels(); 