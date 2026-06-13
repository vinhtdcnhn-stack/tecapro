import { Router } from 'express'
import {
  getSchedule, createSchedule, updateSchedule, deleteSchedule,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/receivableController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Receivable schedule — ghi yêu cầu PM của HĐ (F-11)
router.get('/contracts/:contractId/receivable',       getSchedule)
router.post('/contracts/:contractId/receivable',      pmFromParam(), createSchedule)
router.put('/receivable/:id',                         pmVia('receivable'), updateSchedule)
router.delete('/receivable/:id',                      pmVia('receivable'), deleteSchedule)

// Actual payments
router.get('/contracts/:contractId/receivable-payments',  getPayments)
router.post('/contracts/:contractId/receivable-payments', pmFromParam(), createPayment)
router.put('/receivable-payments/:id',                    pmVia('receivablePayment'), updatePayment)
router.delete('/receivable-payments/:id',                 pmVia('receivablePayment'), deletePayment)

export default router
