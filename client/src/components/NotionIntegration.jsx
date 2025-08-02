import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateNotionPageModal from './CreateNotionPageModal';

const NotionIntegration = ({ workspaceId }) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageContent, setPageContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetchPages();
  }, [workspaceId]);

  const fetchPages = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/notion/workspace/${workspaceId}/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPages(response.data.pages);
    } catch (error) {
      console.error('Error fetching Notion pages:', error);
      setError(error.response?.data?.message || 'Failed to fetch Notion pages');
    } finally {
      setLoading(false);
    }
  };

  const fetchPageContent = async (pageId) => {
    setLoadingContent(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/notion/page/${pageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPageContent(response.data.page);
    } catch (error) {
      console.error('Error fetching page content:', error);
      setError(error.response?.data?.message || 'Failed to fetch page content');
    } finally {
      setLoadingContent(false);
    }
  };

  const handlePageClick = (page) => {
    setSelectedPage(page);
    fetchPageContent(page.id);
  };

  const handlePageCreated = (newPage) => {
    setPages(prev => [newPage, ...prev]);
  };

  const updatePageStatus = async (pageId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`https://technovista.onrender.com/api/notion/page/${pageId}/status`, 
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setPages(prev => prev.map(page => 
        page.id === pageId ? { ...page, status } : page
      ));
      
      if (selectedPage?.id === pageId) {
        setSelectedPage(prev => ({ ...prev, status }));
      }
    } catch (error) {
      console.error('Error updating page status:', error);
      setError(error.response?.data?.message || 'Failed to update page status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Review': return 'bg-blue-100 text-blue-800';
      case 'Complete': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Meeting Notes': return '📝';
      case 'Project Plan': return '📋';
      case 'Brainstorming': return '💡';
      case 'Documentation': return '📚';
      case 'Task List': return '✅';
      default: return '📄';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderBlockContent = (block) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p className="mb-4">
            {block.paragraph.rich_text.map((text, index) => (
              <span key={index} className={text.annotations?.bold ? 'font-bold' : ''}>
                {text.plain_text}
              </span>
            ))}
          </p>
        );
      case 'heading_1':
        return (
          <h1 className="text-2xl font-bold mb-4">
            {block.heading_1.rich_text.map(text => text.plain_text).join('')}
          </h1>
        );
      case 'heading_2':
        return (
          <h2 className="text-xl font-semibold mb-3">
            {block.heading_2.rich_text.map(text => text.plain_text).join('')}
          </h2>
        );
      case 'heading_3':
        return (
          <h3 className="text-lg font-medium mb-2">
            {block.heading_3.rich_text.map(text => text.plain_text).join('')}
          </h3>
        );
      case 'bulleted_list_item':
        return (
          <li className="mb-2 ml-4">
            • {block.bulleted_list_item.rich_text.map(text => text.plain_text).join('')}
          </li>
        );
      case 'numbered_list_item':
        return (
          <li className="mb-2 ml-4 list-decimal">
            {block.numbered_list_item.rich_text.map(text => text.plain_text).join('')}
          </li>
        );
      case 'to_do':
        return (
          <div className="flex items-center mb-2">
            <input 
              type="checkbox" 
              checked={block.to_do.checked} 
              readOnly 
              className="mr-2"
            />
            <span className={block.to_do.checked ? 'line-through text-gray-500' : ''}>
              {block.to_do.rich_text.map(text => text.plain_text).join('')}
            </span>
          </div>
        );
      case 'divider':
        return <hr className="my-4 border-gray-300" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Pages List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Notion Pages</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Page</span>
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchPages}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Try Again
              </button>
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 mb-4">No pages found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Create your first page
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handlePageClick(page)}
                  className={`w-full text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border ${
                    selectedPage?.id === page.id 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {getTypeIcon(page.type)}
                      </span>
                      <h4 className="font-medium text-gray-900 truncate">
                        {page.title}
                      </h4>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ml-2 ${getStatusColor(page.status)}`}>
                      {page.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{page.type}</span>
                    <span>{formatDate(page.lastEditedTime)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedPage ? (
              <span className="flex items-center">
                <span className="mr-2">{getTypeIcon(selectedPage.type)}</span>
                {selectedPage.title}
              </span>
            ) : (
              'Select a page to view'
            )}
          </h3>
          {selectedPage && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedPage.type} • Last edited {formatDate(selectedPage.lastEditedTime)}
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedPage.status}
                  onChange={(e) => updatePageStatus(selectedPage.id, e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Complete">Complete</option>
                </select>
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Open in Notion
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          {loadingContent ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : !selectedPage ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select a page from the list to view its contents</p>
            </div>
          ) : pageContent ? (
            <div className="prose max-w-none">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-xl font-bold text-gray-900 mb-0">{pageContent.title}</h1>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pageContent.status)}`}>
                    {pageContent.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Type: {pageContent.type}</p>
                  <p>Created: {formatDate(pageContent.createdTime)}</p>
                  {pageContent.createdBy && <p>Created by: {pageContent.createdBy}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                {pageContent.blocks && pageContent.blocks.length > 0 ? (
                  pageContent.blocks.map((block, index) => (
                    <div key={index}>
                      {renderBlockContent(block)}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">This page has no content yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create Page Modal */}
      <CreateNotionPageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspaceId={workspaceId}
        onPageCreated={handlePageCreated}
      />
    </div>
  );
};

export default NotionIntegration;