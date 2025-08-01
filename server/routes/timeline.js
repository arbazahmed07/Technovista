const express = require('express');
const router = express.Router();
const TimelineEvent = require('../models/TimelineEvent');
const Workspace = require('../models/Workspace');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// @route   GET /api/timeline/:workspaceId
// @desc    Get all timeline events for a workspace
// @access  Private
router.get('/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

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

    // Get timeline events
    const events = await TimelineEvent.find({ workspace: workspaceId })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ date: 1 });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/timeline/:workspaceId
// @desc    Create a new timeline event
// @access  Private
router.post('/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { title, description, type, status, date, assignedTo, tags, priority } = req.body;

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

    // Create new timeline event
    const newEvent = new TimelineEvent({
      workspace: workspaceId,
      title,
      description,
      type: type || 'milestone',
      status: status || 'planned',
      date,
      createdBy: req.user.id,
      assignedTo: assignedTo || [],
      tags: tags || [],
      priority: priority || 'medium'
    });

    await newEvent.save();

    // Populate the response
    await newEvent.populate('createdBy', 'name email');
    await newEvent.populate('assignedTo', 'name email');

    res.status(201).json({
      success: true,
      event: newEvent,
      message: 'Timeline event created successfully'
    });
  } catch (error) {
    console.error('Error creating timeline event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/timeline/:workspaceId/:eventId
// @desc    Update a timeline event
// @access  Private
router.patch('/:workspaceId/:eventId', auth, async (req, res) => {
  try {
    const { workspaceId, eventId } = req.params;
    const updates = req.body;

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

    // Find and update the event
    const event = await TimelineEvent.findOne({ 
      _id: eventId, 
      workspace: workspaceId 
    });

    if (!event) {
      return res.status(404).json({ message: 'Timeline event not found' });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'type', 'status', 'date', 'assignedTo', 'tags', 'priority'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        event[field] = updates[field];
      }
    });

    await event.save();
    await event.populate('createdBy', 'name email');
    await event.populate('assignedTo', 'name email');

    res.json({
      success: true,
      event,
      message: 'Timeline event updated successfully'
    });
  } catch (error) {
    console.error('Error updating timeline event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/timeline/:workspaceId/:eventId
// @desc    Delete a timeline event
// @access  Private
router.delete('/:workspaceId/:eventId', auth, async (req, res) => {
  try {
    const { workspaceId, eventId } = req.params;

    // Check if user has access to workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || (userMembership.role !== 'Creator' && userMembership.role !== 'Admin')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Find and delete the event
    const event = await TimelineEvent.findOneAndDelete({ 
      _id: eventId, 
      workspace: workspaceId 
    });

    if (!event) {
      return res.status(404).json({ message: 'Timeline event not found' });
    }

    res.json({
      success: true,
      message: 'Timeline event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting timeline event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/timeline/:workspaceId/analytics
// @desc    Get timeline analytics for a workspace
// @access  Private
router.get('/:workspaceId/analytics', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

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

    // Get analytics data
    const totalEvents = await TimelineEvent.countDocuments({ workspace: workspaceId });
    
    const statusCounts = await TimelineEvent.aggregate([
      { $match: { workspace: mongoose.Types.ObjectId(workspaceId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const typeCounts = await TimelineEvent.aggregate([
      { $match: { workspace: mongoose.Types.ObjectId(workspaceId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const overdueTasks = await TimelineEvent.countDocuments({
      workspace: workspaceId,
      date: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    });

    const upcomingTasks = await TimelineEvent.countDocuments({
      workspace: workspaceId,
      date: { 
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
      },
      status: { $nin: ['completed', 'cancelled'] }
    });

    res.json({
      success: true,
      analytics: {
        totalEvents,
        statusCounts,
        typeCounts,
        overdueTasks,
        upcomingTasks
      }
    });
  } catch (error) {
    console.error('Error fetching timeline analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;