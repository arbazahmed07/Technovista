const express = require('express');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Invite = require('../models/Invite');
const User = require('../models/User');
const router = express.Router();

// @route   POST /api/workspaces
// @desc    Create a new workspace
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, invites = [] } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Workspace name is required' });
    }

    // Create workspace
    const workspace = await Workspace.create({
      name: name.trim(),
      description: description?.trim() || '',
      creator: req.user.id,
      members: [{ user: req.user.id, role: 'Creator' }]
    });

    // Process invitations
    for (const email of invites) {
      if (email.trim() && email !== req.user.email) {
        await Invite.create({
          workspace: workspace._id,
          email: email.trim().toLowerCase(),
          invitedBy: req.user.id,
          status: 'pending'
        });
      }
    }

    // Populate the response
    await workspace.populate('creator', 'name email');

    res.status(201).json({
      success: true,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        description: workspace.description,
        role: 'Creator',
        creator: workspace.creator,
        createdAt: workspace.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/workspaces
// @desc    Get user's workspaces
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      'members.user': req.user.id
    }).populate('creator', 'name email');

    const workspaceList = workspaces.map(workspace => {
      const userMembership = workspace.members.find(
        member => member.user.toString() === req.user.id
      );

      return {
        id: workspace._id,
        name: workspace.name,
        description: workspace.description,
        role: userMembership?.role || 'Member',
        creator: workspace.creator,
        createdAt: workspace.createdAt
      };
    });

    res.json({
      success: true,
      workspaces: workspaceList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/workspaces/:id
// @desc    Get workspace details with members and invites
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the workspace
    const workspace = await Workspace.findById(id)
      .populate('creator', 'name email')
      .populate('members.user', 'name email');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member
    const userMembership = workspace.members.find(
      member => member.user._id.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    // Get all invites for this workspace (only if user is Creator or Admin)
    let invites = [];
    if (['Creator', 'Admin'].includes(userMembership.role)) {
      invites = await Invite.find({ workspace: id })
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });
    }

    // Format the response
    const workspaceData = {
      id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      creator: workspace.creator,
      userRole: userMembership.role,
      createdAt: workspace.createdAt,
      members: workspace.members.map(member => ({
        id: member._id,
        user: {
          id: member.user._id,
          name: member.user.name,
          email: member.user.email
        },
        role: member.role,
        joinedAt: member.joinedAt
      })),
      invites: invites.map(invite => ({
        id: invite._id,
        email: invite.email,
        status: invite.status,
        invitedBy: invite.invitedBy.name,
        invitedByEmail: invite.invitedBy.email,
        createdAt: invite.createdAt
      }))
    };

    res.json({
      success: true,
      workspace: workspaceData
    });
  } catch (error) {
    console.error('Error fetching workspace details:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/workspaces/:id/invite
// @desc    Invite users to an existing workspace
// @access  Private (Creator only)
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Email addresses are required' });
    }

    // Find the workspace
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is the creator
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || userMembership.role !== 'Creator') {
      return res.status(403).json({ 
        message: 'Only workspace creators can invite new members' 
      });
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = [];
    const invalidEmails = [];
    const duplicateEmails = [];
    const existingMembers = [];

    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();
      
      if (!trimmedEmail) continue;
      
      if (!emailRegex.test(trimmedEmail)) {
        invalidEmails.push(email);
        continue;
      }

      if (trimmedEmail === req.user.email.toLowerCase()) {
        continue; // Skip inviting yourself
      }

      // Check if user is already a member
      const existingUser = await User.findOne({ email: trimmedEmail });
      if (existingUser) {
        const isMember = workspace.members.some(
          member => member.user.toString() === existingUser._id.toString()
        );
        if (isMember) {
          existingMembers.push(trimmedEmail);
          continue;
        }
      }

      // Check if invite already exists
      const existingInvite = await Invite.findOne({
        workspace: id,
        email: trimmedEmail,
        status: 'pending'
      });

      if (existingInvite) {
        duplicateEmails.push(trimmedEmail);
        continue;
      }

      validEmails.push(trimmedEmail);
    }

    // Create invitations for valid emails
    const invitePromises = validEmails.map(email => 
      Invite.create({
        workspace: id,
        email,
        invitedBy: req.user.id,
        status: 'pending'
      })
    );

    await Promise.all(invitePromises);

    // Prepare response message
    let message = '';
    if (validEmails.length > 0) {
      message += `${validEmails.length} invitation(s) sent successfully. `;
    }
    if (invalidEmails.length > 0) {
      message += `${invalidEmails.length} invalid email(s) skipped. `;
    }
    if (duplicateEmails.length > 0) {
      message += `${duplicateEmails.length} already invited. `;
    }
    if (existingMembers.length > 0) {
      message += `${existingMembers.length} already member(s). `;
    }

    res.json({
      success: true,
      message: message.trim(),
      invited: validEmails.length,
      details: {
        validEmails,
        invalidEmails,
        duplicateEmails,
        existingMembers
      }
    });
  } catch (error) {
    console.error('Error inviting users to workspace:', error);
    res.status(500).json({ message: 'Failed to send invitations' });
  }
});

module.exports = router;