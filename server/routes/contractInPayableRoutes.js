import { Router } from 'express'
import {
  getPayables, createPayable, updatePayable, deletePayable,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/contractInPayableController.js'

const router = Router()

router.get('/contract-ins/:contractInId/payables',      getPayables)
router.post('/contract-ins/:contractInId/payables',     createPayable)
router.put('/payables/:id',                             updatePayable)
router.delete('/payables/:id',                          deletePayable)

router.get('/contract-ins/:contractInId/payments',      getPayments)
router.post('/contract-ins/:contractInId/payments',     createPayment)
router.put('/payments/:id',                             updatePayment)
router.delete('/payments/:id',                          deletePayment)

export default router
