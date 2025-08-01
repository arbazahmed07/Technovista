import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SmartOnboarding from './SmartOnboarding';
import AddMembersModal from './AddMembersModal';
import GitHubIntegration from './GitHubIntegration';
import NotionIntegration from './NotionIntegration';
import Timeline from './Timeline';
import Chat from './Chat';
import GoogleMeetIntegration from './GoogleMeetIntegration';
import MeetingNotes from './MeetingNotes';

const WorkspaceDetail = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('onboarding');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);

  // Add state for invites
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Add GitHub data state
  const [githubData, setGithubData] = useState({
    isConnected: false,
    repoInfo: null,
    data: {
      issues: [],
      pullRequests: [],
      commits: [],
      releases: []
    },
    loading: {
      repo: false,
      issues: false,
      pullRequests: false,
      commits: false,
      releases: false
    }
  });

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceDetails();
      fetchUserDetails();
    }
  }, [workspaceId]);

  // Add GitHub data fetching
  useEffect(() => {
    if (workspace && activeTab === 'github') {
      fetchGitHubData();
    }
  }, [workspace, activeTab]);

  const fetchWorkspaceDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspace(response.data.workspace);
    } catch (error) {
      console.error('Error fetching workspace:', error);
      setError(error.response?.data?.message || 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const fetchGitHubData = async () => {
    try {
      setGithubData(prev => ({ ...prev, loading: { ...prev.loading, repo: true } }));
      
      const token = localStorage.getItem('token');
      
      // Check GitHub connection status
      const statusResponse = await axios.get(`http://localhost:5000/api/github/workspace/${workspaceId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (statusResponse.data.connected) {
        setGithubData(prev => ({
          ...prev,
          isConnected: true,
          repoInfo: statusResponse.data.repository,
          loading: { ...prev.loading, repo: false }
        }));

        // Fetch GitHub data for different tabs
        await Promise.all([
          fetchGitHubTabData('issues'),
          fetchGitHubTabData('pullRequests'),
          fetchGitHubTabData('commits'),
          fetchGitHubTabData('releases')
        ]);
      } else {
        setGithubData(prev => ({
          ...prev,
          isConnected: false,
          repoInfo: null,
          loading: { ...prev.loading, repo: false }
        }));
      }
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
      setGithubData(prev => ({
        ...prev,
        isConnected: false,
        loading: { ...prev.loading, repo: false }
      }));
    }
  };

  const fetchGitHubTabData = async (tabType) => {
    try {
      setGithubData(prev => ({
        ...prev,
        loading: { ...prev.loading, [tabType]: true }
      }));

      const token = localStorage.getItem('token');
      let endpoint = '';
      
      switch (tabType) {
        case 'issues':
          endpoint = 'issues';
          break;
        case 'pullRequests':
          endpoint = 'pull-requests'; // Fix: use pull-requests not pulls
          break;
        case 'commits':
          endpoint = 'commits';
          break;
        case 'releases':
          endpoint = 'releases';
          break;
        default:
          return;
      }

      const response = await axios.get(
        `http://localhost:5000/api/github/workspace/${workspaceId}/${endpoint}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Fix: map the response data correctly
      let responseData = [];
      switch (tabType) {
        case 'issues':
          responseData = response.data.issues || [];
          break;
        case 'pullRequests':
          responseData = response.data.pullRequests || [];
          break;
        case 'commits':
          responseData = response.data.commits || [];
          break;
        case 'releases':
          responseData = response.data.releases || [];
          break;
        default:
          responseData = [];
      }

      setGithubData(prev => ({
        ...prev,
        data: {
          ...prev.data,
          [tabType]: responseData
        },
        loading: { ...prev.loading, [tabType]: false }
      }));
    } catch (error) {
      console.error(`Error fetching GitHub ${tabType}:`, error);
      setGithubData(prev => ({
        ...prev,
        loading: { ...prev.loading, [tabType]: false }
      }));
    }
  };

  const handleGitHubDataChange = () => {
    // Refresh GitHub data when connection status changes
    fetchGitHubData();
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleMembersAdded = () => {
    // Refresh workspace details and invites
    fetchWorkspaceDetails();
    fetchWorkspaceInvites();
  };

  // Add function to fetch workspace invites
  const fetchWorkspaceInvites = async () => {
    if (!workspace || workspace.userRole !== 'Creator') return;
    
    try {
      setInvitesLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/invites/workspace/${workspaceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvites(response.data.invites || []);
    } catch (error) {
      console.error('Error fetching workspace invites:', error);
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  // Fetch invites when workspace is loaded and user is creator
  useEffect(() => {
    if (workspace && workspace.userRole === 'Creator') {
      fetchWorkspaceInvites();
    }
  }, [workspace]);

  // Add function to resend invite
  const resendInvite = async (email) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/workspaces/${workspaceId}/invite`,
        { emails: [email] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh invites
      fetchWorkspaceInvites();
      alert('Invitation resent successfully');
    } catch (error) {
      console.error('Error resending invite:', error);
      alert('Failed to resend invitation');
    }
  };

  // Add function to cancel invite
  const cancelInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/invites/${inviteId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh invites
      fetchWorkspaceInvites();
    } catch (error) {
      console.error('Error cancelling invite:', error);
      alert('Failed to cancel invitation');
    }
  };

  // Early validation
  if (!workspaceId || workspaceId === 'undefined') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Workspace</h2>
          <p className="text-gray-600 mb-4">Invalid workspace ID</p>
          <button
            onClick={handleBackToDashboard}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canManageMembers = workspace?.userRole === 'Creator' || workspace?.userRole === 'Admin';
  const isCreator = workspace?.userRole === 'Creator';

  const acceptedMembers = workspace?.members || [];
  const pendingInvites = workspace?.invites?.filter(invite => invite.status === 'pending') || [];
  const declinedInvites = workspace?.invites?.filter(invite => invite.status === 'declined') || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleBackToDashboard}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'onboarding', name: 'Smart Onboarding', icon: '🚀' },
    { id: 'timeline', name: 'Timeline', icon: '📊' },
    { id: 'chat', name: 'Team Chat', icon: '💬' },
    { id: 'github', name: 'GitHub', icon: '🐙' },
    { id: 'notion', name: 'Notion', icon: '📝' },
    { id: 'meet', name: 'Google Meet', icon: '🎥' },
    { id: 'meeting-notes', name: 'Meeting Notes', icon: '📋' }, // Add this tab
    { id: 'members', name: 'Members', icon: '👥' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with back button */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                workspace.userRole === 'Creator' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {workspace.userRole}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Smart Onboarding Tab */}
        {activeTab === 'onboarding' && (
          <SmartOnboarding workspaceId={workspaceId} />
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <Timeline workspaceId={workspaceId} />
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <Chat workspaceId={workspaceId} />
        )}

        {/* GitHub Integration Tab */}
        {activeTab === 'github' && (
          <GitHubIntegration 
            workspaceId={workspaceId} 
            workspace={workspace}
            githubData={githubData}
            onDataChange={handleGitHubDataChange}
          />
        )}

        {/* Notion Integration Tab */}
        {activeTab === 'notion' && (
          <NotionIntegration workspaceId={workspaceId} />
        )}

        {/* Google Meet Tab */}
        {activeTab === 'meet' && (
          <GoogleMeetIntegration workspaceId={workspaceId} />
        )}

        {/* Meeting Notes Tab */}
        {activeTab === 'meeting-notes' && (
          <MeetingNotes workspaceId={workspaceId} />
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Active Members Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Workspace Members</h2>
                {workspace.userRole === 'Creator' && (
                  <button
                    onClick={() => setShowAddMembersModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Members</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {workspace.members?.map((member) => (
                  <div key={member.user._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {member.user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{member.user.name}</h3>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.role === 'Creator' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {member.role}
                      </span>
                      <span className="text-sm text-gray-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Invitations Section - Only visible to Creator */}
            {workspace.userRole === 'Creator' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                    {invites.filter(invite => invite.status === 'pending').length} Pending
                  </span>
                </div>

                {invitesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invites.filter(invite => invite.status === 'pending').length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2m-6 0H6m0 0H4m2 0v4m14-4v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4m2 0h2m-6 0h6" />
                        </svg>
                        <p>No pending invitations</p>
                      </div>
                    ) : (
                      invites
                        .filter(invite => invite.status === 'pending')
                        .map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-white font-medium">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{invite.email}</h3>
                                <p className="text-sm text-gray-500">
                                  Invited by {invite.invitedBy} • {new Date(invite.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                Pending
                              </span>
                              <button
                                onClick={() => resendInvite(invite.email)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                              >
                                Resend
                              </button>
                              <button
                                onClick={() => cancelInvite(invite.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Declined Invitations Section - Only visible to Creator */}
            {workspace.userRole === 'Creator' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Declined Invitations</h2>
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                    {invites.filter(invite => invite.status === 'declined').length} Declined
                  </span>
                </div>

                <div className="space-y-4">
                  {invites.filter(invite => invite.status === 'declined').length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No declined invitations</p>
                    </div>
                  ) : (
                  invites
                    .filter(invite => invite.status === 'declined')
                    .map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-medium">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{invite.email}</h3>
                            <p className="text-sm text-gray-500">
                              Invited by {invite.invitedBy} • Declined on {new Date(invite.updatedAt || invite.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            Declined
                          </span>
                          <button
                            onClick={() => resendInvite(invite.email)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                          >
                            Invite Again
                          </button>
                        </div>
                      </div>
                    ))
                  )
                }
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <AddMembersModal
          isOpen={showAddMembersModal}
          onClose={() => setShowAddMembersModal(false)}
          workspaceId={workspaceId}
          onMembersAdded={handleMembersAdded}
        />
      )}
    </div>
  );
};

export default WorkspaceDetail;