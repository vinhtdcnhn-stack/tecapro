import { Router } from 'express'
import {
  getLogisticsList, createLogistics, updateLogistics, deleteLogistics,
  getLogisticsUpdates, createLogisticsUpdate, deleteLogisticsUpdate,
} from '../controllers/contractInLogisticsController.js'
import { ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/logistics',  getLogisticsList)
router.post('/contract-ins/:contractInId/logistics', ownerOfContractIn('contractInId'), createLogistics)
router.put('/contract-in-logistics/:id',             ownerVia('logistics'), updateLogistics)
router.delete('/contract-in-logistics/:id',          ownerVia('logistics'), deleteLogistics)

router.get('/contract-in-logistics/:id/updates',     getLogisticsUpdates)
router.post('/contract-in-logistics/:id/updates',    ownerVia('logistics'), createLogisticsUpdate)
router.delete('/contract-in-logistics-updates/:id',  ownerVia('logisticsUpdate'), deleteLogisticsUpdate)

export default router
