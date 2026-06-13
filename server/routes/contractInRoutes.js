import { Router } from 'express'
import { getContractIns, createContractIn, updateContractIn, deleteContractIn } from '../controllers/contractInController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ bán cha
router.get('/contracts/:id/contract-ins',    getContractIns)
router.post('/contracts/:id/contract-ins',   pmFromParam('id'), createContractIn)
router.put('/contract-ins/:id',              pmVia('contractIn'), updateContractIn)
router.delete('/contract-ins/:id',           pmVia('contractIn'), deleteContractIn)

export default router
