import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import WorkspaceDetail from './WorkspaceDetail';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [loading, setLoading] = useState({ workspaces: true, invites: true });

  useEffect(() => {
    fetchWorkspaces();
    fetchPendingInvites();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(prev => ({ ...prev, workspaces: false }));
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/invites/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingInvites(response.data.invites || []);
    } catch (error) {
      console.error('Error fetching pending invites:', error);
    } finally {
      setLoading(prev => ({ ...prev, invites: false }));
    }
  };

  const openWorkspace = (workspaceId) => {
    console.log('Opening workspace with ID:', workspaceId);
    if (workspaceId && workspaceId !== 'undefined') {
      setSelectedWorkspaceId(workspaceId);
    } else {
      console.error('Invalid workspace ID:', workspaceId);
    }
  };

  const closeWorkspace = () => {
    setSelectedWorkspaceId(null);
  };

  const handleWorkspaceCreated = (newWorkspace) => {
    setWorkspaces(prev => [...prev, newWorkspace]);
    setShowCreateModal(false);
  };

  const acceptInvite = async (inviteId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/invites/${inviteId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchWorkspaces();
      await fetchPendingInvites();
    } catch (error) {
      console.error('Error accepting invite:', error);
      alert('Failed to accept invitation');
    }
  };

  const declineInvite = async (inviteId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/invites/${inviteId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchPendingInvites();
    } catch (error) {
      console.error('Error declining invite:', error);
      alert('Failed to decline invitation');
    }
  };

  // If a workspace is selected, show the workspace detail
  if (selectedWorkspaceId) {
    return (
      <WorkspaceDetail 
        workspaceId={selectedWorkspaceId}
        onBack={closeWorkspace}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">Pending Invitations</h2>
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between bg-white p-4 rounded-lg border border-blue-200">
                  <div>
                    <h4 className="font-medium text-gray-900">{invite.workspace.name}</h4>
                    <p className="text-sm text-gray-600">
                      Invited by {invite.invitedBy.name} • {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineInvite(invite.id)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspaces Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Workspaces</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Workspace</span>
            </button>
          </div>

          {loading.workspaces ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading workspaces...</div>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h4 className="mt-4 text-lg font-medium text-gray-900">No workspaces yet</h4>
              <p className="mt-2 text-gray-500">Create your first workspace to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 truncate">{workspace.name}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      workspace.role === 'Creator' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {workspace.role}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{workspace.description}</p>
                  <button
                    onClick={() => openWorkspace(workspace.id)}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                  >
                    Open Workspace
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <CreateWorkspaceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      )}
    </div>
  );
};

export default Dashboard;
