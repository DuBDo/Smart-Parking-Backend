const {
  initiateEsewaPayment,
  esewaSuccess,
  esewaFailure,
} = require("../controllers/payment.controller");

const router = require("express").Router();

router.post("/esewa/initiate", initiateEsewaPayment);
router.get("/esewa/success", esewaSuccess);
router.get("/esewa/failure", esewaFailure);

module.exports = router;
