import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const GitHubIntegration = ({ workspaceId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('issues');
  const [repository, setRepository] = useState({ owner: '', repo: '' });
  const [repoInfo, setRepoInfo] = useState(null);
  const [data, setData] = useState({
    issues: [],
    pullRequests: [],
    commits: [],
    releases: []
  });
  const [loading, setLoading] = useState({
    repo: false,
    issues: false,
    pullRequests: false,
    commits: false,
    releases: false
  });
  const [error, setError] = useState('');

  const tabs = [
    { id: 'issues', label: 'Issues', icon: '📌' },
    { id: 'pullRequests', label: 'Pull Requests', icon: '🔀' },
    { id: 'commits', label: 'Commits', icon: '📦' },
    { id: 'releases', label: 'Changelog', icon: '📝' }
  ];

  const fetchRepositoryInfo = async () => {
    if (!repository.owner || !repository.repo) return;

    setLoading(prev => ({ ...prev, repo: true }));
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/github/repository', {
        headers: { Authorization: `Bearer ${token}` },
        params: { owner: repository.owner, repo: repository.repo }
      });
      setRepoInfo(response.data.repository);
    } catch (error) {
      console.error('Error fetching repository info:', error);
      setError(error.response?.data?.message || 'Failed to fetch repository information');
      setRepoInfo(null);
    } finally {
      setLoading(prev => ({ ...prev, repo: false }));
    }
  };

  const fetchData = async (type) => {
    if (!repository.owner || !repository.repo) return;

    setLoading(prev => ({ ...prev, [type]: true }));
    setError('');

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'pullRequests' ? 'pull-requests' : 
                     type === 'releases' ? 'changelog' : type;
      
      const response = await axios.get(`http://localhost:5000/api/github/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { owner: repository.owner, repo: repository.repo }
      });

      setData(prev => ({
        ...prev,
        [type]: response.data[type] || response.data.issues || response.data.commits || response.data.releases || []
      }));
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      setError(error.response?.data?.message || `Failed to fetch ${type}`);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleRepositorySubmit = (e) => {
    e.preventDefault();
    if (repository.owner && repository.repo) {
      fetchRepositoryInfo();
      fetchData(activeTab);
    }
  };

  const handleRefresh = () => {
    fetchData(activeTab);
  };

  useEffect(() => {
    if (repoInfo && repository.owner && repository.repo) {
      fetchData(activeTab);
    }
  }, [activeTab]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStateColor = (state, merged = false) => {
    if (merged) return 'bg-purple-100 text-purple-800';
    if (state === 'open') return 'bg-green-100 text-green-800';
    if (state === 'closed') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Repository Input */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">GitHub Repository</h3>
        <form onSubmit={handleRepositorySubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="owner" className="block text-sm font-medium text-gray-700 mb-1">
                Repository Owner
              </label>
              <input
                type="text"
                id="owner"
                value={repository.owner}
                onChange={(e) => setRepository(prev => ({ ...prev, owner: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., facebook"
              />
            </div>
            <div>
              <label htmlFor="repo" className="block text-sm font-medium text-gray-700 mb-1">
                Repository Name
              </label>
              <input
                type="text"
                id="repo"
                value={repository.repo}
                onChange={(e) => setRepository(prev => ({ ...prev, repo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., react"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading.repo || !repository.owner || !repository.repo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading.repo && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{loading.repo ? 'Connecting...' : 'Connect Repository'}</span>
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Repository Info */}
      {repoInfo && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <img
                src={repoInfo.owner.avatar}
                alt={repoInfo.owner.login}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  <a href={repoInfo.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                    {repoInfo.fullName}
                  </a>
                </h3>
                {repoInfo.description && (
                  <p className="text-gray-600 mt-1">{repoInfo.description}</p>
                )}
                <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                  {repoInfo.language && (
                    <span className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>{repoInfo.language}</span>
                    </span>
                  )}
                  <span>⭐ {repoInfo.stars}</span>
                  <span>🍴 {repoInfo.forks}</span>
                  <span>👁️ {repoInfo.watchers}</span>
                  <span>📝 {repoInfo.openIssues} issues</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading[activeTab]}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center space-x-1"
            >
              <svg className={`w-4 h-4 ${loading[activeTab] ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {repoInfo && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {data[tab.id] && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {data[tab.id].length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {loading[activeTab] ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Issues Tab */}
                {activeTab === 'issues' && (
                  <div className="space-y-4">
                    {data.issues.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No open issues found</p>
                      </div>
                    ) : (
                      data.issues.map((issue) => (
                        <div key={issue.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-green-600 font-medium">#{issue.number}</span>
                                <h4 className="font-medium text-gray-900">
                                  <a href={issue.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                    {issue.title}
                                  </a>
                                </h4>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>by {issue.author.login}</span>
                                <span>{formatDate(issue.createdAt)}</span>
                                {issue.comments > 0 && (
                                  <span>💬 {issue.comments}</span>
                                )}
                              </div>
                              {issue.labels.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {issue.labels.map((label) => (
                                    <span
                                      key={label.name}
                                      className="px-2 py-1 text-xs rounded-full"
                                      style={{
                                        backgroundColor: `#${label.color}20`,
                                        color: `#${label.color}`
                                      }}
                                    >
                                      {label.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <img
                              src={issue.author.avatar}
                              alt={issue.author.login}
                              className="w-8 h-8 rounded-full ml-4"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Pull Requests Tab */}
                {activeTab === 'pullRequests' && (
                  <div className="space-y-4">
                    {data.pullRequests.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No pull requests found</p>
                      </div>
                    ) : (
                      data.pullRequests.map((pr) => (
                        <div key={pr.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-blue-600 font-medium">#{pr.number}</span>
                                <h4 className="font-medium text-gray-900">
                                  <a href={pr.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                    {pr.title}
                                  </a>
                                </h4>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  getStateColor(pr.state, pr.merged)
                                }`}>
                                  {pr.merged ? 'Merged' : pr.state}
                                </span>
                                {pr.draft && (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>by {pr.author.login}</span>
                                <span>{formatDate(pr.createdAt)}</span>
                                <span>{pr.head.ref} → {pr.base.ref}</span>
                              </div>
                              {pr.labels.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {pr.labels.map((label) => (
                                    <span
                                      key={label.name}
                                      className="px-2 py-1 text-xs rounded-full"
                                      style={{
                                        backgroundColor: `#${label.color}20`,
                                        color: `#${label.color}`
                                      }}
                                    >
                                      {label.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <img
                              src={pr.author.avatar}
                              alt={pr.author.login}
                              className="w-8 h-8 rounded-full ml-4"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Commits Tab */}
                {activeTab === 'commits' && (
                  <div className="space-y-4">
                    {data.commits.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No commits found</p>
                      </div>
                    ) : (
                      data.commits.map((commit) => (
                        <div key={commit.sha} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-2">
                                <a href={commit.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                  {commit.message.split('\n')[0]}
                                </a>
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>by {commit.author.name}</span>
                                <span>{formatDate(commit.author.date)}</span>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                  {commit.shortSha}
                                </span>
                              </div>
                            </div>
                            {commit.author.avatar && (
                              <img
                                src={commit.author.avatar}
                                alt={commit.author.login}
                                className="w-8 h-8 rounded-full ml-4"
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Releases Tab */}
                {activeTab === 'releases' && (
                  <div className="space-y-4">
                    {data.releases.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No releases found</p>
                      </div>
                    ) : (
                      data.releases.map((release) => (
                        <div key={release.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-bold text-gray-900">
                                  <a href={release.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                    {release.name || release.tagName}
                                  </a>
                                </h4>
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  {release.tagName}
                                </span>
                                {release.prerelease && (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                    Pre-release
                                  </span>
                                )}
                                {release.draft && (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>by {release.author.login}</span>
                                <span>{formatDate(release.publishedAt)}</span>
                              </div>
                            </div>
                            <img
                              src={release.author.avatar}
                              alt={release.author.login}
                              className="w-8 h-8 rounded-full"
                            />
                          </div>
                          {release.body && (
                            <div className="text-sm text-gray-600 prose max-w-none">
                              <pre className="whitespace-pre-wrap">{release.body}</pre>
                            </div>
                          )}
                          {release.assets.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Assets:</h5>
                              <div className="space-y-1">
                                {release.assets.map((asset) => (
                                  <a
                                    key={asset.name}
                                    href={asset.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 block"
                                  >
                                    📦 {asset.name} ({(asset.size / 1024 / 1024).toFixed(2)} MB)
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubIntegration;