import express from 'express';
import { sendMessage, getMessages, getChatUsers, reactToMessage, deleteMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/messages', protect, upload.single('media'), sendMessage);
router.get('/messages/:userId', protect, getMessages);
router.get('/conversations', protect, getChatUsers);
router.put('/messages/:messageId/react', protect, reactToMessage);
router.delete('/messages/:messageId', protect, deleteMessage);

export default router;
