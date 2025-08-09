const { validateClient, validateReservation } = require('../src/middlewares/validation');

describe('Validation Functions', () => {
  describe('validateClient', () => {
    it('should validate required fields', () => {
      const req = {
        body: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };
      const res = {};
      const next = jest.fn();

      validateClient(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateReservation', () => {
    it('should validate required fields', () => {
      const req = {
        method: 'POST',
        body: {
          checkIn: '2024-01-01',
          checkOut: '2024-01-03',
          roomId: 1
        }
      };
      const res = {};
      const next = jest.fn();

      validateReservation(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
}); 