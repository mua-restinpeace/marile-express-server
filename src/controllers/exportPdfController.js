const PDFDocument = require("pdfkit");
const { error } = require("../utils/response");
const {
  resolveDateRange,
  fetchSalesData,
  formatRupiah,
  formatDate,
  formatDateOnly,
} = require("./exportHelper");

/**
 * GET /api/export/sales/pdf
 * Admin only: streams a PDF sales report direcly to the client
 * Query: ?period=today|week|month OR ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
async function exportSalesPdf(req, res) {
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

    // build PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    // set response headers so browser downloads it as a file
    const filename = `laporan-penjualan-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("LAPORAN PENJUALAN", { align: "center" })
      .fontSize(12)
      .font("Helvetica")
      .text("Marile — Marinasi Ikan & Olahan", { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Periode : ${label}`, { align: "center" })
      .text(
        `Dari : ${formatDateOnly(start)}   Sampai : ${formatDateOnly(end)}`,
        { align: "center" },
      )
      .text(`Dicetak : ${formatDate(new Date())}`, { align: "center" })
      .fillColor("#000000")
      .moveDown(1);

    // ── Divider ─────────────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.8);

    // ── Summary box ─────────────────────────────────────────────────────────
    doc.fontSize(13).font("Helvetica-Bold").text("Ringkasan").moveDown(0.4);

    const summaryRows = [
      ["Total Pendapatan", formatRupiah(summary.totalRevenue)],
      ["Total Transaksi", `${summary.totalTransactions} transaksi`],
      ["Rata-rata per Order", formatRupiah(summary.averageOrderValue)],
      ["Total Item Terjual", `${summary.totalItemsSold}`],
      ["Transaksi Dibatalkan", `${summary.voidedCount} transaksi`],
    ];

    doc.fontSize(10).font("Helvetica");
    for (const [label, value] of summaryRows) {
      const y = doc.y;
      doc.text(label, 50, y, { width: 250 });
      doc.text(value, 300, y, { width: 245, align: "right" });
      doc.moveDown(0.4);
    }

    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(1.5);

    // ── Product breakdown table ──────────────────────────────────────────────
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Penjualan per Produk", 50, doc.y, { align: "left" })
      .moveDown(0.5);

    if (productBreakdown.length === 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#888888")
        .text("Tidak ada data penjualan pada periode ini.")
        .fillColor("#000000");
    } else {
      // Table header
      const col = { name: 50, qty: 270, orders: 360, revenue: 430 };

      const headerY = doc.y;
      doc.rect(50, headerY, 495, 18).fill("#333333");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Produk", col.name, headerY + 4, { width: 210 });
      doc.text("Qty Terjual", col.qty, headerY + 4, {
        width: 80,
        align: "right",
      });
      doc.text("Transaksi", col.orders, headerY + 4, {
        width: 60,
        align: "right",
      });
      doc.text("Pendapatan", col.revenue, headerY + 4, {
        width: 115,
        align: "right",
      });
      doc.moveDown(0.2).fillColor("#000000");

      // Table rows
      productBreakdown.forEach((p, i) => {
        // Add new page if running out of space
        if (doc.y > 720) {
          doc.addPage();
        }

        const rowY = doc.y;
        const fillColor = i % 2 === 0 ? "#f9f9f9" : "#ffffff";
        doc.rect(50, rowY, 495, 16).fill(fillColor);

        doc.fontSize(9).font("Helvetica").fillColor("#000000");
        doc.text(p.name, col.name, rowY + 3, { width: 210 });
        doc.text(`${p.qty_sold} ${p.unit}`, col.qty, rowY + 3, {
          width: 80,
          align: "right",
        });
        doc.text(`${p.orders}`, col.orders, rowY + 3, {
          width: 60,
          align: "right",
        });
        doc.text(formatRupiah(p.revenue), col.revenue, rowY + 3, {
          width: 115,
          align: "right",
        });
        doc.moveDown(0.15);
      });
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(1.5);

    // ── Transaction detail table ─────────────────────────────────────────────
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Detail Transaksi", 50, doc.y, {
        align: "left",
      })
      .moveDown(0.5);

    if (transactions.length === 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#888888")
        .text("Tidak ada transaksi pada periode ini.")
        .fillColor("#000000");
    } else {
      const col2 = {
        invoice: 50,
        date: 155,
        cashier: 270,
        method: 360,
        total: 430,
      };

      // Header
      const h2Y = doc.y;
      doc.rect(50, h2Y, 495, 18).fill("#333333");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("No. Invoice", col2.invoice, h2Y + 4, { width: 100 });
      doc.text("Tanggal", col2.date, h2Y + 4, { width: 110 });
      doc.text("Kasir", col2.cashier, h2Y + 4, { width: 85 });
      doc.text("Metode", col2.method, h2Y + 4, { width: 65 });
      doc.text("Total", col2.total, h2Y + 4, { width: 115, align: "right" });
      doc.moveDown(0.2).fillColor("#000000");

      transactions.forEach((t, i) => {
        if (doc.y > 720) {
          doc.addPage();
        }

        const rowY = doc.y;
        const fillColor = i % 2 === 0 ? "#f9f9f9" : "#ffffff";
        doc.rect(50, rowY, 495, 16).fill(fillColor);

        doc.fontSize(9).font("Helvetica").fillColor("#000000");
        doc.text(t.invoice_no, col2.invoice, rowY + 3, { width: 100 });
        doc.text(formatDate(t.created_at), col2.date, rowY + 3, { width: 110 });
        doc.text(t.cashier.name, col2.cashier, rowY + 3, { width: 85 });
        doc.text(t.payment_method, col2.method, rowY + 3, { width: 65 });
        doc.text(formatRupiah(t.total), col2.total, rowY + 3, {
          width: 115,
          align: "right",
        });
        doc.moveDown(0.15);
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text(
        `Dokumen ini dibuat otomatis oleh sistem Marile pada ${formatDate(new Date())}`,
        {
          align: "center",
        },
      );

    doc.end(); // finalize and flush the PDF stream
  } catch (err) {
    console.error("exportSalesPdf error: ", err);
    if (!res.headersSent) {
      return error(res, "Failed to generate PDF report", 500);
    }
    res.end();
  }
}

module.exports = { exportSalesPdf };
