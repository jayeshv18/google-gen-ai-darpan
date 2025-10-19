import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AnalysisResult } from "@/components/AnalysisResult";
import type { Message } from "@/pages/index";
import React from "react";

export const ChatMessage = ({ role, content, analysis }: Message) => {
  if (role === 'user') {
    return (
      <div className="flex items-start gap-4 mb-8 justify-end">
        <div className="max-w-xl bg-primary text-primary-foreground p-4 rounded-lg shadow-md">
          <p>{content}</p>
        </div>
        <Avatar>
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    );
  }

  if (role === 'assistant' && analysis) {
    return (
      <div className="flex items-start gap-4 mb-8">
        <Avatar>
           <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <AnalysisResult {...analysis} />
        </div>
      </div>
    );
  }

  // Fallback for initial welcome message
   if (role === 'assistant' && content) {
    return (
      <div className="flex items-start gap-4 mb-8">
        <Avatar>
           <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div className="max-w-xl bg-card text-card-foreground p-4 rounded-lg shadow-md">
          <p>{content}</p>
        </div>
      </div>
    )
  }

  return null;
};
