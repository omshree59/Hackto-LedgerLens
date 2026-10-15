import { Router } from 'express';
import { ExportService } from '../services/export.service.js';

const router = Router();

/**
 * Export CSV for Invoices, Receipts, Expenses, Vendors, or Review queue
 */
router.get('/csv', (req, res) => {
  const { type = 'invoices', status, category, startDate, endDate } = req.query;
  const dateStr = new Date().toISOString().slice(0, 10);

  let csvContent = '';
  let filename = `ledgerlens_${type}_${dateStr}.csv`;

  switch (type) {
    case 'invoices':
      csvContent = ExportService.exportDocumentsCsv('invoice', status as string);
      break;
    case 'receipts':
      csvContent = ExportService.exportDocumentsCsv('receipt', status as string);
      break;
    case 'expenses':
      csvContent = ExportService.exportExpensesCsv(category as string, startDate as string, endDate as string);
      break;
    case 'vendors':
      csvContent = ExportService.exportVendorsCsv();
      break;
    case 'review':
      csvContent = ExportService.exportDocumentsCsv(undefined, 'needs_review');
      filename = `ledgerlens_review_queue_${dateStr}.csv`;
      break;
    default:
      csvContent = ExportService.exportDocumentsCsv();
      break;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
});

/**
 * Trigger local folder file organization
 */
router.post('/organize', (req, res) => {
  try {
    const result = ExportService.organizeLocalFiles();
    res.json({
      success: true,
      message: `Successfully organized ${result.organizedCount} documents into local folders`,
      destination: result.destinationDir
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'File organization failed' });
  }
});

export default router;
