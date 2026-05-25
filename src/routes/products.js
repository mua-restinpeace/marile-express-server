const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
} = require("../controllers/productController");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("admin", "cashier"), listProducts);
router.get("/:id", authorize("admin", "cashier"), getProduct);

router.post("/", authorize("admin"), upload.single("image"), createProduct);
router.put("/:id", authorize("admin"), upload.single("image"), updateProduct);
router.delete("/:id", authorize("admin"), deleteProduct);
router.delete("/:id/image", authorize("admin"), deleteProductImage);

module.exports = router;
