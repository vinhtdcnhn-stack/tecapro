import { Router } from 'express'
import {
  getGuarantees,
  createGuarantee,
  updateGuarantee,
  deleteGuarantee,
} from '../controllers/guaranteeController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Ghi yêu cầu PM của HĐ (F-11)
router.get('/contracts/:id/guarantees',  getGuarantees)
router.post('/contracts/:id/guarantees', pmFromParam('id'), createGuarantee)
router.put('/guarantees/:id',            pmVia('guarantee'), updateGuarantee)
router.delete('/guarantees/:id',         pmVia('guarantee'), deleteGuarantee)

export default router
