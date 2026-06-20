import { Router } from 'express'
import {
  getInvoices, getInvoiceSummary, createInvoice, updateInvoice, deleteInvoice,
} from '../controllers/invoiceController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Đọc mở cho mọi user đã đăng nhập; ghi chỉ PM của HĐ (hoặc admin).
router.get('/contracts/:id/invoices',        getInvoices)
router.get('/contracts/:id/invoice-summary', getInvoiceSummary)
router.post('/contracts/:id/invoices',       pmFromParam('id'), createInvoice)
router.put('/invoices/:id',                  pmVia('invoice'), updateInvoice)
router.delete('/invoices/:id',               pmVia('invoice'), deleteInvoice)

export default router
