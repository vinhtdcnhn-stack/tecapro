import { Router } from 'express'
import {
  getContractInGuarantees,
  createContractInGuarantee,
  updateContractInGuarantee,
  deleteContractInGuarantee,
} from '../controllers/contractInGuaranteeController.js'

const router = Router()

router.get('/contract-ins/:contractInId/guarantees',  getContractInGuarantees)
router.post('/contract-ins/:contractInId/guarantees', createContractInGuarantee)
router.put('/contract-in-guarantees/:id',             updateContractInGuarantee)
router.delete('/contract-in-guarantees/:id',          deleteContractInGuarantee)

export default router
