const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

// @route   POST /api/tasks/assign
// @desc    Assign a task to a member
// @access  Private (Creator only)
router.post('/assign', auth, async (req, res) => {
  try {
    const {
      workspaceId,
      assignedTo,
      title,
      description,
      priority,
      dueDate,
      estimatedTime,
      aiGuidanceEnabled
    } = req.body;

    // Validate required fields
    if (!workspaceId || !assignedTo || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if workspace exists and user is creator
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || userMembership.role !== 'Creator') {
      return res.status(403).json({ message: 'Only workspace creators can assign tasks' });
    }

    // Check if assigned user is a member
    const assignedMembership = workspace.members.find(
      member => member.user.toString() === assignedTo
    );

    if (!assignedMembership) {
      return res.status(400).json({ message: 'User is not a member of this workspace' });
    }

    // Create task
    const task = new Task({
      workspace: workspaceId,
      title: title.trim(),
      description: description.trim(),
      assignedBy: req.user.id,
      assignedTo,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      estimatedTime: estimatedTime?.trim() || null,
      aiGuidanceEnabled: aiGuidanceEnabled !== false,
      status: 'pending',
      createdAt: new Date()
    });

    await task.save();

    // Populate task with user details
    await task.populate([
      { path: 'assignedBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'workspace', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      task,
      message: 'Task assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ message: 'Failed to assign task' });
  }
});

// @route   GET /api/tasks/workspace/:workspaceId
// @desc    Get tasks for a workspace
// @access  Private
router.get('/workspace/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { filter = 'all' } = req.query;

    // Check if user is a member
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view tasks' });
    }

    // Build query
    let query = { workspace: workspaceId };
    
    // If not creator, only show tasks assigned to user
    if (userMembership.role !== 'Creator') {
      query.assignedTo = req.user.id;
    }

    // Apply filter
    if (filter !== 'all') {
      query.status = filter;
    }

    const tasks = await Task.find(query)
      .populate('assignedBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
});

// @route   PUT /api/tasks/:taskId/status
// @desc    Update task status
// @access  Private
router.put('/:taskId/status', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is assigned to this task or is the creator
    const workspace = await Workspace.findById(task.workspace);
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    const canUpdate = task.assignedTo.toString() === req.user.id || 
                     userMembership.role === 'Creator';

    if (!canUpdate) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    // Update task
    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date();
    } else if (status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date();
    }

    await task.save();

    res.json({
      success: true,
      message: 'Task status updated successfully'
    });

  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Failed to update task status' });
  }
});

// @route   GET /api/tasks/:taskId
// @desc    Get single task details
// @access  Private
router.get('/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('assignedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('workspace', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check authorization
    const workspace = await Workspace.findById(task.workspace._id);
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this task' });
    }

    res.json({
      success: true,
      task
    });

  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Failed to fetch task' });
  }
});

module.exports = router;