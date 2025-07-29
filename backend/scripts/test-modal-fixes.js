const http = require('http');

async function testModalFixes() {
  try {
    console.log('🧪 Probando correcciones del modal de edición...');
    
    const API_URL = 'http://localhost:3001/api';
    const hotelId = 'default-hotel';
    
    // 1. Verificar que se pueden obtener keyframes operacionales
    console.log('\n📊 1. Verificando keyframes operacionales...');
    const keyframesResponse = await makeRequest(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`, 'GET');
    
    if (keyframesResponse.status === 200) {
      const keyframes = JSON.parse(keyframesResponse.data);
      const operationalKeyframes = keyframes.filter(k => k.isOperational);
      
      console.log(`✅ Keyframes operacionales encontrados: ${operationalKeyframes.length}`);
      
      if (operationalKeyframes.length > 0) {
        const testKeyframe = operationalKeyframes[0];
        console.log(`\n📊 2. Información del keyframe de prueba:`);
        console.log(`   ID: ${testKeyframe.id}`);
        console.log(`   Tipo: ${testKeyframe.operationalType}`);
        console.log(`   Precio base: $${testKeyframe.basePrice}`);
        console.log(`   Fecha: ${new Date(testKeyframe.date).toISOString().split('T')[0]}`);
        
        // 3. Simular diferentes tipos de habitación y precio
        console.log('\n📊 3. Simulando diferentes configuraciones:');
        
        const roomTypes = ['single', 'doble', 'triple'];
        const priceTypes = ['base', 'breakfast', 'halfBoard'];
        const coefficients = { single: 0.62, doble: 1.00, triple: 1.25 };
        const mealRules = { breakfastMode: "PERCENTAGE", breakfastValue: 0.15, dinnerMode: "PERCENTAGE", dinnerValue: 0.2 };
        
        roomTypes.forEach(roomType => {
          priceTypes.forEach(priceType => {
            const basePrice = testKeyframe.basePrice;
            const basePriceForType = Math.round(basePrice * coefficients[roomType]);
            
            let adjustedPrice;
            switch (priceType) {
              case 'breakfast':
                adjustedPrice = Math.round(basePriceForType * 1.15);
                break;
              case 'halfBoard':
                adjustedPrice = Math.round(basePriceForType * 1.35);
                break;
              default:
                adjustedPrice = basePriceForType;
            }
            
            console.log(`   ${roomType} + ${priceType}: $${basePrice} → $${adjustedPrice}`);
          });
        });
      }
    }
    
    console.log('\n🎉 Pruebas completadas!');
    console.log('\n📝 Instrucciones para verificar en el frontend:');
    console.log('   1. Ve al frontend y navega a Configuración > Curva Estacional');
    console.log('   2. Cambia el tipo de habitación en el selector');
    console.log('   3. Cambia el tipo de precio en el selector');
    console.log('   4. Haz clic en un keyframe operacional (punto azul)');
    console.log('   5. Verifica que el modal muestre el precio correcto según las selecciones');
    console.log('   6. Verifica que el texto debajo del campo de precio sea correcto');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

function makeRequest(url, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

testModalFixes(); 