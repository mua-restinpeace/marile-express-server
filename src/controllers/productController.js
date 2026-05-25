const prisma = require("../config/prisma");
const path = require("path");
const fs = require("fs");
const { success, error } = require("../utils/response");

const VALID_CATEGORIES = ["sayur", "protein", "buah"];
const VALID_UNITS = ["kg", "pcs", "ekor"];

// Helper: validate prodcut body
function validateProductBody(body, isUpdated = false) {
  const { name, category, price, unit } = body;
  const errs = [];

  if (!isUpdated) {
    if (!name) errs.push("name is required");
    if (!category) errs.push("category is required");
    if (!price) errs.push("price is required");
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category))
    errs.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);

  if (unit !== undefined && !VALID_UNITS.includes(unit))
    errs.push(`unit must be one of: ${VALID_UNITS.join(", ")}`);

  if (price !== undefined && (isNaN(price) || Number(price) < 0))
    errs.push("price must be a non-negative number");

  return errs;
}

// --Helper: delete image file from disk
function deleteImageFile(imageUrl) {
  if (!imageUrl) {
    console.error("deleteImageFile: imageUrl is null");
    return;
  }

  if (!imageUrl.startsWith("/uploads/")) {
    console.err("deleteImageFile: imageUrl didn't start with uploads");
    return;
  }

  const filePath = path.join(__dirname, "../../", imageUrl);
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error("Failed to delete image file: ", err);
    });
  }
}

// ---Helper: build image_url from uploaded file
function buildImageUrl(file) {
  if (!file) return null;

  return `/uploads/products/${file.filename}`;
}

/**
 * GET /api/products
 * Admin & cashier: full list of products and it's stock
 * query: ?search=, ?category=, ?unit=, ?is_active=, ?page=, ?limit=
 */
async function listProducts(req, res) {
  try {
    const {
      search = "",
      category = "",
      unit = "",
      is_active = "",
      page = "1",
      limit = "20",
    } = req.query;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
      ...(category && { category }),
      ...(unit && { unit }),
      ...(is_active !== "" && { is_active: is_active === "true" }),
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return success(res, {
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPage: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("listProducts error: ", err);
    return error(res, "Failed to fetch products", 500);
  }
}

/**
 * GET /api/products/:id
 * Admin & cashier: get specific product by its id
 */
async function getProduct(req, res) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) return error(res, "Product not found", 404);
    return success(res, { product });
  } catch (err) {
    console.error("getProduct error: ", err);
    return error(res, "Failed to fetch product", 500);
  }
}

/**
 * POST /api/products
 * Admin only: create a product
 * body: { name, description?, category, price, stock, unit, image_url?}
 * file: image (optional)
 */
async function createProduct(req, res) {
  try {
    const { name, description, category, price, stock, unit } = req.body;

    const errs = validateProductBody(req.body, false);
    if (errs.length) {
      // if validation fails, delete the uploaded file
      deleteImageFile(buildImageUrl(req.file));
      return error(res, errs.join(", "), 400);
    }

    const existingProduct = await prisma.product.findFirst({
      where: { name: name.trim() },
    });
    if (existingProduct) {
      deleteImageFile(buildImageUrl(req.file));
      return error(res, "A product with this name already exists", 409);
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        category: category,
        price: parseFloat(price),
        stock: stock !== undefined ? parseFloat(stock) : 0,
        unit: unit ?? "kg",
        image_url: buildImageUrl(req.file),
      },
    });

    return success(res, { product }, "Product created successfully", 201);
  } catch (err) {
    deleteImageFile(buildImageUrl(req.file));
    console.error("createProduct error: ", err);
    return error(res, "Failed to create product", 500);
  }
}

/**
 * PUT /api/products/:id
 * Admin only: partial update, stock excluded
 * body: { name?, description?, category?, price?, unit?, image_url?, is_active? }
 * params: id -> a product id
 */
async function updateProduct(req, res) {
  try {
    const { name, description, category, price, unit, is_active } = req.body;

    // disallow stock update
    if (req.body.stock !== undefined) {
      deleteImageFile(buildImageUrl(req.file));
      return error(
        res,
        "Stock cannot be changed directly. Use the inventory restock or adjustment endpoint",
        400,
      );
    }

    const errs = validateProductBody(req.body, true);
    if (errs.length) {
      deleteImageFile(buildImageUrl(req.file));
      return error(res, errs.join(", "), 400);
    }

    const product = await prisma.product.findFirst({
      where: { id: req.params.id },
    });
    if (!product) {
      deleteImageFile(buildImageUrl(req.file));
      return error(res, "Product not found", 404);
    }

    if (name && name.trim() !== product.name) {
      const nameTaken = await prisma.product.findFirst({
        where: { name: name.trim() },
      });
      if (nameTaken) {
        deleteImageFile(buildImageUrl(req.file));
        return error(res, "A product with this name already exists", 409);
      }
    }

    // if a new image was uploaded, delete the old one
    if (req.file) {
      deleteImageFile(buildImageUrl(product.image_url));
    }

    const updatedProduct = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(category !== undefined && { category }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(unit !== undefined && { unit }),
        ...(is_active !== undefined && {
          is_active: is_active === "true" || is_active === true,
        }),
        ...(req.file !== undefined && { image_url: buildImageUrl(req.file) }),
      },
    });

    return success(res, { updateProduct }, "Product updated successfully");
  } catch (err) {
    deleteImageFile(buildImageUrl(req.file));
    if (err.code === "P2025") return error(res, "Product not found", 404);
    console.error("updateProduct error: ", err);
    return error(res, "Failed to update product", 500);
  }
}

/**
 * DELETE /api/products/:id
 * Admin only: dactivate a product, delete if product has no transaction history
 */
async function deleteProduct(req, res) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { transactionItems: true } } },
    });

    if (!product) return error(res, "Product not found", 404);

    if (product._count.transactionItems > 0) {
      await prisma.product.update({
        where: { id: req.params.id },
        data: { is_active: false },
      });

      return success(
        res,
        null,
        "Product deactivated (has transaction history, cannot permanently deleted)",
      );
    }

    deleteImageFile(product.image_url);
    await prisma.product.delete({ where: { id: req.params.id } });
    return success(res, "Product permanently deleted");
  } catch (err) {
    if (err.code === "P2025") return error(res, "Product not found", 404);
    console.error("deleteProduct error: ", err);
    return error(res, "Failed to delete product", 500);
  }
}

/**
 * DELETE /api/products/:id/image
 * Admin only: remove product image without deleting the product
 */
async function deleteProductImage(req, res) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) return error(res, "Product not found", 404);
    if (!product.image_url) return error(res, "Product has no image", 400);

    deleteImageFile(product.image_url);
    await prisma.product.update({
      where: { id: req.params.id },
      data: { image_url: null },
    });

    return success(res, null, "Product image deleted");
  } catch (err) {
    console.error("deleteProductImage error: ", err);
    return error(res, "Failed to delete product image", 500);
  }
}
module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
};
