const express = require('express');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const OnboardingPath = require('../models/OnboardingPath');
const User = require('../models/User');
const geminiService = require('../services/geminiService');
const router = express.Router();

// @route   POST /api/onboarding/:workspaceId/generate
// @desc    Generate personalized onboarding path
// @access  Private
router.post('/:workspaceId/generate', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { learningPreferences = {} } = req.body;

    // Validate workspace access
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'name email role')
      .populate('creator', 'name email');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user._id.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Access denied to this workspace' });
    }

    // Check if user already has an onboarding path for this workspace
    let existingPath = await OnboardingPath.findOne({
      workspace: workspaceId,
      user: req.user.id
    });

    // Gather workspace data for Gemini
    const workspaceData = {
      name: workspace.name,
      description: workspace.description,
      memberCount: workspace.members.length,
      members: workspace.members.map(m => ({
        name: m.user.name,
        role: m.role
      })),
      githubRepo: workspace.githubRepository,
      recentActivity: [], // You can fetch this from timeline events
      keyDocuments: [], // You can fetch this from Notion integration
      githubStats: {}, // You can fetch this from GitHub API
      documentCount: 0,
      documentTypes: [],
      primaryTech: 'JavaScript' // Can be determined from GitHub data
    };

    const userProfile = {
      role: userMembership.role,
      experienceLevel: learningPreferences.experienceLevel || 'intermediate',
      background: learningPreferences.background || 'general',
      name: req.user.name
    };

    // Generate onboarding path using Gemini
    const onboardingContent = await geminiService.generateOnboardingPath(workspaceData, userProfile);
    
    // Parse the response (handle potential JSON parsing)
    let parsedPath;
    try {
      parsedPath = JSON.parse(onboardingContent);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response from text
      parsedPath = {
        gettingStarted: [onboardingContent],
        keyPeople: [],
        essentialDocuments: [],
        criticalCodeAreas: [],
        timeline: []
      };
    }

    let onboardingPath;

    if (existingPath) {
      // Update existing path
      existingPath.path = parsedPath;
      existingPath.learningPreferences = learningPreferences;
      existingPath.generatedAt = new Date();
      existingPath.isCompleted = false;
      existingPath.completedAt = undefined;
      existingPath.progress = {
        completedTasks: [],
        currentStep: 0,
        lastUpdated: new Date()
      };
      
      await existingPath.save();
      onboardingPath = existingPath;
    } else {
      // Create new onboarding path
      onboardingPath = new OnboardingPath({
        workspace: workspaceId,
        user: req.user.id,
        path: parsedPath,
        learningPreferences,
        generatedAt: new Date(),
        isCompleted: false,
        progress: {
          completedTasks: [],
          currentStep: 0,
          lastUpdated: new Date()
        }
      });

      await onboardingPath.save();
    }

    res.json({
      success: true,
      onboardingPath: parsedPath,
      pathId: onboardingPath._id,
      message: existingPath ? 'Onboarding path updated successfully' : 'Onboarding path created successfully'
    });

  } catch (error) {
    console.error('Error generating onboarding path:', error);
    res.status(500).json({ 
      message: 'Failed to generate onboarding path',
      error: error.message 
    });
  }
});

// @route   GET /api/onboarding/:workspaceId/path
// @desc    Get user's onboarding path for workspace
// @access  Private
router.get('/:workspaceId/path', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const onboardingPath = await OnboardingPath.findOne({
      workspace: workspaceId,
      user: req.user.id
    }).populate('workspace', 'name description');

    if (!onboardingPath) {
      return res.status(404).json({ message: 'No onboarding path found' });
    }

    res.json({
      success: true,
      onboardingPath
    });

  } catch (error) {
    console.error('Error fetching onboarding path:', error);
    res.status(500).json({ message: 'Failed to fetch onboarding path' });
  }
});

// @route   POST /api/onboarding/:workspaceId/tasks
// @desc    Generate personalized tasks
// @access  Private
router.post('/:workspaceId/tasks', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { learningPreferences } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const workspaceData = {
      name: workspace.name,
      primaryTech: 'JavaScript',
      memberCount: workspace.members?.length || 0
    };

    const userProfile = {
      role: 'Member',
      experienceLevel: learningPreferences?.experienceLevel || 'intermediate',
      background: learningPreferences?.background || 'general'
    };

    const tasksContent = await geminiService.generatePersonalizedTasks(
      userProfile, 
      workspaceData, 
      learningPreferences
    );

    let tasks;
    try {
      tasks = JSON.parse(tasksContent);
    } catch (parseError) {
      tasks = [
        {
          title: "Explore Workspace",
          description: "Get familiar with the workspace structure and team members",
          estimatedTime: "30 minutes",
          priority: "high",
          prerequisites: "None"
        }
      ];
    }

    res.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error('Error generating tasks:', error);
    res.status(500).json({ message: 'Failed to generate tasks' });
  }
});

// @route   PUT /api/onboarding/:pathId/progress
// @desc    Update onboarding progress
// @access  Private
router.put('/:pathId/progress', auth, async (req, res) => {
  try {
    const { pathId } = req.params;
    const { completedTasks, currentStep, isCompleted } = req.body;

    // Validate pathId
    if (!pathId || pathId === 'undefined' || pathId === 'null') {
      return res.status(400).json({ message: 'Valid path ID is required' });
    }

    const onboardingPath = await OnboardingPath.findById(pathId);
    if (!onboardingPath) {
      return res.status(404).json({ message: 'Onboarding path not found' });
    }

    if (onboardingPath.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this path' });
    }

    onboardingPath.progress = {
      completedTasks: completedTasks || [],
      currentStep: currentStep || 0,
      lastUpdated: new Date()
    };

    if (isCompleted !== undefined) {
      onboardingPath.isCompleted = isCompleted;
      if (isCompleted) {
        onboardingPath.completedAt = new Date();
      }
    }

    await onboardingPath.save();

    res.json({
      success: true,
      progress: onboardingPath.progress
    });

  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ message: 'Failed to update progress' });
  }
});

// @route   DELETE /api/onboarding/:workspaceId/reset
// @desc    Reset/delete user's onboarding path for workspace
// @access  Private
router.delete('/:workspaceId/reset', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await OnboardingPath.findOneAndDelete({
      workspace: workspaceId,
      user: req.user.id
    });

    if (!result) {
      return res.status(404).json({ message: 'No onboarding path found to reset' });
    }

    res.json({
      success: true,
      message: 'Onboarding path reset successfully'
    });

  } catch (error) {
    console.error('Error resetting onboarding path:', error);
    res.status(500).json({ message: 'Failed to reset onboarding path' });
  }
});

module.exports = router;