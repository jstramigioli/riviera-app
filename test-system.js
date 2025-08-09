const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

async function testBackend() {
  console.log('🔍 Probando backend...');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('✅ Backend health:', healthResponse.data);
    
    // Test service types endpoint
    const serviceTypesResponse = await axios.get(`${BACKEND_URL}/api/service-types?hotelId=default-hotel`);
    console.log('✅ Service types:', serviceTypesResponse.data.data?.length || 0, 'tipos encontrados');
    
    // Test season blocks endpoint
    const seasonBlocksResponse = await axios.get(`${BACKEND_URL}/api/season-blocks?hotelId=default-hotel`);
    console.log('✅ Season blocks:', seasonBlocksResponse.data.data?.length || 0, 'bloques encontrados');
    
    return true;
  } catch (error) {
    console.error('❌ Error en backend:', error.message);
    return false;
  }
}

async function testFrontend() {
  console.log('\n🔍 Probando frontend...');
  
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ Frontend está corriendo en:', FRONTEND_URL);
      return true;
    }
  } catch (error) {
    console.error('❌ Error en frontend:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas del sistema...\n');
  
  const backendOk = await testBackend();
  const frontendOk = await testFrontend();
  
  console.log('\n📊 Resumen de pruebas:');
  console.log(`Backend: ${backendOk ? '✅ OK' : '❌ ERROR'}`);
  console.log(`Frontend: ${frontendOk ? '✅ OK' : '❌ ERROR'}`);
  
  if (backendOk && frontendOk) {
    console.log('\n🎉 ¡Sistema funcionando correctamente!');
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
    console.log(`🔧 Backend: ${BACKEND_URL}`);
    console.log('\n💡 Puedes acceder a la aplicación en tu navegador.');
  } else {
    console.log('\n⚠️  Hay problemas en el sistema. Revisa los logs anteriores.');
  }
}

runTests().catch(console.error); 