const ExcelJS = require("exceljs");
const { error } = require("../utils/response");
const {
  resolveDateRange,
  fetchSalesData,
  formatDateOnly,
  formatRupiah,
  formatDate,
} = require("./exportHelper");

/**
 * GET /api/export/sales/excel
 * Admin only: streams an Excel (.xlxx) sales report directly to the client
 * Query: ?period=today|week|month OR ?start_end=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
async function exportSalesExcel(req, res) {
  try {
    // resolve date range
    const range = resolveDateRange(req.query);
    if (range.error) return error(res, range.error, 400);

    const { start, end, label } = range;

    // fetch sales data
    const { transactions, summary, productBreakdown } = await fetchSalesData(
      start,
      end,
    );

    // build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Marile-System";
    workbook.created = new Date();

    // ── Reusable style helpers ──────────────────────────────────────────────
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333333" },
    };
    const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    const altFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF9F9F9" },
    };
    const titleFont = { bold: true, size: 14 };
    const labelFont = { bold: true, size: 10 };
    const borderStyle = { style: "thin", color: { argb: "FFCCCCCC" } };
    const allBorders = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle,
    };
    const rupiahFmt = '"Rp"#,##0';

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 1 — Summary
    // ════════════════════════════════════════════════════════════════════════
    const summarySheet = workbook.addWorksheet("Ringkasan");
    summarySheet.columns = [{ width: 30 }, { width: 25 }];

    // Title
    summarySheet.mergeCells("A1:B1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = "LAPORAN PENJUALAN — MARILE";
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center" };

    summarySheet.mergeCells("A2:B2");
    const periodeCell = summarySheet.getCell("A2");
    periodeCell.value = `Periode: ${label}  (${formatDateOnly(start)} — ${formatDateOnly(end)})`;
    periodeCell.font = { size: 10, color: { argb: "FF666666" } };
    periodeCell.alignment = { horizontal: "center" };

    summarySheet.addRow([]);

    // Summary table
    const summaryData = [
      ["Total Pendapatan", summary.totalRevenue],
      ["Total Transaksi", summary.totalTransactions],
      ["Rata-rata per Order", summary.averageOrderValue],
      ["Total Item Terjual", summary.totalItemsSold],
      ["Transaksi Dibatalkan", summary.voidedCount],
      ["Dicetak pada", formatDate(new Date())],
    ];

    for (const [label_, value] of summaryData) {
      const row = summarySheet.addRow([label_, value]);
      row.getCell(1).font = labelFont;
      row.getCell(1).border = allBorders;
      row.getCell(2).border = allBorders;

      // Format currency cells
      if (["Total Pendapatan", "Rata-rata per Order"].includes(label_)) {
        row.getCell(2).numFmt = rupiahFmt;
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 2 — Product Breakdown
    // ════════════════════════════════════════════════════════════════════════
    const productSheet = workbook.addWorksheet("Penjualan per Produk");
    productSheet.columns = [
      { header: "Produk", key: "name", width: 35 },
      { header: "Qty Terjual", key: "qty", width: 15 },
      { header: "Satuan", key: "unit", width: 10 },
      { header: "Jml Transaksi", key: "orders", width: 15 },
      { header: "Pendapatan", key: "revenue", width: 20 },
    ];

    // Style header row
    const productHeader = productSheet.getRow(1);
    productHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = allBorders;
      cell.alignment = { horizontal: "center" };
    });
    productHeader.height = 20;

    // Data rows
    productBreakdown.forEach((p, i) => {
      const row = productSheet.addRow({
        name: p.name,
        qty: p.qty_sold,
        unit: p.unit,
        orders: p.orders,
        revenue: p.revenue,
      });
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = altFill;
        });
      }
      row.eachCell((cell) => {
        cell.border = allBorders;
      });
      row.getCell("revenue").numFmt = rupiahFmt;
    });

    // Totals row
    if (productBreakdown.length > 0) {
      const totalRow = productSheet.addRow({
        name: "TOTAL",
        qty: null,
        unit: null,
        orders: summary.totalTransactions,
        revenue: summary.totalRevenue,
      });
      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8E8E8" },
        };
        cell.border = allBorders;
      });
      totalRow.getCell("revenue").numFmt = rupiahFmt;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 3 — Transaction Detail
    // ════════════════════════════════════════════════════════════════════════
    const txSheet = workbook.addWorksheet("Detail Transaksi");
    txSheet.columns = [
      { header: "No. Invoice", key: "invoice", width: 22 },
      { header: "Tanggal", key: "date", width: 20 },
      { header: "Kasir", key: "cashier", width: 18 },
      { header: "Metode", key: "method", width: 14 },
      { header: "Total", key: "total", width: 18 },
      { header: "Dibayar", key: "paid", width: 18 },
      { header: "Kembalian", key: "change", width: 18 },
      { header: "Item", key: "items", width: 35 },
    ];

    // Style header row
    const txHeader = txSheet.getRow(1);
    txHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = allBorders;
      cell.alignment = { horizontal: "center" };
    });
    txHeader.height = 20;

    // Data rows
    transactions.forEach((t, i) => {
      const itemsSummary = t.transactionItems
        .map((item) => `${item.product_name} x${parseFloat(item.quantity)}`)
        .join(", ");

      const row = txSheet.addRow({
        invoice: t.invoice_no,
        date: formatDate(t.created_at),
        cashier: t.cashier.name,
        method: t.payment_method,
        total: parseFloat(t.total),
        paid: t.amount_paid ? parseFloat(t.amount_paid) : null,
        change: t.change ? parseFloat(t.change) : null,
        items: itemsSummary,
      });

      if (i % 2 === 0)
        row.eachCell((cell) => {
          cell.fill = altFill;
        });
      row.eachCell((cell) => {
        cell.border = allBorders;
      });

      row.getCell("total").numFmt = rupiahFmt;
      row.getCell("paid").numFmt = rupiahFmt;
      row.getCell("change").numFmt = rupiahFmt;
    });

    // stram workbook to response
    const filename = `laporan-penjualan-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportSalesExcel error: ", err);
    if (!res.headersSent) {
      return error(res, "Failed to generate Excel report", 500);
    }
    res.end();
  }
}

module.exports = { exportSalesExcel };
