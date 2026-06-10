import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';

// @desc    Get user profile details by username
// @route   GET /api/users/profile/:username
// @access  Public
export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() }).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate details
    const totalPosts = await Post.countDocuments({ author: user._id });
    const followersCount = await Follow.countDocuments({ following: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    // Calculate total likes received
    const userPosts = await Post.find({ author: user._id });
    const likesReceived = userPosts.reduce((acc, post) => acc + (post.likes ? post.likes.length : 0), 0);

    // Check if the requesting user is following this user
    let isFollowing = false;
    if (req.user) {
      const followRecord = await Follow.findOne({
        follower: req.user._id,
        following: user._id
      });
      isFollowing = !!followRecord;
    }

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        totalPosts,
        followersCount,
        followingCount,
        likesReceived,
        isFollowing
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { fullName, bio, location, website, interests } = req.body;

    user.fullName = fullName || user.fullName;
    user.bio = bio !== undefined ? bio : user.bio;
    user.location = location !== undefined ? location : user.location;
    user.website = website !== undefined ? website : user.website;

    if (interests) {
      user.interests = Array.isArray(interests) 
        ? interests 
        : interests.split(',').map(i => i.trim()).filter(Boolean);
    }

    // Process files if uploaded
    if (req.files) {
      if (req.files.profilePic) {
        user.profilePic = `/uploads/${req.files.profilePic[0].filename}`;
      }
      if (req.files.coverPic) {
        user.coverPic = `/uploads/${req.files.coverPic[0].filename}`;
      }
    }

    const updatedUser = await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        profilePic: updatedUser.profilePic,
        coverPic: updatedUser.coverPic,
        bio: updatedUser.bio,
        location: updatedUser.location,
        website: updatedUser.website,
        interests: updatedUser.interests,
        role: updatedUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Follow / Unfollow user
// @route   POST /api/users/follow/:id
// @access  Private
export const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User to follow not found' });
    }

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: targetUserId
    });

    if (existingFollow) {
      // Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });
      
      // Delete notification
      await Notification.deleteOne({
        sender: currentUserId,
        receiver: targetUserId,
        type: 'follow'
      });

      return res.json({ success: true, isFollowing: false, message: `Unfollowed ${targetUser.username}` });
    } else {
      // Follow
      await Follow.create({
        follower: currentUserId,
        following: targetUserId
      });

      // Create notification
      await Notification.create({
        sender: currentUserId,
        receiver: targetUserId,
        type: 'follow',
        entityId: currentUserId
      });

      return res.json({ success: true, isFollowing: true, message: `Followed ${targetUser.username}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user followers list
// @route   GET /api/users/:id/followers
// @access  Public
export const getUserFollowers = async (req, res) => {
  try {
    const userId = req.params.id;
    const followers = await Follow.find({ following: userId })
      .populate('follower', 'username fullName profilePic bio')
      .sort({ createdAt: -1 });

    const formattedFollowers = followers.map(f => f.follower).filter(Boolean);
    res.json({ success: true, data: formattedFollowers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user following list
// @route   GET /api/users/:id/following
// @access  Public
export const getUserFollowing = async (req, res) => {
  try {
    const userId = req.params.id;
    const following = await Follow.find({ follower: userId })
      .populate('following', 'username fullName profilePic bio')
      .sort({ createdAt: -1 });

    const formattedFollowing = following.map(f => f.following).filter(Boolean);
    res.json({ success: true, data: formattedFollowing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get recommended users to follow
// @route   GET /api/users/recommendations
// @access  Private
export const getRecommendedUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get list of user IDs currently followed
    const followingRecords = await Follow.find({ follower: currentUserId }).select('following');
    const followedIds = followingRecords.map(f => f.following.toString());
    followedIds.push(currentUserId.toString()); // Exclude self

    // Find users not followed yet
    const nonFollowedUsers = await User.find({ _id: { $nin: followedIds } }).limit(20);

    // Calculate recommendation weights
    const recommendations = [];

    for (const u of nonFollowedUsers) {
      let score = 0;
      let reason = 'ConnectSphere Suggestion';

      // 1. Shared Interests Match
      const commonInterests = u.interests.filter(i => req.user.interests.includes(i));
      if (commonInterests.length > 0) {
        score += commonInterests.length * 3;
        reason = `Both like ${commonInterests[0]}`;
      }

      // 2. Mutual Connections
      // Find who the recommended user is following
      const theirFollowingRecords = await Follow.find({ follower: u._id }).select('following');
      const theirFollowingIds = theirFollowingRecords.map(f => f.following.toString());
      
      // Calculate how many of those the current user follows
      const mutualCount = theirFollowingIds.filter(id => followedIds.includes(id)).length;
      if (mutualCount > 0) {
        score += mutualCount * 5;
        reason = `${mutualCount} mutual connection${mutualCount > 1 ? 's' : ''}`;
      }

      recommendations.push({
        user: {
          _id: u._id,
          username: u.username,
          fullName: u.fullName,
          profilePic: u.profilePic,
          bio: u.bio
        },
        score,
        reason
      });
    }

    // Sort by recommendation score and slice top 5
    recommendations.sort((a, b) => b.score - a.score);
    const topRecommendations = recommendations.slice(0, 5).map(r => ({
      ...r.user,
      recommendationReason: r.reason
    }));

    res.json({ success: true, data: topRecommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search profiles, posts, or tags
// @route   GET /api/users/search
// @access  Public
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(query, 'i');
    const users = await User.find({
      $or: [
        { username: regex },
        { fullName: regex }
      ]
    }).select('username fullName profilePic bio').limit(10);

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
