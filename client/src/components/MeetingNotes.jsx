import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MeetingNotes = ({ workspaceId }) => {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (workspaceId && workspaceId !== 'undefined' && workspaceId.length === 24) {
      fetchMeetingsWithNotes();
    } else {
      console.warn('Invalid workspaceId for MeetingNotes:', workspaceId);
      setLoading(false);
    }
  }, [workspaceId, filter]);

  const fetchMeetingsWithNotes = async () => {
    if (!workspaceId || workspaceId === 'undefined' || workspaceId.length !== 24) {
      console.error('Invalid workspaceId:', workspaceId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/meet/workspace/${workspaceId}/notes?filter=${filter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings with notes:', error);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const markNotesAsViewed = async (meetingId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/meet/${meetingId}/mark-notes-viewed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMeetings(meetings.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, currentUserViewedNotes: true }
          : meeting
      ));
    } catch (error) {
      console.error('Error marking notes as viewed:', error);
    }
  };

  const generateNotesManually = async (meetingId) => {
    try {
      setNotesLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/meet/${meetingId}/generate-automatic-notes`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchMeetingsWithNotes();
      alert('Meeting notes generated successfully!');
    } catch (error) {
      console.error('Error generating notes:', error);
      alert('Failed to generate meeting notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const exportNotes = (meeting) => {
    const notesContent = `# Meeting Notes: ${meeting.title}\n\n${meeting.automaticNotes}`;
    const blob = new Blob([notesContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-notes-${meeting.title.replace(/\s+/g, '-')}-${new Date(meeting.scheduledTime).toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNotesForDisplay = (notes) => {
    if (!notes) return <p className="text-gray-500 italic">No notes available for this meeting.</p>;

    const lines = notes.split('\n');
    const formattedContent = [];

    lines.forEach((line, index) => {
      // Handle headers
      if (line.startsWith('# ')) {
        formattedContent.push(
          <h1 key={index} className="text-3xl font-bold text-gray-900 mb-6 mt-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        formattedContent.push(
          <h2 key={index} className="text-2xl font-semibold text-gray-800 mb-4 mt-6 flex items-center">
            <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3"></span>
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        formattedContent.push(
          <h3 key={index} className="text-xl font-medium text-gray-700 mb-3 mt-5 border-l-4 border-blue-400 pl-4">
            {line.substring(4)}
          </h3>
        );
      }
      // Handle bold text
      else if (line.includes('**')) {
        const formattedLine = line.split('**').map((part, i) => 
          i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900 bg-yellow-100 px-1 rounded">{part}</strong> : part
        );
        formattedContent.push(
          <p key={index} className="mb-3 text-gray-700 leading-relaxed">
            {formattedLine}
          </p>
        );
      }
      // Handle bullet points
      else if (line.startsWith('- ')) {
        formattedContent.push(
          <div key={index} className="flex items-start mb-2 ml-4">
            <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
            <span className="text-gray-700">{line.substring(2)}</span>
          </div>
        );
      }
      // Handle checkboxes
      else if (line.includes('- [ ]')) {
        formattedContent.push(
          <div key={index} className="flex items-start mb-3 ml-4 p-2 bg-gray-50 rounded-lg">
            <input type="checkbox" className="mr-3 mt-1 text-blue-600" disabled />
            <span className="text-gray-700">{line.replace('- [ ]', '').trim()}</span>
          </div>
        );
      }
      // Handle horizontal rules
      else if (line.trim() === '---') {
        formattedContent.push(
          <hr key={index} className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        );
      }
      // Handle regular paragraphs
      else if (line.trim()) {
        formattedContent.push(
          <p key={index} className="mb-3 text-gray-700 leading-relaxed">
            {line}
          </p>
        );
      }
      // Handle empty lines
      else {
        formattedContent.push(<div key={index} className="h-2" />);
      }
    });

    return <div className="space-y-1">{formattedContent}</div>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">Loading meeting notes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold flex items-center">
              <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Meeting Notes
            </h2>
            <p className="text-blue-100 text-lg">
              Access and manage your meeting notes and summaries
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-sm text-blue-100 mb-1">Total Meetings</p>
              <p className="text-2xl font-bold">{meetings.length}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-sm text-blue-100 mb-1">With Notes</p>
              <p className="text-2xl font-bold">{meetings.filter(m => m.notesGenerated).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filter Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v6.586a1 1 0 01-.293.707L11 18.414v-6.586a1 1 0 00-.293-.707L4.293 5.707A1 1 0 014 5V4z" />
            </svg>
            <label className="text-sm font-medium text-gray-700">Filter meetings:</label>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          >
            <option value="all">🗂️ All Meetings</option>
            <option value="missed">❌ Missed Meetings</option>
            <option value="completed">✅ Completed Meetings</option>
          </select>
        </div>
      </div>

      {/* Enhanced Meetings Grid */}
      {meetings.length === 0 ? (
        <div className="text-center py-16 bg-white/60 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl">
          <div className="mb-6">
            <svg className="mx-auto h-20 w-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No meeting notes available</h3>
          <p className="text-gray-500 mb-6">Meeting notes will appear here after your meetings are completed</p>
          <button
            onClick={fetchMeetingsWithNotes}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
          >
            Refresh Notes
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <div key={meeting._id} className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg leading-tight">{meeting.title}</h3>
                  <div className="flex space-x-1">
                    {meeting.missedByCurrentUser && !meeting.currentUserViewedNotes && (
                      <span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        New
                      </span>
                    )}
                    {meeting.notesGenerated && (
                      <span className="bg-green-400 text-white text-xs px-2 py-1 rounded-full">
                        ✓ Notes
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-blue-100 text-sm">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 012 2z" />
                    </svg>
                    {formatDate(meeting.scheduledTime)}
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {meeting.organizer?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {meeting.duration} minutes
                  </div>
                  {meeting.notesGeneratedAt && (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Notes: {formatDate(meeting.notesGeneratedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="flex justify-center space-x-3">
                  {meeting.notesGenerated ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedMeeting(meeting);
                          if (meeting.missedByCurrentUser) {
                            markNotesAsViewed(meeting._id);
                          }
                        }}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Notes
                      </button>
                      <button
                        onClick={() => exportNotes(meeting)}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </>
                  ) : meeting.status === 'completed' ? (
                    <button
                      onClick={() => generateNotesManually(meeting._id)}
                      disabled={notesLoading}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {notesLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Generate Notes
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-2 text-sm text-gray-500 bg-gray-100 rounded-xl">
                      <svg className="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Meeting in progress
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Notes Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-white/20 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">
                    📝 {selectedMeeting.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-blue-100 text-sm">
                    <span>📅 {formatDate(selectedMeeting.scheduledTime)}</span>
                    <span>👤 {selectedMeeting.organizer?.name}</span>
                    <span>⏱️ {selectedMeeting.duration} min</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-8 overflow-y-auto max-h-[60vh] bg-gradient-to-br from-gray-50 to-blue-50">
              <div className="prose prose-lg max-w-none">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
                  {formatNotesForDisplay(selectedMeeting.automaticNotes || 'No notes available for this meeting.')}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-between items-center p-6 bg-gray-50/80 backdrop-blur-sm border-t border-gray-200/50">
              <div className="text-sm text-gray-500">
                Generated on {selectedMeeting.notesGeneratedAt ? formatDate(selectedMeeting.notesGeneratedAt) : 'Unknown'}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => exportNotes(selectedMeeting)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export Notes</span>
                </button>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingNotes;