import express from 'express';
import { getNotifications, markNotificationsAsRead, clearNotifications } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.put('/read', protect, markNotificationsAsRead);
router.delete('/clear', protect, clearNotifications);

export default router;
