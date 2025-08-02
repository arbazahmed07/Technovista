import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MeetingNotes = ({ workspaceId }) => {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, missed, completed

  useEffect(() => {
    // Only fetch if workspaceId is valid
    if (workspaceId && workspaceId !== 'undefined' && workspaceId.length === 24) {
      fetchMeetingsWithNotes();
    } else {
      console.warn('Invalid workspaceId for MeetingNotes:', workspaceId);
      setLoading(false);
    }
  }, [workspaceId, filter]);

  const fetchMeetingsWithNotes = async () => {
    // Add validation at the start of the function
    if (!workspaceId || workspaceId === 'undefined' || workspaceId.length !== 24) {
      console.error('Invalid workspaceId:', workspaceId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://technovista.onrender.com/api/meet/workspace/${workspaceId}/notes?filter=${filter}`,
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
        `https://technovista.onrender.com/api/meet/${meetingId}/mark-notes-viewed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
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
        `https://technovista.onrender.com/api/meet/${meetingId}/generate-automatic-notes`,
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
    if (!notes) return <p>No notes available for this meeting.</p>;

    // Split notes into lines and process each line
    const lines = notes.split('\n');
    const formattedContent = [];

    lines.forEach((line, index) => {
      // Handle headers
      if (line.startsWith('# ')) {
        formattedContent.push(
          <h1 key={index} className="text-2xl font-bold text-gray-900 mb-4 mt-6">
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        formattedContent.push(
          <h2 key={index} className="text-xl font-semibold text-gray-800 mb-3 mt-5">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        formattedContent.push(
          <h3 key={index} className="text-lg font-medium text-gray-700 mb-2 mt-4">
            {line.substring(4)}
          </h3>
        );
      }
      // Handle bold text
      else if (line.includes('**')) {
        const formattedLine = line.split('**').map((part, i) => 
          i % 2 === 1 ? <strong key={i}>{part}</strong> : part
        );
        formattedContent.push(
          <p key={index} className="mb-2">
            {formattedLine}
          </p>
        );
      }
      // Handle bullet points
      else if (line.startsWith('- ')) {
        formattedContent.push(
          <div key={index} className="flex items-start mb-1">
            <span className="mr-2">•</span>
            <span>{line.substring(2)}</span>
          </div>
        );
      }
      // Handle checkboxes
      else if (line.includes('- [ ]')) {
        formattedContent.push(
          <div key={index} className="flex items-start mb-2">
            <input type="checkbox" className="mr-2 mt-1" disabled />
            <span>{line.replace('- [ ]', '').trim()}</span>
          </div>
        );
      }
      // Handle horizontal rules
      else if (line.trim() === '---') {
        formattedContent.push(
          <hr key={index} className="my-4 border-gray-300" />
        );
      }
      // Handle regular paragraphs
      else if (line.trim()) {
        formattedContent.push(
          <p key={index} className="mb-2">
            {line}
          </p>
        );
      }
      // Handle empty lines
      else {
        formattedContent.push(<br key={index} />);
      }
    });

    return <div>{formattedContent}</div>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Loading meeting notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Meeting Notes</h3>
          <div className="flex items-center space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Meetings</option>
              <option value="missed">Missed Meetings</option>
              <option value="completed">Completed Meetings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meetings List */}
      <div className="grid gap-4">
        {meetings.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500">No meeting notes available</p>
          </div>
        ) : (
          meetings.map((meeting) => (
            <div key={meeting._id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                      {meeting.missedByCurrentUser && !meeting.currentUserViewedNotes && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                          New Notes Available
                        </span>
                      )}
                      {meeting.notesGenerated && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Notes Available
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>📅 {formatDate(meeting.scheduledTime)}</p>
                      <p>👤 Organizer: {meeting.organizer?.name || 'Unknown'}</p>
                      <p>⏱️ Duration: {meeting.duration} minutes</p>
                      {meeting.notesGeneratedAt && (
                        <p>📝 Notes generated: {formatDate(meeting.notesGeneratedAt)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {meeting.notesGenerated ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            if (meeting.missedByCurrentUser) {
                              markNotesAsViewed(meeting._id);
                            }
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          View Notes
                        </button>
                        <button
                          onClick={() => exportNotes(meeting)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Export
                        </button>
                      </>
                    ) : meeting.status === 'completed' ? (
                      <button
                        onClick={() => generateNotesManually(meeting._id)}
                        disabled={notesLoading}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        {notesLoading ? 'Generating...' : 'Generate Notes'}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">Meeting in progress</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notes Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Meeting Notes: {selectedMeeting.title}
              </h3>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="prose max-w-none">
                <div className="formatted-notes text-gray-800">
                  {formatNotesForDisplay(selectedMeeting.automaticNotes || 'No notes available for this meeting.')}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => exportNotes(selectedMeeting)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Export Notes
              </button>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingNotes;