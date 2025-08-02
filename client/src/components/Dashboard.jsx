import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import CreateWorkspaceModal from './CreateWorkspaceModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState({ workspaces: true, invites: true });
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
    fetchPendingInvites();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://technovista.onrender.com/api/workspaces', {
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
      console.log('Fetching pending invites...');
      const response = await axios.get('https://technovista.onrender.com/api/invites/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Pending invites response:', response.data);
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
      navigate(`/workspace/${workspaceId}`);
    } else {
      console.error('Invalid workspace ID:', workspaceId);
    }
  };

  const handleWorkspaceCreated = (newWorkspace) => {
    setWorkspaces(prev => [...prev, newWorkspace]);
    setShowCreateModal(false);
    if (newWorkspace.id) {
      navigate(`/workspace/${newWorkspace.id}`);
    }
  };

  const acceptInvite = async (inviteId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`https://technovista.onrender.com/api/invites/${inviteId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Invite accepted:', response.data);
      
      // Refresh both workspaces and pending invites
      await fetchWorkspaces();
      await fetchPendingInvites();
      
      // Show success message
      alert('Invitation accepted successfully!');
    } catch (error) {
      console.error('Error accepting invite:', error);
      alert(error.response?.data?.message || 'Failed to accept invitation');
    }
  };

  const declineInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to decline this invitation?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`https://technovista.onrender.com/api/invites/${inviteId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Invite declined:', response.data);
      
      // Refresh pending invites
      await fetchPendingInvites();
      
      // Show success message
      alert('Invitation declined successfully.');
    } catch (error) {
      console.error('Error declining invite:', error);
      alert(error.response?.data?.message || 'Failed to decline invitation');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Enhanced Header with Gradient */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500">Manage your workspaces and collaborations</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-lg">
                  <span className="text-white font-semibold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Welcome back!</p>
                  <p className="text-xs text-gray-500">{user?.name}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
              >
                <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="mb-10 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Good to see you, {user?.name}! 👋</h2>
                <p className="text-blue-100 text-lg">Ready to collaborate and build something amazing?</p>
              </div>
              <div className="hidden md:flex items-center space-x-8 text-center">
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold">{workspaces.length}</div>
                  <div className="text-sm text-blue-100">Workspaces</div>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold">{pendingInvites.length}</div>
                  <div className="text-sm text-blue-100">Invitations</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Workspaces</h2>
              <p className="text-gray-600">Organize your projects and collaborate with your team</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-3"
            >
              <div className="bg-white/20 rounded-lg p-1">
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span>Create Workspace</span>
            </button>
          </div>

          {loading.workspaces ? (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-gray-600 font-medium">Loading your workspaces...</p>
              </div>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-16 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No workspaces yet</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">Get started by creating your first workspace and invite your team to collaborate.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Create Your First Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl p-7 transition-all duration-300 transform hover:scale-105 border border-white/20 hover:bg-white/90">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">
                          {workspace.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {workspace.name}
                        </h4>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${
                      workspace.role === 'Creator' 
                        ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200' 
                        : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-200'
                    }`}>
                      {workspace.role}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {workspace.description || 'No description provided'}
                  </p>
                  <button
                    onClick={() => openWorkspace(workspace.id)}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-500 hover:from-gray-900 hover:to-black text-white py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 transform group-hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                  >
                    <span>Open Workspace</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Workspace Invitations</h2>
                <p className="text-gray-600">Review and respond to collaboration requests</p>
              </div>
              {!loading.invites && pendingInvites.length > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold border border-blue-200">
                    {pendingInvites.length} pending
                  </span>
                </div>
              )}
            </div>
            {!loading.invites && pendingInvites.length > 0 && (
              <button
                onClick={fetchPendingInvites}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all duration-200"
              >
                <svg className="w-4 h-4 hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            )}
          </div>

          {loading.invites ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-12 shadow-xl">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-4"></div>
                <span className="text-gray-700 font-medium">Loading invitations...</span>
              </div>
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="text-center py-16 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl">
              <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">All caught up!</h3>
              <p className="text-gray-600 max-w-md mx-auto">You don't have any pending workspace invitations at the moment.</p>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
              <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      Review and respond to workspace invitations from other users.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="p-8 hover:bg-white/60 transition-all duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                          {invite.workspace.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xl font-bold text-gray-900 mb-2">
                            {invite.workspace.name}
                          </h4>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                            {invite.workspace.description || 'No description provided'}
                          </p>
                          <div className="flex items-center space-x-6 text-xs text-gray-500">
                            <span className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>Invited by <strong className="text-gray-700">{invite.invitedBy.name}</strong></span>
                            </span>
                            <span className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{new Date(invite.createdAt).toLocaleDateString()}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 ml-6">
                        <button
                          onClick={() => acceptInvite(invite.id)}
                          className="group bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => declineInvite(invite.id)}
                          className="group bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Enhanced Footer */}
              <div className="px-8 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-100">
                <div className="flex items-center justify-center space-x-2 text-sm text-blue-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>💡 Accepting an invitation will add you as a member and grant full workspace access</span>
                </div>
              </div>
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
