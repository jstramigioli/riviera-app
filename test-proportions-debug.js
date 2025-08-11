// Script de prueba para verificar el sistema de proporciones
console.log('🧪 Probando sistema de proporciones...');

// Simular datos de prueba
const roomTypes = [
  { id: 1, name: 'Doble' },
  { id: 2, name: 'Triple' },
  { id: 3, name: 'Suite' }
];

const serviceTypes = [
  { id: 'base', name: 'Solo Alojamiento' },
  { id: 'breakfast', name: 'Con Desayuno' },
  { id: 'half', name: 'Media Pensión' },
  { id: 'full', name: 'Pensión Completa' }
];

const serviceAdjustments = [
  { serviceTypeId: 'base', mode: 'FIXED', value: 0 },
  { serviceTypeId: 'breakfast', mode: 'PERCENTAGE', value: 12 },
  { serviceTypeId: 'half', mode: 'PERCENTAGE', value: 30 },
  { serviceTypeId: 'full', mode: 'PERCENTAGE', value: 50 }
];

// Precios iniciales
let prices = [
  { roomTypeId: 1, serviceTypeId: 'base', basePrice: 80 },
  { roomTypeId: 1, serviceTypeId: 'breakfast', basePrice: 89.6 },
  { roomTypeId: 1, serviceTypeId: 'half', basePrice: 104 },
  { roomTypeId: 1, serviceTypeId: 'full', basePrice: 120 },
  { roomTypeId: 2, serviceTypeId: 'base', basePrice: 120 },
  { roomTypeId: 2, serviceTypeId: 'breakfast', basePrice: 134.4 },
  { roomTypeId: 2, serviceTypeId: 'half', basePrice: 156 },
  { roomTypeId: 2, serviceTypeId: 'full', basePrice: 180 },
  { roomTypeId: 3, serviceTypeId: 'base', basePrice: 200 },
  { roomTypeId: 3, serviceTypeId: 'breakfast', basePrice: 224 },
  { roomTypeId: 3, serviceTypeId: 'half', basePrice: 260 },
  { roomTypeId: 3, serviceTypeId: 'full', basePrice: 300 }
];

console.log('📊 Precios iniciales:');
prices.forEach(p => {
  const roomType = roomTypes.find(rt => rt.id === p.roomTypeId);
  const serviceType = serviceTypes.find(st => st.id === p.serviceTypeId);
  console.log(`  ${roomType.name} ${serviceType.name}: $${p.basePrice}`);
});

// Función para calcular precio base desde precio con servicio
function calculateBasePrice(price, serviceTypeId) {
  const adjustment = serviceAdjustments.find(adj => adj.serviceTypeId === serviceTypeId);
  if (!adjustment || !adjustment.value) return price;
  
  if (adjustment.mode === 'FIXED') {
    return price - adjustment.value;
  } else if (adjustment.mode === 'PERCENTAGE') {
    return price / (1 + adjustment.value / 100);
  }
  return price;
}

// Función para calcular precio con servicio desde precio base
function calculateServicePrice(basePrice, serviceTypeId) {
  const adjustment = serviceAdjustments.find(adj => adj.serviceTypeId === serviceTypeId);
  if (!adjustment || !adjustment.value) return basePrice;
  
  if (adjustment.mode === 'FIXED') {
    return basePrice + adjustment.value;
  } else if (adjustment.mode === 'PERCENTAGE') {
    return basePrice * (1 + adjustment.value / 100);
  }
  return basePrice;
}

// Simular cambio de precio: Doble con desayuno de $89.6 a $200
console.log('\n🔄 Simulando cambio: Doble con desayuno de $89.6 a $200');

const roomTypeId = 1; // Doble
const serviceTypeId = 'breakfast'; // Con desayuno
const newPrice = 200;

// 1. Calcular el nuevo precio base
const newBasePrice = calculateBasePrice(newPrice, serviceTypeId);
console.log(`🧮 Nuevo precio base calculado: $${newBasePrice}`);

// 2. Obtener el precio base anterior
const previousBasePrice = prices.find(p => p.roomTypeId === roomTypeId && p.serviceTypeId === 'base')?.basePrice || 0;
console.log(`📊 Precio base anterior: $${previousBasePrice}`);

// 3. Calcular el factor de cambio
const changeFactor = previousBasePrice > 0 ? newBasePrice / previousBasePrice : 1;
console.log(`🔄 Factor de cambio: ${changeFactor}`);

// 4. Aplicar el factor de cambio a todos los tipos de habitación
const updatedPrices = [];

roomTypes.forEach(roomType => {
  serviceTypes.forEach(serviceType => {
    const existingPrice = prices.find(p => 
      p.roomTypeId === roomType.id && p.serviceTypeId === serviceType.id
    );
    
    let finalBasePrice;
    
    if (roomType.id === roomTypeId) {
      // Para el tipo de habitación editado, usar el nuevo precio base
      finalBasePrice = calculateServicePrice(newBasePrice, serviceType.id);
      console.log(`🎯 ${roomType.name} ${serviceType.name}: $${finalBasePrice}`);
    } else {
      // Para otros tipos de habitación, aplicar el factor de cambio
      const currentBasePrice = existingPrice?.basePrice || 0;
      
      // Calcular el precio base actual (sin ajustes de servicio)
      const currentBase = calculateBasePrice(currentBasePrice, serviceType.id);
      
      // Aplicar el factor de cambio al precio base
      const newBase = currentBase * changeFactor;
      
      // Aplicar ajustes de servicio al nuevo precio base
      finalBasePrice = calculateServicePrice(newBase, serviceType.id);
      
      console.log(`📊 ${roomType.name} ${serviceType.name}: $${currentBasePrice} -> $${finalBasePrice} (base: $${currentBase} -> $${newBase})`);
    }
    
    updatedPrices.push({
      roomTypeId: roomType.id,
      serviceTypeId: serviceType.id,
      basePrice: Math.round(finalBasePrice * 100) / 100
    });
  });
});

console.log('\n🎯 Precios finales después del cambio:');
updatedPrices.forEach(p => {
  const roomType = roomTypes.find(rt => rt.id === p.roomTypeId);
  const serviceType = serviceTypes.find(st => st.id === p.serviceTypeId);
  console.log(`  ${roomType.name} ${serviceType.name}: $${p.basePrice}`);
});

console.log('\n✅ Prueba completada. Verifica que los precios se actualizaron proporcionalmente.'); 