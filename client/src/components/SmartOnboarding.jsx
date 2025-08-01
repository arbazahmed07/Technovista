import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SmartOnboarding = ({ workspaceId }) => {
  const [onboardingPath, setOnboardingPath] = useState(null);
  const [pathId, setPathId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [learningPreferences, setLearningPreferences] = useState({
    experienceLevel: 'intermediate',
    style: 'mixed',
    pace: 'normal',
    background: ''
  });
  const [progress, setProgress] = useState({
    completedTasks: [],
    currentStep: 0
  });
  const [generatedTasks, setGeneratedTasks] = useState([]);

  useEffect(() => {
    checkExistingPath();
  }, [workspaceId]);

  const checkExistingPath = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/onboarding/${workspaceId}/path`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const pathData = response.data.onboardingPath;
      setOnboardingPath(pathData.path);
      setPathId(pathData._id);
      
      if (pathData.progress) {
        setProgress(pathData.progress);
      }
      
      // Set learning preferences from existing path
      if (pathData.learningPreferences) {
        setLearningPreferences(pathData.learningPreferences);
      }
      
      // Generate tasks if path exists
      await generateTasks();
      
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error checking existing path:', error);
      }
    }
  };

  const parseAIResponse = (aiResponse) => {
    // If it's already a properly structured object, check if it needs further parsing
    if (typeof aiResponse === 'object') {
      // Check if any of the arrays contain markdown-formatted JSON strings
      const structuredData = {
        gettingStarted: [],
        keyPeople: [],
        essentialDocuments: [],
        criticalCodeAreas: [],
        timeline: []
      };

      // Process each array and extract JSON if needed
      Object.keys(structuredData).forEach(key => {
        if (aiResponse[key] && Array.isArray(aiResponse[key])) {
          const processedArray = [];
          
          aiResponse[key].forEach(item => {
            // Check if the item contains JSON markdown
            if (typeof item === 'string' && item.includes('```json')) {
              try {
                // Extract JSON from markdown
                const jsonMatch = item.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                  const parsedJson = JSON.parse(jsonMatch[1]);
                  // Add the parsed data to the appropriate arrays
                  Object.keys(parsedJson).forEach(jsonKey => {
                    if (jsonKey === key && Array.isArray(parsedJson[jsonKey])) {
                      processedArray.push(...parsedJson[jsonKey]);
                    } else if (Array.isArray(parsedJson[jsonKey])) {
                      // If it's a different key, add it to the appropriate array
                      if (structuredData[jsonKey]) {
                        structuredData[jsonKey].push(...parsedJson[jsonKey]);
                      }
                    }
                  });
                }
              } catch (e) {
                console.warn('Failed to parse JSON from markdown in array item:', e);
                // Fall back to using the original item
                if (item.trim() && !item.includes('```')) {
                  processedArray.push(item);
                }
              }
            } else if (typeof item === 'string' && item.trim()) {
              // Regular string item
              processedArray.push(item);
            }
          });
          
          // Only update if we found processed items
          if (processedArray.length > 0) {
            structuredData[key] = processedArray;
          } else {
            structuredData[key] = aiResponse[key];
          }
        } else {
          structuredData[key] = aiResponse[key] || [];
        }
      });

      return structuredData;
    }

    // Original parsing logic for string responses
    try {
      // First try direct JSON parsing
      return JSON.parse(aiResponse);
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e2) {
          console.warn('Failed to parse JSON from markdown block');
        }
      }

      // Enhanced parsing for the concatenated string format
      const structuredData = {
        gettingStarted: [],
        keyPeople: [],
        essentialDocuments: [],
        criticalCodeAreas: [],
        timeline: []
      };

      // Split by common delimiters and clean up
      const cleanResponse = aiResponse
        .replace(/```json|```/g, '') // Remove code block markers
        .replace(/\\"/g, '"') // Fix escaped quotes
        .replace(/\\\\/g, '\\'); // Fix escaped backslashes

      // Try to extract structured data using regex patterns
      try {
        // Look for array-like patterns in the string
        const gettingStartedMatch = cleanResponse.match(/"gettingStarted":\s*\[(.*?)\]/);
        const keyPeopleMatch = cleanResponse.match(/"keyPeople":\s*\[(.*?)\]/);
        const essentialDocsMatch = cleanResponse.match(/"essentialDocuments":\s*\[(.*?)\]/);
        const criticalCodeMatch = cleanResponse.match(/"criticalCodeAreas":\s*\[(.*?)\]/);
        const timelineMatch = cleanResponse.match(/"timeline":\s*\[(.*?)\]/);

        // Helper function to parse array content
        const parseArrayContent = (content) => {
          if (!content) return [];
          
          // Split by quotes and filter out empty/delimiter strings
          return content
            .split(/",\s*"/)
            .map(item => item.replace(/^"|"$/g, '').trim())
            .filter(item => item && item !== ',' && item.length > 0);
        };

        if (gettingStartedMatch) {
          structuredData.gettingStarted = parseArrayContent(gettingStartedMatch[1]);
        }
        if (keyPeopleMatch) {
          structuredData.keyPeople = parseArrayContent(keyPeopleMatch[1]);
        }
        if (essentialDocsMatch) {
          structuredData.essentialDocuments = parseArrayContent(essentialDocsMatch[1]);
        }
        if (criticalCodeMatch) {
          structuredData.criticalCodeAreas = parseArrayContent(criticalCodeMatch[1]);
        }
        if (timelineMatch) {
          structuredData.timeline = parseArrayContent(timelineMatch[1]);
        }

      } catch (regexError) {
        console.warn('Regex parsing failed, falling back to manual parsing');
        
        // Fallback: Split the entire response and categorize
        const sections = cleanResponse.split(/[{}]/).filter(section => section.trim());
        
        for (const section of sections) {
          if (section.includes('Explore the') || section.includes('Familiarize yourself')) {
            // This looks like getting started content
            const items = section.split(/[",]/).filter(item => 
              item.trim() && 
              !item.includes('gettingStarted') && 
              item.length > 10
            );
            structuredData.gettingStarted.push(...items.map(item => item.trim()));
          }
          
          if (section.includes('Creator') || section.includes('Member') || section.includes('arbaz')) {
            // This looks like key people
            const people = section.match(/(\w+\s*\([^)]+\))/g) || [];
            structuredData.keyPeople.push(...people);
          }
          
          if (section.includes('README') || section.includes('CONTRIBUTING')) {
            // This looks like documents
            const docs = section.match(/(README\.md|CONTRIBUTING\.md|[A-Z]+\.md)/g) || [];
            structuredData.essentialDocuments.push(...docs);
          }
          
          if (section.includes('src/') || section.includes('components')) {
            // This looks like code areas
            const codeAreas = section.match(/(src\/[^"]+)/g) || [];
            structuredData.criticalCodeAreas.push(...codeAreas);
          }
          
          if (section.includes('Week ') || section.includes('Complete workspace')) {
            // This looks like timeline
            const timelineItems = section.match(/(Week \d+: [^"]+)/g) || [];
            structuredData.timeline.push(...timelineItems);
          }
        }
      }

      // Clean up any remaining formatting issues
      Object.keys(structuredData).forEach(key => {
        structuredData[key] = structuredData[key]
          .map(item => item.replace(/^["'\s]+|["'\s]+$/g, '').trim())
          .filter(item => item.length > 0 && !item.match(/^[,\]\[\{\}]+$/));
      });

      return structuredData;
    }
  };

  const generateOnboardingPath = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `http://localhost:5000/api/onboarding/${workspaceId}/generate`,
        { learningPreferences },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add debugging
      console.log('Raw AI Response:', response.data.onboardingPath);
      console.log('Response type:', typeof response.data.onboardingPath);

      // Parse the AI response properly
      const parsedPath = parseAIResponse(response.data.onboardingPath);
      console.log('Parsed Path:', parsedPath);
      
      setOnboardingPath(parsedPath);
      setPathId(response.data.pathId);
      setShowSetup(false);
      
      // Reset progress for new path
      setProgress({
        completedTasks: [],
        currentStep: 0
      });
      
      // Generate personalized tasks
      await generateTasks();
      
    } catch (error) {
      console.error('Error generating onboarding path:', error);
      alert('Failed to generate onboarding path. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:5000/api/onboarding/${workspaceId}/tasks`,
        { learningPreferences },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const tasks = response.data.tasks || [];
      // Ensure tasks is an array and parse if needed
      if (typeof tasks === 'string') {
        try {
          setGeneratedTasks(JSON.parse(tasks));
        } catch (e) {
          // Create default tasks if parsing fails
          setGeneratedTasks([
            {
              title: "Explore Workspace",
              description: "Get familiar with the workspace structure and team members",
              estimatedTime: "30 minutes",
              priority: "high",
              prerequisites: "None"
            }
          ]);
        }
      } else {
        setGeneratedTasks(Array.isArray(tasks) ? tasks : []);
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
    }
  };

  const resetOnboardingPath = async () => {
    if (!confirm('Are you sure you want to reset your onboarding path? This will delete all progress.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/onboarding/${workspaceId}/reset`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Reset all state
      setOnboardingPath(null);
      setPathId(null);
      setProgress({ completedTasks: [], currentStep: 0 });
      setGeneratedTasks([]);
      setShowSetup(false);
      
    } catch (error) {
      console.error('Error resetting onboarding path:', error);
      alert('Failed to reset onboarding path. Please try again.');
    }
  };

  const markTaskComplete = (taskIndex) => {
    const newCompleted = [...progress.completedTasks];
    if (!newCompleted.includes(taskIndex)) {
      newCompleted.push(taskIndex);
      setProgress({
        ...progress,
        completedTasks: newCompleted
      });
    }
  };

  const updateProgress = async () => {
    if (!pathId) {
      console.warn('Cannot update progress: pathId is missing');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/onboarding/${pathId}/progress`,
        {
          completedTasks: progress.completedTasks,
          currentStep: progress.currentStep,
          isCompleted: progress.completedTasks.length >= 5
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  useEffect(() => {
    if (pathId && progress.completedTasks.length > 0) {
      updateProgress();
    }
  }, [progress.completedTasks, pathId]);

  if (!onboardingPath && !showSetup) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Smart Onboarding</h3>
          <p className="text-gray-600 mb-6">
            Get a personalized onboarding path powered by AI to help you navigate this workspace efficiently.
          </p>
        </div>
        
        <button
          onClick={() => setShowSetup(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Start Smart Onboarding
        </button>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Customize Your Onboarding</h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Experience Level
            </label>
            <select
              value={learningPreferences.experienceLevel}
              onChange={(e) => setLearningPreferences({
                ...learningPreferences,
                experienceLevel: e.target.value
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="beginner">Beginner - New to this type of work</option>
              <option value="intermediate">Intermediate - Some experience</option>
              <option value="advanced">Advanced - Very experienced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Learning Style
            </label>
            <select
              value={learningPreferences.style}
              onChange={(e) => setLearningPreferences({
                ...learningPreferences,
                style: e.target.value
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="visual">Visual - I learn better with diagrams and examples</option>
              <option value="hands-on">Hands-on - I learn by doing</option>
              <option value="reading">Reading - I prefer detailed documentation</option>
              <option value="mixed">Mixed - Combination of approaches</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Pace
            </label>
            <select
              value={learningPreferences.pace}
              onChange={(e) => setLearningPreferences({
                ...learningPreferences,
                pace: e.target.value
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="slow">Slow - Take time to understand deeply</option>
              <option value="normal">Normal - Standard learning pace</option>
              <option value="fast">Fast - Quick overview and dive in</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background (Optional)
            </label>
            <input
              type="text"
              value={learningPreferences.background}
              onChange={(e) => setLearningPreferences({
                ...learningPreferences,
                background: e.target.value
              })}
              placeholder="e.g., Frontend developer, Project manager, Designer..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button
            onClick={() => setShowSetup(false)}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={generateOnboardingPath}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{loading ? 'Generating...' : (onboardingPath ? 'Update Path' : 'Generate My Path')}</span>
          </button>
        </div>
      </div>
    );
  }

  const totalTasks = Math.max(generatedTasks.length, 5);
  const completionPercentage = Math.round((progress.completedTasks.length / totalTasks) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Smart Onboarding Path</h2>
            <p className="opacity-90">Personalized guidance powered by AI</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{completionPercentage}%</div>
            <div className="text-sm opacity-75">Complete</div>
          </div>
        </div>
        <div className="mt-4 bg-white bg-opacity-20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Getting Started Section */}
      {onboardingPath?.gettingStarted && Array.isArray(onboardingPath.gettingStarted) && onboardingPath.gettingStarted.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-green-100 text-green-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Getting Started
          </h3>
          <div className="space-y-3">
            {onboardingPath.gettingStarted.map((step, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 bg-current rounded-full"></div>
                </div>
                <p className="text-gray-700 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key People Section */}
      {onboardingPath?.keyPeople && Array.isArray(onboardingPath.keyPeople) && onboardingPath.keyPeople.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-orange-100 text-orange-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            Key People to Connect With
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {onboardingPath.keyPeople.map((person, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">{person}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Essential Documents Section */}
      {onboardingPath?.essentialDocuments && Array.isArray(onboardingPath.essentialDocuments) && onboardingPath.essentialDocuments.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Essential Documents
          </h3>
          <div className="space-y-2">
            {onboardingPath.essentialDocuments.map((doc, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <span className="text-gray-700">{doc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Code Areas Section */}
      {onboardingPath?.criticalCodeAreas && Array.isArray(onboardingPath.criticalCodeAreas) && onboardingPath.criticalCodeAreas.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-purple-100 text-purple-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </span>
            Critical Code Areas
          </h3>
          <div className="space-y-2">
            {onboardingPath.criticalCodeAreas.map((area, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                <span className="text-gray-700 font-mono text-sm">{area}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Section */}
      {onboardingPath?.timeline && Array.isArray(onboardingPath.timeline) && onboardingPath.timeline.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-indigo-100 text-indigo-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Recommended Timeline
          </h3>
          <div className="space-y-3">
            {onboardingPath.timeline.map((item, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="bg-indigo-100 text-indigo-600 rounded-full p-1 mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 bg-current rounded-full"></div>
                </div>
                <p className="text-gray-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Tasks */}
      {generatedTasks.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-green-100 text-green-600 rounded-full p-2 mr-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            Your Personalized Tasks
          </h3>
          <div className="space-y-4">
            {generatedTasks.map((task, index) => (
              <div 
                key={index} 
                className={`border rounded-lg p-4 transition-all ${
                  progress.completedTasks.includes(index) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                      {task.priority && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          task.priority === 'high' ? 'bg-red-100 text-red-600' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {task.priority} priority
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{task.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      {task.estimatedTime && <span>⏱️ {task.estimatedTime}</span>}
                      {task.prerequisites && task.prerequisites !== 'None' && (
                        <span>📋 {task.prerequisites}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => markTaskComplete(index)}
                    disabled={progress.completedTasks.includes(index)}
                    className={`ml-4 px-3 py-1 rounded text-sm transition-colors ${
                      progress.completedTasks.includes(index)
                        ? 'bg-green-600 text-white cursor-default'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {progress.completedTasks.includes(index) ? 'Completed' : 'Mark Done'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => setShowSetup(true)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
        >
          Update Preferences
        </button>
        <button
          onClick={resetOnboardingPath}
          className="text-red-600 hover:text-red-800 text-sm font-medium px-4 py-2 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
        >
          Reset Path
        </button>
      </div>
    </div>
  );
};

export default SmartOnboarding;