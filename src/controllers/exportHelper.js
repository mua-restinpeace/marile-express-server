const prisma = require("../config/prisma");

/**
 * Parse and validate query params for exports enpoint.
 * Support:
 *  ?period=today|week|month
 *  ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * Custom range takes priority over period
 */

function resolveDateRange(query) {
  const { period, start_date, end_date } = query;

  // custom range
  if (start_date || end_date) {
    if (!start_date || !end_date)
      return {
        error: "Both start_date and end_date are required for a custom range",
      };

    const start = new Date(start_date);
    const end = new Date(end_date);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start) || isNaN(end))
      return { error: "Invalid date format. Use YYYY-MM-DD" };

    if (start > end) return { error: "start_date connot be after end_date" };

    return { start, end, label: `${start_date} to ${end_date}` };
  }

  // preset period
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
    default:
      start.setHours(0, 0, 0, 0);
      break;
  }

  const periodLabel = {
    today: "Today",
    week: "This Week",
    month: "This Month",
  };
  return { start, end: now, label: periodLabel[period] || "Today" };
}

/**
 * Fetch complete sales report data for a given date range.
 * Returns transactions with items, summary totals, and per-product breakdown.
 */

async function fetchSalesData(start, end) {
  const transactions = await prisma.transaction.findMany({
    where: {
      status: "completed",
      created_at: { gte: start, lte: end },
    },
    include: {
      cashier: { select: { name: true } },
      transactionItems: {
        include: { product: { select: { name: true, unit: true } } },
      },
    },
    orderBy: { created_at: "asc" },
  });

  // summary totals
  const totalRevenue = transactions.reduce(
    (sum, t) => sum + parseFloat(t.total),
    0,
  );
  const totalTransactions = transactions.length;
  const totalItemSold = transactions.reduce(
    (sum, t) =>
      sum + t.transactionItems.reduce((s, i) => s + parseFloat(i.quantity), 0),
    0,
  );

  const voidedCount = await prisma.transaction.count({
    where: { status: "canceled", created_at: { gte: start, lte: end } },
  });

  // per-product breakdown
  const productMap = {};
  for (const t of transactions) {
    for (const item of t.transactionItems) {
      const pid = item.productsId;
      if (!productMap[pid]) {
        productMap[pid] = {
          name: item.product_name,
          unit: item.product.unit,
          qty_sold: 0,
          revenue: 0,
          orders: 0,
        };
      }

      productMap[pid].qty_sold += parseFloat(item.quantity);
      productMap[pid].revenue += parseFloat(item.sub_total);
      productMap[pid].orders += 1;
    }
  }

  const productBreakdown = Object.values(productMap).sort(
    (a, b) => b.revenue - a.revenue,
  );

  return {
    transactions,
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalTransactions,
      totalItemsSold: parseFloat(totalItemSold.toFixed(3)),
      voidedCount,
      averageOrderValue:
        totalTransactions > 0
          ? parseFloat((totalRevenue / totalTransactions).toFixed(2))
          : 0,
    },
    productBreakdown,
  };
}

/**
 * Format a number as Indonesian rupiah
 */
function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a Date to local DD/MM/YYYY HH:mm
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a Date to local DD/MM/YYYY
 */
function formatDateOnly(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

module.exports = {
  resolveDateRange,
  fetchSalesData,
  formatRupiah,
  formatDate,
  formatDateOnly,
};
