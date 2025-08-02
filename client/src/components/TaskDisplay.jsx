import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TaskDisplay = ({ workspaceId, userId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [workspaceId, filter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://technovista.onrender.com/api/tasks/workspace/${workspaceId}?filter=${filter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `https://technovista.onrender.com/api/tasks/${taskId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTasks(); // Refresh tasks
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-600 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-600 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="bg-blue-100 text-blue-600 rounded-full p-2 mr-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
          Your Tasks
        </h3>
        
        <div className="flex space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tasks</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No tasks yet</h3>
          <p className="mt-2 text-gray-500">Tasks assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div 
              key={task._id} 
              className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                task.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className={`font-medium ${task.status === 'completed' ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </h4>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(task.priority)}`}>
                      {task.priority} priority
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                    <span>📅 {formatDueDate(task.dueDate)}</span>
                    {task.estimatedTime && <span>⏱️ {task.estimatedTime}</span>}
                    <span>👤 Assigned by {task.assignedBy?.name}</span>
                  </div>

                  {task.aiGuidanceEnabled && (
                    <div className="flex items-center space-x-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>AI guidance available</span>
                    </div>
                  )}
                </div>
                
                <div className="ml-4 flex flex-col space-y-2">
                  {task.status !== 'completed' && (
                    <>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => updateTaskStatus(task._id, 'in_progress')}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Start Task
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => updateTaskStatus(task._id, 'completed')}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                    </>
                  )}
                  
                  {task.aiGuidanceEnabled && task.status !== 'completed' && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openAIGuidance', { detail: { task } }))}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Get AI Help
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskDisplay;