import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';

// @desc    Add comment/reply to post
// @route   POST /api/comments/:postId
// @access  Private
export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentComment } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = await Comment.create({
      post: postId,
      author: req.user._id,
      content,
      parentComment: parentComment || null
    });

    const populated = await Comment.findById(comment._id)
      .populate('author', 'username fullName profilePic');

    // Send notifications
    if (parentComment) {
      // It's a nested reply
      const originalComment = await Comment.findById(parentComment);
      if (originalComment && originalComment.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          sender: req.user._id,
          receiver: originalComment.author,
          type: 'comment',
          entityId: comment._id
        });
      }
    } else {
      // Base post comment
      if (post.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          sender: req.user._id,
          receiver: post.author,
          type: 'comment',
          entityId: comment._id
        });
      }
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get comments/replies of a post
// @route   GET /api/comments/:postId
// @access  Public
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // Retrieve comments populated with author info
    const comments = await Comment.find({ post: postId })
      .populate('author', 'username fullName profilePic')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Edit comment
// @route   PUT /api/comments/:id
// @access  Private
export const editComment = async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this comment' });
    }

    comment.content = content || comment.content;
    const updated = await comment.save();
    const populated = await Comment.findById(updated._id).populate('author', 'username fullName profilePic');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete comment and its replies
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Verify ownership or admin role
    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    // Find and delete all child replies recursively (or direct children)
    await Comment.deleteMany({
      $or: [
        { _id: comment._id },
        { parentComment: comment._id }
      ]
    });

    // Clean up notifications matching this comment ID
    await Notification.deleteMany({ entityId: comment._id });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
