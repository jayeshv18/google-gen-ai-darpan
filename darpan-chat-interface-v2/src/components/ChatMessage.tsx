// src/components/ChatMessage.tsx

import { Message } from "@/pages"; // Or "../pages" if alias fails
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, XCircle, ThumbsUp, ThumbsDown, Share2, User,
  Volume2, // Speaker icon
  Square,  // Stop icon
  ShieldAlert // Report icon
} from "lucide-react";
import React, { useState, useEffect } from "react";

// Check for browser support just once
const isSpeechSynthesisSupported = !!window.speechSynthesis;

interface ChatMessageProps extends Message {
  isLastMessage?: boolean;
}

// Helper function for status
const getStatus = (score: number) => {
  if (score >= 75) return { text: "Trustworthy", colorClass: "text-green-400", icon: CheckCircle2, progressClass: "bg-green-500", stanceText: "High Confidence in Accuracy", stanceIcon: CheckCircle2, stanceColor: "text-green-500", };
  if (score >= 40) return { text: "Questionable", colorClass: "text-yellow-400", icon: AlertTriangle, progressClass: "bg-yellow-500", stanceText: "Potential Inaccuracies Detected", stanceIcon: AlertTriangle, stanceColor: "text-yellow-500", };
  return { text: "Not Trustworthy", colorClass: "text-red-400", icon: XCircle, progressClass: "bg-red-500", stanceText: "High Risk of Misinformation", stanceIcon: XCircle, stanceColor: "text-red-500", };
};

// Helper function for sentiment styles
const getFactorSentimentStyles = (sentiment?: string) => {
  switch (sentiment?.toLowerCase()) {
    case "positive": return { badge: "bg-green-900/50 text-green-300 border-green-700/50" };
    case "negative": return { badge: "bg-red-900/50 text-red-300 border-red-700/50" };
    default: return { badge: "bg-zinc-800 text-zinc-400 border-zinc-700" };
  }
};

export const ChatMessage = ({ role, content, imageUrl, analysis, isLastMessage }: ChatMessageProps) => { // Added imageUrl prop
  const { toast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);

  // --- Text-to-Speech (TTS) Logic ---
  useEffect(() => {
    return () => { // Cleanup on unmount
      if (isSpeechSynthesisSupported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (!isSpeechSynthesisSupported || !analysis?.analysis) {
      toast({ title: "Speech Not Available", variant: "destructive" });
      return;
    }
    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(analysis.analysis);
      utterance.lang = 'en-US';
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.error("SpeechSynthesis Error:", event.error);
        toast({ title: "Speech Error", variant: "destructive" });
        setIsSpeaking(false);
      };
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) window.speechSynthesis.speak(utterance);
      }, 50); // Short delay
    }
  };
  // --- End TTS Logic ---

  // Render content with links and line breaks
  const renderContent = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Replace standalone URLs first
    const contentWithLinks = content?.replace(urlRegex, (url) => {
      // Avoid replacing URLs already inside <a> tags (simple check)
      if (content?.includes(`href="${url}"`)) return url;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline break-all">${url}</a>`;
    }) || "";
    // Then replace newlines
    return contentWithLinks.replace(/\n/g, '<br />');
  }

  // Feedback handler
  const handleFeedback = (isPositive: boolean) => {
    toast({ title: "Feedback Submitted", description: "Thanks for helping improve Darpan AI!" });
  };

  // Share handler
  const handleShare = () => {
    if (analysis) {
      const shareText = `Darpan AI Analysis:\nScore: ${analysis.score}/100 (${getStatus(analysis.score).text})\nSummary: ${analysis.analysis}`;
      navigator.clipboard.writeText(shareText)
        .then(() => toast({ title: "Copied to Clipboard" }))
        .catch(err => toast({ title: "Copy Failed", variant: "destructive" }));
    }
  };

  // Report handler (calls the backend endpoint)
  const handleReport = async (reportPayload: any) => {
    console.log("--- Reporting Misinformation ---");
    const reportEndpoint = MEDIA_API_ENDPOINT.replace('/analyze-media', '/report-misinformation');

    try {
      const response = await fetch(reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `Failed to submit report: ${response.status}`);
      }

      const result = await response.json();
      toast({
        title: "Content Reported",
        description: result.status || "Your report has been submitted for review.",
        variant: "destructive",
        duration: 5000,
      });

    } catch (error) {
      console.error("Failed to submit report:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Report Submission Failed", description: errorMessage, variant: "destructive" });
    }
  };

  // --- USER MESSAGE ---
  if (role === "user") {
    return (
      <div className="flex items-start gap-4 justify-end mb-6 animate-slide-in">
        <div className="max-w-xl lg:max-w-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-4 rounded-lg rounded-tr-none shadow-md">
          {/* --- Image Preview Added Here --- */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="User upload preview"
              className="max-w-full h-auto max-h-48 rounded-md mb-2 border border-indigo-300/50"
            />
          )}
          {/* --- End Image Preview --- */}
          {content && <p className="text-sm" dangerouslySetInnerHTML={{ __html: renderContent() }}></p>}
        </div>
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-indigo-500">
          <AvatarFallback className="bg-zinc-700 text-zinc-300"><User size={18} /></AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // --- ASSISTANT MESSAGE (ANALYSIS REPORT) ---
  if (role === "assistant" && analysis) {
    const status = getStatus(analysis.score);
    const StanceIcon = status.stanceIcon;

    return (
      <div className="flex items-start gap-4 mb-6 animate-slide-in">
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-purple-500">
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white"><CheckCircle2 size={18} /></AvatarFallback>
        </Avatar>
        <div
          id={isLastMessage ? 'darpan-report-to-export' : undefined}
          className="max-w-xl lg:max-w-2xl w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg rounded-tl-none shadow-lg"
        >
          {/* Header Area (with Speaker Button) */}
          <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-white text-md">Trust Compass Report</h3>
              {isSpeechSynthesisSupported && (
                  <Button variant="ghost" size="icon" className={`h-7 w-7 text-zinc-400 hover:bg-zinc-700 ${isSpeaking ? 'text-indigo-400 animate-pulse' : 'hover:text-indigo-400'}`} onClick={handleSpeak} title={isSpeaking ? "Stop speaking" : "Read summary aloud"}>
                      {isSpeaking ? <Square size={14} /> : <Volume2 size={16} />}
                  </Button>
              )}
          </div>

          {/* Score/Stance Section */}
          <div className="bg-zinc-900/50 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${status.colorClass}`}>{status.text}</span>
              <span className={`font-bold text-2xl ${status.colorClass}`}>{analysis.score} / 100</span>
            </div>
            <Progress value={analysis.score} className={`h-2 [&>div]:${status.progressClass}`} />
            <div className={`flex items-center gap-2 mt-3 text-xs font-medium ${status.stanceColor}`}>
              <StanceIcon size={14} />
              <span>Stance: {status.stanceText}</span>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="mb-4">
             <h4 className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">Analysis Summary</h4>
             <p className="text-sm text-zinc-300 whitespace-pre-wrap">{analysis.analysis}</p>
          </div>

          {/* C.O.N.T.E.X.T. Section (Uses 3 columns) */}
          <div className="border-t border-zinc-700 pt-4">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Darpan C.O.N.T.E.X.T. Analysis</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2"> {/* 3 Columns */}
              {analysis.factors.map((factor, index) => {
                const sentimentStyles = getFactorSentimentStyles(factor.sentiment);
                return (
                  <div key={index} className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-700/50 flex flex-col justify-between min-h-[60px]">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-1">
                      <span>{factor.label}</span>
                      <Badge variant="outline" className={`text-xs px-1.5 py-0.5 border-none capitalize ${sentimentStyles.badge}`}>
                        {factor.sentiment || 'neutral'}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-200 break-words">{factor.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactivity Buttons Section (Includes Report Button) */}
          <div className="mt-4 pt-4 border-t border-zinc-700 flex items-center justify-end gap-2">
             <span className="text-xs text-zinc-500 mr-auto">Was this analysis helpful?</span>
             {/* Feedback */}
             <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-green-500 hover:bg-zinc-700" onClick={() => handleFeedback(true)} title="Helpful"><ThumbsUp size={16} /></Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-zinc-700" onClick={() => handleFeedback(false)} title="Not Helpful"><ThumbsDown size={16} /></Button>
             {/* Share */}
             <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-700" onClick={handleShare} title="Copy Summary"><Share2 size={16} /></Button>
             {/* Report Button */}
             {analysis.report_payload && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/50" onClick={() => handleReport(analysis.report_payload)} title="Report to Authorities">
                    <ShieldAlert size={16} />
                </Button>
             )}
          </div>

          {/* Learn More Section */}
          {analysis.learn_more && (
             <div className="mt-4 pt-4 border-t border-zinc-700">
               <h4 className="font-semibold text-sm text-indigo-300 mb-2">{analysis.learn_more.title || "Learn More"}</h4>
               <p className="text-xs text-zinc-400 mb-3 whitespace-pre-wrap">{analysis.learn_more.explanation}</p>
               {analysis.learn_more.sources?.length > 0 && (
                 <div>
                   <h5 className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">Verification Resources:</h5>
                   <ul className="list-disc list-inside space-y-1">
                     {analysis.learn_more.sources.map((resource, index) => (
                       <li key={index} className="text-xs text-indigo-300">
                         {resource.startsWith('http') || resource.includes('.') ? (
                           <a href={resource.startsWith('http') ? resource : `https://${resource}`} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                             {resource}
                           </a>
                         ) : ( resource )}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
    );
  }

  // --- FALLBACK FOR SIMPLE TEXT ASSISTANT MESSAGES (like welcome message) ---
  if (role === 'assistant' && content) {
    return (
      <div className="flex items-start gap-4 mb-6 animate-slide-in">
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-purple-500">
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white"><CheckCircle2 size={18} /></AvatarFallback>
        </Avatar>
        <div className="max-w-xl lg:max-w-2xl bg-zinc-800 border border-zinc-700 p-4 rounded-lg rounded-tl-none shadow-lg">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    )
  }

  return null; // Should not happen in normal flow
};