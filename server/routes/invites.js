const express = require('express');
const auth = require('../middleware/auth');
const Invite = require('../models/Invite');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/invites/pending
// @desc    Get pending invitations for the authenticated user
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    console.log('Fetching pending invites for user:', req.user.email);
    
    const invites = await Invite.find({
      email: req.user.email.toLowerCase(),
      status: 'pending'
    })
    .populate('workspace', 'name description')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });

    console.log('Found invites:', invites.length);

    const formattedInvites = invites.map(invite => ({
      id: invite._id,
      workspace: {
        id: invite.workspace._id,
        name: invite.workspace.name,
        description: invite.workspace.description
      },
      invitedBy: {
        name: invite.invitedBy.name,
        email: invite.invitedBy.email
      },
      createdAt: invite.createdAt,
      email: invite.email
    }));

    res.json({
      success: true,
      invites: formattedInvites
    });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invites/:inviteId/accept
// @desc    Accept a workspace invitation
// @access  Private
router.post('/:inviteId/accept', auth, async (req, res) => {
  try {
    const { inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if the invite belongs to the current user
    if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'Not authorized to accept this invitation' });
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation has already been processed' });
    }

    // Find the workspace
    const workspace = await Workspace.findById(invite.workspace);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is already a member
    const existingMember = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (existingMember) {
      // Update invite status but don't add as duplicate member
      invite.status = 'accepted';
      await invite.save();
      return res.json({ 
        success: true, 
        message: 'Already a member of this workspace' 
      });
    }

    // Add user to workspace members
    workspace.members.push({
      user: req.user.id,
      role: 'Member',
      joinedAt: new Date()
    });

    // Update invite status
    invite.status = 'accepted';

    // Save both documents
    await Promise.all([workspace.save(), invite.save()]);

    res.json({
      success: true,
      message: 'Invitation accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invites/:inviteId/decline
// @desc    Decline a workspace invitation
// @access  Private
router.post('/:inviteId/decline', auth, async (req, res) => {
  try {
    const { inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if the invite belongs to the current user
    if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'Not authorized to decline this invitation' });
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invitation has already been processed' });
    }

    // Update invite status
    invite.status = 'declined';
    await invite.save();

    res.json({
      success: true,
      message: 'Invitation declined successfully'
    });
  } catch (error) {
    console.error('Error declining invite:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/invites/workspace/:workspaceId
// @desc    Get all invitations for a specific workspace (for workspace owners/admins)
// @access  Private
router.get('/workspace/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Find the workspace and check if user has permission
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member with appropriate role
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || !['Creator', 'Admin'].includes(userMembership.role)) {
      return res.status(403).json({ message: 'Not authorized to view workspace invitations' });
    }

    // Get all invitations for this workspace
    const invites = await Invite.find({ workspace: workspaceId })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    const formattedInvites = invites.map(invite => ({
      id: invite._id,
      email: invite.email,
      status: invite.status,
      invitedBy: invite.invitedBy.name,
      invitedByEmail: invite.invitedBy.email,
      createdAt: invite.createdAt
    }));

    res.json({
      success: true,
      invites: formattedInvites
    });
  } catch (error) {
    console.error('Error fetching workspace invites:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/invites/:inviteId
// @desc    Cancel/Delete a workspace invitation (Creator only)
// @access  Private
router.delete('/:inviteId', auth, async (req, res) => {
  try {
    const { inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findById(inviteId).populate('workspace');
    if (!invite) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Find the workspace and check if user is the creator
    const workspace = await Workspace.findById(invite.workspace._id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is the creator of the workspace
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || userMembership.role !== 'Creator') {
      return res.status(403).json({ message: 'Only workspace creators can cancel invitations' });
    }

    // Delete the invitation
    await Invite.findByIdAndDelete(inviteId);

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;