import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

/**
 * Overview dashboard metrics and trend charts
 */
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const { startDate, endDate } = req.query;

  let docDateFilter = '';
  let expDateFilter = '';
  const docParams: any[] = [];
  const expParams: any[] = [];

  if (startDate) {
    docDateFilter += ' AND d.created_at >= ?';
    docParams.push(startDate);
    expDateFilter += ' AND expense_date >= ?';
    expParams.push(startDate);
  }

  if (endDate) {
    docDateFilter += ' AND d.created_at <= ?';
    docParams.push(endDate);
    expDateFilter += ' AND expense_date <= ?';
    expParams.push(endDate);
  }

  // 1. Overall counts
  const totalInvoicesRow = db.prepare(`
    SELECT COUNT(*) as count FROM documents d WHERE d.document_type = 'invoice' AND d.status != 'archived' ${docDateFilter}
  `).get(...docParams) as { count: number };

  const totalReceiptsRow = db.prepare(`
    SELECT COUNT(*) as count FROM documents d WHERE d.document_type = 'receipt' AND d.status != 'archived' ${docDateFilter}
  `).get(...docParams) as { count: number };

  const awaitingReviewRow = db.prepare(`
    SELECT COUNT(*) as count FROM documents d WHERE d.status = 'needs_review' ${docDateFilter}
  `).get(...docParams) as { count: number };

  const duplicatesRow = db.prepare(`
    SELECT COUNT(*) as count FROM documents d WHERE d.is_duplicate = 1 AND d.status != 'archived' ${docDateFilter}
  `).get(...docParams) as { count: number };

  const totalExpensesRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as totalSum, COUNT(*) as count FROM expenses WHERE 1=1 ${expDateFilter}
  `).get(...expParams) as { totalSum: number; count: number };

  // 2. Monthly spending trend (last 12 months or in date range)
  const monthlyTrend = db.prepare(`
    SELECT
      strftime('%Y-%m', expense_date) as month,
      SUM(amount) as total,
      COUNT(id) as count
    FROM expenses
    WHERE 1=1 ${expDateFilter}
    GROUP BY strftime('%Y-%m', expense_date)
    ORDER BY month ASC
  `).all(...expParams);

  // 3. Spending by category
  const spendingByCategory = db.prepare(`
    SELECT
      category,
      SUM(amount) as total,
      COUNT(id) as count
    FROM expenses
    WHERE 1=1 ${expDateFilter}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 8
  `).all(...expParams);

  // 4. Spending by top vendors
  const spendingByVendor = db.prepare(`
    SELECT
      vendor_name as vendor,
      SUM(amount) as total,
      COUNT(id) as count
    FROM expenses
    WHERE 1=1 ${expDateFilter}
    GROUP BY LOWER(vendor_name)
    ORDER BY total DESC
    LIMIT 6
  `).all(...expParams);

  // 5. Recent documents (latest 6)
  const recentDocuments = db.prepare(`
    SELECT
      d.id,
      d.original_filename,
      d.document_type,
      d.status,
      d.is_duplicate,
      d.created_at,
      e.vendor_name,
      e.total_amount,
      e.currency,
      e.category
    FROM documents d
    LEFT JOIN extracted_data e ON d.id = e.document_id
    ORDER BY d.created_at DESC
    LIMIT 6
  `).all();

  // 6. Processing pipeline stats
  const processingStats = db.prepare(`
    SELECT
      status,
      COUNT(*) as count
    FROM documents
    GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  // 7. Payment status breakdown
  const paymentBreakdown = db.prepare(`
    SELECT
      COALESCE(e.payment_status, 'unspecified') as status,
      COUNT(d.id) as count,
      COALESCE(SUM(e.total_amount), 0) as total
    FROM documents d
    JOIN extracted_data e ON d.id = e.document_id
    WHERE d.status != 'archived' ${docDateFilter}
    GROUP BY e.payment_status
  `).all(...docParams);

  res.json({
    metrics: {
      totalInvoices: totalInvoicesRow.count,
      totalReceipts: totalReceiptsRow.count,
      totalDocuments: totalInvoicesRow.count + totalReceiptsRow.count,
      totalExpenses: totalExpensesRow.totalSum,
      expenseCount: totalExpensesRow.count,
      awaitingReview: awaitingReviewRow.count,
      duplicateCandidates: duplicatesRow.count,
    },
    monthlyTrend,
    spendingByCategory,
    spendingByVendor,
    recentDocuments,
    processingStats,
    paymentBreakdown
  });
});

/**
 * Detailed reports view
 */
router.get('/reports', (req, res) => {
  const db = getDb();
  const { year = new Date().getFullYear().toString() } = req.query;

  // Monthly breakdown for selected year
  const monthlyData = db.prepare(`
    SELECT
      strftime('%m', expense_date) as monthNum,
      strftime('%Y-%m', expense_date) as monthLabel,
      SUM(amount) as amount,
      COUNT(id) as transactionCount
    FROM expenses
    WHERE strftime('%Y', expense_date) = ?
    GROUP BY monthNum
    ORDER BY monthNum ASC
  `).all(year);

  // Category breakdown for selected year
  const categoryData = db.prepare(`
    SELECT
      category,
      SUM(amount) as total,
      COUNT(id) as count
    FROM expenses
    WHERE strftime('%Y', expense_date) = ?
    GROUP BY category
    ORDER BY total DESC
  `).all(year);

  // Vendor breakdown for selected year
  const vendorData = db.prepare(`
    SELECT
      vendor_name,
      SUM(amount) as total,
      COUNT(id) as count
    FROM expenses
    WHERE strftime('%Y', expense_date) = ?
    GROUP BY LOWER(vendor_name)
    ORDER BY total DESC
    LIMIT 10
  `).all(year);

  // Tax collected/paid estimate
  const taxSummary = db.prepare(`
    SELECT
      COALESCE(SUM(tax_amount), 0) as totalTax,
      COALESCE(SUM(subtotal), 0) as totalSubtotal,
      COALESCE(SUM(total_amount), 0) as totalGrand
    FROM extracted_data e
    JOIN documents d ON e.document_id = d.id
    WHERE d.status = 'approved' AND strftime('%Y', e.invoice_date) = ?
  `).get(year);

  res.json({
    year,
    monthlyData,
    categoryData,
    vendorData,
    taxSummary
  });
});

export default router;
