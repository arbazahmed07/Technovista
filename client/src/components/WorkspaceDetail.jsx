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
import SemanticSearch from './SemanticSearch';
import TaskAssignmentModal from './TaskAssignmentModal';
import TaskDisplay from './TaskDisplay';
import FloatingAIBot from './FloatingAIBot';

const WorkspaceDetail = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('onboarding');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showTaskAssignmentModal, setShowTaskAssignmentModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Add state for invites
  const [invites, setInvites] = useState([]);

  // Fix GitHub data structure to match what GitHubIntegration expects
  const [githubData, setGitHubData] = useState({
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
      pulls: false,
      commits: false,
      releases: false
    }
  });

  const handleGitHubDataChange = async (newData) => {
    if (newData && typeof newData === 'object') {
      setGitHubData(prevData => ({
        ...prevData,
        ...newData
      }));
    } else {
      // If no specific data provided, refresh GitHub data
      await fetchGitHubData();
    }
  };

  const fetchGitHubData = async () => {
    if (!workspaceId || workspaceId === 'undefined') return;

    try {
      const token = localStorage.getItem('token');
      
      // Set loading state
      setGitHubData(prevData => ({
        ...prevData,
        loading: { ...prevData.loading, repo: true }
      }));

      // Check GitHub connection status
      const statusResponse = await axios.get(
        `https://technovista.onrender.com/api/github/workspace/${workspaceId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { connected, repository } = statusResponse.data;

      if (connected && repository) {
        const [issuesResponse, pullsResponse, commitsResponse, releasesResponse] = await Promise.all([
          axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/issues`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { issues: [] } })),
          
          axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/pull-requests`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { pullRequests: [] } })),
          
          axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/commits`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { commits: [] } })),
          
          axios.get(`https://technovista.onrender.com/api/github/workspace/${workspaceId}/releases`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { releases: [] } }))
        ]);

        setGitHubData({
          isConnected: true,
          repoInfo: repository,
          data: {
            issues: issuesResponse.data.issues || [],
            pullRequests: pullsResponse.data.pullRequests || [],
            commits: commitsResponse.data.commits || [],
            releases: releasesResponse.data.releases || []
          },
          loading: {
            repo: false,
            issues: false,
            pulls: false,
            commits: false,
            releases: false
          }
        });
      } else {
        setGitHubData({
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
            pulls: false,
            commits: false,
            releases: false
          }
        });
      }
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
      setGitHubData(prevData => ({
        ...prevData,
        loading: {
          repo: false,
          issues: false,
          pulls: false,
          commits: false,
          releases: false
        }
      }));
    }
  };

  useEffect(() => {
    fetchWorkspaceDetails();
    fetchUserDetails();
  }, [workspaceId]);

  useEffect(() => {
    // Fetch GitHub data after workspace details are loaded
    if (workspace && workspaceId) {
      fetchGitHubData();
    }
  }, [workspace, workspaceId]);

  const fetchUserDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://technovista.onrender.com/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const fetchWorkspaceDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://technovista.onrender.com/api/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspace(response.data.workspace);
      setInvites(response.data.workspace.invites || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching workspace details:', error);
      setError('Failed to load workspace details');
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleMembersAdded = () => {
    fetchWorkspaceDetails(); // Refresh workspace data
    setShowAddMembersModal(false);
  };

  const resendInvite = async (email) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`https://technovista.onrender.com/api/workspaces/${workspaceId}/invite`, 
        { invites: [email] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Invitation resent successfully!');
      fetchWorkspaceDetails(); // Refresh data
    } catch (error) {
      console.error('Error resending invite:', error);
      alert('Failed to resend invitation');
    }
  };

  const handleAssignTask = (member) => {
    setSelectedMember(member);
    setShowTaskAssignmentModal(true);
  };

  if (!workspaceId || workspaceId === 'undefined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-2xl border border-white/20">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Invalid Workspace</h2>
          <p className="text-gray-600 mb-8">The workspace ID is invalid or missing.</p>
          <button
            onClick={handleBackToDashboard}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading workspace...</h3>
            <p className="text-gray-600">Please wait while we fetch your workspace details</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-2xl border border-white/20">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Error Loading Workspace</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={handleBackToDashboard}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'search', name: 'Semantic Search', icon: '🔍', color: 'from-emerald-500 to-teal-600' },
    { id: 'onboarding', name: 'Smart Onboarding', icon: '🚀', color: 'from-purple-500 to-indigo-600' },
    { id: 'timeline', name: 'Timeline', icon: '📊', color: 'from-blue-500 to-cyan-600' },
    { id: 'chat', name: 'Team Chat', icon: '💬', color: 'from-green-500 to-emerald-600' },
    { id: 'github', name: 'GitHub', icon: '🐙', color: 'from-slate-600 to-slate-800' },
    { id: 'notion', name: 'Notion', icon: '📝', color: 'from-orange-500 to-red-600' },
    { id: 'meet', name: 'Google Meet', icon: '🎥', color: 'from-blue-600 to-purple-600' },
    { id: 'meeting-notes', name: 'Meeting Notes', icon: '📋', color: 'from-teal-500 to-cyan-600' },
    { id: 'members', name: 'Members', icon: '👥', color: 'from-pink-500 to-rose-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Enhanced Header */}
      <nav className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-6">
              <button
                onClick={handleBackToDashboard}
                className="group p-3 text-gray-600 hover:text-gray-900 transition-all duration-200 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      workspace.userRole === 'Creator' 
                        ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200' 
                        : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-200'
                    }`}>
                      {workspace.userRole}
                    </span>
                    <span className="text-sm text-gray-500">
                      {workspace.members?.length || 0} members
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-lg">
                  <span className="text-white font-semibold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-gray-700 font-medium">Welcome, {user?.name}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Enhanced Tab Navigation */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20 sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 overflow-x-auto py-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center space-x-3 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform scale-105`
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.name}</span>
                {activeTab === tab.id && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content with Enhanced Styling */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Semantic Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <SemanticSearch workspaceId={workspaceId} />
          </div>
        )}

        {/* Smart Onboarding Tab */}
        {activeTab === 'onboarding' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <SmartOnboarding workspaceId={workspaceId} />
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <Timeline workspaceId={workspaceId} />
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <Chat workspaceId={workspaceId} />
          </div>
        )}

        {/* GitHub Integration Tab */}
        {activeTab === 'github' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <GitHubIntegration 
              workspaceId={workspaceId} 
              workspace={workspace}
              githubData={githubData}
              onDataChange={handleGitHubDataChange}
            />
          </div>
        )}

        {/* Notion Integration Tab */}
        {activeTab === 'notion' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <NotionIntegration workspaceId={workspaceId} />
          </div>
        )}

        {/* Google Meet Tab */}
        {activeTab === 'meet' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <GoogleMeetIntegration workspaceId={workspaceId} />
          </div>
        )}

        {/* Meeting Notes Tab */}
        {activeTab === 'meeting-notes' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <MeetingNotes workspaceId={workspaceId} />
          </div>
        )}

        {/* Enhanced Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-8">
            {/* Active Members Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Workspace Members</h2>
                      <p className="text-blue-100 text-sm">{acceptedMembers.length} active members</p>
                    </div>
                  </div>
                  {workspace.userRole === 'Creator' && (
                    <button
                      onClick={() => setShowAddMembersModal(true)}
                      className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Add Members</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8">
                <div className="space-y-4">
                  {workspace.members?.map((member) => (
                    <div key={member.user._id} className="flex items-center justify-between p-6 bg-gradient-to-r from-white/60 to-blue-50/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {member.user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{member.user.name}</h3>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-4 py-2 text-sm font-semibold rounded-xl ${
                          member.role === 'Creator' 
                            ? 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-200'
                            : member.role === 'Admin'
                            ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200'
                            : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-200'
                        }`}>
                          {member.role}
                        </span>
                        <div className="flex items-center space-x-1 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pending Invites Section */}
            {canManageMembers && pendingInvites.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-600 px-8 py-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Pending Invitations</h3>
                      <p className="text-yellow-100 text-sm">{pendingInvites.length} awaiting response</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="space-y-4">
                    {pendingInvites.map((invite) => (
                      <div key={invite._id} className="flex items-center justify-between p-6 bg-gradient-to-r from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border border-yellow-200/40 rounded-2xl">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center text-white font-bold">
                            {invite.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{invite.email}</h4>
                            <p className="text-sm text-gray-600">Invitation sent {new Date(invite.sentAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Pending
                          </span>
                          <button
                            onClick={() => resendInvite(invite.email)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all duration-200"
                          >
                            Resend
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Declined Invites Section */}
            {canManageMembers && declinedInvites.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Declined Invitations</h3>
                      <p className="text-red-100 text-sm">{declinedInvites.length} declined</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="space-y-4">
                    {declinedInvites.map((invite) => (
                      <div key={invite._id} className="flex items-center justify-between p-6 bg-gradient-to-r from-red-50/80 to-red-50/80 backdrop-blur-sm border border-red-200/40 rounded-2xl">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-500 rounded-2xl flex items-center justify-center text-white font-bold">
                            {invite.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{invite.email}</h4>
                            <p className="text-sm text-gray-600">Declined on {new Date(invite.respondedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
                            Declined
                          </span>
                          <button
                            onClick={() => resendInvite(invite.email)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all duration-200"
                          >
                            Invite Again
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Task Assignment Modal */}
      {showTaskAssignmentModal && selectedMember && (
        <TaskAssignmentModal
          isOpen={showTaskAssignmentModal}
          onClose={() => {
            setShowTaskAssignmentModal(false);
            setSelectedMember(null);
          }}
          workspaceId={workspaceId}
          memberId={selectedMember.user.id}
          memberName={selectedMember.user.name}
        />
      )}

      {/* Floating AI Bot */}
      <FloatingAIBot workspaceId={workspaceId} user={user} />
    </div>
  );
};

export default WorkspaceDetail;