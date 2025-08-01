const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('./models/User');
    
    // Fix: Use decoded.id instead of decoded.user.id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.userInfo = {
      id: user._id,
      name: user.name,
      email: user.email
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userInfo.name} connected`);

  // Join workspace room
  socket.on('join-workspace', (workspaceId) => {
    socket.join(`workspace-${workspaceId}`);
    console.log(`User ${socket.userInfo.name} joined workspace ${workspaceId}`);
  });

  // Leave workspace room
  socket.on('leave-workspace', (workspaceId) => {
    socket.leave(`workspace-${workspaceId}`);
    console.log(`User ${socket.userInfo.name} left workspace ${workspaceId}`);
  });

  // Handle chat messages
  socket.on('send-message', async (data) => {
    try {
      const { workspaceId, message, type = 'text' } = data;
      
      // Save message to database
      const Message = require('./models/Message');
      const newMessage = await Message.create({
        workspace: workspaceId,
        sender: socket.userId,
        content: message,
        type
      });

      await newMessage.populate('sender', 'name email');

      // Emit to all users in the workspace
      io.to(`workspace-${workspaceId}`).emit('new-message', {
        id: newMessage._id,
        content: newMessage.content,
        type: newMessage.type,
        sender: {
          id: newMessage.sender._id,
          name: newMessage.sender.name,
          email: newMessage.sender.email
        },
        timestamp: newMessage.createdAt
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    socket.to(`workspace-${data.workspaceId}`).emit('user-typing', {
      userId: socket.userId,
      userName: socket.userInfo.name
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`workspace-${data.workspaceId}`).emit('user-stopped-typing', {
      userId: socket.userId
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userInfo.name} disconnected`);
  });
});

// Import the search routes
// const searchRoutes = require('./routes/search');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/invites', require('./routes/invites'));
app.use('/api/github', require('./routes/github'));
app.use('/api/notion', require('./routes/notion'));
app.use('/api/search', require('./routes/search')); // Add this line
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/meet', require('./routes/meet'));
app.use('/api/onboarding', require('./routes/onboarding'));
// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});