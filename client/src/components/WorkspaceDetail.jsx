import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import AddMembersModal from './AddMembersModal';
import GitHubIntegration from './GitHubIntegration';
import NotionIntegration from './NotionIntegration';
import Timeline from './Timeline';
import Chat from './Chat';
import GoogleMeetIntegration from './GoogleMeetIntegration';
import SmartOnboarding from './SmartOnboarding';
import MeetingNotes from './MeetingNotes';

const WorkspaceDetail = ({ workspaceId, onBack }) => {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  
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
    if (workspaceId && workspaceId !== 'undefined') {
      console.log('Fetching workspace details for ID:', workspaceId);
      fetchWorkspaceDetails();
    } else {
      console.error('Invalid workspaceId in WorkspaceDetail:', workspaceId);
      setError('Invalid workspace ID');
      setLoading(false);
    }
  }, [workspaceId]);

  // Add useEffect to fetch GitHub data when workspace is loaded
  useEffect(() => {
    if (workspace) {
      fetchGitHubData();
    }
  }, [workspace]);

  const fetchWorkspaceDetails = async () => {
    if (!workspaceId || workspaceId === 'undefined') {
      setError('Invalid workspace ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspace(response.data.workspace);
      setError('');
    } catch (error) {
      console.error('Error fetching workspace details:', error);
      setError(error.response?.data?.message || 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const fetchGitHubData = async () => {
    if (!workspaceId || workspaceId === 'undefined') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Check if GitHub is connected
      const repoResponse = await axios.get(
        `http://localhost:5000/api/github/workspace/${workspaceId}/repository`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (repoResponse.data.repository) {
        setGithubData(prev => ({
          ...prev,
          isConnected: true,
          repoInfo: repoResponse.data.repository
        }));

        // Fetch GitHub data
        const dataPromises = [
          axios.get(`http://localhost:5000/api/github/workspace/${workspaceId}/issues`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`http://localhost:5000/api/github/workspace/${workspaceId}/pull-requests`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`http://localhost:5000/api/github/workspace/${workspaceId}/commits`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`http://localhost:5000/api/github/workspace/${workspaceId}/changelog`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ];

        // Set individual loading states
        setGithubData(prev => ({
          ...prev,
          loading: {
            ...prev.loading,
            issues: true,
            pullRequests: true,
            commits: true,
            releases: true
          }
        }));

        try {
          const [issuesRes, pullRequestsRes, commitsRes, releasesRes] = await Promise.allSettled(dataPromises);

          setGithubData(prev => ({
            ...prev,
            data: {
              issues: issuesRes.status === 'fulfilled' ? (issuesRes.value.data.issues || []) : [],
              pullRequests: pullRequestsRes.status === 'fulfilled' ? (pullRequestsRes.value.data.pullRequests || []) : [],
              commits: commitsRes.status === 'fulfilled' ? (commitsRes.value.data.commits || []) : [],
              releases: releasesRes.status === 'fulfilled' ? (releasesRes.value.data.releases || []) : []
            },
            loading: {
              repo: false,
              issues: false,
              pullRequests: false,
              commits: false,
              releases: false
            }
          }));
        } catch (error) {
          console.error('Error fetching GitHub data:', error);
          setGithubData(prev => ({
            ...prev,
            loading: {
              repo: false,
              issues: false,
              pullRequests: false,
              commits: false,
              releases: false
            }
          }));
        }
      } else {
        setGithubData(prev => ({
          ...prev,
          isConnected: false,
          repoInfo: null,
          loading: { ...prev.loading, repo: false }
        }));
      }
    } catch (error) {
      console.error('Error fetching GitHub repository:', error);
      setGithubData(prev => ({
        ...prev,
        loading: { ...prev.loading, repo: false }
      }));
    }
  };

  const handleMembersAdded = () => {
    fetchWorkspaceDetails();
  };

  // Add function to refresh GitHub data
  const handleGitHubDataChange = () => {
    fetchGitHubData();
  };

  // Early validation
  if (!workspaceId || workspaceId === 'undefined') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Invalid workspace ID</p>
          <button
            onClick={onBack}
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
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'onboarding', label: 'Smart Onboarding', icon: '🧠' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'pending', label: 'Pending Invites', icon: '⏳' },
    { id: 'github', label: 'GitHub', icon: '🐙' },
    { id: 'notion', label: 'Notion', icon: '📘' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'meet', label: 'Google Meet', icon: '🎥' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 transition-colors"
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
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Smart Onboarding Tab */}
        {activeTab === 'onboarding' && (
          <div className="p-6">
            <SmartOnboarding workspaceId={workspaceId} />
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Active Members</h3>
              {isCreator && (
                <button
                  onClick={() => setShowAddMembersModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Members</span>
                </button>
              )}
            </div>
            {acceptedMembers.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="mt-4 text-gray-500">No members yet</p>
                {isCreator && (
                  <button
                    onClick={() => setShowAddMembersModal(true)}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Invite your first member
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{member.user.name}</h4>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.role === 'Creator' 
                          ? 'bg-blue-100 text-blue-800'
                          : member.role === 'Admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {member.role}
                      </span>
                      <span className="text-xs text-gray-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Invites Tab */}
        {activeTab === 'pending' && canManageMembers && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Pending Invitations</h3>
              {isCreator && (
                <button
                  onClick={() => setShowAddMembersModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Send More Invites</span>
                </button>
              )}
            </div>
            {pendingInvites.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-gray-500">No pending invitations</p>
                {isCreator && (
                  <button
                    onClick={() => setShowAddMembersModal(true)}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Send new invitations
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{invite.email}</h4>
                        <p className="text-sm text-gray-500">Invited by {invite.invitedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Declined Invites Tab */}
        {activeTab === 'declined' && canManageMembers && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Declined Invitations</h3>
            {declinedInvites.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No declined invitations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {declinedInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{invite.email}</h4>
                        <p className="text-sm text-gray-500">Invited by {invite.invitedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Declined
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notion Integration Tab */}
        {activeTab === 'notion' && (
          <div className="p-6">
            <NotionIntegration workspaceId={workspaceId} />
          </div>
        )}

        {/* GitHub Integration Tab */}
        {activeTab === 'github' && (
          <div className="p-6">
            <GitHubIntegration 
              workspaceId={workspaceId} 
              workspace={workspace}
              githubData={githubData}
              onDataChange={handleGitHubDataChange}
            />
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="p-6">
            <Timeline workspaceId={workspaceId} />
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="h-96">
            <Chat workspaceId={workspaceId} />
          </div>
        )}

        {/* Google Meet Tab */}
        {activeTab === 'meet' && workspaceId && workspaceId !== 'undefined' && (
          <div className="p-6">
            <GoogleMeetIntegration workspaceId={workspaceId} />
            <MeetingNotes workspaceId={workspaceId} />
          </div>
        )}
      </main>

      {/* Add Members Modal */}
      <AddMembersModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        workspaceId={workspaceId}
        onMembersAdded={handleMembersAdded}
      />
    </div>
  );
};

export default WorkspaceDetail;