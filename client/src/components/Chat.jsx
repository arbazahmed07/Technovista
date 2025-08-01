import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const Chat = ({ workspaceId }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, [workspaceId]);

  useEffect(() => {
    if (socket && isConnected) {
      // Join workspace room
      socket.emit('join-workspace', workspaceId);

      // Listen for new messages
      socket.on('new-message', handleNewMessage);
      
      // Listen for typing indicators
      socket.on('user-typing', handleUserTyping);
      socket.on('user-stopped-typing', handleUserStoppedTyping);

      return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('user-typing', handleUserTyping);
        socket.off('user-stopped-typing', handleUserStoppedTyping);
        socket.emit('leave-workspace', workspaceId);
      };
    }
  }, [socket, isConnected, workspaceId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/chat/${workspaceId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleUserTyping = (data) => {
    if (data.userId !== user.id) {
      setTypingUsers(prev => {
        if (!prev.find(u => u.userId === data.userId)) {
          return [...prev, data];
        }
        return prev;
      });
    }
  };

  const handleUserStoppedTyping = (data) => {
    setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !isConnected) return;

    socket.emit('send-message', {
      workspaceId,
      message: newMessage.trim(),
      type: 'text'
    });

    setNewMessage('');
    stopTyping();
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (socket && isConnected) {
      socket.emit('typing-start', { workspaceId });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    }
  };

  const stopTyping = () => {
    if (socket && isConnected) {
      socket.emit('typing-stop', { workspaceId });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    
    return currentDate !== previousDate;
  };

  const shouldShowAvatar = (currentMessage, nextMessage) => {
    if (!nextMessage) return true;
    
    return currentMessage.sender.id !== nextMessage.sender.id ||
           new Date(nextMessage.timestamp) - new Date(currentMessage.timestamp) > 300000; // 5 minutes
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Chat</h3>
          <p className="text-sm text-gray-500">
            {isConnected ? (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                Disconnected
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '400px' }}>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7.93-7M3 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No messages yet</h3>
            <p className="mt-2 text-gray-500">Start the conversation by sending a message.</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
              const isOwnMessage = message.sender.id === user.id;
              const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
              const showAvatar = shouldShowAvatar(message, nextMessage);

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                  )}
                  
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      {!isOwnMessage && showAvatar && (
                        <div className="flex-shrink-0 mr-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {message.sender.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        {(!isOwnMessage && showAvatar) && (
                          <span className="text-xs font-medium text-gray-600 mb-1">
                            {message.sender.name}
                          </span>
                        )}
                        
                        <div className={`px-4 py-2 rounded-lg ${
                          isOwnMessage 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                          {message.edited && (
                            <span className="text-xs opacity-70 italic">(edited)</span>
                          )}
                        </div>
                        
                        <span className="text-xs text-gray-500 mt-1">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span>
              {typingUsers.length === 1 
                ? `${typingUsers[0].userName} is typing...`
                : `${typingUsers.length} people are typing...`
              }
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            onBlur={stopTyping}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;