const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const router = express.Router();

// GitHub API base configuration
const githubAPI = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'EchoHub-App'
  }
});

// @route   POST /api/github/workspace/:workspaceId/connect
// @desc    Connect a GitHub repository to a workspace
// @access  Private (Creator only)
router.post('/workspace/:workspaceId/connect', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo are required' });
    }

    // Find the workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is the creator
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || userMembership.role !== 'Creator') {
      return res.status(403).json({ 
        message: 'Only workspace creators can connect GitHub repositories' 
      });
    }

    // Verify the repository exists and is accessible
    try {
      await githubAPI.get(`/repos/${owner}/${repo}`);
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({ message: 'Repository not found or not accessible' });
      }
      throw error;
    }

    // Update workspace with GitHub repository info
    workspace.githubRepository = {
      owner: owner.trim(),
      repo: repo.trim(),
      connectedAt: new Date(),
      connectedBy: req.user.id
    };

    await workspace.save();

    res.json({
      success: true,
      message: 'GitHub repository connected successfully',
      repository: {
        owner: workspace.githubRepository.owner,
        repo: workspace.githubRepository.repo,
        connectedAt: workspace.githubRepository.connectedAt
      }
    });
  } catch (error) {
    console.error('Error connecting GitHub repository:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to connect repository' 
    });
  }
});

// @route   DELETE /api/github/workspace/:workspaceId/disconnect
// @desc    Disconnect GitHub repository from workspace
// @access  Private (Creator only)
router.delete('/workspace/:workspaceId/disconnect', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Find the workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is the creator
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership || userMembership.role !== 'Creator') {
      return res.status(403).json({ 
        message: 'Only workspace creators can disconnect GitHub repositories' 
      });
    }

    // Remove GitHub repository connection
    workspace.githubRepository = undefined;
    await workspace.save();

    res.json({
      success: true,
      message: 'GitHub repository disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting GitHub repository:', error);
    res.status(500).json({ message: 'Failed to disconnect repository' });
  }
});

// @route   GET /api/github/workspace/:workspaceId/repository
// @desc    Get connected GitHub repository for a workspace
// @access  Private
router.get('/workspace/:workspaceId/repository', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Find the workspace
    const workspace = await Workspace.findById(workspaceId)
      .populate('githubRepository.connectedBy', 'name email');
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member
    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    // Return repository info if connected
    if (!workspace.githubRepository?.owner || !workspace.githubRepository?.repo) {
      return res.json({
        success: true,
        connected: false,
        repository: null
      });
    }

    // Fetch fresh repository data from GitHub
    try {
      const response = await githubAPI.get(
        `/repos/${workspace.githubRepository.owner}/${workspace.githubRepository.repo}`
      );
      
      const repoData = response.data;
      const repository = {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        url: repoData.html_url,
        cloneUrl: repoData.clone_url,
        defaultBranch: repoData.default_branch,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        openIssues: repoData.open_issues_count,
        size: repoData.size,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
        pushedAt: repoData.pushed_at,
        owner: {
          login: repoData.owner.login,
          avatar: repoData.owner.avatar_url,
          url: repoData.owner.html_url,
          type: repoData.owner.type
        },
        topics: repoData.topics,
        license: repoData.license ? {
          name: repoData.license.name,
          spdxId: repoData.license.spdx_id
        } : null,
        // Workspace-specific metadata
        connectedAt: workspace.githubRepository.connectedAt,
        connectedBy: workspace.githubRepository.connectedBy
      };

      res.json({
        success: true,
        connected: true,
        repository
      });
    } catch (error) {
      if (error.response?.status === 404) {
        // Repository no longer exists, remove connection
        workspace.githubRepository = undefined;
        await workspace.save();
        
        return res.json({
          success: true,
          connected: false,
          repository: null,
          message: 'Connected repository no longer exists and has been disconnected'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching workspace repository:', error);
    res.status(500).json({ message: 'Failed to fetch repository information' });
  }
});

// Update existing routes to use workspace repository
// @route   GET /api/github/workspace/:workspaceId/issues
// @desc    Get open issues for workspace repository
// @access  Private
router.get('/workspace/:workspaceId/issues', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Get workspace and verify access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    // Check if repository is connected
    if (!workspace.githubRepository?.owner || !workspace.githubRepository?.repo) {
      return res.status(400).json({ message: 'No GitHub repository connected to this workspace' });
    }

    const { owner, repo } = workspace.githubRepository;

    const response = await githubAPI.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        state: 'open',
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      }
    });

    const issues = response.data
      .filter(issue => !issue.pull_request)
      .map(issue => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author: {
          login: issue.user.login,
          avatar: issue.user.avatar_url,
          url: issue.user.html_url
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url,
        labels: issue.labels.map(label => ({
          name: label.name,
          color: label.color
        })),
        assignees: issue.assignees.map(assignee => ({
          login: assignee.login,
          avatar: assignee.avatar_url
        })),
        comments: issue.comments
      }));

    res.json({
      success: true,
      issues,
      total: issues.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch issues' 
    });
  }
});

// @route   GET /api/github/workspace/:workspaceId/pull-requests
// @desc    Get pull requests for workspace repository
// @access  Private
router.get('/workspace/:workspaceId/pull-requests', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    if (!workspace.githubRepository?.owner || !workspace.githubRepository?.repo) {
      return res.status(400).json({ message: 'No GitHub repository connected to this workspace' });
    }

    const { owner, repo } = workspace.githubRepository;

    const response = await githubAPI.get(`/repos/${owner}/${repo}/pulls`, {
      params: {
        state: 'all',
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      }
    });

    const pullRequests = response.data.map(pr => ({
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

    res.json({
      success: true,
      pullRequests,
      total: pullRequests.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch pull requests' 
    });
  }
});

// @route   GET /api/github/workspace/:workspaceId/commits
// @desc    Get recent commits for workspace repository
// @access  Private
router.get('/workspace/:workspaceId/commits', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { branch = 'main' } = req.query;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    if (!workspace.githubRepository?.owner || !workspace.githubRepository?.repo) {
      return res.status(400).json({ message: 'No GitHub repository connected to this workspace' });
    }

    const { owner, repo } = workspace.githubRepository;

    const response = await githubAPI.get(`/repos/${owner}/${repo}/commits`, {
      params: {
        sha: branch,
        per_page: 50
      }
    });

    const commits = response.data.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        avatar: commit.author?.avatar_url,
        login: commit.author?.login,
        url: commit.author?.html_url
      },
      committer: {
        name: commit.commit.committer.name,
        email: commit.commit.committer.email,
        date: commit.commit.committer.date
      },
      url: commit.html_url,
      stats: commit.stats,
      files: commit.files?.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes
      }))
    }));

    res.json({
      success: true,
      commits,
      total: commits.length,
      branch
    });
  } catch (error) {
    console.error('GitHub API Error:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch commits' 
    });
  }
});

// @route   GET /api/github/workspace/:workspaceId/changelog
// @desc    Get releases/tags for workspace repository
// @access  Private
router.get('/workspace/:workspaceId/changelog', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to view this workspace' });
    }

    if (!workspace.githubRepository?.owner || !workspace.githubRepository?.repo) {
      return res.status(400).json({ message: 'No GitHub repository connected to this workspace' });
    }

    const { owner, repo } = workspace.githubRepository;

    const response = await githubAPI.get(`/repos/${owner}/${repo}/releases`, {
      params: {
        per_page: 50
      }
    });

    const releases = response.data.map(release => ({
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
      author: {
        login: release.author.login,
        avatar: release.author.avatar_url,
        url: release.author.html_url
      },
      createdAt: release.created_at,
      publishedAt: release.published_at,
      url: release.html_url,
      tarballUrl: release.tarball_url,
      zipballUrl: release.zipball_url,
      assets: release.assets.map(asset => ({
        name: asset.name,
        size: asset.size,
        downloadCount: asset.download_count,
        url: asset.browser_download_url
      }))
    }));

    res.json({
      success: true,
      releases,
      total: releases.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch releases' 
    });
  }
});

// Keep the original routes for backward compatibility
// @route   GET /api/github/issues
// @desc    Get open issues for a repository
// @access  Private
router.get('/issues', auth, async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo parameters are required' });
    }

    const response = await githubAPI.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        state: 'open',
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      }
    });

    const issues = response.data
      .filter(issue => !issue.pull_request) // Filter out pull requests
      .map(issue => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author: {
          login: issue.user.login,
          avatar: issue.user.avatar_url,
          url: issue.user.html_url
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url,
        labels: issue.labels.map(label => ({
          name: label.name,
          color: label.color
        })),
        assignees: issue.assignees.map(assignee => ({
          login: assignee.login,
          avatar: assignee.avatar_url
        })),
        comments: issue.comments
      }));

    res.json({
      success: true,
      issues,
      total: issues.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Repository not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: 'GitHub authentication failed' });
    }

    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch issues' 
    });
  }
});

// @route   GET /api/github/pull-requests
// @desc    Get pull requests for a repository
// @access  Private
router.get('/pull-requests', auth, async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo parameters are required' });
    }

    const response = await githubAPI.get(`/repos/${owner}/${repo}/pulls`, {
      params: {
        state: 'all',
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      }
    });

    const pullRequests = response.data.map(pr => ({
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

    res.json({
      success: true,
      pullRequests,
      total: pullRequests.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Repository not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: 'GitHub authentication failed' });
    }

    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch pull requests' 
    });
  }
});

// @route   GET /api/github/commits
// @desc    Get recent commits for a repository
// @access  Private
router.get('/commits', auth, async (req, res) => {
  try {
    const { owner, repo, branch = 'main' } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo parameters are required' });
    }

    const response = await githubAPI.get(`/repos/${owner}/${repo}/commits`, {
      params: {
        sha: branch,
        per_page: 50
      }
    });

    const commits = response.data.map(commit => ({
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        avatar: commit.author?.avatar_url,
        login: commit.author?.login,
        url: commit.author?.html_url
      },
      committer: {
        name: commit.commit.committer.name,
        email: commit.commit.committer.email,
        date: commit.commit.committer.date
      },
      url: commit.html_url,
      stats: commit.stats,
      files: commit.files?.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes
      }))
    }));

    res.json({
      success: true,
      commits,
      total: commits.length,
      branch
    });
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Repository or branch not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: 'GitHub authentication failed' });
    }

    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch commits' 
    });
  }
});

// @route   GET /api/github/changelog
// @desc    Get releases/tags for changelog
// @access  Private
router.get('/changelog', auth, async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo parameters are required' });
    }

    const response = await githubAPI.get(`/repos/${owner}/${repo}/releases`, {
      params: {
        per_page: 50
      }
    });

    const releases = response.data.map(release => ({
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
      author: {
        login: release.author.login,
        avatar: release.author.avatar_url,
        url: release.author.html_url
      },
      createdAt: release.created_at,
      publishedAt: release.published_at,
      url: release.html_url,
      tarballUrl: release.tarball_url,
      zipballUrl: release.zipball_url,
      assets: release.assets.map(asset => ({
        name: asset.name,
        size: asset.size,
        downloadCount: asset.download_count,
        url: asset.browser_download_url
      }))
    }));

    res.json({
      success: true,
      releases,
      total: releases.length
    });
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Repository not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: 'GitHub authentication failed' });
    }

    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch releases' 
    });
  }
});

// @route   GET /api/github/repository
// @desc    Get repository information
// @access  Private
router.get('/repository', auth, async (req, res) => {
  try {
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Owner and repo parameters are required' });
    }

    const response = await githubAPI.get(`/repos/${owner}/${repo}`);
    const repoData = response.data;

    const repository = {
      id: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      private: repoData.private,
      url: repoData.html_url,
      cloneUrl: repoData.clone_url,
      defaultBranch: repoData.default_branch,
      language: repoData.language,
      languages: [], // Will be fetched separately if needed
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.watchers_count,
      openIssues: repoData.open_issues_count,
      size: repoData.size,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      owner: {
        login: repoData.owner.login,
        avatar: repoData.owner.avatar_url,
        url: repoData.owner.html_url,
        type: repoData.owner.type
      },
      topics: repoData.topics,
      license: repoData.license ? {
        name: repoData.license.name,
        spdxId: repoData.license.spdx_id
      } : null
    };

    res.json({
      success: true,
      repository
    });
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Repository not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ message: 'GitHub authentication failed' });
    }

    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch repository information' 
    });
  }
});

module.exports = router;