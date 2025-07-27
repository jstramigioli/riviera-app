const fetch = require('node-fetch');

async function testKeyframesLoading() {
  try {
    console.log('🧪 Probando carga de keyframes desde el frontend...');
    
    // Simular la petición que hace el frontend
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    console.log(`📡 Haciendo petición a: ${API_URL}/dynamic-pricing/keyframes/${hotelId}`);
    
    const response = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`);
    
    console.log(`📊 Status de respuesta: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Datos recibidos: ${data.length} keyframes`);
    
    data.forEach((keyframe, index) => {
      const dateStr = new Date(keyframe.date).toISOString().split('T')[0];
      const priceStr = keyframe.basePrice.toFixed(2);
      console.log(`   ${index + 1}. ${dateStr} - $${priceStr} (ID: ${keyframe.id})`);
    });
    
    console.log('\n🎯 Simulando formato del frontend...');
    
    // Simular el formato que espera el frontend
    const formattedKeyframes = data.map(k => ({
      date: new Date(k.date).toISOString().slice(0, 10),
      value: k.basePrice
    }));
    
    console.log('📋 Keyframes formateados para el frontend:');
    formattedKeyframes.forEach((keyframe, index) => {
      console.log(`   ${index + 1}. ${keyframe.date} - $${keyframe.value}`);
    });
    
    console.log('\n✅ Prueba completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testKeyframesLoading(); 