import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Upload, Copy, Download, Play, Pause, Square, FileAudio, Github, Linkedin, Heart, Sparkles, Zap } from 'lucide-react';

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
  confidence?: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [isSupported, setIsSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'zh-CN', name: 'Chinese' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' }
  ];

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      // Stop any existing recognition and clean up resources
      await stopRecording();
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if speech recognition is available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }
      
      // Check microphone permissions first
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
        }
      } catch (permError) {
        console.warn('Permission check failed:', permError);
      }

      // Request microphone access with specific constraints
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });
      } catch (mediaError) {
        console.error('Media access error:', mediaError);
        if (mediaError.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone access and refresh the page.');
        } else if (mediaError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (mediaError.name === 'NotReadableError') {
          throw new Error('Microphone is being used by another application. Please close other applications using the microphone and try again.');
        } else {
          throw new Error('Failed to access microphone. Please check your microphone settings.');
        }
      }
      
      // Set up audio analysis for visual feedback
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context if suspended (required by some browsers)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (audioError) {
        console.error('Audio context error:', audioError);
        // Continue without audio visualization if context fails
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording && !isPaused) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Set up speech recognition
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedLanguage;
      
      // Set additional properties for better compatibility
      try {
        recognitionRef.current.maxAlternatives = 1;
        recognitionRef.current.serviceURI = undefined; // Use default service
      } catch (propError) {
        console.warn('Some recognition properties not supported:', propError);
      }

      recognitionRef.current.onresult = (event) => {
        if (!event.results) return;
        
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (!event.results[i] || !event.results[i][0]) continue;
          
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptSegment;
          } else {
            interimTranscript += transcriptSegment;
          }
        }

        if (finalTranscript) {
          const newSegment: TranscriptSegment = {
            id: Date.now().toString(),
            text: finalTranscript.trim(),
            timestamp: new Date(),
            confidence: event.results[event.results.length - 1]?.[0]?.confidence
          };
          setTranscript(prev => {
            // Prevent duplicate segments
            const lastSegment = prev[prev.length - 1];
            if (lastSegment && lastSegment.text === newSegment.text) {
              return prev;
            }
            return [...prev, newSegment];
          });
          setCurrentText('');
        } else {
          setCurrentText(interimTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle specific errors
        switch (event.error) {
          case 'network':
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              text: '[Network Error: Please check your internet connection]',
              timestamp: new Date()
            }]);
            break;
          case 'not-allowed':
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              text: '[Permission Error: Microphone access denied. Please allow microphone access in browser settings]',
              timestamp: new Date()
            }]);
            stopRecording();
            break;
          case 'no-speech':
            console.log('No speech detected, continuing...');
            // Don't show error for no speech, just continue
            break;
          case 'audio-capture':
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              text: '[Audio Error: Microphone is being used by another application. Please close other apps using the microphone]',
              timestamp: new Date()
            }]);
            stopRecording();
            break;
          case 'service-not-allowed':
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              text: '[Service Error: Speech recognition service blocked. Try refreshing the page or using a different browser]',
              timestamp: new Date()
            }]);
            stopRecording();
            break;
          case 'bad-grammar':
            console.warn('Grammar error, continuing...');
            break;
          default:
            setTranscript(prev => [...prev, {
              id: Date.now().toString(),
              text: `[Recognition Error: ${event.error}. Please try again]`,
              timestamp: new Date()
            }]);
        }
      };

      recognitionRef.current.onend = () => {
        // Auto-restart if still recording (handles browser timeouts)
        if (isRecording && !isPaused && recognitionRef.current) {
          setTimeout(() => {
            if (recognitionRef.current && isRecording && !isPaused) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('Failed to restart recognition:', error);
                setTranscript(prev => [...prev, {
                  id: Date.now().toString(),
                  text: '[System: Recognition stopped. Click Start Recording to continue]',
                  timestamp: new Date()
                }]);
                setIsRecording(false);
                setIsPaused(false);
              }
            }
          }, 100);
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started successfully');
        setTranscript(prev => [...prev, {
          id: Date.now().toString(),
          text: '[System: Recording started. Speak clearly into your microphone]',
          timestamp: new Date()
        }]);
      };

      // Start recognition with error handling
      try {
        recognitionRef.current.start();
      } catch (startError) {
        console.error('Failed to start recognition:', startError);
        throw new Error('Failed to start speech recognition. Please try again.');
      }
      
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTranscript(prev => [...prev, {
        id: Date.now().toString(),
        text: `[Error: ${errorMessage}]`,
        timestamp: new Date()
      }]);
      
      // Reset recording state
      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);
    }
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.suspend();
      } catch (error) {
        console.error('Error suspending audio context:', error);
      }
    }
    setIsPaused(true);
    setAudioLevel(0);
    
    setTranscript(prev => [...prev, {
      id: Date.now().toString(),
      text: '[System: Recording paused]',
      timestamp: new Date()
    }]);
  };

  const resumeRecording = () => {
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Error resuming audio context:', error);
      }
    }
    
    // Create new recognition instance for resume
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 1;

    // Re-attach event handlers
    recognitionRef.current.onresult = (event) => {
      if (!event.results) return;
      
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i] || !event.results[i][0]) continue;
        
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      if (finalTranscript) {
        const newSegment: TranscriptSegment = {
          id: Date.now().toString(),
          text: finalTranscript.trim(),
          timestamp: new Date(),
          confidence: event.results[event.results.length - 1]?.[0]?.confidence
        };
        setTranscript(prev => {
          const lastSegment = prev[prev.length - 1];
          if (lastSegment && lastSegment.text === newSegment.text) {
            return prev;
          }
          return [...prev, newSegment];
        });
        setCurrentText('');
      } else {
        setCurrentText(interimTranscript.trim());
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognitionRef.current.onend = () => {
      if (isRecording && !isPaused) {
        setTimeout(() => {
          if (recognitionRef.current && isRecording && !isPaused) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Failed to restart recognition:', error);
            }
          }
        }, 100);
      }
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to resume recognition:', error);
      setTranscript(prev => [...prev, {
        id: Date.now().toString(),
        text: '[Error: Failed to resume recording. Please stop and start again]',
        timestamp: new Date()
      }]);
      return;
    }
    
    setIsPaused(false);
    setTranscript(prev => [...prev, {
      id: Date.now().toString(),
      text: '[System: Recording resumed]',
      timestamp: new Date()
    }]);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.error('Error closing audio context:', error);
      }
      audioContextRef.current = null;
    }
    
    // Stop all media tracks to release microphone
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setRecordingTime(0);
    
    if (transcript.length > 0) {
      setTranscript(prev => [...prev, {
        id: Date.now().toString(),
        text: '[System: Recording stopped]',
        timestamp: new Date()
      }]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For demo purposes, we'll show a message about file upload
    // In a real implementation, you'd need a backend service to process audio files
    alert('File upload feature requires a backend service to process audio files. This demo focuses on real-time speech recognition.');
  };

  const copyToClipboard = () => {
    const fullText = transcript.map(segment => segment.text).join(' ').trim();
    if (fullText) {
      navigator.clipboard.writeText(fullText).then(() => {
        // Could add a toast notification here
        console.log('Text copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy text:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      });
    }
  };

  const downloadTranscript = () => {
    const fullText = transcript.map(segment => 
      `[${segment.timestamp.toLocaleTimeString()}] ${segment.text}`
    ).join('\n').trim();
    
    if (fullText) {
      const blob = new Blob([fullText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const clearTranscript = () => {
    setTranscript([]);
    setCurrentText('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MicOff className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Browser Not Supported</h2>
          <p className="text-gray-300">
            Your browser doesn't support the Web Speech API. Please use Chrome, Edge, or Safari for the best experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              VoiceScribe
            </h1>
          </div>
          <p className="text-xl text-gray-300 mb-4">Transform your voice into perfect text with AI precision</p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Real-time Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>10+ Languages</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span>Free Forever</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-3 relative z-10">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl p-6 hover:bg-white/15 transition-all duration-300">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
                Controls
              </h2>
              
              {/* Language Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isRecording}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-white/5 disabled:opacity-50 backdrop-blur-sm transition-all duration-200 appearance-none cursor-pointer"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em'
                  }}
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-gray-800 text-white">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recording Controls */}
              <div className="space-y-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Mic className="w-5 h-5 animate-pulse" />
                    Start Recording
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {!isPaused ? (
                        <button
                          onClick={pauseRecording}
                          className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={resumeRecording}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Play className="w-4 h-4" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={stopRecording}
                        className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    </div>
                    
                    {/* Recording Status */}
                    <div className="text-center bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500'} ${!isPaused ? 'animate-pulse' : ''}`}></div>
                        <span className="text-sm font-medium text-gray-300">
                          {isPaused ? 'Paused' : 'Recording'}
                        </span>
                      </div>
                      <div className="text-2xl font-mono text-white font-bold">
                        {formatTime(recordingTime)}
                      </div>
                    </div>

                    {/* Audio Level Visualization */}
                    <div className="bg-white/10 rounded-full h-3 overflow-hidden border border-white/20">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 transition-all duration-100 shadow-lg"
                        style={{ width: `${audioLevel * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div className="border-t border-white/10 pt-6">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRecording}
                    className="w-full bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 border border-white/20 hover:border-white/30 backdrop-blur-sm"
                  >
                    <Upload className="w-5 h-5" />
                    Upload Audio File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Supports MP3, WAV, M4A files
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl p-6 h-full hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
                  Live Transcript
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={copyToClipboard}
                    disabled={transcript.length === 0}
                    className="bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 text-white p-3 rounded-xl transition-all duration-300 border border-blue-500/30 hover:border-blue-500/50 backdrop-blur-sm"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={downloadTranscript}
                    disabled={transcript.length === 0}
                    className="bg-green-500/20 hover:bg-green-500/30 disabled:bg-white/5 text-white p-3 rounded-xl transition-all duration-300 border border-green-500/30 hover:border-green-500/50 backdrop-blur-sm"
                    title="Download transcript"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearTranscript}
                    disabled={transcript.length === 0}
                    className="bg-red-500/20 hover:bg-red-500/30 disabled:bg-white/5 text-white p-3 rounded-xl transition-all duration-300 border border-red-500/30 hover:border-red-500/50 backdrop-blur-sm"
                    title="Clear transcript"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 min-h-96 max-h-96 overflow-y-auto border border-white/10 custom-scrollbar">
                {transcript.length === 0 && !currentText ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="p-4 bg-white/5 rounded-2xl mb-4">
                      <FileAudio className="w-12 h-12 opacity-60" />
                    </div>
                    <p className="text-lg font-medium text-white mb-2">Ready to transcribe</p>
                    <p className="text-sm text-center max-w-xs">Start recording or upload an audio file to see your words appear here in real-time</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((segment) => (
                      <div key={segment.id} className="bg-white/10 p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-all duration-200 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400 font-mono">
                            {segment.timestamp.toLocaleTimeString()}
                          </span>
                          {segment.confidence && (
                            <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">
                              {Math.round(segment.confidence * 100)}% confident
                            </span>
                          )}
                        </div>
                        <p className="text-white leading-relaxed text-sm">{segment.text}</p>
                      </div>
                    ))}
                    {currentText && (
                      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 p-4 rounded-xl border border-purple-500/30 animate-pulse">
                        <span className="text-xs text-purple-300 block mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          Speaking...
                        </span>
                        <p className="text-white leading-relaxed italic text-sm">{currentText}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {transcript.length > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
                  <p className="text-sm text-purple-200">
                    <strong>Word count:</strong> {transcript.reduce((acc, segment) => acc + segment.text.split(' ').length, 0)} words
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-16 text-center relative z-10">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-8 max-w-4xl mx-auto">
            {/* Developer Info */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4 shadow-2xl">
                <span className="text-2xl font-bold text-white">YS</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Yuvraj Singh</h3>
              <p className="text-gray-300 text-lg mb-1">Full Stack Developer</p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Heart className="w-4 h-4 text-red-400" />
                <span>Crafted with passion and precision</span>
              </div>
            </div>
            
            {/* Social Links */}
            <div className="flex items-center justify-center gap-6 mb-8">
              <a
                href="https://github.com/Yuvrajsy24"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 text-gray-300 hover:text-white transition-all duration-300 bg-gradient-to-r from-gray-800/50 to-gray-700/50 hover:from-gray-700/70 hover:to-gray-600/70 px-6 py-4 rounded-2xl border border-white/10 hover:border-white/30 shadow-lg hover:shadow-xl transform hover:scale-105 backdrop-blur-sm"
              >
                <div className="p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-all duration-300">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-lg">GitHub</div>
                  <div className="text-xs text-gray-400 group-hover:text-gray-300">View my projects</div>
                </div>
              </a>
              
              <a
                href="https://www.linkedin.com/in/yuvraj-singh-3597b0322/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 text-gray-300 hover:text-white transition-all duration-300 bg-gradient-to-r from-blue-800/50 to-blue-700/50 hover:from-blue-700/70 hover:to-blue-600/70 px-6 py-4 rounded-2xl border border-blue-500/20 hover:border-blue-400/40 shadow-lg hover:shadow-xl transform hover:scale-105 backdrop-blur-sm"
              >
                <div className="p-2 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-all duration-300">
                  <Linkedin className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-lg">LinkedIn</div>
                  <div className="text-xs text-gray-400 group-hover:text-gray-300">Let's connect</div>
                </div>
              </a>
            </div>
            
            {/* Tech Stack & Copyright */}
            <div className="border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-center gap-4 mb-4 text-sm text-gray-400">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>React</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>TypeScript</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Web Speech API</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <span>Tailwind CSS</span>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                © 2025 VoiceScribe. All rights reserved. Built with modern web technologies.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;