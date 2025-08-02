import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import axios from 'axios';

const ArchitectureDiagram = ({ workspaceId }) => {
  const [diagramData, setDiagramData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagramType, setDiagramType] = useState('flowchart');
  const mermaidRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      }
    });
  }, []);

  useEffect(() => {
    if (diagramData && mermaidRef.current) {
      renderDiagram();
    }
  }, [diagramData, diagramType]);

  const generateArchitecture = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `https://technovista.onrender.com/api/github/workspace/${workspaceId}/architecture`,
        { diagramType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDiagramData(response.data);
    } catch (error) {
      console.error('Error generating architecture:', error);
      const errorMessage = error.response?.data?.message || 'Failed to generate architecture diagram';
      setError(errorMessage);
      
      // Additional error logging
      if (error.response?.status === 400) {
        console.error('Bad Request Details:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderDiagram = async () => {
    if (!diagramData?.mermaidCode || !mermaidRef.current) return;

    try {
      mermaidRef.current.innerHTML = '';
      const { svg } = await mermaid.render('architecture-diagram', diagramData.mermaidCode);
      mermaidRef.current.innerHTML = svg;
    } catch (error) {
      console.error('Error rendering diagram:', error);
      setError('Failed to render diagram. Please try a different diagram type.');
    }
  };

  const downloadDiagram = () => {
    if (!mermaidRef.current) return;

    const svg = mermaidRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `architecture-${diagramType}-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(svgUrl);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">Architecture Diagram</h3>
            <select
              value={diagramType}
              onChange={(e) => setDiagramType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="flowchart">Flowchart</option>
              <option value="component">Component Diagram</option>
              <option value="sequence">Sequence Diagram</option>
              <option value="class">Class Diagram</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            {diagramData && (
              <button
                onClick={downloadDiagram}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download SVG</span>
              </button>
            )}
            
            <button
              onClick={generateArchitecture}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{loading ? 'Generating...' : 'Generate Architecture'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          <div className="font-medium">Error:</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Diagram Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing codebase and generating architecture...</p>
            </div>
          </div>
        ) : !diagramData ? (
          <div className="text-center py-16">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Architecture Diagram</h3>
            <p className="text-gray-500 mb-4">Generate an interactive architecture diagram from your codebase</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Diagram Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Diagram Analysis</h4>
              <p className="text-gray-700 text-sm mb-2">{diagramData.description}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {diagramData.componentsCount} Components
                </span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  {diagramData.connectionsCount} Connections
                </span>
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  {diagramType.charAt(0).toUpperCase() + diagramType.slice(1)} Diagram
                </span>
              </div>
            </div>

            {/* Mermaid Diagram */}
            <div className="border border-gray-200 rounded-lg p-4 overflow-auto">
              <div 
                ref={mermaidRef}
                className="mermaid-diagram text-center"
                style={{ minHeight: '400px' }}
              />
            </div>

            {/* Diagram Code */}
            <div className="mt-6">
              <button
                onClick={() => {
                  const codeElement = document.getElementById('diagram-code');
                  codeElement.style.display = codeElement.style.display === 'none' ? 'block' : 'none';
                }}
                className="text-sm text-blue-600 hover:text-blue-800 mb-2"
              >
                Toggle Mermaid Code
              </button>
              <div id="diagram-code" style={{ display: 'none' }}>
                <pre className="bg-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <code>{diagramData.mermaidCode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;