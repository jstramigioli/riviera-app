const express = require('express');
const multer = require('multer');
const {
  getPublicCheckIn,
  submitPublicCheckIn,
  uploadPublicCheckInDocumentPhoto
} = require('../controllers/onlineCheckIn.controller');

const router = express.Router();

const uploadDocumentPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

// Público — sin auth
router.get('/:token', getPublicCheckIn);
router.post(
  '/:token/document-photos/:slot',
  uploadDocumentPhoto.single('file'),
  uploadPublicCheckInDocumentPhoto
);
router.post('/:token', submitPublicCheckIn);

module.exports = router;
