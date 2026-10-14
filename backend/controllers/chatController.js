import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Send a message
// @route   POST /api/chat/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    let mediaUrl = '';

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      text,
      mediaUrl
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'username fullName profilePic')
      .populate('receiver', 'username fullName profilePic');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get message history between current user and target user
// @route   GET /api/chat/messages/:userId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    // Retrieve conversation history
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username fullName profilePic')
    .populate('receiver', 'username fullName profilePic');

    // Mark these messages as read if the recipient was current user
    await Message.updateMany(
      { sender: targetUserId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get list of conversations (chat partners)
// @route   GET /api/chat/conversations
// @access  Private
export const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all messages involving the current user
    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
    .sort({ createdAt: -1 });

    // Extract unique chat partner IDs
    const partnerIds = new Set();
    const latestMessages = {};

    messages.forEach((msg) => {
      const partnerId = msg.sender.toString() === currentUserId.toString()
        ? msg.receiver.toString()
        : msg.sender.toString();

      if (!partnerIds.has(partnerId)) {
        partnerIds.add(partnerId);
        latestMessages[partnerId] = msg;
      }
    });

    const conversationList = [];

    for (const partnerId of partnerIds) {
      const partner = await User.findById(partnerId).select('username fullName profilePic');
      if (!partner) continue;

      // Count unread messages sent by this partner
      const unreadCount = await Message.countDocuments({
        sender: partnerId,
        receiver: currentUserId,
        read: false
      });

      conversationList.push({
        user: partner,
        lastMessage: latestMessages[partnerId],
        unreadCount
      });
    }

    // Sort by last message date descending
    conversationList.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ success: true, data: conversationList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    React to a chat message
// @route   PUT /api/chat/messages/:messageId/react
// @access  Private
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    const existingIdx = message.reactions.findIndex(
      r => r.user.toString() === currentUserId.toString() && r.emoji === emoji
    );

    if (existingIdx > -1) {
      // Toggle off if same emoji clicked again
      message.reactions.splice(existingIdx, 1);
    } else {
      // Remove previous reaction from this user and add new one
      message.reactions = message.reactions.filter(
        r => r.user.toString() !== currentUserId.toString()
      );
      message.reactions.push({ user: currentUserId, emoji: emoji || '❤️' });
    }

    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'username fullName profilePic')
      .populate('receiver', 'username fullName profilePic');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a message
// @route   DELETE /api/chat/messages/:messageId
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }

    await Message.deleteOne({ _id: messageId });
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

