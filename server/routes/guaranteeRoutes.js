import { Router } from 'express'
import {
  getGuarantees,
  createGuarantee,
  updateGuarantee,
  deleteGuarantee,
} from '../controllers/guaranteeController.js'
import { contractPermFromParam, contractPermVia } from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.guarantee.manage' // bootstrap = PM
router.get('/contracts/:id/guarantees',  getGuarantees)
router.post('/contracts/:id/guarantees', contractPermFromParam(M, 'id'), createGuarantee)
router.put('/guarantees/:id',            contractPermVia(M, 'guarantee'), updateGuarantee)
router.delete('/guarantees/:id',         contractPermVia(M, 'guarantee'), deleteGuarantee)

export default router
