import express from 'express';
import {
  createComment,
  getPostComments,
  editComment,
  deleteComment
} from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:postId', protect, createComment);
router.get('/:postId', protect, getPostComments);
router.put('/:id', protect, editComment);
router.delete('/:id', protect, deleteComment);

export default router;
