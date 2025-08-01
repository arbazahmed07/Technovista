const normalizeArtifacts = (githubPRs = [], notionDocs = [], workspaceId) => {
  const artifacts = [];

  // Normalize GitHub Pull Requests
  githubPRs.forEach(pr => {
    artifacts.push({
      id: `github_pr_${pr.id}`,
      type: 'github_pr',
      title: pr.title,
      description: pr.body || '',
      url: pr.url,
      author: pr.author.login,
      authorAvatar: pr.author.avatar,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      status: pr.merged ? 'merged' : pr.state,
      labels: pr.labels.map(label => label.name),
      workspaceId,
      metadata: {
        number: pr.number,
        branch: {
          head: pr.head.ref,
          base: pr.base.ref
        },
        assignees: pr.assignees.map(assignee => assignee.login),
        reviewers: pr.reviewers ? pr.reviewers.map(reviewer => reviewer.login) : [],
        draft: pr.draft,
        mergedAt: pr.mergedAt
      }
    });
  });

  // Normalize Notion Documents
  notionDocs.forEach(doc => {
    artifacts.push({
      id: `notion_doc_${doc.id}`,
      type: 'notion_doc',
      title: doc.title,
      description: '', // Notion API doesn't provide description in list view
      url: doc.url,
      author: 'Unknown', // Notion API doesn't provide author in current implementation
      authorAvatar: null,
      createdAt: doc.createdTime,
      updatedAt: doc.lastEditedTime,
      status: doc.status || 'active',
      labels: [doc.type], // Use type as label
      workspaceId,
      metadata: {
        notionId: doc.id,
        type: doc.type,
        workspace: doc.workspace
      }
    });
  });

  // Sort by creation date (newest first)
  artifacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return artifacts;
};

module.exports = { normalizeArtifacts };