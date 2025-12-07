const express = require('express');
const isAuthenticated = require('../middlewares/isAuthenticated');
const { listParkingLot, getParkingLot } = require('../controllers/parkinglot.controller');
const {} = require('../middlewares/multer.middlerware');
const upload = require('../middlewares/multer.middlerware');

const parkingRouter = express.Router();

parkingRouter.get('/', getParkingLot);
parkingRouter.post("/",isAuthenticated, upload.array("photos", 10), listParkingLot);

module.exports = parkingRouter;