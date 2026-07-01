import { Router } from 'express'
import {
  getSchedule, createSchedule, updateSchedule, deleteSchedule,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/receivableController.js'
import { contractPermFromParam, contractPermVia } from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.receivable.manage' // bootstrap = PM
// Receivable schedule — ghi cần co.receivable.manage
router.get('/contracts/:contractId/receivable',       getSchedule)
router.post('/contracts/:contractId/receivable',      contractPermFromParam(M), createSchedule)
router.put('/receivable/:id',                         contractPermVia(M, 'receivable'), updateSchedule)
router.delete('/receivable/:id',                      contractPermVia(M, 'receivable'), deleteSchedule)

// Actual payments
router.get('/contracts/:contractId/receivable-payments',  getPayments)
router.post('/contracts/:contractId/receivable-payments', contractPermFromParam(M), createPayment)
router.put('/receivable-payments/:id',                    contractPermVia(M, 'receivablePayment'), updatePayment)
router.delete('/receivable-payments/:id',                 contractPermVia(M, 'receivablePayment'), deletePayment)

export default router
