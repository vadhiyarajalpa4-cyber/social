import Story from '../models/Story.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';

// @desc    Upload a 24h Story
// @route   POST /api/stories
// @access  Private
export const createStory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'An image file is required for a story' });
    }

    const mediaUrl = `/uploads/${req.file.filename}`;

    const story = await Story.create({
      author: req.user._id,
      mediaUrl
    });

    const populated = await Story.findById(story._id)
      .populate('author', 'username fullName profilePic');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active stories from followed users and self
// @route   GET /api/stories/active
// @access  Private
export const getActiveStories = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get list of followed user IDs
    const followingRecords = await Follow.find({ follower: currentUserId }).select('following');
    const followedIds = followingRecords.map(f => f.following);
    followedIds.push(currentUserId); // Include current user's stories

    // Query active stories (expires TTL ensures expired stories are eventually deleted, 
    // but we can query created in last 24h explicitly to be safe)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stories = await Story.find({
      author: { $in: followedIds },
      createdAt: { $gte: cutoffTime }
    })
    .populate('author', 'username fullName profilePic')
    .sort({ createdAt: 1 });

    // Group stories by author
    const groupedStories = {};

    stories.forEach((story) => {
      if (!story.author) return;
      const authorId = story.author._id.toString();
      
      if (!groupedStories[authorId]) {
        groupedStories[authorId] = {
          user: story.author,
          stories: []
        };
      }
      
      groupedStories[authorId].stories.push({
        _id: story._id,
        mediaUrl: story.mediaUrl,
        createdAt: story.createdAt
      });
    });

    const result = Object.values(groupedStories);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
