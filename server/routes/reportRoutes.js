import { Router } from 'express'
import { requireAccountant } from '../middleware/accountantAccess.js'
import { getOverdueReceivables, getCashflowSummary, getInvoiceRevenue } from '../controllers/reportController.js'
import {
  getReceivablesReport, getPayablesReport, getProgressCollection,
  getDebtByContract, getDebtByCustomer, getContractsAsOf,
} from '../controllers/reportDebtController.js'
import { getWarrantyReport } from '../controllers/reportWarrantyController.js'
import { getOverdueTasks } from '../controllers/reportTaskController.js'
import { getTenderOverview } from '../controllers/reportTenderController.js'

const router = Router()

// Báo cáo tài chính — chỉ kế toán / BGĐ / admin.
router.get('/reports/cashflow-summary',     requireAccountant, getCashflowSummary)
router.get('/reports/invoice-revenue',      requireAccountant, getInvoiceRevenue)     // doanh thu xuất hóa đơn theo khoảng ngày
router.get('/reports/overdue-receivables',  requireAccountant, getOverdueReceivables)
router.get('/reports/receivables',          requireAccountant, getReceivablesReport)   // #3/#4
router.get('/reports/payables',             requireAccountant, getPayablesReport)       // #5
router.get('/reports/progress-collection',  requireAccountant, getProgressCollection)   // #6
router.get('/reports/debt-by-contract',     requireAccountant, getDebtByContract)       // #9
router.get('/reports/debt-by-customer',     requireAccountant, getDebtByCustomer)       // #8
router.get('/reports/warranty',             requireAccountant, getWarrantyReport)        // #10
router.get('/reports/overdue-tasks',        requireAccountant, getOverdueTasks)          // dashboard điều hành
router.get('/reports/contracts-asof',       requireAccountant, getContractsAsOf)         // danh sách HĐ tại 1 thời điểm
router.get('/reports/tender-overview',      requireAccountant, getTenderOverview)        // tổng quan đấu thầu (dashboard điều hành)

export default router
