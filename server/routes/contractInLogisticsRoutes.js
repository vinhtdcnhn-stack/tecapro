import { Router } from 'express'
import {
  getLogisticsList, createLogistics, updateLogistics, deleteLogistics,
  getLogisticsUpdates, createLogisticsUpdate, deleteLogisticsUpdate,
} from '../controllers/contractInLogisticsController.js'
import { pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ bán cha (F-11)
router.get('/contract-ins/:contractInId/logistics',  getLogisticsList)
router.post('/contract-ins/:contractInId/logistics', pmVia('contractIn', 'contractInId'), createLogistics)
router.put('/contract-in-logistics/:id',             pmVia('logistics'), updateLogistics)
router.delete('/contract-in-logistics/:id',          pmVia('logistics'), deleteLogistics)

router.get('/contract-in-logistics/:id/updates',     getLogisticsUpdates)
router.post('/contract-in-logistics/:id/updates',    pmVia('logistics'), createLogisticsUpdate)
router.delete('/contract-in-logistics-updates/:id',  pmVia('logisticsUpdate'), deleteLogisticsUpdate)

export default router
