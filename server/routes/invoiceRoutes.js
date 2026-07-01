import { Router } from 'express'
import {
  getInvoices, getInvoiceSummary, createInvoice, updateInvoice, deleteInvoice, setInvoiceLock,
} from '../controllers/invoiceController.js'
import { contractPermFromParam, contractPermVia, blockIfLockedVia } from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.invoice.manage' // bootstrap = PM
// Đọc mở cho mọi user đã đăng nhập; ghi cần co.invoice.manage (hoặc admin).
router.get('/contracts/:id/invoices',        getInvoices)
router.get('/contracts/:id/invoice-summary', getInvoiceSummary)
router.post('/contracts/:id/invoices',       contractPermFromParam(M, 'id'), createInvoice)
router.put('/invoices/:id',                  contractPermVia(M, 'invoice'), blockIfLockedVia('invoice', 'id', 'Đợt xuất hóa đơn'), updateInvoice)
router.delete('/invoices/:id',               contractPermVia(M, 'invoice'), blockIfLockedVia('invoice', 'id', 'Đợt xuất hóa đơn'), deleteInvoice)
// Khóa/mở khóa đợt — cần co.invoice.manage; KHÔNG gắn blockIfLocked để còn mở khóa được.
router.patch('/invoices/:id/lock',           contractPermVia(M, 'invoice'), setInvoiceLock)

export default router
