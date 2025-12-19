const isAuthenticated = require("../middlewares/isAuthenticated");
const {
  initiateEsewaPayment,
  esewaSuccess,
  esewaFailure,
  initiateKhaltiPayment,
  khaltiSuccess,
} = require("../controllers/payment.controller");

const router = require("express").Router();

//Esewa
router.post("/esewa/initiate", initiateEsewaPayment);
router.get("/esewa/success", esewaSuccess);
router.get("/esewa/failure", esewaFailure);

//Khalti
router.post("/khalti/initiate", isAuthenticated, initiateKhaltiPayment);
router.get("/khalti/success", khaltiSuccess);
module.exports = router;
