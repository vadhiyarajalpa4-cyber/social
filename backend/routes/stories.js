import express from 'express';
import { createStory, getActiveStories } from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', protect, upload.single('story'), createStory);
router.get('/active', protect, getActiveStories);

export default router;
