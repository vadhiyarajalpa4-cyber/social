import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Comment from '../models/Comment.js';
import { getSmartFeedAlgorithm } from '../utils/smartFeed.js';

// Helper to extract hashtags and mentions
const parseHashtagsAndMentions = async (content) => {
  const hashtags = [];
  const mentions = [];
  
  if (!content) return { hashtags, mentions };

  // Parse hashtags (#word)
  const hashRegex = /#(\w+)/g;
  let match;
  while ((match = hashRegex.exec(content)) !== null) {
    if (!hashtags.includes(match[1])) {
      hashtags.push(match[1].toLowerCase());
    }
  }

  // Parse mentions (@username)
  const mentionRegex = /@(\w+)/g;
  while ((match = mentionRegex.exec(content)) !== null) {
    const user = await User.findOne({ username: match[1].toLowerCase() });
    if (user && !mentions.includes(user._id.toString())) {
      mentions.push(user._id);
    }
  }

  return { hashtags, mentions };
};

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    let mediaUrl = '';

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    if (!content && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Post content or an image is required' });
    }

    const { hashtags, mentions } = await parseHashtagsAndMentions(content);

    const post = await Post.create({
      author: req.user._id,
      content,
      mediaUrl,
      hashtags,
      mentions
    });

    // Populate author details
    const populatedPost = await Post.findById(post._id).populate('author', 'username fullName profilePic bio');

    // Create notifications for mentions
    for (const mentionId of mentions) {
      if (mentionId.toString() !== req.user._id.toString()) {
        await Notification.create({
          sender: req.user._id,
          receiver: mentionId,
          type: 'mention',
          entityId: post._id
        });
      }
    }

    res.status(201).json({ success: true, data: populatedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get smart recommended feed for current user
// @route   GET /api/posts/feed
// @access  Private/Public (optional token support)
export const getFeed = async (req, res) => {
  try {
    const { page, limit } = req.query;
    // req.user might be undefined if route is public
    const feed = await getSmartFeedAlgorithm(req.user, page, limit);
    res.json({ success: true, ...feed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get post by ID
// @route   GET /api/posts/:id
// @access  Public
export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username fullName profilePic bio');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const commentsCount = await Comment.countDocuments({ post: post._id });
    const isLiked = req.user ? post.likes.some(id => id.toString() === req.user._id.toString()) : false;

    res.json({
      success: true,
      data: {
        ...post.toObject(),
        commentsCount,
        likesCount: post.likes.length,
        isLiked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Edit user post
// @route   PUT /api/posts/:id
// @access  Private
export const editPost = async (req, res) => {
  try {
    const { content } = req.body;
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Verify ownership
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'User is not authorized to edit this post' });
    }

    post.content = content || post.content;
    const { hashtags, mentions } = await parseHashtagsAndMentions(content);
    post.hashtags = hashtags;
    post.mentions = mentions;

    if (req.file) {
      post.mediaUrl = `/uploads/${req.file.filename}`;
    }

    const updatedPost = await post.save();
    const populated = await Post.findById(updatedPost._id).populate('author', 'username fullName profilePic bio');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Verify ownership or check if Admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'User is not authorized to delete this post' });
    }

    await Post.deleteOne({ _id: post._id });
    
    // Also delete associated comments
    await Comment.deleteMany({ post: post._id });

    // Also delete bookmarks reference for all users
    await User.updateMany(
      { bookmarks: post._id },
      { $pull: { bookmarks: post._id } }
    );

    res.json({ success: true, message: 'Post and associated comments deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Like / Unlike post
// @route   POST /api/posts/like/:id
// @access  Private
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const alreadyLiked = post.likes.some(id => id.toString() === req.user._id.toString());

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
      await post.save();

      // Delete like notification
      await Notification.deleteOne({
        sender: req.user._id,
        receiver: post.author,
        type: 'like',
        entityId: post._id
      });

      res.json({ success: true, isLiked: false, likesCount: post.likes.length });
    } else {
      // Like
      post.likes.push(req.user._id);
      await post.save();

      // Trigger notification if not liking own post
      if (post.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          sender: req.user._id,
          receiver: post.author,
          type: 'like',
          entityId: post._id
        });
      }

      res.json({ success: true, isLiked: true, likesCount: post.likes.length });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bookmark / Unbookmark post
// @route   POST /api/posts/bookmark/:id
// @access  Private
export const bookmarkPost = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const isBookmarked = user.bookmarks.some(id => id.toString() === postId);

    if (isBookmarked) {
      user.bookmarks = user.bookmarks.filter(id => id.toString() !== postId);
      await user.save();
      res.json({ success: true, isBookmarked: false, message: 'Post removed from bookmarks' });
    } else {
      user.bookmarks.push(postId);
      await user.save();
      res.json({ success: true, isBookmarked: true, message: 'Post added to bookmarks' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user specific posts
// @route   GET /api/posts/user/:username
// @access  Public
export const getUserPosts = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const posts = await Post.find({ author: user._id })
      .populate('author', 'username fullName profilePic bio')
      .sort({ createdAt: -1 });

    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const commentsCount = await Comment.countDocuments({ post: post._id });
      const isLiked = req.user ? post.likes.some(id => id.toString() === req.user._id.toString()) : false;
      return {
        ...post.toObject(),
        commentsCount,
        likesCount: post.likes.length,
        isLiked
      };
    }));

    res.json({ success: true, data: postsWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's bookmarked posts
// @route   GET /api/posts/bookmarks/list
// @access  Private
export const getBookmarkedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'bookmarks',
      populate: {
        path: 'author',
        select: 'username fullName profilePic bio'
      }
    });

    const postsWithCounts = await Promise.all(user.bookmarks.map(async (post) => {
      if (!post) return null;
      const commentsCount = await Comment.countDocuments({ post: post._id });
      const isLiked = req.user ? post.likes.some(id => id.toString() === req.user._id.toString()) : false;
      return {
        ...post.toObject(),
        commentsCount,
        likesCount: post.likes.length,
        isLiked
      };
    }));

    // Filter nulls in case some referenced posts were deleted
    const filteredBookmarks = postsWithCounts.filter(Boolean);

    res.json({ success: true, data: filteredBookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search posts by query, hashtag or mentions
// @route   GET /api/posts/search/items
// @access  Public
export const searchPosts = async (req, res) => {
  try {
    const { query, hashtag, sort } = req.query;
    const filter = {};

    if (query) {
      filter.content = new RegExp(query, 'i');
    }
    if (hashtag) {
      filter.hashtags = hashtag.toLowerCase();
    }

    let posts = await Post.find(filter)
      .populate('author', 'username fullName profilePic bio');

    // Add extra engagement scores for sorting
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const commentsCount = await Comment.countDocuments({ post: post._id });
      const isLiked = req.user ? post.likes.some(id => id.toString() === req.user._id.toString()) : false;
      return {
        ...post.toObject(),
        commentsCount,
        likesCount: post.likes.length,
        isLiked
      };
    }));

    // Sort by latest vs popularity
    if (sort === 'popular') {
      postsWithCounts.sort((a, b) => {
        const scoreA = a.likesCount + (a.commentsCount * 2);
        const scoreB = b.likesCount + (b.commentsCount * 2);
        return scoreB - scoreA;
      });
    } else {
      // Default latest
      postsWithCounts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ success: true, data: postsWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Increment post share count
// @route   POST /api/posts/share/:id
// @access  Private
export const sharePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.sharesCount += 1;
    await post.save();

    res.json({ success: true, sharesCount: post.sharesCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
