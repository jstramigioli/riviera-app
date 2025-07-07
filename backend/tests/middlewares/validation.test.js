const express = require('express');
const request = require('supertest');
const { validateClient, validateReservation, validateRoom } = require('../../src/middlewares/validation');

describe('Validation Middlewares', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validateClient', () => {
    beforeEach(() => {
      app.post('/test-client', validateClient, (req, res) => {
        res.json({ success: true, data: req.body });
      });
      // Middleware de manejo de errores después de las rutas
      app.use((error, req, res, next) => {
        if (error.name === 'ValidationError') {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      });
    });

    it('should pass validation with valid client data', async () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        documentType: 'DNI',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/test-client')
        .send(validData)
        .expect(200);
    });

    it('should fail validation with missing firstName', async () => {
      const invalidData = {
        lastName: 'Doe',
        email: 'john@example.com',
        documentType: 'DNI',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/test-client')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with short firstName', async () => {
      const invalidData = {
        firstName: 'J',
        lastName: 'Doe',
        email: 'john@example.com',
        documentType: 'DNI',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/test-client')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with invalid email', async () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        documentType: 'DNI',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/test-client')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with invalid document type', async () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        documentType: 'INVALID',
        documentNumber: '12345678'
      };

      await request(app)
        .post('/test-client')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with short document number', async () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        documentType: 'DNI',
        documentNumber: '12'
      };

      await request(app)
        .post('/test-client')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('validateReservation', () => {
    beforeEach(() => {
      app.post('/test-reservation', validateReservation, (req, res) => {
        res.json({ success: true, data: req.body });
      });
      app.put('/test-reservation/:id', validateReservation, (req, res) => {
        res.json({ success: true, data: req.body });
      });
      // Middleware de manejo de errores después de las rutas
      app.use((error, req, res, next) => {
        if (error.name === 'ValidationError') {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      });
    });

    it('should pass validation with valid reservation data for POST', async () => {
      const validData = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        roomId: 1,
        mainClientId: 1,
        totalAmount: 1000
      };

      await request(app)
        .post('/test-reservation')
        .send(validData)
        .expect(200);
    });

    it('should pass validation with valid reservation data for PUT', async () => {
      const validData = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        totalAmount: 1000
      };

      await request(app)
        .put('/test-reservation/1')
        .send(validData)
        .expect(200);
    });

    it('should fail validation with missing checkIn', async () => {
      const invalidData = {
        checkOut: '2024-01-03',
        roomId: 1,
        mainClientId: 1
      };

      await request(app)
        .post('/test-reservation')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with missing checkOut', async () => {
      const invalidData = {
        checkIn: '2024-01-01',
        roomId: 1,
        mainClientId: 1
      };

      await request(app)
        .post('/test-reservation')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with checkOut before checkIn', async () => {
      const invalidData = {
        checkIn: '2024-01-03',
        checkOut: '2024-01-01',
        roomId: 1,
        mainClientId: 1
      };

      await request(app)
        .post('/test-reservation')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with invalid totalAmount', async () => {
      const invalidData = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        roomId: 1,
        mainClientId: 1,
        totalAmount: -100
      };

      await request(app)
        .post('/test-reservation')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with missing roomId for POST', async () => {
      const invalidData = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        mainClientId: 1
      };

      await request(app)
        .post('/test-reservation')
        .send(invalidData)
        .expect(400);
    });

    it('should pass validation without roomId for PUT', async () => {
      const validData = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03'
      };

      await request(app)
        .put('/test-reservation/1')
        .send(validData)
        .expect(200);
    });
  });

  describe('validateRoom', () => {
    beforeEach(() => {
      app.post('/test-room', validateRoom, (req, res) => {
        res.json({ success: true, data: req.body });
      });
      // Middleware de manejo de errores después de las rutas
      app.use((error, req, res, next) => {
        if (error.name === 'ValidationError') {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      });
    });

    it('should pass validation with valid room data', async () => {
      const validData = {
        name: 'Room 101',
        capacity: 2,
        price: 100.50
      };

      await request(app)
        .post('/test-room')
        .send(validData)
        .expect(200);
    });

    it('should fail validation with missing name', async () => {
      const invalidData = {
        capacity: 2,
        price: 100.50
      };

      await request(app)
        .post('/test-room')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with empty name', async () => {
      const invalidData = {
        name: '',
        capacity: 2,
        price: 100.50
      };

      await request(app)
        .post('/test-room')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with invalid capacity', async () => {
      const invalidData = {
        name: 'Room 101',
        capacity: -1,
        price: 100.50
      };

      await request(app)
        .post('/test-room')
        .send(invalidData)
        .expect(400);
    });

    it('should fail validation with invalid price', async () => {
      const invalidData = {
        name: 'Room 101',
        capacity: 2,
        price: 0
      };

      await request(app)
        .post('/test-room')
        .send(invalidData)
        .expect(400);
    });
  });
});
 