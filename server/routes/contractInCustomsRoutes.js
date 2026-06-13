import { Router } from 'express'
import {
  getContractInCustoms,
  createContractInCustoms,
  updateContractInCustoms,
  deleteContractInCustoms,
} from '../controllers/contractInCustomsController.js'
import { pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ bán cha (F-11)
router.get('/contract-ins/:contractInId/customs',  getContractInCustoms)
router.post('/contract-ins/:contractInId/customs', pmVia('contractIn', 'contractInId'), createContractInCustoms)
router.put('/contract-in-customs/:id',             pmVia('customs'), updateContractInCustoms)
router.delete('/contract-in-customs/:id',          pmVia('customs'), deleteContractInCustoms)

export default router
