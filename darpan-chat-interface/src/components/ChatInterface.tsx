import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Image, 
  Settings, 
  User, 
  Search,
  Moon,
  Sun,
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  Menu,
  MoreVertical,
  Download,
  Copy,
  Flag,
  Zap,
  Brain,
  Eye,
  Sparkles,
  MessageSquare,
  FileText,
  Camera,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from 'lucide-react';

// <<< CHANGE 1: ADD YOUR API ENDPOINT HERE >>>
const API_ENDPOINT = 'https://darpan-backend-service-zrrnkavxpa-uc.a.run.app/analyze';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  misinformationStatus?: 'verified' | 'suspicious' | 'flagged' | null;
  confidence?: number;
  analysisType?: 'text' | 'image' | 'link' | 'document';
}

interface ChatInterfaceProps {}

export const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to Darpan! 🛡️ I\'m your advanced AI assistant specialized in detecting and analyzing misinformation. I can help you verify facts, analyze content credibility, and provide reliable information. How can I assist you today?',
      sender: 'ai',
      timestamp: new Date(),
      misinformationStatus: 'verified',
      confidence: 98,
      analysisType: 'text'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState('standard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // <<< CHANGE 2: REPLACE THE SIMULATED AI RESPONSE WITH A REAL API CALL >>>
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: newMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok.');
      }
      
      const report = await response.json();

      // Determine status based on trust score
      let status: 'verified' | 'suspicious' | 'flagged' = 'suspicious';
      if (report.trustScore >= 75) {
        status = 'verified';
      } else if (report.trustScore < 40) {
        status = 'flagged';
      }

      // Format the report from the backend into a readable chat message
      const formattedContent = `**Trust Compass Report**\n\n**Ground Truth:** ${report.groundTruth}\n\n**Explanation:** ${report.explanation}\n\n**Identified Techniques:** ${report.techniques.join(', ')}`;
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: formattedContent,
        sender: 'ai',
        timestamp: new Date(),
        misinformationStatus: status,
        confidence: report.trustScore,
        analysisType: 'text' // This can be enhanced later
      };
      
      setMessages(prev => [...prev, aiResponse]);

    } catch (error) {
      console.error("API call failed:", error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error while analyzing your request. Please check the backend connection and try again.",
        sender: 'ai',
        timestamp: new Date(),
        misinformationStatus: 'flagged',
        confidence: 0,
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: `📄 Analyzing document: ${file.name}`,
        sender: 'user',
        timestamp: new Date(),
        analysisType: 'document'
      };
      setMessages(prev => [...prev, newMessage]);
      // Placeholder for backend document analysis call
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: `🖼️ Analyzing image: ${file.name}`,
        sender: 'user',
        timestamp: new Date(),
        analysisType: 'image'
      };
      setMessages(prev => [...prev, newMessage]);
      // Placeholder for backend image analysis call
    }
  };

  const filteredMessages = messages.filter(message =>
    message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'suspicious':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'flagged':
        return <Flag className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'suspicious':
        return 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'flagged':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
      default:
        return '';
    }
  };
  
  // Convert string with markdown-like bolding into React elements
  const formatMessageContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      // Handle newline characters
      return part.split('\n').map((line, lineIndex) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {line}
          {lineIndex < part.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'standard':
        return <Eye className="w-4 h-4" />;
      case 'strict':
        return <Shield className="w-4 h-4" />;
      case 'research':
        return <Brain className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <div className={`flex flex-col h-screen transition-all duration-300 ${
      darkMode 
        ? 'dark bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      {/* Enhanced Header */}
      <header className={`border-b backdrop-blur-xl transition-all duration-300 ${
        darkMode 
          ? 'border-gray-700/50 bg-gray-800/80' 
          : 'border-gray-200/50 bg-white/80'
      } px-6 py-4 flex items-center justify-between shadow-sm`}>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-75"></div>
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className={`text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent`}>
              Darpan
            </h1>
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              AI-Powered Misinformation Detection
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-2 ml-6">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className={`pl-10 pr-8 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-700' 
                  : 'bg-white/50 border-gray-300/50 text-gray-900 hover:bg-white'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm`}
              aria-label="Select analysis mode"
            >
              <option value="standard">Standard Mode</option>
              <option value="strict">Strict Analysis</option>
              <option value="research">Research Mode</option>
            </select>
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              {getModeIcon(selectedMode)}
            </div>
          </div>

          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                showSearch
                  ? 'bg-blue-500 text-white shadow-lg'
                  : darkMode 
                  ? 'hover:bg-gray-600 text-gray-300 hover:text-white' 
                  : 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm'
              }`}
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                soundEnabled
                  ? darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-sm'
                  : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
              aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'hover:bg-gray-600 text-gray-300 hover:text-white' 
                  : 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm'
              }`}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'hover:bg-gray-600 text-gray-300 hover:text-white' 
                  : 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm'
              }`}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                darkMode 
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                darkMode 
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Account settings"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Enhanced Search Bar */}
      {showSearch && (
        <div className={`border-b backdrop-blur-xl transition-all duration-300 ${
          darkMode ? 'border-gray-700/50 bg-gray-800/80' : 'border-gray-200/50 bg-white/80'
        } px-6 py-4`}>
          <div className="relative max-w-md">
            <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-12 py-3 rounded-xl border transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 focus:bg-gray-700' 
                  : 'bg-white/50 border-gray-300/50 text-gray-900 placeholder-gray-500 focus:bg-white'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm`}
            />
            <button
              onClick={() => setShowSearch(false)}
              className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition-colors ${
                darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Messages Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
          {(showSearch ? filteredMessages : messages).map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={`max-w-2xl group relative ${
                  message.sender === 'user'
                    ? 'ml-12'
                    : 'mr-12'
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`px-6 py-4 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : darkMode
                      ? `bg-gray-800/80 text-white border border-gray-700/50 ${getStatusColor(message.misinformationStatus)} border-l-4`
                      : `bg-white/80 text-gray-900 border border-gray-200/50 ${getStatusColor(message.misinformationStatus)} border-l-4 backdrop-blur-sm`
                  }`}
                >
                  <p className="text-sm leading-relaxed font-medium">{formatMessageContent(message.content)}</p>
                  
                  {/* Message Footer */}
                  <div className="flex items-center justify-between mt-3 space-x-3">
                    <span className={`text-xs font-medium ${
                      message.sender === 'user' 
                        ? 'text-blue-100' 
                        : darkMode 
                        ? 'text-gray-400' 
                        : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    {message.sender === 'ai' && message.misinformationStatus && (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(message.misinformationStatus)}
                          <span className={`text-xs font-semibold ${
                            darkMode ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            {message.confidence}% confidence
                          </span>
                        </div>
                        {message.analysisType && (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {message.analysisType}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {message.sender === 'ai' && (
                  <div className="flex items-center space-x-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                      aria-label="Copy message"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                      aria-label="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Enhanced Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
              <div className="mr-12">
                <div className={`px-6 py-4 rounded-2xl shadow-sm ${
                  darkMode ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50 backdrop-blur-sm'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Analyzing content...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Enhanced Input Area */}
      <div className={`border-t backdrop-blur-xl transition-all duration-300 ${
        darkMode ? 'border-gray-700/50 bg-gray-800/80' : 'border-gray-200/50 bg-white/80'
      } px-6 py-4`}>
        <div className="flex items-end space-x-4">
          {/* Enhanced File Upload Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                darkMode 
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white bg-gray-700/50' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 bg-gray-50'
              }`}
              aria-label="Upload document"
            >
              <FileText className="w-5 h-5" />
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                darkMode 
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-white bg-gray-700/50' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 bg-gray-50'
              }`}
              aria-label="Upload image"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          {/* Enhanced Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask me to verify information, analyze content, or fact-check claims..."
              className={`w-full px-6 py-4 pr-16 rounded-2xl border resize-none max-h-32 transition-all duration-200 ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 focus:bg-gray-700' 
                  : 'bg-white/50 border-gray-300/50 text-gray-900 placeholder-gray-500 focus:bg-white'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm`}
              rows={1}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {inputValue.trim() && (
                <div className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {inputValue.length}/2000
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Voice Input */}
          <button
            onClick={handleVoiceToggle}
            className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
              isRecording 
                ? 'bg-red-500 text-white shadow-lg animate-pulse' 
                : darkMode 
                ? 'hover:bg-gray-700 text-gray-300 hover:text-white bg-gray-700/50' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 bg-gray-50'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Enhanced Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className={`p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
              inputValue.trim()
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                : darkMode
                ? 'bg-gray-600 text-gray-400'
                : 'bg-gray-300 text-gray-500'
            }`}
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center mt-4 space-x-4">
          <button className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
            darkMode ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
            <Sparkles className="w-4 h-4 inline mr-2" />
            Quick Fact Check
          </button>
          <button className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
            darkMode ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
            <Zap className="w-4 h-4 inline mr-2" />
            Analyze Link
          </button>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.csv,.json"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Enhanced Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-lg w-full rounded-2xl shadow-2xl transition-all duration-300 ${
            darkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-200'
          }`}>
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold">Settings</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`p-2 rounded-xl transition-colors ${
                    darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-6 space-y-6 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold mb-3">
                  Analysis Sensitivity
                </label>
                <select className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                    : 'bg-gray-50 border-gray-300 focus:bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}>
                  <option>Conservative (High Precision)</option>
                  <option>Balanced (Recommended)</option>
                  <option>Aggressive (High Recall)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-3">
                  Primary Language
                </label>
                <select className={`w-full px-4 py-3 rounded-xl border transition-all duration-200 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                    : 'bg-gray-50 border-gray-300 focus:bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}>
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Chinese</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Real-time Analysis</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Analyze content as you type</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Sound Notifications</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Audio alerts for analysis results</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Auto-save Conversations</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Save chat history automatically</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Privacy Mode</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enhanced data protection</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettings(false)}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};