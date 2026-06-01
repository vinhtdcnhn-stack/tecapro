import { Router } from 'express'
import {
  getContractInCustoms,
  createContractInCustoms,
  updateContractInCustoms,
  deleteContractInCustoms,
} from '../controllers/contractInCustomsController.js'

const router = Router()

router.get('/contract-ins/:contractInId/customs',  getContractInCustoms)
router.post('/contract-ins/:contractInId/customs', createContractInCustoms)
router.put('/contract-in-customs/:id',             updateContractInCustoms)
router.delete('/contract-in-customs/:id',          deleteContractInCustoms)

export default router
