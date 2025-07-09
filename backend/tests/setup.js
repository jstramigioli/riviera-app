// Configuración global para los tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/riviera_test';

// Configurar timeouts más largos para tests de base de datos
jest.setTimeout(10000);

// Mock completo de Prisma para tests
const mockPrismaClient = {
  // Métodos generales
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  
  // Modelo Client
  client: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    upsert: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.create })),
  },
  
  // Modelo Room
  room: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  
  // Modelo Reservation
  reservation: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  
  // Modelo RoomType
  roomType: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
  },
  
  // Modelo Tag
  tag: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
  },
  
  // Modelo Guest
  guest: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  
  // Modelo Payment
  payment: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  
  // Modelo DailyRate
  dailyRate: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data.data })),
    update: jest.fn().mockImplementation((data) => Promise.resolve({ id: data.where.id, ...data.data })),
    delete: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
};

// Mock del módulo Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient)
}));

// Mock del módulo de utilidades de Prisma
jest.mock('../src/utils/prisma', () => mockPrismaClient);

// Limpiar console.log en tests (opcional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Exportar el mock para uso en tests
global.mockPrisma = mockPrismaClient; 