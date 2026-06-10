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
