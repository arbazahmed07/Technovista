import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MeetingCaptions from './MeetingCaptions';

const GoogleMeetIntegration = ({ workspaceId }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduledTime: '',
    duration: 60,
    attendees: '',
    isRecurring: false,
    recurrencePattern: 'weekly'
  });
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // ALL useEffect hooks MUST come before any early returns
  useEffect(() => {
    checkAuthStatus();
    checkUrlParams();
  }, [workspaceId]);

  useEffect(() => {
    if (isConnected) {
      fetchMeetings();
    }
  }, [isConnected, workspaceId]);

  // Remove this debug useEffect if no longer needed
  // useEffect(() => {
  //   console.log('Meetings state updated:', meetings);
  // }, [meetings]);

  const checkUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success === 'google_connected') {
      alert('Google account connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuthStatus();
    } else if (error) {
      const errorMessages = {
        'authorization_failed': 'Authorization failed. Please try again.',
        'authentication_failed': 'Authentication failed. Please try again.',
        'no_code': 'No authorization code received.',
        'no_state': 'Invalid authentication state.',
        'user_not_found': 'User not found.',
        'token_exchange_failed': 'Failed to exchange authorization code.'
      };
      
      alert(errorMessages[error] || 'An error occurred during authentication.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://technovista.onrender.com/api/meet/auth/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Auth status:', response.data);
      setIsConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    // Add validation
    if (!workspaceId || workspaceId === 'undefined' || workspaceId.length !== 24) {
      console.error('Invalid workspaceId for fetchMeetings:', workspaceId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('Making request to:', `https://technovista.onrender.com/api/meet/workspace/${workspaceId}/meetings`);
      
      const response = await axios.get(
        `https://technovista.onrender.com/api/meet/workspace/${workspaceId}/meetings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Full response:', response.data);
      console.log('Meetings array:', response.data.meetings);
      console.log('Number of meetings:', response.data.meetings?.length || 0);
      
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      console.error('Error response:', error.response?.data);
      
      if (error.response?.data?.needsAuth) {
        setIsConnected(false);
      }
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleAccount = async () => {
    try {
      setAuthLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('https://technovista.onrender.com/api/meet/auth/url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      window.location.href = response.data.authUrl;
      
    } catch (error) {
      console.error('Error connecting Google account:', error);
      setAuthLoading(false);
      alert('Failed to generate Google authorization URL. Please try again.');
    }
  };

  const createMeeting = async (e) => {
    e.preventDefault();
    
    try {
      setCreateLoading(true);
      const token = localStorage.getItem('token');
      const attendeesArray = newMeeting.attendees
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      console.log('Creating meeting with data:', {
        ...newMeeting,
        attendees: attendeesArray,
        scheduledTime: new Date(newMeeting.scheduledTime).toISOString()
      });

      const response = await axios.post(
        `https://technovista.onrender.com/api/meet/workspace/${workspaceId}/create`,
        {
          ...newMeeting,
          attendees: attendeesArray,
          scheduledTime: new Date(newMeeting.scheduledTime).toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Meeting created successfully:', response.data);

      // Close modal and reset form
      setShowCreateModal(false);
      setNewMeeting({
        title: '',
        description: '',
        scheduledTime: '',
        duration: 60,
        attendees: '',
        isRecurring: false,
        recurrencePattern: 'weekly'
      });
      
      // Force refresh meetings list
      await fetchMeetings();
      
      alert('Meeting created successfully!');
    } catch (error) {
      console.error('Error creating meeting:', error);
      
      if (error.response?.data?.needsAuth) {
        setIsConnected(false);
        alert('Google authentication required. Please connect your Google account.');
      } else {
        alert(error.response?.data?.message || 'Failed to create meeting');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const joinMeeting = (meeting) => {
    if (meeting.googleMeetLink) {
      window.open(meeting.googleMeetLink, '_blank');
    } else if (meeting.meetingUrl) {
      window.open(meeting.meetingUrl, '_blank');
    } else {
      alert('Meeting link not available');
    }
  };

  const startMeeting = (meeting) => {
    setActiveMeeting(meeting);
    setShowCaptions(true);
    joinMeeting(meeting);
  };

  const endMeeting = async () => {
    if (activeMeeting) {
      try {
        // Automatically generate notes when meeting ends
        const token = localStorage.getItem('token');
        await axios.post(
          `https://technovista.onrender.com/api/meet/${activeMeeting._id}/generate-automatic-notes`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        alert('Meeting ended and notes have been automatically generated for team members who missed the meeting!');
      } catch (error) {
        console.error('Error generating automatic notes:', error);
        // Don't show error to user, just log it
      }
    }
    
    setActiveMeeting(null);
    setShowCaptions(false);
  };

  const deleteMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://technovista.onrender.com/api/meet/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh meetings list
      await fetchMeetings();
      alert('Meeting cancelled successfully!');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to cancel meeting');
    }
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // NOW the early returns are safe because all hooks are above
  if (loading && !isConnected) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Google Meet</h3>
        <p className="text-gray-500 mb-4">Connect your Google account to schedule and manage meetings</p>
        <button
          onClick={connectGoogleAccount}
          disabled={authLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2 mx-auto"
        >
          {authLoading && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <span>{authLoading ? 'Connecting...' : 'Connect Google Account'}</span>
        </button>
      </div>
    );
  }

  // Main component render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Google Meet Integration</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Loading state for meetings */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">Loading meetings...</div>
        </div>
      ) : (
        /* Meetings List */
        <div className="space-y-4">
          {meetings.length === 0 ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No upcoming meetings scheduled</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
              >
                Schedule your first meeting
              </button>
            </div>
          ) : (
            meetings.map((meeting) => {
              const { date, time } = formatDateTime(meeting.scheduledTime);
              const isMeetingTime = new Date() >= new Date(meeting.scheduledTime) && 
                                    new Date() <= new Date(new Date(meeting.scheduledTime).getTime() + meeting.duration * 60000);
              
              return (
                <div key={meeting._id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{meeting.title}</h4>
                      {meeting.description && (
                        <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          📅 {date}
                        </span>
                        <span className="flex items-center">
                          🕒 {time}
                        </span>
                        <span className="flex items-center">
                          ⏱️ {meeting.duration} min
                        </span>
                        <span className="flex items-center">
                          👤 {meeting.organizer?.name || 'Unknown'}
                        </span>
                      </div>
                      {meeting.attendees && meeting.attendees.length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          <span>Attendees: {meeting.attendees.map(attendee => attendee.email).join(', ')}</span>
                        </div>
                      )}
                      {meeting.isRecurring && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                          Recurring ({meeting.recurrencePattern})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {isMeetingTime && (
                        <button
                          onClick={() => startMeeting(meeting)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Start with Captions
                        </button>
                      )}
                      <button
                        onClick={() => joinMeeting(meeting)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Join Meeting
                      </button>
                      <button
                        onClick={() => deleteMeeting(meeting._id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Active Meeting Captions */}
      {showCaptions && activeMeeting && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold">Meeting in Progress: {activeMeeting.title}</h4>
            <button
              onClick={endMeeting}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              End Meeting
            </button>
          </div>
          
          <MeetingCaptions
            meetingId={activeMeeting._id}
            isActive={true}
            onCaptionsUpdate={(captions) => {
              console.log('Captions updated:', captions.length);
            }}
          />
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Schedule New Meeting</h3>
            <form onSubmit={createMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter meeting title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Time *
                </label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduledTime}
                  onChange={(e) => setNewMeeting({...newMeeting, scheduledTime: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={getCurrentDateTime()}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={newMeeting.duration}
                  onChange={(e) => setNewMeeting({...newMeeting, duration: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="15"
                  max="480"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attendees (emails, comma-separated)
                </label>
                <textarea
                  value={newMeeting.attendees}
                  onChange={(e) => setNewMeeting({...newMeeting, attendees: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email1@example.com, email2@example.com"
                  rows="2"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newMeeting.isRecurring}
                  onChange={(e) => setNewMeeting({...newMeeting, isRecurring: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  Recurring meeting
                </label>
              </div>

              {newMeeting.isRecurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurrence Pattern
                  </label>
                  <select
                    value={newMeeting.recurrencePattern}
                    onChange={(e) => setNewMeeting({...newMeeting, recurrencePattern: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {createLoading && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{createLoading ? 'Creating...' : 'Schedule Meeting'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal - New Design */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-white/20 w-full max-w-md mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 rounded-t-3xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Schedule New Meeting</h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-white hover:text-gray-200 p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-8">
              <form onSubmit={createMeeting} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter meeting title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Description
                  </label>
                  <textarea
                    value={newMeeting.description}
                    onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                    rows="3"
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Scheduled Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newMeeting.scheduledTime}
                    onChange={(e) => setNewMeeting({...newMeeting, scheduledTime: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={newMeeting.duration}
                    onChange={(e) => setNewMeeting({...newMeeting, duration: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    min="15"
                    max="480"
                    placeholder="60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Attendees (emails, comma-separated)
                  </label>
                  <textarea
                    value={newMeeting.attendees}
                    onChange={(e) => setNewMeeting({...newMeeting, attendees: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                    rows="2"
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {createLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Schedule Meeting</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMeetIntegration;
