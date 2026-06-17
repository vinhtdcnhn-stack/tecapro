import { Router } from 'express'
import {
  getContractInCustoms,
  createContractInCustoms,
  updateContractInCustoms,
  deleteContractInCustoms,
} from '../controllers/contractInCustomsController.js'
import { ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/customs',  getContractInCustoms)
router.post('/contract-ins/:contractInId/customs', ownerOfContractIn('contractInId'), createContractInCustoms)
router.put('/contract-in-customs/:id',             ownerVia('customs'), updateContractInCustoms)
router.delete('/contract-in-customs/:id',          ownerVia('customs'), deleteContractInCustoms)

export default router
