import { Router } from 'express'
import {
  getInvoices, getInvoiceSummary, createInvoice, updateInvoice, deleteInvoice, setInvoiceLock,
} from '../controllers/invoiceController.js'
import { pmFromParam, pmVia, blockIfLockedVia } from '../middleware/contractAccess.js'

const router = Router()

// Đọc mở cho mọi user đã đăng nhập; ghi chỉ PM của HĐ (hoặc admin).
router.get('/contracts/:id/invoices',        getInvoices)
router.get('/contracts/:id/invoice-summary', getInvoiceSummary)
router.post('/contracts/:id/invoices',       pmFromParam('id'), createInvoice)
router.put('/invoices/:id',                  pmVia('invoice'), blockIfLockedVia('invoice', 'id', 'Đợt xuất hóa đơn'), updateInvoice)
router.delete('/invoices/:id',               pmVia('invoice'), blockIfLockedVia('invoice', 'id', 'Đợt xuất hóa đơn'), deleteInvoice)
// Khóa/mở khóa đợt — chỉ PM của HĐ/admin; KHÔNG gắn blockIfLocked để còn mở khóa được.
router.patch('/invoices/:id/lock',           pmVia('invoice'), setInvoiceLock)

export default router
