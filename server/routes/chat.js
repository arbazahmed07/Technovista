const express = require('express');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const router = express.Router();

// @route   GET /api/chat/:workspaceId/messages
// @desc    Get chat messages for a workspace
// @access  Private
router.get('/:workspaceId/messages', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user has access to workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Access denied to this workspace' });
    }

    // Get messages with pagination
    const messages = await Message.find({ workspace: workspaceId })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Reverse to show oldest first
    const formattedMessages = messages.reverse().map(message => ({
      id: message._id,
      content: message.content,
      type: message.type,
      sender: {
        id: message.sender._id,
        name: message.sender.name,
        email: message.sender.email
      },
      timestamp: message.createdAt,
      edited: message.edited,
      editedAt: message.editedAt
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/chat/:workspaceId/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:workspaceId/messages/:messageId', auth, async (req, res) => {
  try {
    const { workspaceId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Find the message
    const message = await Message.findOne({
      _id: messageId,
      workspace: workspaceId,
      sender: req.user.id
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found or unauthorized' });
    }

    // Update message
    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Message updated successfully'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/chat/:workspaceId/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:workspaceId/messages/:messageId', auth, async (req, res) => {
  try {
    const { workspaceId, messageId } = req.params;

    // Find the message
    const message = await Message.findOne({
      _id: messageId,
      workspace: workspaceId,
      sender: req.user.id
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found or unauthorized' });
    }

    await Message.deleteOne({ _id: messageId });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;