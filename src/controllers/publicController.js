const prisma = require("../config/prisma");
const { error, success } = require("../utils/response");

/**
 * GET /api/public/menu
 * get best seller products and menus
 * Query: ?take=(default: 8), ?category= (default: protein)
 */
async function getMenu(req, res) {
  try {
    const { take = "8", category = "protein" } = req.query;

    const VALID_CATGORIES = ["protein", "sayur", "buah", "lainnya"];
    if (!VALID_CATGORIES.includes(category))
      return error(
        res,
        `category must be one of: ${VALID_CATGORIES.join(", ")}`,
      );

    // fetch best seller product
    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          status: "completed",
        },
        product: {
          category: category,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image_url: true,
            price: true,
          },
        },
      },
    });

    // agregate per product
    const productMap = {};
    for (const item of items) {
      const pid = item.productsId;
      if (!productMap[pid]) {
        productMap[pid] = {
          product_id: pid,
          product_name: item.product_name,
          price: parseFloat(item.product.price),
          image_url: item.product.image_url,
          total_qty_sold: 0,
        };
      }

      productMap[pid].total_qty_sold += parseFloat(item.quantity);
    }

    const allProducts = Object.values(productMap).map((p) => ({
      ...p,
      total_qty_sold: parseFloat(p.total_qty_sold.toFixed(3)),
    }));

    const bestSeller = [...allProducts]
      .sort((a, b) => b.total_qty_sold - a.total_qty_sold)
      .slice(0, 5);

    if (bestSeller.length === 0) {
      const fallBack = await prisma.product.findMany({
        where: { category, is_active: true },
        select: { id: true, name: true, image_url: true, price: true },
        take: 5,
        orderBy: { created_at: "desc" },
      });

      bestSeller = fallBack.map((p) => ({
        product_id: p.id,
        product_name: p.name,
        price: parseFloat(p.price),
        image_url: p.image_url,
        total_qty_sold: 0,
      }));
    }

    // get main menu
    const limitNum = Math.min(100, Math.max(1, parseInt(take)));
    const menu = await prisma.product.findMany({
      where: {
        category: category,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        image_url: true,
        price: true,
      },
      take: limitNum,
      orderBy: { created_at: "desc" },
    });

    return success(res, {
      best_seller: bestSeller,
      menu: menu,
    });
  } catch (err) {
    console.error("getMenu error: ", err);
    return error(res, "Failed to fetch menu", 500);
  }
}

module.exports = { getMenu };
