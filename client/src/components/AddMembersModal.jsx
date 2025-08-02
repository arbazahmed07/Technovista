import React, { useState } from 'react';
import axios from 'axios';

const AddMembersModal = ({ isOpen, onClose, workspaceId, onMembersAdded }) => {
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Validate form
      if (!emails.trim()) {
        setError('Please enter at least one email address');
        setLoading(false);
        return;
      }

      // Parse invite emails
      const emailList = emails
        .split(',')
        .map(email => email.trim())
        .filter(email => email !== '');

      // Validate emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailList.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        setError(`Invalid email format: ${invalidEmails.join(', ')}`);
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `https://technovista.onrender.com/api/workspaces/${workspaceId}/invite`,
        { emails: emailList },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccessMessage(response.data.message);
      setEmails('');
      
      // Notify parent component to refresh data
      if (onMembersAdded) {
        onMembersAdded();
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (err) {
      console.error('Error adding members:', err);
      setError(err.response?.data?.message || 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmails('');
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
            <h3 className="text-lg font-semibold text-gray-900">Add Members to Workspace</h3>
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
            {/* Email Addresses */}
            <div>
              <label htmlFor="emails" className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses *
              </label>
              <textarea
                id="emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                disabled={loading}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter email addresses separated by commas&#10;e.g., john@example.com, jane@example.com"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Separate multiple email addresses with commas
              </p>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Invitation Information
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Invitations will be sent to the provided email addresses</li>
                      <li>Users will receive email notifications about the invitation</li>
                      <li>They can accept or decline the invitation from their dashboard</li>
                      <li>Only valid email addresses will be processed</li>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !emails.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{loading ? 'Sending Invitations...' : 'Send Invitations'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddMembersModal;