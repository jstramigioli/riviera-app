-- Script para resetear todas las secuencias de autoincrement
-- Ejecutar después de restaurar un backup o importar datos con IDs específicos
-- 
-- Uso: npm run db:fix-sequences
-- 
-- Este script actualiza el contador de autoincrement (sequence) de cada tabla
-- para que comience desde el ID máximo actual + 1, evitando conflictos de
-- "unique constraint failed on id"

-- Client
SELECT setval('"Client_id_seq"', COALESCE((SELECT MAX(id) FROM "Client"), 1), true);

-- Guest
SELECT setval('"Guest_id_seq"', COALESCE((SELECT MAX(id) FROM "Guest"), 1), true);

-- Payment
SELECT setval('"Payment_id_seq"', COALESCE((SELECT MAX(id) FROM "Payment"), 1), true);

-- Reservation
SELECT setval('"Reservation_id_seq"', COALESCE((SELECT MAX(id) FROM "Reservation"), 1), true);

-- Query
SELECT setval('"Query_id_seq"', COALESCE((SELECT MAX(id) FROM "Query"), 1), true);

-- QueryGuest
SELECT setval('"QueryGuest_id_seq"', COALESCE((SELECT MAX(id) FROM "QueryGuest"), 1), true);

-- QueryPayment
SELECT setval('"QueryPayment_id_seq"', COALESCE((SELECT MAX(id) FROM "QueryPayment"), 1), true);

-- Tag
SELECT setval('"Tag_id_seq"', COALESCE((SELECT MAX(id) FROM "Tag"), 1), true);

-- RoomType
SELECT setval('"RoomType_id_seq"', COALESCE((SELECT MAX(id) FROM "RoomType"), 1), true);

-- Room
SELECT setval('"Room_id_seq"', COALESCE((SELECT MAX(id) FROM "Room"), 1), true);

-- VirtualRoom
SELECT setval('"VirtualRoom_id_seq"', COALESCE((SELECT MAX(id) FROM "VirtualRoom"), 1), true);

-- VirtualRoomComponent
SELECT setval('"VirtualRoomComponent_id_seq"', COALESCE((SELECT MAX(id) FROM "VirtualRoomComponent"), 1), true);

-- RoomInventory
SELECT setval('"RoomInventory_id_seq"', COALESCE((SELECT MAX(id) FROM "RoomInventory"), 1), true);

-- OpenDay
SELECT setval('"OpenDay_id_seq"', COALESCE((SELECT MAX(id) FROM "OpenDay"), 1), true);

-- ReservationSegment
SELECT setval('"ReservationSegment_id_seq"', COALESCE((SELECT MAX(id) FROM "ReservationSegment"), 1), true);



