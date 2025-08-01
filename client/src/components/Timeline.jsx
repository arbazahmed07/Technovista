import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Timeline = ({ workspaceId }) => {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'milestone',
    date: '',
    status: 'planned'
  });

  const eventTypes = [
    { value: 'milestone', label: 'Milestone', icon: '🎯', color: 'blue' },
    { value: 'task', label: 'Task', icon: '✅', color: 'green' },
    { value: 'meeting', label: 'Meeting', icon: '📅', color: 'purple' },
    { value: 'deployment', label: 'Deployment', icon: '🚀', color: 'red' },
    { value: 'release', label: 'Release', icon: '📦', color: 'indigo' },
    { value: 'review', label: 'Review', icon: '👁️', color: 'yellow' }
  ];

  const statusTypes = [
    { value: 'planned', label: 'Planned', color: 'gray' },
    { value: 'in-progress', label: 'In Progress', color: 'blue' },
    { value: 'completed', label: 'Completed', color: 'green' },
    { value: 'delayed', label: 'Delayed', color: 'yellow' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' }
  ];

  useEffect(() => {
    fetchTimelineEvents();
  }, [workspaceId]);

  const fetchTimelineEvents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/timeline/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimelineEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching timeline events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/timeline/${workspaceId}`,
        newEvent,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTimelineEvents(prev => [response.data.event, ...prev]);
      setNewEvent({
        title: '',
        description: '',
        type: 'milestone',
        date: '',
        status: 'planned'
      });
      setShowAddEvent(false);
    } catch (error) {
      console.error('Error adding timeline event:', error);
    }
  };

  const updateEventStatus = async (eventId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `http://localhost:5000/api/timeline/${workspaceId}/${eventId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTimelineEvents(prev =>
        prev.map(event =>
          event._id === eventId ? { ...event, status: newStatus } : event
        )
      );
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/timeline/${workspaceId}/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTimelineEvents(prev => prev.filter(event => event._id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const getEventTypeConfig = (type) => {
    return eventTypes.find(t => t.value === type) || eventTypes[0];
  };

  const getStatusConfig = (status) => {
    return statusTypes.find(s => s.value === status) || statusTypes[0];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const sortedEvents = timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Project Timeline</h2>
          <p className="text-gray-600">Track milestones, tasks, and project events</p>
        </div>
        <button
          onClick={() => setShowAddEvent(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Event</span>
        </button>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Timeline Event</h3>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Event description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {eventTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={newEvent.status}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusTypes.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No timeline events</h3>
            <p className="mt-2 text-gray-500">Add your first milestone or event to get started.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6">
                {sortedEvents.map((event, index) => {
                  const typeConfig = getEventTypeConfig(event.type);
                  const statusConfig = getStatusConfig(event.status);
                  const isOverdue = new Date(event.date) < new Date() && event.status !== 'completed';
                  
                  return (
                    <div key={event._id} className="relative flex items-start space-x-4">
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white ${
                        event.status === 'completed' 
                          ? 'border-green-500 text-green-500'
                          : isOverdue 
                          ? 'border-red-500 text-red-500'
                          : `border-${typeConfig.color}-500 text-${typeConfig.color}-500`
                      }`}>
                        <span className="text-sm">{typeConfig.icon}</span>
                      </div>
                      
                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {event.title}
                                </h4>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${statusConfig.color}-100 text-${statusConfig.color}-800`}>
                                  {statusConfig.label}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${typeConfig.color}-100 text-${typeConfig.color}-800`}>
                                  {typeConfig.label}
                                </span>
                              </div>
                              
                              {event.description && (
                                <p className="text-gray-600 mb-2">{event.description}</p>
                              )}
                              
                              <div className="flex items-center text-sm text-gray-500">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {formatDate(event.date)}
                                  {isOverdue && ' (Overdue)'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              {/* Status update dropdown */}
                              <select
                                value={event.status}
                                onChange={(e) => updateEventStatus(event._id, e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {statusTypes.map(status => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                              
                              {/* Delete button */}
                              <button
                                onClick={() => deleteEvent(event._id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Delete event"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {sortedEvents.filter(e => e.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">In Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {sortedEvents.filter(e => e.status === 'in-progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              <p className="text-2xl font-semibold text-gray-900">
                {sortedEvents.filter(e => 
                  new Date(e.date) < new Date() && e.status !== 'completed'
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;