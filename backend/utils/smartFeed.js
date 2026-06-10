import Post from '../models/Post.js';
import Follow from '../models/Follow.js';
import Comment from '../models/Comment.js';

export const getSmartFeedAlgorithm = async (user, page = 1, limit = 10) => {
  try {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    // Get following user IDs
    let followedUserIds = [];
    if (user) {
      const followingList = await Follow.find({ follower: user._id }).select('following');
      followedUserIds = followingList.map(f => f.following.toString());
    }

    // Retrieve all active posts from the last 7 days (for relevance, with fallback if few posts)
    // For a demo workspace, let's fetch posts from any time, but rank them
    const allPosts = await Post.find({})
      .populate('author', 'username fullName profilePic bio')
      .lean();

    const scoredPosts = [];
    const now = new Date();

    for (const post of allPosts) {
      let score = 1; // base score

      // 1. Social connection boost (Following author)
      const isFollowingAuthor = user && followedUserIds.includes(post.author._id.toString());
      if (isFollowingAuthor) {
        score += 50;
      }

      // 2. Interest Match (Post content matches user interests)
      if (user && user.interests && user.interests.length > 0) {
        // Match with hashtags
        const matchingHashtags = post.hashtags.filter(tag => 
          user.interests.some(interest => interest.toLowerCase() === tag.toLowerCase())
        );
        score += matchingHashtags.length * 15;

        // Simple text scanning
        const postText = post.content ? post.content.toLowerCase() : '';
        const matchingTextInterests = user.interests.filter(interest => 
          postText.includes(interest.toLowerCase())
        );
        score += matchingTextInterests.length * 10;
      }

      // 3. Engagement metrics
      const likesCount = post.likes ? post.likes.length : 0;
      // Get comment count
      const commentsCount = await Comment.countDocuments({ post: post._id });
      const sharesCount = post.sharesCount || 0;

      score += (likesCount * 2) + (commentsCount * 5) + (sharesCount * 8);

      // 4. Time Decay
      const hoursSinceCreated = Math.abs(now - new Date(post.createdAt)) / 36e5; // diff in hours
      const timeDecayFactor = Math.pow(hoursSinceCreated + 2, 1.2);
      score = score / timeDecayFactor;

      // Include count data in object
      post.commentsCount = commentsCount;
      post.likesCount = likesCount;
      post.isLiked = user ? post.likes.some(id => id.toString() === user._id.toString()) : false;

      scoredPosts.push({ post, score });
    }

    // Sort by calculated score (descending)
    scoredPosts.sort((a, b) => b.score - a.score);

    // Slice for pagination
    const paginatedItems = scoredPosts.slice(skipNum, skipNum + limitNum).map(item => item.post);
    const hasMore = scoredPosts.length > skipNum + limitNum;

    return {
      posts: paginatedItems,
      hasMore,
      totalCount: scoredPosts.length
    };
  } catch (error) {
    console.error('Error executing Smart Feed algorithm:', error);
    throw error;
  }
};
