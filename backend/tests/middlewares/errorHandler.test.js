const express = require('express');
const request = require('supertest');
const errorHandler = require('../../src/middlewares/errorHandler');

describe('Error Handler Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Error Handler', () => {
    it('debería manejar errores de validación', async () => {
      // Ruta que simula un error de validación
      app.get('/test-validation-error', (req, res, next) => {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-validation-error')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error de validación');
    });

    it('debería manejar errores de base de datos', async () => {
      // Ruta que simula un error de base de datos
      app.get('/test-db-error', (req, res, next) => {
        const error = new Error('Database connection failed');
        error.name = 'PrismaClientKnownRequestError';
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-db-error')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });

    it('debería manejar errores de sintaxis JSON', async () => {
      // Ruta que simula un error de sintaxis JSON
      app.post('/test-json-error', (req, res, next) => {
        const error = new SyntaxError('Unexpected token in JSON');
        error.status = 400;
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .post('/test-json-error')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });

    it('debería manejar errores 404', async () => {
      // Ruta que simula un error 404
      app.get('/test-not-found', (req, res, next) => {
        const error = new Error('Not Found');
        error.status = 404;
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-not-found')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });

    it('debería manejar errores genéricos', async () => {
      // Ruta que simula un error genérico
      app.get('/test-generic-error', (req, res, next) => {
        const error = new Error('Something went wrong');
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-generic-error')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });

    it('debería manejar errores con detalles adicionales', async () => {
      // Ruta que simula un error con detalles
      app.get('/test-error-with-details', (req, res, next) => {
        const error = new Error('Error with details');
        error.details = 'Additional error information';
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-error-with-details')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('Error interno del servidor');
      expect(response.body.message).toBe('Error with details');
    });

    it('debería manejar errores de autenticación', async () => {
      // Ruta que simula un error de autenticación
      app.get('/test-auth-error', (req, res, next) => {
        const error = new Error('Unauthorized');
        error.status = 401;
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-auth-error')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });

    it('debería manejar errores de permisos', async () => {
      // Ruta que simula un error de permisos
      app.get('/test-forbidden-error', (req, res, next) => {
        const error = new Error('Forbidden');
        error.status = 403;
        next(error);
      });

      app.use(errorHandler);

      const response = await request(app)
        .get('/test-forbidden-error')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Error interno del servidor');
    });
  });
}); 