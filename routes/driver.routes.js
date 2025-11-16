const express = require('express');
const isAuthenticated = require('../middlewares/isAuthenticated');
const { updateAccount, addVehicle } = require('../controllers/driver.crontroller');
const  upload = require('../middlewares/multer.middlerware');

const driverRouter = express.Router();

driverRouter.patch('/account', isAuthenticated, updateAccount);
driverRouter.post('/vehicle', isAuthenticated, upload.single('image'), addVehicle);

module.exports = driverRouter;