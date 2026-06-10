import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: function() {
        return !this.mediaUrl; // Content is required if no media is provided
      },
      trim: true
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    hashtags: {
      type: [String],
      default: [],
      index: true
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
      }
    ],
    sharesCount: {
      type: Number,
      default: 0
    },
    reportsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Post = mongoose.model('Post', postSchema);
export default Post;
