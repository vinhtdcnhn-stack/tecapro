import { Router } from 'express'
import {
  isDeptMember, isHeadOrDeputy, isTaskLeadOrHead, isHeadDeputyOrAssignee,
  isAssigneeOf, isAssignmentHolder, isHandoffRecipient, isLogOwner,
} from '../middleware/deptWorkAccess.js'
import {
  getTeams, getMembers,
} from '../controllers/deptWorkTeamController.js'
import {
  getTasks, getTask, createTask, updateTask, updateTaskStatus, deleteTask,
} from '../controllers/deptWorkTaskController.js'
import {
  upload, getAttachments, uploadAttachment, deleteAttachment,
} from '../controllers/deptWorkTaskAttachmentController.js'
import {
  handoff, acceptHandoff, rejectHandoff, escalate, escalateResolve,
} from '../controllers/deptWorkTransferController.js'
import {
  getIssues, addIssue, resolveIssue,
} from '../controllers/deptWorkIssueController.js'
import {
  getLogs, addLog, updateLog, deleteLog, getCapacity,
} from '../controllers/deptWorkLogController.js'

// Tất cả route đã nằm sau requireAuth (mount trong routes/index.js).
// Tiền tố /dept-work. Đọc cần là thành viên phòng; ghi cấu hình cần trưởng/phó phòng.
const router = Router()

// Team + danh sách thành viên (đọc; thành viên/quyền suy từ phòng + chức danh)
router.get('/dept-work/teams', isDeptMember, getTeams)
router.get('/dept-work/members', isDeptMember, getMembers)

// Việc: đọc cho mọi thành viên; tạo cho mọi thành viên (controller áp luật NV/head);
// sửa/xóa chỉ head/deputy; đổi trạng thái chỉ nhóm trưởng/head.
router.get('/dept-work/tasks', isDeptMember, getTasks)
router.get('/dept-work/tasks/:id', isDeptMember, getTask)
router.post('/dept-work/tasks', isDeptMember, createTask)
router.put('/dept-work/tasks/:id', isHeadOrDeputy, updateTask)
router.put('/dept-work/tasks/:id/status', isTaskLeadOrHead('id'), updateTaskStatus)
router.delete('/dept-work/tasks/:id', isHeadOrDeputy, deleteTask)

// Đính kèm tệp cho việc (guard ĐẶT TRƯỚC multer để request không có quyền không ghi file ra đĩa).
router.get('/dept-work/tasks/:taskId/attachments', isDeptMember, getAttachments)
router.post('/dept-work/tasks/:taskId/attachments', isHeadDeputyOrAssignee('taskId'), upload.single('file'), uploadAttachment)
router.delete('/dept-work/task-attachments/:id', isDeptMember, deleteAttachment)

// Chuyển việc ngang (cần chấp nhận) + đẩy việc lên cấp trên (escalation).
router.post('/dept-work/assignments/:id/handoff', isAssignmentHolder('id'), handoff)
router.post('/dept-work/assignments/:id/accept', isHandoffRecipient('id'), acceptHandoff)
router.post('/dept-work/assignments/:id/reject', isHandoffRecipient('id'), rejectHandoff)
router.post('/dept-work/tasks/:id/escalate', isAssigneeOf('id'), escalate)
router.post('/dept-work/tasks/:id/escalate-resolve', isHeadOrDeputy, escalateResolve)

// Báo cáo vấn đề: đọc cho mọi thành viên; người được giao việc báo; head/deputy đánh dấu xử lý.
router.get('/dept-work/tasks/:taskId/issues', isDeptMember, getIssues)
router.post('/dept-work/tasks/:taskId/issues', isAssigneeOf('taskId'), addIssue)
router.put('/dept-work/issues/:id/resolve', isHeadOrDeputy, resolveIssue)

// Nhật ký công việc + báo cáo năng lực. Ghi cho chính mình; sửa/xóa chỉ chủ nhật ký.
router.get('/dept-work/logs', isDeptMember, getLogs)
router.post('/dept-work/logs', isDeptMember, addLog)
router.put('/dept-work/logs/:id', isLogOwner('id'), updateLog)
router.delete('/dept-work/logs/:id', isLogOwner('id'), deleteLog)
router.get('/dept-work/capacity', isDeptMember, getCapacity)

export default router
