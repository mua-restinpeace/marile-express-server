const express = require("express");
const { getMenu } = require("../controllers/publicController");

const router = express.Router();

router.get('/menu', getMenu);

module.exports  = router;