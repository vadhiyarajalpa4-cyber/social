import mongoose from 'mongoose';

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    mediaUrl: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // Automatically delete document after 24 hours (86400 seconds)
    }
  }
);

const Story = mongoose.model('Story', storySchema);
export default Story;
