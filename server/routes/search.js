const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const axios = require('axios');

// Helper function to get GitHub data
const getGitHubData = async (workspace, token) => {
  if (!workspace.githubRepository) return [];
  
  const results = [];
  const githubToken = process.env.GITHUB_TOKEN;
  
  try {
    const { owner, repo } = workspace.githubRepository;
    const githubAPI = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Search repository
    const repoResponse = await githubAPI.get(`/repos/${owner}/${repo}`);
    if (repoResponse.data) {
      results.push({
        type: 'github_repo',
        title: repoResponse.data.full_name,
        description: repoResponse.data.description,
        url: repoResponse.data.html_url,
        relevanceScore: 0.9,
        metadata: {
          author: repoResponse.data.owner.login,
          createdAt: repoResponse.data.created_at,
          language: repoResponse.data.language,
          stars: repoResponse.data.stargazers_count
        }
      });
    }

    // Search issues
    const issuesResponse = await githubAPI.get(`/repos/${owner}/${repo}/issues?state=all&per_page=10`);
    issuesResponse.data.forEach(issue => {
      results.push({
        type: 'github_issue',
        title: issue.title,
        description: issue.body,
        url: issue.html_url,
        relevanceScore: 0.8,
        metadata: {
          author: issue.user.login,
          createdAt: issue.created_at,
          state: issue.state,
          number: issue.number
        }
      });
    });

    // Search pull requests
    const prsResponse = await githubAPI.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=10`);
    prsResponse.data.forEach(pr => {
      results.push({
        type: 'github_pr',
        title: pr.title,
        description: pr.body,
        url: pr.html_url,
        relevanceScore: 0.8,
        metadata: {
          author: pr.user.login,
          createdAt: pr.created_at,
          state: pr.state,
          number: pr.number
        }
      });
    });

  } catch (error) {
    console.error('Error fetching GitHub data:', error);
  }
  
  return results;
};

// Helper function to get Notion data with proper error handling
const getNotionData = async (workspace) => {
  const results = [];
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!databaseId) return results;
  
  try {
    const notionAPI = axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });

    // First, get database properties to check what's available
    let availableProperties = {};
    try {
      const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
      availableProperties = dbResponse.data.properties;
    } catch (dbError) {
      console.error('Database access error:', dbError.response?.data || dbError.message);
      return results; // Return empty results if database is not accessible
    }

    // Build query payload based on available properties
    let queryPayload = {
      page_size: 20
    };

    // Add sorting - use created_time as fallback if no Created property exists
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

    // Only add workspace filter if Workspace property exists
    if (availableProperties.Workspace) {
      queryPayload.filter = {
        property: 'Workspace',
        select: {
          equals: workspace.name
        }
      };
    }

    const response = await notionAPI.post(`/databases/${databaseId}/query`, queryPayload);

    response.data.results.forEach(page => {
      const title = page.properties.Title?.title?.[0]?.plain_text || 'Untitled';
      const type = page.properties.Type?.select?.name || 'Note';
      const status = page.properties.Status?.select?.name || 'Draft';
      const workspace_name = page.properties.Workspace?.select?.name || 'No workspace';
      
      // If no Workspace property exists, include all pages
      // If Workspace property exists, only include pages that match or have no workspace set
      if (!availableProperties.Workspace || 
          workspace_name === workspace.name || 
          workspace_name === 'No workspace') {
        results.push({
          type: 'notion_page',
          title: title,
          description: `${type} - ${status}`,
          url: page.url,
          relevanceScore: 0.7,
          metadata: {
            type: type,
            status: status,
            createdAt: page.created_time,
            lastEdited: page.last_edited_time,
            workspace: workspace_name
          }
        });
      }
    });

  } catch (error) {
    console.error('Error fetching Notion data:', error.response?.data || error.message);
  }
  
  return results;
};

// Helper function to calculate text similarity (simple implementation)
const calculateRelevanceScore = (text, query) => {
  if (!text || !query) return 0;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(word => word.length > 2);
  
  let score = 0;
  let matches = 0;
  
  // Exact phrase match
  if (textLower.includes(queryLower)) {
    score += 0.8;
  }
  
  // Individual word matches
  queryWords.forEach(word => {
    if (textLower.includes(word)) {
      matches++;
      score += 0.2;
    }
  });
  
  // Normalize score
  const normalizedScore = Math.min(score, 1.0);
  return normalizedScore;
};

// Filter and rank results based on query
const filterAndRankResults = (results, query, filters) => {
  let filteredResults = results;
  
  // Apply type filter
  if (filters.type && filters.type !== 'all') {
    filteredResults = results.filter(result => {
      switch (filters.type) {
        case 'github':
          return result.type.startsWith('github_');
        case 'notion':
          return result.type === 'notion_page';
        case 'members':
          return result.type === 'member';
        case 'docs':
          return result.type === 'document';
        default:
          return true;
      }
    });
  }
  
  // Calculate relevance scores based on query
  filteredResults = filteredResults.map(result => {
    const titleScore = calculateRelevanceScore(result.title, query);
    const descriptionScore = calculateRelevanceScore(result.description, query);
    const combinedScore = Math.max(titleScore, descriptionScore * 0.7);
    
    return {
      ...result,
      relevanceScore: combinedScore || result.relevanceScore
    };
  });
  
  // Filter by minimum relevance and sort
  filteredResults = filteredResults
    .filter(result => result.relevanceScore > 0.1)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Apply limit
  if (filters.limit) {
    filteredResults = filteredResults.slice(0, filters.limit);
  }
  
  return filteredResults;
};

// @route   POST /api/search/semantic/:workspaceId
// @desc    Perform semantic search across workspace content
// @access  Private
router.post('/semantic/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { query, filters = {} } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Verify workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    // Collect all results
    let allResults = [];

    // Get GitHub data
    const githubResults = await getGitHubData(workspace, req.user.githubToken);
    allResults = allResults.concat(githubResults);

    // Get Notion data
    const notionResults = await getNotionData(workspace);
    allResults = allResults.concat(notionResults);

    // Add workspace members as searchable content
    workspace.members.forEach(member => {
      allResults.push({
        type: 'member',
        title: member.user.name,
        description: `${member.role} - ${member.user.email}`,
        url: null,
        relevanceScore: 0.6,
        metadata: {
          role: member.role,
          email: member.user.email,
          joinedAt: member.joinedAt
        }
      });
    });

    // Filter and rank results
    const results = filterAndRankResults(allResults, query.trim(), filters);

    res.json({
      success: true,
      results,
      total: results.length,
      query: query.trim(),
      filters,
      sources: {
        github: githubResults.length,
        notion: notionResults.length,
        members: workspace.members.length
      }
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ 
      message: 'Search failed. Please try again.',
      details: error.message 
    });
  }
});

// @route   GET /api/search/suggestions/:workspaceId
// @desc    Get search suggestions based on workspace content
// @access  Private
router.get('/suggestions/:workspaceId', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    // Generate suggestions based on common search patterns
    const suggestions = [
      'recent commits',
      'open issues',
      'pull requests',
      'meeting notes',
      'project documentation',
      'team members',
      'authentication setup',
      'deployment process',
      'api endpoints',
      'bug reports'
    ];

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 8)
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ 
      message: 'Failed to get search suggestions',
      details: error.message 
    });
  }
});

module.exports = router;