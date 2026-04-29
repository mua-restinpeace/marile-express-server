const prisma = require("../config/prisma");
const { success, error } = require("../utils/response");

const VALID_CATEGORIES = ["sayur", "protein", "buah"];
const VALID_UNITS = ["kg", "pcs", "ekor"];

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
 */
async function createProduct(req, res) {
  try {
    const { name, description, category, price, stock, unit, image_url } =
      req.body;

    const errs = validateProductBody(req.body, false);
    if (errs.length) return error(res, errs.join(", "), 400);

    const existingProduct = await prisma.product.findFirst({
      where: { name: name.trim() },
    });
    if (existingProduct)
      return error(res, "A product with this name already exists", 409);

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        category: category,
        price: parseFloat(price),
        stock: stock !== undefined ? parseFloat(stock) : 0,
        unit: unit ?? "kg",
        image_url: image_url?.trim() ?? null,
      },
    });

    return success(res, { product }, 201);
  } catch (err) {
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
    const { name, description, category, price, unit, image_url, is_active } =
      req.body;

    // disallow stock update
    if (req.body.stock !== undefined)
      return error(
        res,
        "Stock cannot be changed directly. Use the inventory restock or adjustment endpoint",
        400,
      );

    const errs = validateProductBody(req.body, true);
    if (errs.length) return error(res, errs.join(", "), 400);

    const product = await prisma.product.findFirst({
      where: { id: req.params.id },
    });
    if (!product) return error(res, "Product not found", 404);

    if (name && name.trim() !== product.name) {
      const nameTaken = await prisma.product.findFirst({
        where: { name: name.trim() },
      });
      if (nameTaken)
        return error(res, "A product with this name already exists", 409);
    }

    const updatedProduct = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(category !== undefined && { category }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(unit !== undefined && { unit }),
        ...(image_url !== undefined && { image_url: image_url.trim() }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return success(res, { updateProduct });
  } catch (err) {
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
      select: { _count: { select: { transactionItems: true } } },
    });

    if(!product) return error(res, 'Product not found', 404);

    if(product._count.transactionItems > 0){
      await prisma.product.update({
        where: {id: req.params.id},
        data: {is_active: false},
      });

      return success(res, null, 'Product deactivated (has transaction history, cannot permanently deleted)');
    }

    await prisma.product.delete({where: {id: req.params.id}});
    return success(res, 'Product permanently deleted');
  } catch (err) {
    if(err.code === 'P2025') return error(res, 'Product not found', 404);
    console.error('deleteProduct error: ', err);
    return error(res, 'Failed to delete product', 500);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
