const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const geminiService = require('../services/geminiService');
const Task = require('../models/Task');
const Workspace = require('../models/Workspace');

// @route   POST /api/ai/chat
// @desc    Chat with AI assistant
// @access  Private
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, workspaceId, currentTask, context } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get workspace context if provided
    let workspaceContext = '';
    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId)
        .populate('members.user', 'name email');
      
      if (workspace) {
        workspaceContext = `
WORKSPACE CONTEXT:
- Name: ${workspace.name}
- Description: ${workspace.description || 'No description'}
- Members: ${workspace.members.length}
`;
      }
    }

    // Get task context if provided
    let taskContext = '';
    if (currentTask) {
      taskContext = `
CURRENT TASK CONTEXT:
- Title: ${currentTask.title}
- Description: ${currentTask.description}
- Status: ${currentTask.status}
`;
    }

    // Build AI prompt based on context
    let systemPrompt = `You are an AI assistant helping team members in a collaborative workspace. `;
    
    if (context === 'task_guidance') {
      systemPrompt += `You specialize in providing step-by-step guidance for completing tasks. Break down complex tasks into manageable steps, provide helpful tips, and offer encouragement. `;
    }
    
    systemPrompt += `Be helpful, concise, and friendly. Provide actionable advice when possible.`;

    const fullPrompt = `${systemPrompt}

${workspaceContext}
${taskContext}

User message: ${message}

Provide a helpful response:`;

    const aiResponse = await geminiService.generateContent(fullPrompt);

    res.json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ 
      message: 'AI service temporarily unavailable',
      response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment."
    });
  }
});

// @route   POST /api/ai/task-guidance
// @desc    Get AI guidance for a specific task
// @access  Private
router.post('/task-guidance', auth, async (req, res) => {
  try {
    const { taskId, question } = req.body;

    const task = await Task.findById(taskId)
      .populate('workspace', 'name description')
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check authorization
    if (task.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const prompt = `You are providing step-by-step guidance for completing a specific task.

TASK DETAILS:
- Title: ${task.title}
- Description: ${task.description}
- Priority: ${task.priority}
- Status: ${task.status}
- Estimated Time: ${task.estimatedTime || 'Not specified'}
- Workspace: ${task.workspace.name}

${question ? `SPECIFIC QUESTION: ${question}` : 'Provide general guidance for this task.'}

Provide helpful, actionable guidance:`;

    const guidance = await geminiService.generateContent(prompt);

    res.json({
      success: true,
      guidance,
      task: {
        id: task._id,
        title: task.title,
        status: task.status
      }
    });

  } catch (error) {
    console.error('Error generating task guidance:', error);
    res.status(500).json({ message: 'Failed to generate guidance' });
  }
});

module.exports = router;