const express = require('express');
const controller = require('../controllers/gastronomia.controller');

const router = express.Router();

router.get('/daily-menus', controller.listDailyMenus);
router.get('/daily-menus/by-date/:date', controller.getDailyMenuByDate);
router.get('/daily-menus/:id/pdf', controller.getDailyMenuPdf);
router.get('/daily-menus/:id', controller.getDailyMenuById);
router.post('/daily-menus', controller.createDailyMenu);
router.put('/daily-menus/:id', controller.updateDailyMenu);
router.patch('/daily-menus/:id/status', controller.patchDailyMenuStatus);
router.post('/daily-menus/:id/copy', controller.copyDailyMenu);

router.get('/dishes', controller.searchDishes);
router.patch('/dishes/:id', controller.renameDish);
router.delete('/dishes/:id', controller.deleteDish);

module.exports = router;
