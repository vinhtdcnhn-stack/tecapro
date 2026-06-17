import { Router } from 'express'
import {
  getPayables, createPayable, updatePayable, deletePayable,
  getPayments, createPayment, updatePayment, deletePayment,
} from '../controllers/contractInPayableController.js'
import { ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'

const router = Router()

const ownerOfCI = ownerOfContractIn('contractInId')

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/payables',      getPayables)
router.post('/contract-ins/:contractInId/payables',     ownerOfCI, createPayable)
router.put('/payables/:id',                             ownerVia('payable'), updatePayable)
router.delete('/payables/:id',                          ownerVia('payable'), deletePayable)

router.get('/contract-ins/:contractInId/payments',      getPayments)
router.post('/contract-ins/:contractInId/payments',     ownerOfCI, createPayment)
router.put('/payments/:id',                             ownerVia('payment'), updatePayment)
router.delete('/payments/:id',                          ownerVia('payment'), deletePayment)

export default router
