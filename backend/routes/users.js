import express from 'express';
import { 
  getUserProfile, 
  updateUserProfile, 
  followUser, 
  getUserFollowers, 
  getUserFollowing, 
  getRecommendedUsers, 
  searchUsers 
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/profile/:username', protect, getUserProfile);
router.put('/profile', protect, upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'coverPic', maxCount: 1 }
]), updateUserProfile);

router.post('/follow/:id', protect, followUser);
router.get('/:id/followers', protect, getUserFollowers);
router.get('/:id/following', protect, getUserFollowing);
router.get('/recommendations', protect, getRecommendedUsers);
router.get('/search', protect, searchUsers);

export default router;
