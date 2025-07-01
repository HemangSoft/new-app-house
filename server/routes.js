'use strict';

const express = require('express');
const router = express.Router();

const publicCtrl  = require('./controllers/public/public.js');

// Login or public auth pages
router.post('/login', publicCtrl.login);
router.get('/logout', publicCtrl.logout);

const netSuiteInvAdjCtrl  = require('./controllers/netsuite/inventory-adjustment.js');
router.post('/v1/netsuite/inventoryadjustmentcategory', netSuiteInvAdjCtrl.inventoryAdjustmentCategory);
router.post('/v1/netsuite/inventoryadjustment', netSuiteInvAdjCtrl.inventoryAdjustment);
router.post('/v1/netsuite/inventoryadjustmentprogress', netSuiteInvAdjCtrl.inventoryAdjustmentProgress);
router.post('/v1/netsuite/inventoryrelief', netSuiteInvAdjCtrl.inventoryRelief);
router.post('/v1/netsuite/inventoryadjustmentlog', netSuiteInvAdjCtrl.inventoryAdjustmentLog);
router.post('/v1/netsuite/importFrankyProcess', netSuiteInvAdjCtrl.importFrankyProcess);

module.exports = router;
