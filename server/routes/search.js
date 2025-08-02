const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const axios = require('axios');

// Enhanced helper function to get GitHub data with better semantic matching
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

    // Search repository with enhanced metadata
    const repoResponse = await githubAPI.get(`/repos/${owner}/${repo}`);
    if (repoResponse.data) {
      results.push({
        type: 'github_repo',
        title: repoResponse.data.full_name,
        description: repoResponse.data.description || 'GitHub repository',
        url: repoResponse.data.html_url,
        relevanceScore: 0.9,
        metadata: {
          author: repoResponse.data.owner.login,
          createdAt: repoResponse.data.created_at,
          language: repoResponse.data.language,
          stars: repoResponse.data.stargazers_count,
          forks: repoResponse.data.forks_count,
          openIssues: repoResponse.data.open_issues_count,
          // Add semantic keywords for better matching
          keywords: [
            'repository', 'repo', 'codebase', 'project',
            repoResponse.data.language?.toLowerCase(),
            'github', 'code', 'source'
          ].filter(Boolean)
        }
      });
    }

    // Search issues with enhanced semantic context
    const issuesResponse = await githubAPI.get(`/repos/${owner}/${repo}/issues?state=all&per_page=50`);
    issuesResponse.data
      .filter(issue => !issue.pull_request) // Filter out pull requests
      .forEach(issue => {
        const isOpen = issue.state === 'open';
        const keywords = [
          'issue', 'bug', 'problem', 'error',
          isOpen ? 'open' : 'closed',
          isOpen ? 'current' : 'resolved',
          ...issue.labels.map(label => label.name.toLowerCase()),
          issue.assignee ? 'assigned' : 'unassigned'
        ];

        results.push({
          type: 'github_issue',
          title: `#${issue.number}: ${issue.title}`,
          description: issue.body || `${issue.state} issue in ${repo}`,
          url: issue.html_url,
          relevanceScore: isOpen ? 0.9 : 0.7, // Prioritize open issues
          metadata: {
            author: issue.user.login,
            createdAt: issue.created_at,
            state: issue.state,
            number: issue.number,
            labels: issue.labels.map(l => l.name),
            assignee: issue.assignee?.login,
            comments: issue.comments,
            keywords: keywords
          }
        });
      });

    // Search pull requests with enhanced context
    const prsResponse = await githubAPI.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=30`);
    prsResponse.data.forEach(pr => {
      const isOpen = pr.state === 'open';
      const isMerged = pr.merged_at !== null;
      const keywords = [
        'pull request', 'pr', 'merge', 'review',
        isOpen ? 'open' : 'closed',
        isMerged ? 'merged' : 'unmerged',
        pr.draft ? 'draft' : 'ready',
        ...pr.labels.map(label => label.name.toLowerCase())
      ];

      results.push({
        type: 'github_pr',
        title: `PR #${pr.number}: ${pr.title}`,
        description: pr.body || `${pr.state} pull request in ${repo}`,
        url: pr.html_url,
        relevanceScore: isOpen ? 0.85 : 0.65,
        metadata: {
          author: pr.user.login,
          createdAt: pr.created_at,
          state: pr.state,
          number: pr.number,
          merged: isMerged,
          draft: pr.draft,
          keywords: keywords
        }
      });
    });

    // Search commits with better context
    const commitsResponse = await githubAPI.get(`/repos/${owner}/${repo}/commits?per_page=20`);
    commitsResponse.data.forEach(commit => {
      const message = commit.commit.message;
      const keywords = [
        'commit', 'change', 'update', 'fix', 'add',
        'recent', 'latest', 'new',
        ...message.toLowerCase().split(/\s+/).slice(0, 3)
      ];

      results.push({
        type: 'github_commit',
        title: message.split('\n')[0], // First line of commit message
        description: `Commit by ${commit.commit.author.name}`,
        url: commit.html_url,
        relevanceScore: 0.6,
        metadata: {
          author: commit.commit.author.name,
          createdAt: commit.commit.author.date,
          sha: commit.sha.substring(0, 7),
          keywords: keywords
        }
      });
    });

    // Add releases
    try {
      const releasesResponse = await githubAPI.get(`/repos/${owner}/${repo}/releases?per_page=10`);
      releasesResponse.data.forEach(release => {
        const keywords = [
          'release', 'version', 'tag', 'deployment',
          release.prerelease ? 'prerelease' : 'stable',
          'latest', 'update'
        ];

        results.push({
          type: 'github_release',
          title: `Release ${release.tag_name}: ${release.name || release.tag_name}`,
          description: release.body || `Release ${release.tag_name}`,
          url: release.html_url,
          relevanceScore: 0.7,
          metadata: {
            author: release.author?.login,
            createdAt: release.created_at,
            tagName: release.tag_name,
            prerelease: release.prerelease,
            keywords: keywords
          }
        });
      });
    } catch (releaseError) {
      console.log('No releases found or error fetching releases');
    }

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

// Enhanced relevance calculation with semantic matching
const calculateRelevanceScore = (text, query, keywords = []) => {
  if (!text || !query) return 0;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(word => word.length > 2);
  
  let score = 0;
  let matches = 0;
  
  // Exact phrase match - highest score
  if (textLower.includes(queryLower)) {
    score += 1.0;
  }
  
  // Individual word matches
  queryWords.forEach(word => {
    if (textLower.includes(word)) {
      matches++;
      score += 0.3;
    }
  });
  
  // Keyword matching for semantic understanding
  if (keywords && keywords.length > 0) {
    queryWords.forEach(queryWord => {
      keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(queryWord) || queryWord.includes(keyword.toLowerCase())) {
          score += 0.4;
        }
      });
    });
  }

  // Semantic query patterns
  const semanticPatterns = [
    { pattern: /(open|current|active)\s+(issue|bug|problem)s?/gi, boost: 0.8, type: 'github_issue', state: 'open' },
    { pattern: /(closed|resolved|fixed)\s+(issue|bug|problem)s?/gi, boost: 0.8, type: 'github_issue', state: 'closed' },
    { pattern: /(recent|latest|new)\s+(commit|change|update)s?/gi, boost: 0.8, type: 'github_commit' },
    { pattern: /(open|active)\s+(pull\s+request|pr)s?/gi, boost: 0.8, type: 'github_pr', state: 'open' },
    { pattern: /(merged|closed)\s+(pull\s+request|pr)s?/gi, boost: 0.8, type: 'github_pr' },
    { pattern: /(repository|repo|codebase)\s+(info|details|overview)/gi, boost: 0.9, type: 'github_repo' },
    { pattern: /(latest|recent|new)\s+(release|version)/gi, boost: 0.8, type: 'github_release' }
  ];

  // Apply semantic pattern matching
  semanticPatterns.forEach(({ pattern, boost }) => {
    if (pattern.test(queryLower)) {
      score += boost;
    }
  });
  
  // Normalize score
  const normalizedScore = Math.min(score, 1.0);
  return normalizedScore;
};

// Enhanced query analyzer to understand intent and provide answers
const analyzeQueryIntent = (query, allResults) => {
  const queryLower = query.toLowerCase();
  const answers = [];

  // Question patterns and their handlers
  const queryPatterns = [
    {
      patterns: [/how many (open|active) issues?/gi, /count.*open issues/gi, /number.*open issues/gi],
      handler: () => {
        const openIssues = allResults.filter(r => r.type === 'github_issue' && r.metadata?.state === 'open');
        return {
          type: 'answer',
          title: `There are ${openIssues.length} open issues`,
          description: `Currently, there are ${openIssues.length} open issues in the repository that need attention.`,
          url: null,
          relevanceScore: 2.0,
          metadata: {
            answerType: 'count',
            count: openIssues.length,
            relatedResults: openIssues.slice(0, 5)
          }
        };
      }
    },
    {
      patterns: [/how many (closed|resolved) issues?/gi, /count.*closed issues/gi],
      handler: () => {
        const closedIssues = allResults.filter(r => r.type === 'github_issue' && r.metadata?.state === 'closed');
        return {
          type: 'answer',
          title: `There are ${closedIssues.length} closed issues`,
          description: `${closedIssues.length} issues have been resolved and closed in this repository.`,
          url: null,
          relevanceScore: 2.0,
          metadata: { answerType: 'count', count: closedIssues.length }
        };
      }
    },
    {
      patterns: [/who.*contributors?/gi, /list.*contributors/gi, /main contributors/gi],
      handler: () => {
        const repo = allResults.find(r => r.type === 'github_repo');
        const contributors = repo?.metadata?.contributors || [];
        return {
          type: 'answer',
          title: `Main contributors: ${contributors.slice(0, 5).join(', ')}`,
          description: `The main contributors to this repository are: ${contributors.slice(0, 10).join(', ')}${contributors.length > 10 ? ` and ${contributors.length - 10} others` : ''}.`,
          url: repo?.url,
          relevanceScore: 2.0,
          metadata: { answerType: 'list', contributors: contributors }
        };
      }
    },
    {
      patterns: [/what.*programming language/gi, /which.*language/gi, /tech stack/gi],
      handler: () => {
        const repo = allResults.find(r => r.type === 'github_repo');
        const languages = repo?.metadata?.languages || [];
        const mainLanguage = repo?.metadata?.language;
        return {
          type: 'answer',
          title: `Primary language: ${mainLanguage || 'Not specified'}`,
          description: `This repository primarily uses ${mainLanguage || 'multiple languages'}. ${languages.length > 1 ? `Other languages include: ${languages.filter(l => l !== mainLanguage).join(', ')}.` : ''}`,
          url: repo?.url,
          relevanceScore: 2.0,
          metadata: { answerType: 'info', languages: languages, mainLanguage: mainLanguage }
        };
      }
    },
    {
      patterns: [/latest.*commit/gi, /recent.*commit/gi, /last commit/gi],
      handler: () => {
        const commits = allResults.filter(r => r.type === 'github_commit').sort((a, b) => 
          new Date(b.metadata?.createdAt) - new Date(a.metadata?.createdAt)
        );
        const latestCommit = commits[0];
        if (latestCommit) {
          return {
            type: 'answer',
            title: `Latest commit: ${latestCommit.title}`,
            description: `The most recent commit was "${latestCommit.title}" by ${latestCommit.metadata?.author} on ${new Date(latestCommit.metadata?.createdAt).toLocaleDateString()}.`,
            url: latestCommit.url,
            relevanceScore: 2.0,
            metadata: { answerType: 'latest', commit: latestCommit }
          };
        }
        return null;
      }
    },
    {
      patterns: [/latest.*release/gi, /current.*version/gi, /newest.*release/gi],
      handler: () => {
        const releases = allResults.filter(r => r.type === 'github_release').sort((a, b) => 
          new Date(b.metadata?.publishedAt || b.metadata?.createdAt) - new Date(a.metadata?.publishedAt || a.metadata?.createdAt)
        );
        const latestRelease = releases[0];
        if (latestRelease) {
          return {
            type: 'answer',
            title: `Latest release: ${latestRelease.metadata?.tagName}`,
            description: `The current version is ${latestRelease.metadata?.tagName}${latestRelease.metadata?.name ? ` (${latestRelease.metadata.name})` : ''}, released on ${new Date(latestRelease.metadata?.publishedAt || latestRelease.metadata?.createdAt).toLocaleDateString()}.`,
            url: latestRelease.url,
            relevanceScore: 2.0,
            metadata: { answerType: 'latest', release: latestRelease }
          };
        }
        return null;
      }
    },
    {
      patterns: [/how many.*pull requests?/gi, /count.*pr/gi, /open.*pull requests?/gi],
      handler: () => {
        const openPRs = allResults.filter(r => r.type === 'github_pr' && r.metadata?.state === 'open');
        const totalPRs = allResults.filter(r => r.type === 'github_pr');
        return {
          type: 'answer',
          title: `${openPRs.length} open pull requests out of ${totalPRs.length} total`,
          description: `There are currently ${openPRs.length} open pull requests awaiting review, and ${totalPRs.length} total pull requests in the repository.`,
          url: null,
          relevanceScore: 2.0,
          metadata: { answerType: 'count', openPRs: openPRs.length, totalPRs: totalPRs.length }
        };
      }
    },
    {
      patterns: [/repository.*stats/gi, /repo.*overview/gi, /project.*summary/gi],
      handler: () => {
        const repo = allResults.find(r => r.type === 'github_repo');
        if (repo) {
          const issues = allResults.filter(r => r.type === 'github_issue');
          const prs = allResults.filter(r => r.type === 'github_pr');
          const commits = allResults.filter(r => r.type === 'github_commit');
          return {
            type: 'answer',
            title: `Repository Overview: ${repo.title}`,
            description: `${repo.title} has ${repo.metadata?.stars} stars, ${repo.metadata?.forks} forks, ${issues.length} issues, ${prs.length} pull requests, and ${commits.length} recent commits. Main language: ${repo.metadata?.language || 'Not specified'}.`,
            url: repo.url,
            relevanceScore: 2.0,
            metadata: { 
              answerType: 'overview', 
              stats: {
                stars: repo.metadata?.stars,
                forks: repo.metadata?.forks,
                issues: issues.length,
                prs: prs.length,
                commits: commits.length
              }
            }
          };
        }
        return null;
      }
    },
    {
      patterns: [/recent.*activity/gi, /what.*happening/gi, /latest.*changes/gi],
      handler: () => {
        const recentItems = allResults
          .filter(r => r.metadata?.createdAt || r.metadata?.updatedAt)
          .sort((a, b) => {
            const aDate = new Date(a.metadata?.updatedAt || a.metadata?.createdAt);
            const bDate = new Date(b.metadata?.updatedAt || b.metadata?.createdAt);
            return bDate - aDate;
          })
          .slice(0, 5);

        if (recentItems.length > 0) {
          const summary = recentItems.map(item => {
            const date = new Date(item.metadata?.updatedAt || item.metadata?.createdAt).toLocaleDateString();
            return `${item.type.replace('github_', '').toUpperCase()}: ${item.title} (${date})`;
          }).join('; ');

          return {
            type: 'answer',
            title: `Recent Activity Summary`,
            description: `Here's what's been happening recently: ${summary}`,
            url: null,
            relevanceScore: 2.0,
            metadata: { answerType: 'activity', recentItems: recentItems }
          };
        }
        return null;
      }
    },
    {
      patterns: [/bugs?.*issues?/gi, /error.*reports?/gi, /problems?/gi],
      handler: () => {
        const bugIssues = allResults.filter(r => 
          r.type === 'github_issue' && 
          (r.metadata?.labels?.some(label => label.toLowerCase().includes('bug')) ||
           r.title.toLowerCase().includes('bug') ||
           r.title.toLowerCase().includes('error') ||
           r.title.toLowerCase().includes('fix'))
        );
        return {
          type: 'answer',
          title: `Found ${bugIssues.length} bug-related issues`,
          description: `There are ${bugIssues.length} issues related to bugs or errors in the repository.`,
          url: null,
          relevanceScore: 2.0,
          metadata: { answerType: 'filtered_count', items: bugIssues, filter: 'bugs' }
        };
      }
    },
    {
      patterns: [/feature.*requests?/gi, /enhancements?/gi, /new.*features?/gi],
      handler: () => {
        const featureIssues = allResults.filter(r => 
          r.type === 'github_issue' && 
          (r.metadata?.labels?.some(label => ['feature', 'enhancement', 'improvement'].some(f => label.toLowerCase().includes(f))) ||
           r.title.toLowerCase().includes('feature') ||
           r.title.toLowerCase().includes('enhancement'))
        );
        return {
          type: 'answer',
          title: `Found ${featureIssues.length} feature requests`,
          description: `There are ${featureIssues.length} issues requesting new features or enhancements.`,
          url: null,
          relevanceScore: 2.0,
          metadata: { answerType: 'filtered_count', items: featureIssues, filter: 'features' }
        };
      }
    }
  ];

  // Check each pattern and generate answers
  queryPatterns.forEach(({ patterns, handler }) => {
    if (patterns.some(pattern => pattern.test(queryLower))) {
      const answer = handler();
      if (answer) {
        answers.push(answer);
      }
    }
  });

  return answers;
};

// Enhanced filter and rank results with answer generation
const filterAndRankResults = (results, query, filters) => {
  let filteredResults = [...results];
  
  // Generate intelligent answers based on query intent
  const intelligentAnswers = analyzeQueryIntent(query, results);
  
  // Add intelligent answers at the top
  filteredResults = [...intelligentAnswers, ...filteredResults];

  // Apply type filter
  if (filters.type && filters.type !== 'all') {
    filteredResults = filteredResults.filter(result => {
      // Always include answers
      if (result.type === 'answer') return true;
      
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
  
  // Enhanced relevance calculation for non-answer results
  filteredResults = filteredResults.map(result => {
    // Skip recalculation for answers
    if (result.type === 'answer') return result;
    
    const titleScore = calculateRelevanceScore(result.title, query, result.metadata?.keywords);
    const descriptionScore = calculateRelevanceScore(result.description, query, result.metadata?.keywords);
    
    // Context-aware boosting
    let contextBoost = 0;
    const queryLower = query.toLowerCase();
    
    // Type-specific boosting
    if (queryLower.includes('issue') && result.type === 'github_issue') contextBoost += 0.5;
    if (queryLower.includes('pull request') || queryLower.includes('pr')) {
      if (result.type === 'github_pr') contextBoost += 0.5;
    }
    if (queryLower.includes('commit') && result.type === 'github_commit') contextBoost += 0.5;
    if (queryLower.includes('release') && result.type === 'github_release') contextBoost += 0.5;
    if (queryLower.includes('repo') || queryLower.includes('repository')) {
      if (result.type === 'github_repo') contextBoost += 0.5;
    }
    if (queryLower.includes('file') && result.type === 'github_file') contextBoost += 0.5;
    
    // State-based boosting
    if (queryLower.includes('open') && result.metadata?.state === 'open') contextBoost += 0.3;
    if (queryLower.includes('closed') && result.metadata?.state === 'closed') contextBoost += 0.3;
    if (queryLower.includes('merged') && result.metadata?.merged) contextBoost += 0.3;
    
    // Recency boosting for time-sensitive queries
    if (queryLower.includes('recent') || queryLower.includes('latest') || queryLower.includes('new')) {
      const createdAt = new Date(result.metadata?.createdAt || result.metadata?.publishedAt || 0);
      const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 30) contextBoost += 0.4;
      else if (daysSinceCreation < 90) contextBoost += 0.2;
    }
    
    const combinedScore = Math.max(titleScore, descriptionScore * 0.8) + contextBoost;
    
    return {
      ...result,
      relevanceScore: Math.min(combinedScore || result.relevanceScore, 3.0)
    };
  });
  
  // Filter by minimum relevance and sort
  filteredResults = filteredResults
    .filter(result => result.type === 'answer' || result.relevanceScore > 0.1)
    .sort((a, b) => {
      // Always prioritize answers
      if (a.type === 'answer' && b.type !== 'answer') return -1;
      if (b.type === 'answer' && a.type !== 'answer') return 1;
      
      // Primary sort by relevance score
      if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.2) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // Secondary sort by recency for similar scores
      const aDate = new Date(a.metadata?.createdAt || a.metadata?.publishedAt || 0);
      const bDate = new Date(b.metadata?.createdAt || b.metadata?.publishedAt || 0);
      return bDate - aDate;
    });
  
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

    // Enhanced suggestions based on workspace content and common patterns
    const suggestions = [
      // Question-based queries that will generate answers
      'How many open issues are there?',
      'Who are the main contributors?',
      'What programming languages are used?',
      'What is the latest commit?',
      'What is the current version?',
      'How many pull requests are open?',
      'Show me repository stats',
      'What recent activity has there been?',
      'Are there any bug reports?',
      'How many feature requests are there?',
      
      // Direct GitHub queries
      'show me all open issues',
      'list recent commits',
      'current pull requests',
      'latest releases and versions',
      'repository overview',
      'closed issues',
      'merged pull requests',
      'draft pull requests',
      'files in the repository',
      'repository branches',
      'commit history',
      'issues assigned to me',
      'pull requests by author',
      
      // General workspace queries
      'team members and roles',
      'meeting notes',
      'project timeline',
      'authentication setup',
      'api documentation'
    ];

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 15)
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