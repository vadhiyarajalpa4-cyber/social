import express from 'express';
import { getNotifications, markNotificationsAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.put('/read', protect, markNotificationsAsRead);

export default router;
