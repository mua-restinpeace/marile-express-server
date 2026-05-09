const prisma = require("../config/prisma");
const { error, success } = require("../utils/response");

function toLocalDateKey(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


function toLocalMonthKey(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}


function getPeriodRange(period = "today") {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case "week":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    default:
      break;
  }

  return { start, end: now };
}

function getChartRange(range = "30d") {
  const end = new Date();
  const start = new Date();

  if (range === "12m") {
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function fillDailyGaps(data, start, end) {
  console.log(data);
  const map = Object.fromEntries(data.map((d) => [d.date, d]));
  console.log({map});
  const result = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = toLocalDateKey(cursor);
    console.log(key);
    result.push(map[key] ?? { date: key, revenue: 0, transactions: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function fillMonthlyGaps(data, start, end) {
  const map = Object.fromEntries(data.map((d) => [d.month, d]));
  const result = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const key = toLocalMonthKey(cursor);

    result.push(map[key] ?? { month: key, revenue: 0, transactions: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

/**
 * GET /api/dashboard/summary
 * Overview numbers of given period
 * Query: ?period=today|week|month (default: today)
 */
async function getSummary(req, res) {
  try {
    const { period = "today" } = req.body;

    const VALID_PERIOD = ["today", "week", "month"];
    if (!VALID_PERIOD.includes(period))
      return error(
        res,
        `period must be one of: ${VALID_PERIOD.join(", ")}`,
        400,
      );

    const { start, end } = getPeriodRange(period);

    const transactions = await prisma.transaction.findMany({
      where: { status: "completed", created_at: { gte: start, lte: end } },
      include: { transactionItems: true },
    });

    const totalRevenue = transactions.reduce(
      (sum, t) => sum + parseFloat(t.total),
      0,
    );
    const totalTransactions = transactions.length;
    const totalItemsSold = transactions.reduce(
      (sum, t) =>
        sum +
        t.transactionItems.reduce((s, i) => s + parseFloat(i.quantity), 0),
      0,
    );
    const averageOrderValue =
      totalTransactions > 0
        ? parseFloat((totalRevenue / totalTransactions).toFixed(2))
        : 0;

    const voidedCount = await prisma.transaction.count({
      where: { status: "canceled", created_at: { gte: start, lte: end } },
    });

    return success(res, {
      period,
      date_range: { from: start, to: end },
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_transactions: totalTransactions,
      total_items_sold: parseFloat(totalItemsSold.toFixed(2)),
      average_order_value: averageOrderValue,
      voided_count: voidedCount,
    });
  } catch (err) {
    console.error("getSummary error: ", err);
    return error(res, "Failed to fecth summary", 500);
  }
}

/**
 * GET /api/dashboard/revenue-chart
 * day-by-day or month-by-month revenue trend
 * Query: ?range=30d|12m (default: 30d)
 */
async function getRevenueChart(req, res) {
  try {
    const { range = "30d" } = req.body;

    const VALID_RANGES = ["30d", "12m"];
    if (!VALID_RANGES.includes(range))
      return error(
        res,
        `range mush be one of: ${VALID_RANGES.join(", ")}`,
        400,
      );

    const { start, end } = getChartRange(range);

    const transactions = await prisma.transaction.findMany({
      where: { status: "completed", created_at: { gte: start, lte: end } },
      select: { total: true, created_at: true },
    });

    if (range === "12m") {
      // group by YYYY-MM
      const grouped = {};
      for (const t of transactions) {
        const key = toLocalMonthKey(t.created_at);

        if (!grouped[key])
          grouped[key] = { month: key, revenue: 0, transactions: 0 };
        grouped[key].revenue += parseFloat(t.total);
        grouped[key].transactions += 1;
      }

      const raw = Object.values(grouped).map((d) => ({
        ...d,
        revenue: parseFloat(d.revenue.toFixed(2)),
      }));

      const data = fillMonthlyGaps(raw, start, end);

      return success(res, { range, data });
    } else {
      // grouped by YYYY-MM-DD
      const grouped = {};
      for (const t of transactions) {
        const key = toLocalDateKey(t.created_at);

        if (!grouped[key])
          grouped[key] = { date: key, revenue: 0, transactions: 0 };
        grouped[key].revenue += parseFloat(t.total);
        grouped[key].transactions += 1;
      }

      const raw = Object.values(grouped).map((d) => ({
        ...d,
        revenue: parseFloat(d.revenue.toFixed(2)),
      }));

      const data = fillDailyGaps(raw, start, end);
      return success(res, { range, data });
    }
  } catch (err) {
    console.error("getRevenueChart error: ", err);
    return error(res, "Failed to fetch revenue chart", 500);
  }
}

/**
 * GET /api/dashboard/top-products
 * Top 5 products by quantity sold and revenue
 * Query: ?period=today|week|month|all (default: today)
 */
async function getTopProducts(req, res) {
  try {
    const { period = "today" } = req.body;

    const VALID_PERIODS = ["today", "week", "month", "all"];
    if (!VALID_PERIODS.includes(period))
      return error(
        res,
        `period must be one of: ${VALID_PERIODS.join(", ")}`,
        400,
      );

    const dateFilter = period !== "all" ? getPeriodRange(period) : null;

    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          status: "completed",
          ...(dateFilter && {
            created_at: { gte: dateFilter.start, lte: dateFilter.end },
          }),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            stock: true,
            unit: true,
          },
        },
      },
    });

    // aggregate per product
    const productMap = {};
    for (const item of items) {
      const pid = item.productsId;
      if (!productMap[pid]) {
        productMap[pid] = {
          product_id: pid,
          product_name: item.product_name,
          category: item.product.category,
          unit: item.product.unit,
          current_stock: parseFloat(item.product.stock),
          total_qty_sold: 0,
          total_revenue: 0,
          total_orders: 0,
        };
      }

      productMap[pid].total_qty_sold += parseFloat(item.quantity);
      productMap[pid].total_revenue += parseFloat(item.sub_total);
      productMap[pid].total_orders += 1;
    }

    const allProducts = Object.values(productMap).map((p) => ({
      ...p,
      total_qty_sold: parseFloat(p.total_qty_sold.toFixed(2)),
      total_revenue: parseFloat(p.total_revenue.toFixed(2)),
    }));

    // top 5 products by quantity sold
    const byQuantity = [...allProducts]
      .sort((a, b) => b.total_qty_sold - a.total_qty_sold)
      .slice(0, 5);

    // top 5 products by revenue
    const byRevenue = [...allProducts]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);

    return success(res, {
      period,
      top_by_quantity: byQuantity,
      top_by_revenue: byRevenue,
    });
  } catch (err) {
    console.error("getTopProducts error: ", err);
    return error(res, "Failed to fetch top products", 500);
  }
}

/**
 * GET /api/dashboard/snapshot
 * Operational overview:
 *  - low sotck alerts (stock <= 5)
 *  - cashier active today
 *  -last 5 transactions
 */
async function getSnapshot(req, res) {
  try {
    const { start: todayStart, end: todayEnd } = getPeriodRange("today");

    const [lowStock, cashierActivity, recentTrasnactions] = await Promise.all([
      // products at low stock
      prisma.product.findMany({
        where: { is_active: true, stock: { lte: 5 } },
        orderBy: { stock: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          stock: true,
          unit: true,
        },
      }),

      // per-cashier transaction count today
      prisma.transaction.groupBy({
        by: ["cashierId"],
        where: { created_at: { gte: todayStart, lte: todayEnd } },
        _count: { id: true },
        _sum: { total: true },
      }),

      // last 5 recent transaction accross all cashier
      prisma.transaction.findMany({
        orderBy: { created_at: "desc" },
        take: 5,
        select: {
          id: true,
          invoice_no: true,
          total: true,
          payment_method: true,
          status: true,
          created_at: true,
          cashier: { select: { id: true, name: true } },
        },
      }),
    ]);

    // enrich cashier activity with names
    const cashierIds = cashierActivity.map((c) => c.cashierId);
    const cashiers = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, name: true },
    });
    const cashierMap = Object.fromEntries(cashiers.map((c) => [c.id, c.name]));

    const enrichedActivity = cashierActivity
      .map((c) => ({
        cashier_id: c.cashierId,
        cashier_name: cashierMap[c.cashierId] ?? "Unknown",
        transaction_today: c._count.id,
        revenue_today: parseFloat((c._sum.total ?? 0).toFixed(2)),
      }))
      .sort((a, b) => b.transaction_today - a.transaction_today);

    return success(res, {
      low_stock: {
        threshold: 5,
        count: lowStock.length,
        products: lowStock,
      },
      cashier_activity: enrichedActivity,
      recentTrasnactions: recentTrasnactions,
    });
  } catch (err) {
    console.error("getSnapshot error: ", err);
    return error(res, "Failed to fetch snapshot", 500);
  }
}

module.exports = { getSummary, getRevenueChart, getTopProducts, getSnapshot };
