const prisma = require("../config/prisma");
const { Unit } = require("../generated/prisma");
const { error, success } = require("../utils/response");

/**
 * POST /api/v1/inventory/restock
 * Admin only: add stock to a product, always logged into inventory log
 * body: { product_id, quantity, note? }
 */
async function restock(req, res) {
  try {
    const { product_id, quantity, note } = req.body;

    if (!product_id) return error(res, "ProductId is required", 400);
    if (!quantity) return error(res, "Quantity is required", 400);
    if (parseFloat(quantity) <= 0)
      return error(res, "Quantity must be greater than 0", 400);

    const product = await prisma.product.findUnique({
      where: { id: product_id },
    });
    if (!product) return error(res, "Product not found", 404);
    if (!product.is_active)
      return error(res, "Cannot restock a deactivated product", 400);

    const qty = parseFloat(quantity);

    const [updatedProduct, log] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product_id },
        data: { stock: { increment: qty } },
      }),
      prisma.inventoryLog.create({
        data: {
          productsId: product_id,
          type: "restock",
          quantity: qty,
          note: note?.trim() ?? null,
          created_by: req.user.id,
        },
      }),
    ]);

    return success(
      res,
      {
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          stock: updatedProduct.stock,
          unit: updatedProduct.unit,
        },
        log,
      },
      `Restccked ${qty} ${updatedProduct.unit} of "${updatedProduct.name}"`,
      201,
    );
  } catch (err) {
    console.log("Restock failed: ", err);
    return error(res, "Failed to restock product", 500);
  }
}

/**
 * POST /api/v1/inventory/adjust
 * Admin only: manually correct stock (can increase or decrease)
 * body: { product_id, quantity, note}
 * quantity: positve = add, negative = subtract
 */
async function adjust(req, res) {
  try {
    const { product_id, quantity, note } = req.body;

    if (!product_id) return error(res, "ProductId is required", 400);
    if (quantity === undefined) return error(res, "Quantity is required", 400);
    if (parseFloat(quantity) === 0)
      return error(res, "Quantity connot be 0", 400);
    if (!note?.trim())
      return error(res, "Note is required for product adjustment", 400);

    const product = await prisma.product.findUnique({
      where: { id: product_id },
    });
    if (!product) return error(res, "Product not found", 404);

    const qty = parseFloat(quantity);
    const newStock = parseFloat(product.stock) + qty;

    if (newStock < 0)
      return error(
        res,
        `Adjustment would result in negative stock. Current stock: ${product.stock} ${product.unit}`,
        400,
      );

    const [updatedProduct, log] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product_id },
        data: { stock: newStock },
      }),
      prisma.inventoryLog.create({
        data: {
          productsId: product_id,
          type: "adjustment",
          quantity: qty,
          note: note?.trim(),
          created_by: req.user.id,
        },
      }),
    ]);

    return success(
      res,
      {
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          stock: updatedProduct.stock,
          unit: updatedProduct.unit,
        },
        log,
      },
      `Stock adjusted by ${qty > 0 ? "+" : ""}${qty} ${updatedProduct.unit}`,
      201,
    );
  } catch (err) {
    console.log("Adjust error: ", err);
    return error(res, "Failed to adjust stock", 500);
  }
}

/**
 * GET /api/v1/inventory/logs
 * Admin only: paginated inventory log history
 * query: ?product_id=, ?type=, ?page=, ?limit=
 */
async function getLogs(req, res) {
  try {
    const { product_id: products_id = "", type = "", page = 1, limit = 20 } = req.query;
    const VALID_TYPES = ["restock", "adjustment", "sale", "void"];
    if (type && !VALID_TYPES.includes(type))
      return error(res, `type must be one of: ${VALID_TYPES.join(", ")}`, 400);

    const where = {
      ...(products_id && { products_id }),
      ...(type && { type }),
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await prisma.$transaction([
      prisma.inventoryLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: "desc" },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.inventoryLog.count({ where }),
    ]);

    return success(res, {
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.log("getLogs error: ", err);
    return error(res, "Failed to fetch inventory logs", 500);
  }
}

/**
 * GET /api/inventory/low-stock
 * Admin only: get products stock below threshold
 * query: ?threshold= (default: 5)
 */
async function getLowStock(req, res) {
  try {
    const threshold = parseFloat(req.query.threshold ?? "5");

    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        stock: { lte: threshold },
      },
      orderBy: { stock: "asc" },
      select: { id: true, name: true, category: true, stock: true, unit: true },
    });

    return success(res, { products, threshold });
  } catch (err) {
    console.log("getLowStock error: ", err);
    return error(res, "Failed to fetch low stock product", 500);
  }
}

module.exports = { restock, adjust, getLogs, getLowStock };
