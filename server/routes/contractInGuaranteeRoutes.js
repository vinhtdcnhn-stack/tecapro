import { Router } from 'express'
import {
  getContractInGuarantees,
  createContractInGuarantee,
  updateContractInGuarantee,
  deleteContractInGuarantee,
} from '../controllers/contractInGuaranteeController.js'
import { ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/guarantees',  getContractInGuarantees)
router.post('/contract-ins/:contractInId/guarantees', ownerOfContractIn('contractInId'), createContractInGuarantee)
router.put('/contract-in-guarantees/:id',             ownerVia('inGuarantee'), updateContractInGuarantee)
router.delete('/contract-in-guarantees/:id',          ownerVia('inGuarantee'), deleteContractInGuarantee)

export default router
