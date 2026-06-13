import { Router } from 'express'
import {
  getPayables, createPayable, updatePayable, deletePayable,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/contractInPayableController.js'
import { pmVia } from '../middleware/contractAccess.js'

const router = Router()

const pmOfContractIn = pmVia('contractIn', 'contractInId')

// Ghi yêu cầu PM của HĐ bán cha
router.get('/contract-ins/:contractInId/payables',      getPayables)
router.post('/contract-ins/:contractInId/payables',     pmOfContractIn, createPayable)
router.put('/payables/:id',                             pmVia('payable'), updatePayable)
router.delete('/payables/:id',                          pmVia('payable'), deletePayable)

router.get('/contract-ins/:contractInId/payments',      getPayments)
router.post('/contract-ins/:contractInId/payments',     pmOfContractIn, createPayment)
router.put('/payments/:id',                             pmVia('payment'), updatePayment)
router.delete('/payments/:id',                          pmVia('payment'), deletePayment)

export default router
