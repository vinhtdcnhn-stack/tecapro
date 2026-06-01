import { Router } from 'express'
import * as c from '../controllers/supplierController.js'

const router = Router()

router.get('/suppliers',              c.getAllSuppliers)
router.get('/suppliers/:id',          c.getSupplierById)
router.post('/suppliers',             c.createSupplier)
router.put('/suppliers/:id',          c.updateSupplier)
router.post('/suppliers/check-code',  c.checkSupplierCodeExists)

export default router
