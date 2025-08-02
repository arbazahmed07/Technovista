import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CodebaseViewer = ({ workspaceId }) => {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [pathHistory, setPathHistory] = useState([]);
  const [loading, setLoading] = useState({
    files: false,
    content: false,
    branches: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBranches();
    fetchFiles('');
  }, [workspaceId]);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [selectedBranch]);

  const fetchBranches = async () => {
    setLoading(prev => ({ ...prev, branches: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBranches(response.data.branches);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(prev => ({ ...prev, branches: false }));
    }
  };

  const fetchFiles = async (path) => {
    setLoading(prev => ({ ...prev, files: true }));
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path, ref: selectedBranch }
      });
      
      setFiles(response.data.files);
      setCurrentPath(path);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError(error.response?.data?.message || 'Failed to fetch files');
    } finally {
      setLoading(prev => ({ ...prev, files: false }));
    }
  };

  const fetchFileContent = async (filePath) => {
    setLoading(prev => ({ ...prev, content: true }));
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/file-content`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: filePath, ref: selectedBranch }
      });
      
      setFileContent(response.data.file);
      setSelectedFile(filePath);
    } catch (error) {
      console.error('Error fetching file content:', error);
      setError(error.response?.data?.message || 'Failed to fetch file content');
    } finally {
      setLoading(prev => ({ ...prev, content: false }));
    }
  };

  const handleFileClick = (file) => {
    if (file.type === 'dir') {
      const newPath = file.path;
      setPathHistory(prev => [...prev, currentPath]);
      fetchFiles(newPath);
      setSelectedFile(null);
      setFileContent(null);
    } else {
      fetchFileContent(file.path);
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      fetchFiles(previousPath);
      setSelectedFile(null);
      setFileContent(null);
    }
  };

  const handleBreadcrumbClick = (path, index) => {
    const newPathHistory = pathHistory.slice(0, index);
    setPathHistory(newPathHistory);
    fetchFiles(path);
    setSelectedFile(null);
    setFileContent(null);
  };

  const getFileIcon = (file) => {
    if (file.type === 'dir') {
      return '📁';
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '📄',
      'jsx': '⚛️',
      'ts': '📘',
      'tsx': '⚛️',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'json': '📋',
      'md': '📝',
      'py': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'php': '🐘',
      'rb': '💎',
      'go': '🐹',
      'rs': '🦀',
      'sql': '🗄️',
      'yml': '⚙️',
      'yaml': '⚙️',
      'xml': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'pdf': '📄',
      'zip': '📦',
      'tar': '📦',
      'gz': '📦'
    };
    
    return iconMap[extension] || '📄';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getLanguageFromExtension = (extension) => {
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'bash',
      'bat': 'batch'
    };
    
    return languageMap[extension] || 'text';
  };

  const renderBreadcrumb = () => {
    const pathParts = currentPath.split('/').filter(part => part);
    const breadcrumbs = [
      { name: 'Root', path: '', index: -1 },
      ...pathParts.map((part, index) => ({
        name: part,
        path: pathParts.slice(0, index + 1).join('/'),
        index
      }))
    ];

    return (
      <nav className="flex mb-4 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => handleBreadcrumbClick(crumb.path, crumb.index)}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {crumb.name}
            </button>
            {index < breadcrumbs.length - 1 && (
              <span className="mx-2 text-gray-400">/</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* File Explorer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Repository Files</h3>
            <div className="flex items-center space-x-2">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loading.branches}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {renderBreadcrumb()}
          
          {currentPath && (
            <button
              onClick={handleBackClick}
              className="flex items-center text-blue-600 hover:text-blue-800 text-sm mb-2"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
        </div>

        <div className="p-4">
          {loading.files ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No files found
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors border ${
                    selectedFile === file.path 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {getFileIcon(file)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {file.name}
                        </div>
                        {file.type === 'file' && (
                          <div className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </div>
                        )}
                      </div>
                    </div>
                    {file.type === 'dir' && (
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Viewer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedFile ? (
              <span className="flex items-center">
                <span className="mr-2">{getFileIcon({ name: selectedFile, type: 'file' })}</span>
                {selectedFile.split('/').pop()}
              </span>
            ) : (
              'Select a file to view'
            )}
          </h3>
          {fileContent && (
            <div className="mt-2 text-sm text-gray-500">
              {formatFileSize(fileContent.size)} • {getLanguageFromExtension(fileContent.extension)}
            </div>
          )}
        </div>

        <div className="p-4">
          {loading.content ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : !selectedFile ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select a file from the explorer to view its contents</p>
            </div>
          ) : fileContent?.isBinary ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 mb-4">Binary file cannot be displayed</p>
              <a
                href={fileContent.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download File
              </a>
            </div>
          ) : fileContent ? (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {fileContent.content.split('\n').length} lines
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={fileContent.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View on GitHub
                  </a>
                  <a
                    href={fileContent.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Download
                  </a>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg border overflow-hidden">
                <pre className="p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  <code className={`language-${getLanguageFromExtension(fileContent.extension)}`}>
                    {fileContent.content}
                  </code>
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CodebaseViewer;