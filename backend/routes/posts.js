import express from 'express';
import {
  createPost,
  getFeed,
  getPostById,
  editPost,
  deletePost,
  likePost,
  bookmarkPost,
  getUserPosts,
  getBookmarkedPosts,
  searchPosts,
  sharePost
} from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', protect, upload.single('image'), createPost);
router.get('/feed', protect, getFeed);
router.get('/bookmarks/list', protect, getBookmarkedPosts);
router.get('/search/items', protect, searchPosts);
router.get('/user/:username', protect, getUserPosts);

router.get('/:id', protect, getPostById);
router.put('/:id', protect, upload.single('image'), editPost);
router.delete('/:id', protect, deletePost);

router.post('/like/:id', protect, likePost);
router.post('/bookmark/:id', protect, bookmarkPost);
router.post('/share/:id', protect, sharePost);

export default router;
