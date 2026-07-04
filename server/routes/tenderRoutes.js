import { Router } from 'express'
import {
  isTenderMember, isHead, isBidMakerOrHead, isChecklistEditor, isChecklistContributor,
  isItemDocEditor, isItemReviewCurator, isLotEditor, isBidderEditor, isEntryMemberOrContributor,
} from '../middleware/tenderAccess.js'
import {
  getTenders, getTender, createTender, updateTender,
  updateTenderStatus, deleteTender, getActivityLog, getMembers, getMyTenders,
} from '../controllers/tenderController.js'
import {
  getChecklist, createItem, updateItem, updateItemStatus, deleteItem, getMyTask,
} from '../controllers/tenderChecklistController.js'
import {
  getEntries as getItemEntries, addEntry as addItemEntry,
  addEntryImage as addItemEntryImage, deleteEntry as deleteItemEntry,
  uploadEntryImage as uploadItemEntryImage,
} from '../controllers/tenderChecklistEntryController.js'
import {
  getTemplate, createTemplateItem, updateTemplateItem, deleteTemplateItem, applyTemplate,
} from '../controllers/tenderChecklistTemplateController.js'
import {
  uploadSummary,
  viewAttachment, downloadAttachment,
  getSummaryFiles, uploadSummaryFile, deleteSummaryFile, viewSummary, downloadSummary,
} from '../controllers/tenderFileController.js'
import {
  uploadTender, getFolderTreeTender, createFolderTender, getTenderFiles, uploadFileTender,
} from '../controllers/tenderDocController.js'
import {
  uploadTenderItem, getItemFolders, createItemFolder, getItemFiles, uploadItemDoc,
  getItemInvitationFolders, getItemInvitationFiles,
} from '../controllers/tenderItemDocController.js'
import {
  getItemsForReview, submitItemReview, decideItemReview, reopenItemReview,
  toggleFileExcluded, toggleFolderExcluded, uploadReplacement, deleteReplacement,
} from '../controllers/tenderItemReviewController.js'
import { getReports } from '../controllers/tenderReportController.js'
import {
  getLots, createLot, updateLot, deleteLot,
  createBidder, updateBidder, deleteBidder,
} from '../controllers/tenderLotController.js'

// Tất cả route đã nằm sau requireAuth (mount trong routes/index.js).
// Tiền tố /tender. Đọc cần là thành viên phòng; phân công/xoá cần Trưởng phòng.
const router = Router()

router.get('/tender/members', isTenderMember, getMembers)
router.get('/tender/my', isTenderMember, getMyTenders)
router.get('/tender/reports', isTenderMember, getReports)

// Mẫu checklist dùng chung (đặt TRƯỚC '/tender/:id'). Đọc cho mọi thành viên;
// sửa mẫu chỉ Trưởng phòng.
router.get('/tender/checklist-template', isTenderMember, getTemplate)
router.post('/tender/checklist-template', isHead, createTemplateItem)
router.put('/tender/checklist-template/:itemId', isHead, updateTemplateItem)
router.delete('/tender/checklist-template/:itemId', isHead, deleteTemplateItem)

router.get('/tender', isTenderMember, getTenders)
router.post('/tender', isTenderMember, createTender)
router.get('/tender/:id', isTenderMember, getTender)
router.put('/tender/:id', isBidMakerOrHead('id'), updateTender)
router.delete('/tender/:id', isHead, deleteTender)

// Đổi trạng thái/kết quả (người làm thầu hoặc trưởng phòng). Phân công người làm thầu/
// AM nay nằm trong tạo/sửa gói (createTender/updateTender, gác head ở controller).
router.put('/tender/:id/status', isBidMakerOrHead('id'), updateTenderStatus)

// Nhật ký thao tác (audit).
router.get('/tender/:id/activity', isTenderMember, getActivityLog)

// ── Kết quả dự thầu: lô + nhà thầu (xếp hạng giá theo từng lô) ───────────────
// Đọc cho thành viên ban; ghi cho người làm thầu của gói / Trưởng phòng / admin.
router.get('/tender/:id/lots', isTenderMember, getLots)
router.post('/tender/:id/lots', isBidMakerOrHead('id'), createLot)
router.put('/tender/lots/:lotId', isLotEditor('lotId'), updateLot)
router.delete('/tender/lots/:lotId', isLotEditor('lotId'), deleteLot)
router.post('/tender/lots/:lotId/bidders', isLotEditor('lotId'), createBidder)
router.put('/tender/bidders/:bidderId', isBidderEditor('bidderId'), updateBidder)
router.delete('/tender/bidders/:bidderId', isBidderEditor('bidderId'), deleteBidder)

// ── Checklist công việc ─────────────────────────────────────────────────────
router.get('/tender/:id/checklist', isTenderMember, getChecklist)
router.post('/tender/:id/checklist/apply-template', isBidMakerOrHead('id'), applyTemplate)
router.post('/tender/:id/checklist', isBidMakerOrHead('id'), createItem)
router.put('/tender/checklist/:itemId', isChecklistEditor('itemId'), updateItem)
router.put('/tender/checklist/:itemId/status', isChecklistContributor('itemId'), updateItemStatus)
router.delete('/tender/checklist/:itemId', isChecklistEditor('itemId'), deleteItem)

// ── Dòng thời gian trao đổi của đầu việc (báo cáo · chỉ đạo · trao đổi + ảnh) ──
// Cho thành viên ban HOẶC người được giao/người làm thầu của đúng đầu việc (trang "Việc
// đấu thầu của tôi" cho người ngoài ban). Loại mục được đăng gác theo vai trò trong
// controller. Guard TRƯỚC multer cho route đính ảnh.
router.get('/tender/checklist/:itemId/entries', isEntryMemberOrContributor(), getItemEntries)
router.post('/tender/checklist/:itemId/entries', isEntryMemberOrContributor(), addItemEntry)
router.post('/tender/checklist-entries/:id/images', isEntryMemberOrContributor({ from: 'entry', param: 'id' }), uploadItemEntryImage.single('image'), addItemEntryImage)
router.delete('/tender/checklist-entries/:id', isEntryMemberOrContributor({ from: 'entry', param: 'id' }), deleteItemEntry)

// ── "Việc đấu thầu của tôi" — cho người được giao (không thuộc Ban Đấu thầu) ──
// Xem chi tiết việc + tệp sản phẩm + danh sách hồ sơ mời thầu, đổi trạng thái, nộp/
// xoá tệp sản phẩm — tất cả gác theo người được giao của ĐÚNG đầu việc/tệp đó, không
// cần mở cả module Đấu thầu. Đổi trạng thái dùng /tender/checklist/:itemId/status.
router.get('/tender/my-task/:itemId', isChecklistContributor('itemId'), getMyTask)

// Tệp sản phẩm của đầu việc = hệ thư mục/tệp khoá theo item_id (folder + file, xem
// trước, upload cả thư mục). Sửa tên/xoá thư mục, xoá/xem/tải tệp dùng route toàn
// cục /folders/:id, /files/:id (docGuard đã nới cho tệp theo item). Guard TRƯỚC multer.
router.get('/tender/my-task/:itemId/docs/folders', isChecklistContributor('itemId'), getItemFolders)
router.post('/tender/my-task/:itemId/docs/folders', isItemDocEditor('itemId'), createItemFolder)
router.get('/tender/my-task/:itemId/docs/files', isChecklistContributor('itemId'), getItemFiles)
router.post('/tender/my-task/:itemId/docs/files/upload', isItemDocEditor('itemId'), uploadTenderItem.single('file'), uploadItemDoc)

// Hồ sơ mời thầu (đầu vào) — CHỈ ĐỌC cho người được giao việc (xem/tải qua /files/:id).
router.get('/tender/my-task/:itemId/invitation/folders', isChecklistContributor('itemId'), getItemInvitationFolders)
router.get('/tender/my-task/:itemId/invitation/files', isChecklistContributor('itemId'), getItemInvitationFiles)

// Tệp sản phẩm phía Ban Đấu thầu (trong tab Checklist) — cùng kho document_file(item_id).
router.get('/tender/checklist/:itemId/docs/folders', isTenderMember, getItemFolders)
router.post('/tender/checklist/:itemId/docs/folders', isItemDocEditor('itemId'), createItemFolder)
router.get('/tender/checklist/:itemId/docs/files', isTenderMember, getItemFiles)
router.post('/tender/checklist/:itemId/docs/files/upload', isItemDocEditor('itemId'), uploadTenderItem.single('file'), uploadItemDoc)

// ── Hồ sơ mời thầu (đầu vào từ chủ đầu tư) — thư mục/tệp như tài liệu HĐ bán,
//    cho phép tải tệp vào thư mục gốc. Sửa tên/xoá thư mục, xoá/xem/tải tệp dùng
//    chung route toàn cục /folders/:id, /files/:id (documentRoutes; docGuard đã nới).
router.get('/tenders/:tenderId/folders', isTenderMember, getFolderTreeTender)
router.post('/tenders/:tenderId/folders', isBidMakerOrHead('tenderId'), createFolderTender)
router.get('/tenders/:tenderId/files', isTenderMember, getTenderFiles)
router.post('/tenders/:tenderId/files/upload', isBidMakerOrHead('tenderId'), uploadTender.single('file'), uploadFileTender)

// ── Tổng hợp hồ sơ ──────────────────────────────────────────────────────────
router.get('/tender/:id/summary', isTenderMember, getSummaryFiles)
router.post('/tender/:id/summary', isBidMakerOrHead('id'), uploadSummary.single('file'), uploadSummaryFile)
router.delete('/tender/summary/:id', isTenderMember, deleteSummaryFile)

// ── Review & Comment theo TỪNG ĐẦU VIỆC ─────────────────────────────────────
// (thay cho review cả gói theo phiên bản — các route /version cũ đã gỡ).
// Curate (đánh dấu loại / tải thay thế / gửi review) = người phụ trách gói/Trưởng phòng;
// kết luận Đạt/Trả lại = Trưởng phòng. Guard đặt TRƯỚC multer cho route tải thay thế.
router.get('/tender/:id/review', isTenderMember, getItemsForReview)
router.post('/tender/checklist/:itemId/review/submit', isItemReviewCurator('item', 'itemId'), submitItemReview)
router.post('/tender/checklist/:itemId/review/decide', isHead, decideItemReview)
router.post('/tender/checklist/:itemId/review/reopen', isHead, reopenItemReview)
router.put('/tender/checklist/file/:fileId/review-exclude', isItemReviewCurator('file', 'fileId'), toggleFileExcluded)
router.put('/tender/checklist/folder/:folderId/review-exclude', isItemReviewCurator('folder', 'folderId'), toggleFolderExcluded)
router.post('/tender/checklist/:itemId/review/replacement', isItemReviewCurator('item', 'itemId'), uploadTenderItem.single('file'), uploadReplacement)
router.delete('/tender/checklist/file/:fileId/replacement', isItemReviewCurator('file', 'fileId'), deleteReplacement)

// ── Phục vụ tệp (xem inline / tải về) ───────────────────────────────────────
router.get('/tender-files/attachment/:id/view', isTenderMember, viewAttachment)
router.get('/tender-files/attachment/:id/download', isTenderMember, downloadAttachment)
router.get('/tender-files/summary/:id/view', isTenderMember, viewSummary)
router.get('/tender-files/summary/:id/download', isTenderMember, downloadSummary)

export default router
