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
      const response = await axios.get('http://localhost:5000/api/meet/auth/status', {
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
    if (!workspaceId || workspaceId === 'undefined' || workspaceId.length !== 24) {
      console.error('Invalid workspaceId for fetchMeetings:', workspaceId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('Making request to:', `http://localhost:5000/api/meet/workspace/${workspaceId}/meetings`);
      
      const response = await axios.get(
        `http://localhost:5000/api/meet/workspace/${workspaceId}/meetings`,
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
      const response = await axios.get('http://localhost:5000/api/meet/auth/url', {
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
        `http://localhost:5000/api/meet/workspace/${workspaceId}/create`,
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
        const token = localStorage.getItem('token');
        await axios.post(
          `http://localhost:5000/api/meet/${activeMeeting._id}/generate-automatic-notes`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        alert('Meeting ended and notes have been automatically generated for team members who missed the meeting!');
      } catch (error) {
        console.error('Error generating automatic notes:', error);
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
      await axios.delete(`http://localhost:5000/api/meet/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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

  // Loading state
  if (loading && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">Loading Google Meet...</p>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="space-y-8">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold">Connect to Google Meet</h2>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Seamlessly schedule, manage, and join Google Meet video conferences directly from your workspace
            </p>
          </div>
        </div>

        {/* Connection Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-xl border border-white/20 text-center">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-gray-900">Google Account Required</h3>
              <p className="text-gray-600 leading-relaxed">
                Connect your Google account to access Google Meet features including meeting scheduling, calendar integration, and automatic note generation.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <ul className="text-left space-y-2 text-gray-600">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Schedule meetings with calendar integration
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Automatic meeting notes and summaries
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Real-time captions and transcription
                </li>
              </ul>
            </div>

            <button
              onClick={connectGoogleAccount}
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transform hover:scale-105"
            >
              {authLoading && (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{authLoading ? 'Connecting...' : 'Connect Google Account'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold flex items-center">
              <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Google Meet Integration
            </h2>
            <p className="text-blue-100 text-lg">
              Schedule and manage your video conferences seamlessly
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-sm text-blue-100 mb-1">Total Meetings</p>
              <p className="text-2xl font-bold">{meetings.length}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-sm text-blue-100 mb-1">Upcoming</p>
              <p className="text-2xl font-bold">{meetings.filter(m => new Date(m.scheduledTime) > new Date()).length}</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Schedule Meeting</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading state for meetings */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Loading meetings...</p>
        </div>
      ) : (
        /* Enhanced Meetings List */
        <div className="space-y-6">
          {meetings.length === 0 ? (
            <div className="text-center py-16 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl">
              <div className="mb-6">
                <svg className="mx-auto h-20 w-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 012 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No meetings scheduled</h3>
              <p className="text-gray-500 mb-6">Get started by scheduling your first meeting</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
              >
                Schedule Meeting
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {meetings.map((meeting) => {
                const { date, time } = formatDateTime(meeting.scheduledTime);
                const isMeetingTime = new Date() >= new Date(meeting.scheduledTime) && 
                                      new Date() <= new Date(new Date(meeting.scheduledTime).getTime() + meeting.duration * 60000);
                const isUpcoming = new Date(meeting.scheduledTime) > new Date();
                
                return (
                  <div key={meeting._id} className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg leading-tight">{meeting.title}</h3>
                        <div className="flex space-x-1">
                          {isMeetingTime && (
                            <span className="bg-green-400 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                              Live
                            </span>
                          )}
                          {isUpcoming && !isMeetingTime && (
                            <span className="bg-blue-400 text-white text-xs px-2 py-1 rounded-full">
                              Upcoming
                            </span>
                          )}
                          {meeting.isRecurring && (
                            <span className="bg-purple-400 text-white text-xs px-2 py-1 rounded-full">
                              Recurring
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {meeting.description && (
                        <p className="text-blue-100 text-sm mb-3 line-clamp-2">{meeting.description}</p>
                      )}
                      
                      <div className="space-y-2 text-blue-100 text-sm">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {date} at {time}
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {meeting.duration} minutes
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {meeting.organizer?.name || 'Unknown'}
                        </div>
                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {meeting.attendees.length} attendee{meeting.attendees.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6">
                      <div className="flex flex-wrap gap-3">
                        {isMeetingTime && (
                          <button
                            onClick={() => startMeeting(meeting)}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293L12 11m0 0l.707-.707A1 1 0 0113.586 10H15m-3 1v3" />
                            </svg>
                            Start with Captions
                          </button>
                        )}
                        
                        <button
                          onClick={() => joinMeeting(meeting)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Join Meeting
                        </button>
                        
                        <button
                          onClick={() => deleteMeeting(meeting._id)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Active Meeting Captions */}
      {showCaptions && activeMeeting && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"></span>
                Meeting in Progress: {activeMeeting.title}
              </h4>
              <p className="text-gray-600">Real-time captions and transcription active</p>
            </div>
            <button
              onClick={endMeeting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10l2 2 4-4" />
              </svg>
              <span>End Meeting</span>
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

      {/* Enhanced Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-white/20 w-full max-w-md mx-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 rounded-t-3xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Schedule New Meeting</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:text-gray-200 p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
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

                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={newMeeting.isRecurring}
                    onChange={(e) => setNewMeeting({...newMeeting, isRecurring: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                    Make this a recurring meeting
                  </label>
                </div>

                {newMeeting.isRecurring && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Recurrence Pattern
                    </label>
                    <select
                      value={newMeeting.recurrencePattern}
                      onChange={(e) => setNewMeeting({...newMeeting, recurrencePattern: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                )}

                <div className="flex space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 012 2z" />
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
