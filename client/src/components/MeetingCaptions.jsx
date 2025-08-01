import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const MeetingCaptions = ({ meetingId, isActive, onCaptionsUpdate }) => {
  const [captions, setCaptions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const captionsRef = useRef([]);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecognition = new SpeechRecognition();
    
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const newCaption = {
          id: Date.now(),
          text: finalTranscript.trim(),
          timestamp: new Date(),
          speaker: 'Current User' // You can enhance this to detect different speakers
        };
        
        setCaptions(prev => {
          const updated = [...prev, newCaption];
          captionsRef.current = updated;
          saveCaptionToServer(newCaption);
          return updated;
        });
      }

      setCurrentTranscript(interimTranscript);
    };

    speechRecognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access for captions.');
      }
    };

    speechRecognition.onend = () => {
      if (isActive && isListening) {
        // Restart recognition if meeting is still active
        setTimeout(() => {
          speechRecognition.start();
        }, 100);
      }
    };

    setRecognition(speechRecognition);

    return () => {
      if (speechRecognition) {
        speechRecognition.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && recognition) {
      startListening();
    } else {
      stopListening();
    }
  }, [isActive, recognition]);

  const startListening = () => {
    if (recognition && !isListening) {
      try {
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
      // Save final captions when stopping
      generateMeetingNotes();
    }
  };

  const saveCaptionToServer = async (caption) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/meet/${meetingId}/captions`,
        caption,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error saving caption:', error);
    }
  };

  const generateMeetingNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/meet/${meetingId}/generate-notes`,
        { captions: captionsRef.current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (onCaptionsUpdate) {
        onCaptionsUpdate(captionsRef.current);
      }
    } catch (error) {
      console.error('Error generating meeting notes:', error);
    }
  };

  const exportCaptions = () => {
    const exportData = captions.map(caption => 
      `[${caption.timestamp.toLocaleTimeString()}] ${caption.speaker}: ${caption.text}`
    ).join('\n');
    
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-captions-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">Live Captions</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-sm text-gray-600">
            {isListening ? 'Recording' : 'Not Recording'}
          </span>
          <button
            onClick={exportCaptions}
            disabled={captions.length === 0}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>
      
      <div className="h-64 overflow-y-auto p-4 space-y-2">
        {captions.map((caption) => (
          <div key={caption.id} className="text-sm">
            <span className="text-gray-500 text-xs">
              [{caption.timestamp.toLocaleTimeString()}] {caption.speaker}:
            </span>
            <p className="text-gray-900">{caption.text}</p>
          </div>
        ))}
        
        {currentTranscript && (
          <div className="text-sm opacity-70 italic">
            <span className="text-gray-500 text-xs">[Live]:</span>
            <p className="text-gray-600">{currentTranscript}</p>
          </div>
        )}
        
        {captions.length === 0 && !currentTranscript && (
          <div className="text-center text-gray-500 py-8">
            <p>Captions will appear here when you start speaking</p>
            {!isListening && (
              <p className="text-sm mt-2">Make sure to allow microphone access</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingCaptions;