import { Router } from 'express'
import {
  getLogisticsList, createLogistics, updateLogistics, deleteLogistics,
  getLogisticsUpdates, createLogisticsUpdate, deleteLogisticsUpdate,
} from '../controllers/contractInLogisticsController.js'

const router = Router()

router.get('/contract-ins/:contractInId/logistics',  getLogisticsList)
router.post('/contract-ins/:contractInId/logistics', createLogistics)
router.put('/contract-in-logistics/:id',             updateLogistics)
router.delete('/contract-in-logistics/:id',          deleteLogistics)

router.get('/contract-in-logistics/:id/updates',     getLogisticsUpdates)
router.post('/contract-in-logistics/:id/updates',    createLogisticsUpdate)
router.delete('/contract-in-logistics-updates/:id',  deleteLogisticsUpdate)

export default router
