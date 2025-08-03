const http = require('http');

async function testEndpoint() {
  console.log('=== Probando Endpoint de Occupancy Score ===\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const testDates = [
    { date: new Date(today.getTime() + 0 * 24 * 60 * 60 * 1000), description: 'Hoy (0 días)' },
    { date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), description: 'Mañana (1 día)' },
    { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), description: 'Ayer (-1 día)' }
  ];

  for (const testCase of testDates) {
    const targetDate = new Date(testCase.date);
    targetDate.setHours(0, 0, 0, 0);
    const daysUntilDate = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    console.log(`\n--- ${testCase.description} ---`);
    console.log('Fecha objetivo:', targetDate.toISOString().split('T')[0]);
    console.log('Días calculados:', daysUntilDate);
    
    const postData = JSON.stringify({
      date: testCase.date.toISOString(),
      hotelId: 'default-hotel',
      daysUntilDate,
      currentOccupancy: 50,
      isWeekend: false,
      isHoliday: false
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/dynamic-pricing/occupancy-score',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Respuesta del servidor:', response);
            console.log('Score final:', response.occupancyScore);
            console.log('Porcentaje:', (response.occupancyScore * 100).toFixed(2) + '%');
          } catch (error) {
            console.error('Error parseando respuesta:', error);
            console.log('Respuesta raw:', data);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error en la petición:', error);
      });

      req.write(postData);
      req.end();
    });
  }
}

// Esperar un poco para que el servidor esté listo
setTimeout(() => {
  testEndpoint().catch(console.error);
}, 2000); 