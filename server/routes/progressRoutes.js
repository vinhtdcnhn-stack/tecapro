import { Router } from 'express'
import {
  getBBTypes, createBBType, updateBBType, deleteBBType,
  getProgress, createProgress, updateProgress, deleteProgress,
} from '../controllers/progressController.js'

const router = Router()

// BB Type master
router.get('/bb-types',       getBBTypes)
router.post('/bb-types',      createBBType)
router.put('/bb-types/:id',   updateBBType)
router.delete('/bb-types/:id', deleteBBType)

// Progress per contract
router.get('/contracts/:contractId/progress',     getProgress)
router.post('/contracts/:contractId/progress',    createProgress)
router.put('/progress/:id',                       updateProgress)
router.delete('/progress/:id',                    deleteProgress)

export default router
