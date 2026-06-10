import express from 'express';
import {
  getAnalytics,
  getUsersList,
  deleteUserAdmin,
  getReports,
  reportPost,
  resolveReport
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/analytics', protect, adminOnly, getAnalytics);
router.get('/users', protect, adminOnly, getUsersList);
router.delete('/users/:id', protect, adminOnly, deleteUserAdmin);

router.get('/reports', protect, adminOnly, getReports);
router.post('/reports/:postId', protect, reportPost);
router.put('/reports/:id', protect, adminOnly, resolveReport);

export default router;
