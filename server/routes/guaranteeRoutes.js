import { Router } from 'express'
import {
  getGuarantees,
  createGuarantee,
  updateGuarantee,
  deleteGuarantee,
} from '../controllers/guaranteeController.js'

const router = Router()

router.get('/contracts/:id/guarantees',  getGuarantees)
router.post('/contracts/:id/guarantees', createGuarantee)
router.put('/guarantees/:id',            updateGuarantee)
router.delete('/guarantees/:id',         deleteGuarantee)

export default router
