import React, { useState } from 'react';
import axios from 'axios';

const TaskAssignmentModal = ({ isOpen, onClose, workspaceId, memberId, memberName }) => {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    estimatedTime: '',
    aiGuidanceEnabled: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTaskData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (!taskData.title.trim() || !taskData.description.trim()) {
        setError('Title and description are required');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `https://technovista.onrender.com/api/tasks/assign`,
        {
          workspaceId,
          assignedTo: memberId,
          ...taskData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage(`Task assigned to ${memberName} successfully!`);
      setTaskData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        estimatedTime: '',
        aiGuidanceEnabled: true
      });

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Error assigning task:', err);
      setError(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTaskData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        estimatedTime: '',
        aiGuidanceEnabled: true
      });
      setError('');
      setSuccessMessage('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Modal Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Task to {memberName}
            </h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
              {successMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Task Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Task Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={taskData.title}
                onChange={handleInputChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Enter task title..."
                maxLength={100}
                required
              />
            </div>

            {/* Task Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={taskData.description}
                onChange={handleInputChange}
                disabled={loading}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100"
                placeholder="Describe what needs to be done..."
                maxLength={500}
                required
              />
            </div>

            {/* Priority and Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={taskData.priority}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  name="dueDate"
                  value={taskData.dueDate}
                  onChange={handleInputChange}
                  disabled={loading}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Estimated Time */}
            <div>
              <label htmlFor="estimatedTime" className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Time
              </label>
              <input
                type="text"
                id="estimatedTime"
                name="estimatedTime"
                value={taskData.estimatedTime}
                onChange={handleInputChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="e.g., 2 hours, 1 day, 30 minutes"
                maxLength={50}
              />
            </div>

            {/* AI Guidance Option */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="aiGuidanceEnabled"
                name="aiGuidanceEnabled"
                checked={taskData.aiGuidanceEnabled}
                onChange={handleInputChange}
                disabled={loading}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
              />
              <label htmlFor="aiGuidanceEnabled" className="ml-2 block text-sm text-gray-900">
                Enable AI guidance for this task
              </label>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Task Assignment Information
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>The member will receive a notification about this task</li>
                      <li>AI guidance will help them complete the task step by step</li>
                      <li>Task progress will be tracked automatically</li>
                      <li>You'll receive updates when the task is completed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors flex items-center"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{loading ? 'Assigning Task...' : 'Assign Task'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TaskAssignmentModal;