import Notification from '../models/Notification.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ receiver: req.user._id })
      .populate('sender', 'username fullName profilePic')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
export const markNotificationsAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await Notification.updateMany(
        { _id: { $in: notificationIds }, receiver: req.user._id },
        { $set: { read: true } }
      );
    } else {
      // Mark all user notifications as read
      await Notification.updateMany(
        { receiver: req.user._id },
        { $set: { read: true } }
      );
    }

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
