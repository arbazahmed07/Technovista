import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SemanticSearch = ({ workspaceId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all', // all, github, notion, members, docs
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    // Load search history from localStorage
    const history = localStorage.getItem(`search_history_${workspaceId}`);
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, [workspaceId]);

  const saveToHistory = (searchQuery) => {
    if (!searchQuery.trim()) return;
    
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem(`search_history_${workspaceId}`, JSON.stringify(newHistory));
  };

  const performSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/search/semantic/${workspaceId}`,
        {
          query: searchQuery,
          filters: filters
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setResults(response.data.results || []);
      saveToHistory(searchQuery);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performSearch();
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setError('');
    searchInputRef.current?.focus();
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'github_repo':
        return '🐙';
      case 'github_issue':
        return '🐛';
      case 'github_pr':
        return '🔀';
      case 'github_commit':
        return '📝';
      case 'notion_page':
        return '📄';
      case 'member':
        return '👤';
      case 'document':
        return '📋';
      default:
        return '🔍';
    }
  };

  const getResultTypeLabel = (type) => {
    switch (type) {
      case 'github_repo':
        return 'Repository';
      case 'github_issue':
        return 'GitHub Issue';
      case 'github_pr':
        return 'Pull Request';
      case 'github_commit':
        return 'Commit';
      case 'notion_page':
        return 'Notion Page';
      case 'member':
        return 'Team Member';
      case 'document':
        return 'Document';
      default:
        return 'Result';
    }
  };

  const formatRelevanceScore = (score) => {
    return Math.round(score * 100);
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          🔍 Semantic Search
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Search across your entire workspace using AI-powered semantic search. 
          Find relevant content from GitHub, Notion, team members, and more.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your workspace... e.g., 'authentication issues' or 'meeting notes from last week'"
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              disabled={loading}
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                </svg>
                <span>Filters</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Content</option>
                  <option value="github">GitHub</option>
                  <option value="notion">Notion Pages</option>
                  <option value="members">Team Members</option>
                  <option value="docs">Documents</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Results Limit
                </label>
                <select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && !query && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Searches</h3>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((historyItem, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(historyItem);
                  performSearch(historyItem);
                }}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                {historyItem}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({results.length})
            </h3>
            <span className="text-sm text-gray-500">
              Found in {loading ? '...' : '0.5'}s
            </span>
          </div>

          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getResultIcon(result.type)}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">
                        <span dangerouslySetInnerHTML={{ 
                          __html: highlightText(result.title, query) 
                        }} />
                      </h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {getResultTypeLabel(result.type)}
                        </span>
                        <span>•</span>
                        <span className="text-green-600 font-medium">
                          {formatRelevanceScore(result.relevanceScore)}% match
                        </span>
                      </div>
                    </div>
                  </div>
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Open
                    </a>
                  )}
                </div>
                
                {result.description && (
                  <p className="text-gray-600 mb-3 line-clamp-3">
                    <span dangerouslySetInnerHTML={{ 
                      __html: highlightText(result.description, query) 
                    }} />
                  </p>
                )}

                {result.metadata && (
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {result.metadata.author && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        By: {result.metadata.author}
                      </span>
                    )}
                    {result.metadata.createdAt && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        Created: {new Date(result.metadata.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    {result.metadata.language && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {result.metadata.language}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && !error && (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search terms or filters. Here are some tips:
          </p>
          <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
            <li>• Use different keywords or synonyms</li>
            <li>• Try broader search terms</li>
            <li>• Check if your workspace has the content you're looking for</li>
            <li>• Use natural language queries like "issues with login"</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;