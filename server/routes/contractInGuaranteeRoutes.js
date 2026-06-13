import { Router } from 'express'
import {
  getContractInGuarantees,
  createContractInGuarantee,
  updateContractInGuarantee,
  deleteContractInGuarantee,
} from '../controllers/contractInGuaranteeController.js'
import { pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ bán cha
router.get('/contract-ins/:contractInId/guarantees',  getContractInGuarantees)
router.post('/contract-ins/:contractInId/guarantees', pmVia('contractIn', 'contractInId'), createContractInGuarantee)
router.put('/contract-in-guarantees/:id',             pmVia('inGuarantee'), updateContractInGuarantee)
router.delete('/contract-in-guarantees/:id',          pmVia('inGuarantee'), deleteContractInGuarantee)

export default router
