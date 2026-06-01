import { Router } from 'express'
import {
  getSchedule, createSchedule, updateSchedule, deleteSchedule,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/receivableController.js'

const router = Router()

// Receivable schedule
router.get('/contracts/:contractId/receivable',       getSchedule)
router.post('/contracts/:contractId/receivable',      createSchedule)
router.put('/receivable/:id',                         updateSchedule)
router.delete('/receivable/:id',                      deleteSchedule)

// Actual payments
router.get('/contracts/:contractId/receivable-payments',  getPayments)
router.post('/contracts/:contractId/receivable-payments', createPayment)
router.put('/receivable-payments/:id',                    updatePayment)
router.delete('/receivable-payments/:id',                 deletePayment)

export default router
