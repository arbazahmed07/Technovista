const express = require('express');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Invite = require('../models/Invite');
const User = require('../models/User');
const { normalizeArtifacts } = require('../utils/normalizeArtifacts');
const router = express.Router();

// Helper function to fetch GitHub PRs for workspace
const fetchGitHubPRs = async (workspaceId) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.githubRepository?.owner || !workspace?.githubRepository?.repo) {
      return [];
    }

    const { owner, repo } = workspace.githubRepository;
    const axios = require('axios');
    
    const githubAPI = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'EchoHub-App'
      }
    });

    const response = await githubAPI.get(`/repos/${owner}/${repo}/pulls`, {
      params: {
        state: 'all',
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      }
    });

    return response.data.map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      merged: pr.merged_at !== null,
      draft: pr.draft,
      author: {
        login: pr.user.login,
        avatar: pr.user.avatar_url,
        url: pr.user.html_url
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      url: pr.html_url,
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha
      },
      base: {
        ref: pr.base.ref,
        sha: pr.base.sha
      },
      labels: pr.labels.map(label => ({
        name: label.name,
        color: label.color
      })),
      assignees: pr.assignees.map(assignee => ({
        login: assignee.login,
        avatar: assignee.avatar_url
      })),
      reviewers: pr.requested_reviewers.map(reviewer => ({
        login: reviewer.login,
        avatar: reviewer.avatar_url
      }))
    }));
  } catch (error) {
    console.error('Error fetching GitHub PRs:', error.message);
    return [];
  }
};

// Helper function to fetch Notion docs for workspace
const fetchNotionDocs = async (workspaceId) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return [];
    }

    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!databaseId) {
      return [];
    }

    const axios = require('axios');
    const notionAPI = axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });

    // Get database properties first
    const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
    const availableProperties = dbResponse.data.properties;

    // Build query payload
    let queryPayload = {
      page_size: 50
    };

    // Add sorting
    if (availableProperties.Created) {
      queryPayload.sorts = [
        {
          property: 'Created',
          direction: 'descending'
        }
      ];
    } else {
      queryPayload.sorts = [
        {
          timestamp: 'created_time',
          direction: 'descending'
        }
      ];
    }

    // Add workspace filter if available
    if (availableProperties.Workspace) {
      queryPayload.filter = {
        property: 'Workspace',
        select: {
          equals: workspace.name
        }
      };
    }

    const response = await notionAPI.post(`/databases/${databaseId}/query`, queryPayload);

    const pages = response.data.results.map(page => ({
      id: page.id,
      title: page.properties.Title?.title?.[0]?.plain_text || 'Untitled',
      type: page.properties.Type?.select?.name || 'Note',
      status: page.properties.Status?.select?.name || 'Draft',
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
      url: page.url,
      workspace: page.properties.Workspace?.select?.name || 'No workspace'
    }));

    // Filter by workspace in code if no filter was applied
    const filteredPages = availableProperties.Workspace 
      ? pages 
      : pages.filter(page => page.workspace === workspace.name || page.workspace === 'No workspace');

    return filteredPages;
  } catch (error) {
    console.error('Error fetching Notion docs:', error.message);
    return [];
  }
};

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
// @desc    Get workspace details with members, invites, and normalized artifacts
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

    // Fetch GitHub PRs and Notion docs in parallel
    const [githubPRs, notionDocs] = await Promise.all([
      fetchGitHubPRs(id),
      fetchNotionDocs(id)
    ]);

    // Normalize artifacts
    const artifacts = normalizeArtifacts(githubPRs, notionDocs, id);

    // Log for verification
    console.log(`Normalized ${artifacts.length} artifacts for workspace ${id}:`, {
      githubPRs: githubPRs.length,
      notionDocs: notionDocs.length,
      totalArtifacts: artifacts.length
    });

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
      workspace: workspaceData,
      workspaceId: id,
      githubPRs,
      notionDocs,
      artifacts
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