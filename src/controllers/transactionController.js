const prisma = require("../config/prisma");
const { error, success } = require("../utils/response");

/**
 * Invoice number generator: INV-YYYYMMDD-XXXX
 */
async function generateInvoiceNo(params) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `INV-${yyyy}${mm}${dd}`;

  const startOfDay = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  const endOfDay = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);

  const count = await prisma.transaction.count({
    where: { created_at: { gte: startOfDay, lte: endOfDay } },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}-${sequence}`;
}

/**
 * POST /api/transactions
 * Admin & Cashier: create a new transaction
 *
 * Body:
 * {
 *   payment_method: 'Cash' | 'Qris' | 'BankTransfer',
 *   amount_paid: 50000,      // required for Cash, optional for Qris/BankTransfer
 *   items: [
 *     { productsId: 'uuid', quantity: 2 },
 *     { productsId: 'uuid', quantity: 0.5 }
 *   ]
 * }
 */
async function createTransaction(req, res) {
  try {
    const { payment_method = "Cash", amount_paid, items } = req.body;

    const VALID_METHOD = ["Cash", "Qris", "BackTransfer"];
    if (!VALID_METHOD.includes(payment_method))
      return error(
        res,
        `payment method must be one of: ${VALID_METHOD.join(", ")}`,
        400,
      );

    if (!items || !Array.isArray(items) || items.length === 0)
      return error(res, "items must be a non-empty array", 400);

    // validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productsId)
        return error(res, `item[${i}].producstId is required`, 400);
      if (!item.quantity || parseFloat(item.quantity) <= 0)
        return error(res, `item[${i}].quantity must be greater than 0`, 400);
    }

    // check for duplicate items
    const ids = items.map((i) => i.productsId);
    if (new Set(ids).size !== ids.length)
      return error(
        res,
        "Duplicate products in items. Combine them into one entry instead",
        400,
      );

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, is_active: true },
    });

    // check all product were found
    if (products.length !== ids.length) {
      const foundIds = products.map((p) => p.id);
      const missingId = ids.find((id) => !foundIds.includes(id));
      return error(res, `Product not found or inactive: ${missingId}`, 404);
    }

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    // check stock availability for all items
    for (const item of items) {
      const product = productMap[item.productsId];
      const qty = parseFloat(item.quantity);

      if (parseFloat(product.stock) < qty)
        return (
          error(
            res,
            `Insufficient stock for "${product.name}". Available: ${product.stock} ${product.unit}, requested: ${qty}`,
          ),
          400
        );
    }

    // calculate total
    const lineItems = items.map((item) => {
      const product = productMap[item.productsId];
      const qty = parseFloat(item.quantity);
      const price = parseFloat(product.price);
      const subtotal = parseFloat((qty * price).toFixed(2));
      return { product, qty, price, subtotal };
    });

    const total = parseFloat(
      lineItems.reduce((sum, li) => sum + li.subtotal, 0).toFixed(2),
    );

    // validate cash payment
    if (payment_method === "Cash") {
      if (amount_paid === undefined)
        return error(res, "amount_paid is required for cash payment", 490);
      if (parseFloat(amount_paid) < total)
        return error(
          res,
          `amount_paid (${amount_paid}) is less than total (${total})`,
          400,
        );
    }

    const paid = amount_paid !== undefined ? parseFloat(amount_paid) : null;
    const change = paid !== null ? parseFloat(paid - total).toFixed(2) : null;

    // build invoide number
    const invoice_no = await generateInvoiceNo();

    // start transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // crate transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          invoice_no,
          cashierId: req.user.id,
          payment_method,
          total,
          amount_paid: paid,
          change,
          status: "completed",
          transactionItems: {
            create: lineItems.map((li) => ({
              productsId: li.product.id,
              product_name: li.product.name,
              quantity: li.qty,
              unit_price: li.price,
              sub_total: li.subtotal,
            })),
          },
        },
        include: {
          transactionItems: true,
          cashier: { select: { id: true, name: true } },
        },
      });

      // decrement stock and write inventory log for each item
      for (const li of lineItems) {
        await tx.product.update({
          where: { id: li.product.id },
          data: { stock: { decrement: li.qty } },
        });

        await tx.inventoryLog.create({
          data: {
            productsId: li.product.id,
            type: "sale",
            quantity: -li.qty,
            note: `Sale - invoice ${invoice_no}`,
            created_by: req.user.id,
          },
        });
      }

      return newTransaction;
    });

    return success(
      res,
      { transaction },
      "Transaction created successfully",
      201,
    );
  } catch (err) {
    console.error("createTransaction error: ", err);
    return error(res, "Failed to create transaction", 500);
  }
}

/**
 * GET /api/transactions
 * Cashier: their own transaction only
 * Admin: all transactions
 * Query: ?status=, ?payment-method=, ?date=YYYY-MM-DD, ?page=, ?limit=
 */
async function listTransactions(req, res) {
  try {
    const {
      status = "",
      payment_method = "",
      date = "",
      page = "1",
      limit = "20",
    } = req.query;

    const where = {};

    if (req.user.role === "cashier") where.cashierId = req.user.id;
    if (status) where.status = status;
    if (payment_method) where.payment_method = payment_method;

    if (date) {
      const day = new Date(date);
      if (isNaN(day))
        return error(
          res,
          "Invalid date format. Use YYYY-MM-DD format instead",
          400,
        );
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where.created_at = { gte: day, lt: nextDay };
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: "desc" },
        include: {
          cashier: { select: { id: true, name: true } },
          transactionItems: {
            include: { product: { select: { id: true, unit: true } } },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return success(res, {
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("listTransactions error: ", err);
    return error(res, "Failed to fetch transactions", 500);
  }
}

/**
 * GET /api/transactions/:id
 * Cashier: their own transaction only
 * Admin: any transaction
 */
async function getTransaction(req, res) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        cashier: { select: { id: true, name: true } },
        transactionItems: {
          include: { product: { select: { id: true, unit: true } } },
        },
      },
    });

    if (!transaction) return error(res, "Transaction not found", 404);

    // cashier cannot view other cashier's transactions
    if (req.user.role === "cashier" && transaction.cashierId !== req.user.id) {
      return error(res, "Transaction not found", 404);
    }

    return success(res, { transaction });
  } catch (err) {}
}

/**
 * POST /api/transactions/:id/void
 * Cashier: can void their own transaction only
 * Admin: can void any transaction
 * Body: { reason } - required
 *
 * Voiding restores stock for all items and logs each reversal
 */
async function voidTransaction(req, res) {
  try {
    const { reason } = req.body;

    if (!reason?.trim())
      return error(res, "Reason is required to void transaction", 400);

    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { transactionItems: true },
    });

    if (!transaction) return error(res, "Transaction not found", 404);

    // cashier can only void their own transaction
    if (req.user.role === "cashier" && transaction.cashierId !== req.user.id)
      return error(res, "Transaction not found", 404);

    if (transaction.status === "canceled")
      return error(res, "Transaction is already voided", 400);

    // start transaction: update status + resoter stock + write logs
    await prisma.$transaction(async (tx) => {
      // mark status canceled
      await tx.transaction.update({
        where: { id: req.params.id },
        data: { status: "canceled" },
      });

      // restore stock and log each reversal
      for (const item of transaction.transactionItems) {
        await tx.product.update({
          where: { id: item.productsId },
          data: { stock: { increment: parseFloat(item.quantity) } },
        });

        await tx.inventoryLog.create({
          data: {
            productsId: item.productsId,
            type: "void",
            quantity: parseFloat(item.quantity),
            note: `Void invoice ${transaction.invoice_no}: ${reason.trim()}`,
            created_by: req.user.id,
          },
        });
      }
    });

    return success(
      res,
      null,
      `Transaction ${transaction.invoice_no} has been voided and stock restored`,
    );
  } catch (err) {
    console.error("voidTransaction error: ", err);
    return error(res, "Failed to void transaction", 500);
  }
}

module.exports = {
  createTransaction,
  listTransactions,
  getTransaction,
  voidTransaction,
};
