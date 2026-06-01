import { Router } from 'express'
import { getContractIns, createContractIn, updateContractIn, deleteContractIn } from '../controllers/contractInController.js'

const router = Router()

router.get('/contracts/:id/contract-ins',    getContractIns)
router.post('/contracts/:id/contract-ins',   createContractIn)
router.put('/contract-ins/:id',              updateContractIn)
router.delete('/contract-ins/:id',           deleteContractIn)

export default router
