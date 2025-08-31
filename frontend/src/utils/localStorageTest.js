// Script para probar la funcionalidad de localStorage
export const testLocalStorage = () => {
  console.log('🧪 Probando funcionalidad de localStorage...\n');

  // Datos de prueba
  const testFormData = {
    checkIn: '2025-09-01',
    checkOut: '2025-09-05',
    mainClient: {
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '123456789'
    }
  };

  const testRequirements = {
    requiredGuests: 2,
    requiredTags: ['VIP', 'Early Check-in']
  };

  try {
    // Guardar datos de prueba
    localStorage.setItem('nuevaConsulta_formData', JSON.stringify(testFormData));
    localStorage.setItem('nuevaConsulta_requirements', JSON.stringify(testRequirements));

    console.log('✅ Datos guardados en localStorage:');
    console.log('  - FormData:', testFormData);
    console.log('  - Requirements:', testRequirements);

    // Leer datos guardados
    const savedFormData = JSON.parse(localStorage.getItem('nuevaConsulta_formData'));
    const savedRequirements = JSON.parse(localStorage.getItem('nuevaConsulta_requirements'));

    console.log('\n📖 Datos leídos de localStorage:');
    console.log('  - FormData:', savedFormData);
    console.log('  - Requirements:', savedRequirements);

    // Verificar que los datos coinciden
    const formDataMatch = JSON.stringify(testFormData) === JSON.stringify(savedFormData);
    const requirementsMatch = JSON.stringify(testRequirements) === JSON.stringify(savedRequirements);

    console.log('\n🔍 Verificación:');
    console.log('  - FormData coincide:', formDataMatch ? '✅' : '❌');
    console.log('  - Requirements coincide:', requirementsMatch ? '✅' : '❌');

    if (formDataMatch && requirementsMatch) {
      console.log('\n🎉 ¡localStorage funciona correctamente!');
    } else {
      console.log('\n⚠️  Hay problemas con localStorage');
    }

  } catch (error) {
    console.error('❌ Error probando localStorage:', error);
  }
};

// Función para limpiar datos de prueba
export const clearTestData = () => {
  localStorage.removeItem('nuevaConsulta_formData');
  localStorage.removeItem('nuevaConsulta_requirements');
  console.log('🗑️  Datos de prueba eliminados');
}; 