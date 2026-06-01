import { Router } from 'express'
import {
  getBBTypes, createBBType, updateBBType, deleteBBType,
  getProgress, createProgress, updateProgress, deleteProgress,
  getProgressIn, createProgressIn, updateProgressIn, deleteProgressIn,
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

// Progress per contract_in (reuses same bb-types)
router.get('/contract-ins/:contractInId/progress',    getProgressIn)
router.post('/contract-ins/:contractInId/progress',   createProgressIn)
router.put('/progress-in/:id',                        updateProgressIn)
router.delete('/progress-in/:id',                     deleteProgressIn)

export default router
