import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import notificationRoutes from './routes/notifications.js';
import chatRoutes from './routes/chat.js';
import storyRoutes from './routes/stories.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/admin', adminRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'ConnectSphere API is running...' });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.io Real-Time Coordination
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins with their User ID
  socket.on('join', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`User ${userId} associated with socket ${socket.id}`);
      
      // Broadcast online status update
      io.emit('user_status', { userId, status: 'online' });
      // Send active list
      io.emit('online_users_list', Array.from(onlineUsers.keys()));
    }
  });

  // Typing indicator trigger
  socket.on('typing', (data) => {
    // data = { senderId, receiverId, isTyping }
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing_status', {
        senderId: data.senderId,
        isTyping: data.isTyping
      });
    }
  });

  // Direct Message forwarding
  socket.on('send_message', (messageData) => {
    // messageData is the populated message object from DB
    const receiverSocketId = onlineUsers.get(messageData.receiver._id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', messageData);
    }
  });

  // Real-time notification dispatch
  socket.on('send_notification', (notifData) => {
    // notifData = { receiverId, senderName, type, entityId }
    const receiverSocketId = onlineUsers.get(notifData.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_notification', notifData);
    }
  });

  // Check if a user is online
  socket.on('check_online', (targetUserId, callback) => {
    const isOnline = onlineUsers.has(targetUserId);
    callback({ isOnline });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user_status', { userId: socket.userId, status: 'offline' });
      io.emit('online_users_list', Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`ConnectSphere server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
