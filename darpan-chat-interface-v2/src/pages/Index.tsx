import { useState, useRef, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RotateCcw, Download } from "lucide-react";

export interface Message {
  role: 'user' | 'assistant';
  content?: string;
  analysis?: {
    score: number;
    analysis: string;
    factors: Array<{ label: string; value: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
    sourceUrl?: string;
  };
}

// --- THIS IS THE **NEW** us-east1 API ENDPOINT ---
const API_ENDPOINT = 'https://darpan-backend-service-361059167059.us-east1.run.app/analyze';

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string, type: 'text' | 'url' | 'image') => {
    if (type !== 'text') {
       toast({
        title: "Feature Coming Soon",
        description: "URL and Image analysis are under development.",
        variant: "default",
      });
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: content
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // --- REAL API CALL ---
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: content }),
      });

      if (!response.ok) {
        // Log the status and potentially the response body for debugging
        const errorBody = await response.text();
        console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const report = await response.json();

      // Basic validation of the expected report structure
      if (!report || typeof report.score !== 'number' || !report.analysis || !Array.isArray(report.factors)) {
        console.error("Received invalid report format:", report);
        throw new Error("Received invalid report format from server.");
      }


      const assistantMessage: Message = {
        role: 'assistant',
        analysis: report,
      };

      setMessages(prev => [...prev, assistantMessage]);

      toast({
        title: "Analysis Complete",
        description: `Trust score: ${report.score}/100`,
      });

    } catch (error) {
      console.error("Analysis failed:", error);
      // More specific error message based on the caught error
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Analysis Failed",
        description: `Could not connect to the analysis service or process the response. ${errorMessage}. Please check backend logs.`,
        variant: "destructive",
      });
      // Optionally add a non-analysis message to chat
      // const errorMessageForChat: Message = { role: 'assistant', content: `Error: ${errorMessage}` };
      // setMessages(prev => [...prev, errorMessageForChat]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    toast({
      title: "Conversation Reset",
      description: "Starting fresh analysis session.",
    });
  };

  const handleExport = () => {
    const exportData = JSON.stringify(messages, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darpan-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url); // Clean up the object URL
    toast({
      title: "Exported Successfully",
      description: "Analysis history downloaded.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Hero />

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4">
        {messages.length > 0 && (
          <div className="flex items-center justify-between py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Analysis Session ({messages.filter(m => m.role === 'assistant').length} analyses)
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="border-border/50 hover:bg-muted/50"
                disabled={messages.length === 0} // Disable if no messages
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="border-border/50 hover:bg-muted/50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 py-6">
          {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-center text-muted-foreground">
               <p className="text-lg mb-2">Welcome to Darpan AI Trust Analysis</p>
               <p>Enter text or paste a URL below to begin.</p>
             </div>
          ) : (
            <>
              {messages.map((message, idx) => (
                <ChatMessage key={idx} {...message} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </ScrollArea>

        <div className="sticky bottom-0 py-4 bg-background/95 backdrop-blur-sm border-t border-border/50">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default Index;