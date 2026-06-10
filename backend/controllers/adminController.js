import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Report from '../models/Report.js';

// @desc    Get dashboard analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
export const getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalPosts = await Post.countDocuments({});
    const totalComments = await Comment.countDocuments({});
    
    // Count total likes
    const posts = await Post.find({});
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes ? post.likes.length : 0), 0);

    // Calculate Engagement Rate
    const totalInteractions = totalLikes + totalComments;
    const engagementRate = totalUsers > 0 ? ((totalInteractions / totalUsers)).toFixed(1) : 0;

    // Get posts count per day for the last 7 days
    const postTrends = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const count = await Post.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      postTrends.push({ day: dayName, count });
    }

    // Get user interest distribution
    const users = await User.find({});
    const interestCounts = {};
    users.forEach(u => {
      if (u.interests) {
        u.interests.forEach(interest => {
          const formatted = interest.toLowerCase().trim();
          interestCounts[formatted] = (interestCounts[formatted] || 0) + 1;
        });
      }
    });

    const categoryDistribution = Object.entries(interestCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPosts,
        totalComments,
        totalLikes,
        engagementRate,
        postTrends,
        categoryDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user list
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsersList = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUserAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete an administrator account' });
    }

    await User.deleteOne({ _id: user._id });
    await Post.deleteMany({ author: user._id });
    await Comment.deleteMany({ author: user._id });
    
    res.json({ success: true, message: 'User and all their content deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reported posts
// @route   GET /api/admin/reports
// @access  Private/Admin
export const getReports = async (req, res) => {
  try {
    const reports = await Report.find({})
      .populate('reporter', 'username fullName')
      .populate({
        path: 'post',
        populate: {
          path: 'author',
          select: 'username fullName profilePic'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Report a post
// @route   POST /api/admin/reports/:postId
// @access  Private
export const reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason for reporting is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if reporter already reported this post
    const alreadyReported = await Report.findOne({
      reporter: req.user._id,
      post: postId
    });

    if (alreadyReported) {
      return res.status(400).json({ success: false, message: 'You have already reported this post' });
    }

    const report = await Report.create({
      reporter: req.user._id,
      post: postId,
      reason
    });

    post.reportsCount += 1;
    await post.save();

    res.status(201).json({ success: true, data: report, message: 'Post reported successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resolve a report (dismiss or take action)
// @route   PUT /api/admin/reports/:id
// @access  Private/Admin
export const resolveReport = async (req, res) => {
  try {
    const { action } = req.body; // 'dismiss' or 'delete_post'
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (action === 'delete_post') {
      const post = await Post.findById(report.post);
      if (post) {
        await Post.deleteOne({ _id: post._id });
        await Comment.deleteMany({ post: post._id });
      }
    }

    report.status = 'resolved';
    await report.save();

    res.json({ success: true, message: `Report resolved via action: ${action}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
