const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/products");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  // rename file to prevenct collision
  // format: product-<timestamp>-<random>.<ext>
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLocaleLowerCase();
    const unique = `${Date.now()}-${Math.random(Math.random() * 1e9)}`;
    cb(null, `product-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP images are allowed", false));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB max
  },
});

module.exports = upload;
