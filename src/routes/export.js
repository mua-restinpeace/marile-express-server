const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { exportSalesPdf } = require("../controllers/exportPdfController");
const { exportSalesExcel } = require("../controllers/exportExcelController");

router.use(authenticate);
router.use(authorize("admin"));

router.get("/sales/pdf", exportSalesPdf);
router.get("/sales/excel", exportSalesExcel);

module.exports = router;
