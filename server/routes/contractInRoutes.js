import { Router } from 'express'
import { getContractIns, createContractIn, updateContractIn, deleteContractIn } from '../controllers/contractInController.js'
import { canCreateContractIn, ownerOfContractIn } from '../middleware/contractAccess.js'

const router = Router()

// Tạo: PM hoặc Xuất nhập khẩu của HĐ bán cha. Sửa/xóa: chỉ người tạo HĐ nhập (hoặc admin).
router.get('/contracts/:id/contract-ins',    getContractIns)
router.post('/contracts/:id/contract-ins',   canCreateContractIn, createContractIn)
router.put('/contract-ins/:id',              ownerOfContractIn('id'), updateContractIn)
router.delete('/contract-ins/:id',           ownerOfContractIn('id'), deleteContractIn)

export default router
