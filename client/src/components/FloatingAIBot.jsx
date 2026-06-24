import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const FloatingAIBot = ({ workspaceId, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize with welcome message
    setMessages([
      {
        id: 1,
        type: 'ai',
        content: `Hello ${user?.name}! I'm your workspace AI assistant. I can help you with task guidance, answer questions about your workspace, and provide general assistance. How can I help you today?`,
        timestamp: new Date()
      }
    ]);

    // Listen for AI guidance requests
    const handleAIGuidanceRequest = (event) => {
      setCurrentTask(event.detail.task);
      setIsOpen(true);
      const guidanceMessage = {
        id: Date.now(),
        type: 'ai',
        content: `I see you need help with the task "${event.detail.task.title}". Let me guide you through it step by step. What specific aspect would you like help with?`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, guidanceMessage]);
    };

    window.addEventListener('openAIGuidance', handleAIGuidanceRequest);
    return () => window.removeEventListener('openAIGuidance', handleAIGuidanceRequest);
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'https://technovista.onrender.com/api/ai/chat',
        {
          message: inputMessage,
          workspaceId,
          currentTask: currentTask ? {
            id: currentTask._id,
            title: currentTask.title,
            description: currentTask.description,
            status: currentTask.status
          } : null,
          context: 'task_guidance'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearCurrentTask = () => {
    setCurrentTask(null);
    const clearMessage = {
      id: Date.now(),
      type: 'ai',
      content: 'Task context cleared. How else can I help you today?',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, clearMessage]);
  };

  return (
    <>
      {/* Floating Button - Positioned on LEFT side */}
      {!isOpen && (
        <div className="fixed bottom-6 left-6 z-40">
          <button
            onClick={() => setIsOpen(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-purple-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
          
          {/* Notification Badge */}
          {currentTask && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              !
            </div>
          )}
        </div>
      )}

      {/* Chat Window - Positioned on LEFT side */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-40 w-80 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Workspace AI</h3>
                <p className="text-xs opacity-75">Task & Workspace Helper</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Task Context */}
          {currentTask && (
            <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-purple-800 font-medium">Helping with: {currentTask.title}</span>
                <button
                  onClick={clearCurrentTask}
                  className="text-purple-600 hover:text-purple-800 text-xs"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    message.type === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about tasks or workspace..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !inputMessage.trim()}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingAIBot;