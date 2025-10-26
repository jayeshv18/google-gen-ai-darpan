// src/pages/index.tsx

import { useState, useRef, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RotateCcw, Download } from "lucide-react";
import jsPDF from 'jspdf';
import { HistorySidebar, HistoryItem } from "@/components/HistorySidebar";
import { v4 as uuidv4 } from 'uuid'; // Ensure you've run: npm install uuid @types/uuid

// This is the full interface for the data from our main backend
export interface Message {
  role: 'user' | 'assistant';
  content?: string;
  imageUrl?: string; // <-- For user image preview
  analysis?: {
    score: number;
    analysis: string;
    factors: Array<{
      label: string;
      value: string;
      sentiment: 'positive' | 'neutral' | 'negative';
    }>;
    learn_more: {
      title: string;
      explanation: string;
      sources: string[];
    };
    report_payload?: {
      type: string;
      timestamp: string;
      forensic_report: any;
      ai_analysis: string;
    };
  };
}

// --- API Endpoints ---
const TEXT_API_ENDPOINT = 'https://darpan-backend-service-361059167059.us-central1.run.app/analyze';
const MEDIA_API_ENDPOINT = 'https://darpan-backend-service-361059167059.us-central1.run.app/analyze-media';
const HISTORY_KEY = 'darpanAnalysisHistory';

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load History on Mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load history:", error);
      localStorage.removeItem(HISTORY_KEY);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save History Function
  const saveToHistory = (message: Message, fileName: string = "Text Analysis") => {
    if (!message.analysis) return;
    const newHistoryItem: HistoryItem = {
      caseId: message.analysis.report_payload?.forensic_report?.case_id || `case-${uuidv4().split('-')[0]}`,
      fileName: fileName,
      score: message.analysis.score,
      timestamp: new Date().toISOString(),
      analysis: message.analysis,
    };
    setHistory(prevHistory => {
      const updatedHistory = [newHistoryItem, ...prevHistory.slice(0, 19)]; // Keep max 20
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch (error) {
        console.error("Failed to save history:", error);
        toast({ title: "Failed to save history", variant: "destructive" });
      }
      return updatedHistory;
    });
  };

  // Load History Item Function
  const handleSelectHistory = (analysis: Message['analysis']) => {
    if (isLoading) return;
    const historyMessage: Message = { role: 'assistant', analysis: analysis };
    setMessages(prev => [...prev, historyMessage]);
    toast({ title: "Loaded from History" });
  };

  // Main Send Function (handles text, images, and image preview URL)
  const handleSend = async (content: string, file: File | null, imagePreviewUrl: string | null) => { // Added imagePreviewUrl
    let userMessageContent = content;
    let fileNameForHistory = "Text Analysis";

    if (file) {
      userMessageContent = content ? `${content} [Image Attached]` : `[Image Attached]`; // Use generic text, preview handles visuals
      fileNameForHistory = file.name;
    }
    if (!userMessageContent.trim() && !file) return; // Need either text or file

    // Construct user message *including* the image preview URL
    const userMessage: Message = {
      role: 'user',
      content: userMessageContent,
      imageUrl: file ? imagePreviewUrl : undefined // Pass the preview URL
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const endpoint = file ? MEDIA_API_ENDPOINT : TEXT_API_ENDPOINT;
      let requestBody: BodyInit;
      let requestHeaders: HeadersInit = {};

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('prompt', content); // Send original text content as prompt
        requestBody = formData;
      } else {
        requestBody = JSON.stringify({ query: content });
        requestHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
      }

      const report = await response.json();

      if (!report || typeof report.score !== 'number' || !report.analysis || !Array.isArray(report.factors)) {
        throw new Error("Received invalid report format from server.");
      }

      const assistantMessage: Message = { role: 'assistant', analysis: report };
      setMessages(prev => [...prev, assistantMessage]);
      saveToHistory(assistantMessage, fileNameForHistory); // Save successful analysis
      toast({ title: "Analysis Complete", description: `Trust score: ${report.score}/100` });

    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      // Add a simple error message to the chat
      const errorAssistantMessage: Message = {
          role: 'assistant',
          content: `Analysis Failed: ${errorMessage}`
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
      toast({ title: "Analysis Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Function
   const handleReset = () => {
        setMessages([]);
        setHistory([]);
        localStorage.removeItem(HISTORY_KEY);
        toast({ title: "Session Reset", description: "Analysis and history cleared." });
    };

  // Advanced PDF Export Function (with Watermark and Robust Checks)
   const handleExport = () => {
    const lastReportMessage = messages.slice().reverse().find(
      msg => msg.role === 'assistant' && msg.analysis && msg.analysis.report_payload
    );
    if (!lastReportMessage || !lastReportMessage.analysis || !lastReportMessage.analysis.report_payload) {
       toast({ title: "No Detailed Report Found", description: "Run a media analysis to generate a full report.", variant: "destructive" });
       return;
    }
    toast({ title: "Generating Forensic PDF...", description: "Please wait..." });
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const analysis = lastReportMessage.analysis;
      const forensicData = analysis.report_payload.forensic_report;

      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = margin; // Start y position

      // --- Watermark Function ---
      const addWatermark = () => {
        const totalPages = doc.getNumberOfPages(); // Get total pages for correct numbering
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(90);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(235, 235, 235); // Lighter gray
            doc.text("DARPAN", pageWidth / 2, pageHeight / 2 + 30, { // Adjusted position
              angle: 45,
              align: 'center',
              baseline: 'middle'
            });
            // Add Page Number
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
        doc.setPage(totalPages); // Return to the last page to continue drawing
        doc.setTextColor(0, 0, 0); // Reset color
      };

      // --- Helper Functions ---
      const checkPageBreak = (spaceNeeded: number) => {
        if (y + spaceNeeded > pageHeight - margin) { // Check if content exceeds bottom margin
          addWatermark(); // Add watermark *before* adding a new page
          doc.addPage();
          y = margin + 10; // Reset y with top margin for new page
          // No need to add watermark again here, it's done at the end
        }
      };

      const addSectionTitle = (title: string) => {
        checkPageBreak(15); // Space needed for title + underline + padding
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(48, 38, 107); // Darpan purple
        doc.text(title, margin, y);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 2, pageWidth - margin, y + 2); // Underline
        y += 12;
      };

      const addSubTitle = (title: string) => {
         checkPageBreak(10); // Space for subtitle + padding
         doc.setFontSize(12);
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(0, 0, 0);
         doc.text(title, margin, y);
         y += 8;
      };

      const addBodyText = (text: string | null | undefined, x = margin, size = 10, style = 'normal') => {
        if (!text) text = "N/A"; // Handle null/undefined input gracefully
        const lines = doc.splitTextToSize(text, pageWidth - margin - x);
        const spaceNeeded = (lines.length * (size * 0.4)) + 3; // Estimate space
        checkPageBreak(spaceNeeded);
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(0, 0, 0);
        doc.text(lines, x, y);
        y += spaceNeeded;
      };

      const addKeyValue = (key: string, value: string | null | undefined) => {
        if (!value) value = "N/A";
        const linesValue = doc.splitTextToSize(value, pageWidth - (margin + 45) - margin); // 45 is approx key width + indent
        const spaceNeeded = (linesValue.length * 4) + 4; // Estimate space
        checkPageBreak(spaceNeeded);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50); // Dark Gray for key
        doc.text(key, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const valueX = margin + 40; // Indent value
        doc.text(linesValue, valueX, y);
        y += spaceNeeded;
      };

      // --- START BUILDING PDF ---
      // Initial Page (No Watermark yet)
      addSectionTitle("Case Details");
      addKeyValue("Case ID:", forensicData?.case_id);
      addKeyValue("File Name:", forensicData?.file_name);
      addKeyValue("SHA-256:", forensicData?.file_sha256);
      addKeyValue("Generated:", forensicData?.generated_at ? new Date(forensicData.generated_at).toUTCString() : 'N/A');
      y += 5;

      addSectionTitle("AI Analysis Summary (Gemini)");
      addBodyText(analysis.analysis, margin, 11);
      y += 5;

      addSectionTitle("C.O.N.T.E.X.T. Analysis Factors");
      for (const factor of analysis.factors) {
        addBodyText(factor.label, margin, 11, 'bold');
        addBodyText(factor.value, margin + 5, 10);
      }
      y += 5;

      // --- Forensic Findings Page ---
      checkPageBreak(pageHeight); // Force page break if needed before next section

      addSectionTitle("Detailed Forensic Findings");
      if (forensicData?.error) {
          doc.setTextColor(255, 0, 0); // Red
          addBodyText(`Forensic Service Error: ${forensicData.error}`, margin, 12, 'bold');
          addBodyText(`Details: ${forensicData.details || 'No details.'}`, margin, 10);
          doc.setTextColor(0, 0, 0); // Reset color
      } else if (forensicData) {
          // Scatter Analysis
          if (forensicData.scatter_analysis) {
            addSubTitle("Scatter Analysis");
            const scatter = forensicData.scatter_analysis;
            addKeyValue("Synthetic Likelihood:", `${scatter.synthetic_likelihood ?? 'N/A'}`);
            if (scatter.entropies) addKeyValue("Entropies (R/G/B):", `${scatter.entropies.R_entropy?.toFixed(3) ?? 'N/A'} / ${scatter.entropies.G_entropy?.toFixed(3) ?? 'N/A'} / ${scatter.entropies.B_entropy?.toFixed(3) ?? 'N/A'}`);
            if (scatter.correlations) addKeyValue("Correlations (RG/RB/GB):", `${scatter.correlations['R-G_corr']?.toFixed(3) ?? 'N/A'} / ${scatter.correlations['R-B_corr']?.toFixed(3) ?? 'N/A'} / ${scatter.correlations['G-B_corr']?.toFixed(3) ?? 'N/A'}`);
            y += 5;
            if (scatter.scatter_image_base64) {
              try {
                const imgData = 'data:image/png;base64,' + scatter.scatter_image_base64;
                const imgWidth = 170; const imgHeight = (imgWidth / 3);
                checkPageBreak(imgHeight + 10); // Check space for image + padding
                doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
                y += imgHeight + 10;
              } catch (e) { addBodyText("(Scatter plot image failed to render)", margin, 10); }
            }
          }
          // Raw Data Appendix
          addSectionTitle("Appendix: Raw Forensic Data");
          addSubTitle("Metadata (ExifTool)");
          const exifData = (forensicData.metadata && forensicData.metadata.ExifTool) ? JSON.stringify(forensicData.metadata.ExifTool, null, 2) : "No ExifTool data found.";
          addBodyText(exifData, margin, 8); // Small font for JSON

          addSubTitle("Binary Structure (Binwalk)");
          addBodyText(forensicData.binwalk, margin, 8); // Small font for raw output

          addSubTitle("Steganography (Steghide)");
          addBodyText(forensicData.steghide, margin, 8); // Small font for raw output
      } else {
         addBodyText("No forensic data was found in the report payload.", margin, 10);
      }

      // --- Add Watermark to ALL pages ---
      addWatermark();

      // --- SAVE ---
      doc.save(`darpan-forensic-report-${forensicData?.case_id || 'export'}.pdf`);
      toast({ title: "Forensic PDF Exported", description: "Report saved successfully." });

    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "Export Failed", description: "An error occurred generating the PDF.", variant: "destructive" });
    }
   };
  // --- END PDF EXPORT ---

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Hero />
      <div className="flex-1 flex flex-row max-w-7xl mx-auto w-full overflow-hidden">
        {/* History Sidebar */}
        <div className="w-56 flex-shrink-0 h-full overflow-y-auto border-r border-border/50">
          <HistorySidebar history={history} onSelectHistory={handleSelectHistory} />
        </div>
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col px-4 overflow-hidden">
          {/* Header Buttons */}
          <div className="flex items-center justify-between py-4 border-b border-border/50 flex-shrink-0">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {messages.length > 0 ? `Analysis Session (${messages.filter(m => m.role === 'assistant').length} reports)` : "Start New Analysis"}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="border-border/50 hover:bg-muted/50 disabled:opacity-50" disabled={isLoading || !messages.some(m => m.role === 'assistant' && m.analysis?.report_payload)} title={!messages.some(m => m.role === 'assistant' && m.analysis?.report_payload) ? "Run a media analysis to enable export" : "Export latest forensic report"}>
                 <Download className="w-4 h-4 mr-2" /> Export Forensic Report
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} className="border-border/50 hover:bg-muted/50 disabled:opacity-50" disabled={isLoading || messages.length === 0} title={messages.length === 0 ? "No session to reset" : "Reset session and history"}>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Session
              </Button>
            </div>
          </div>
          {/* Chat Scroll */}
          <ScrollArea className="flex-1 py-6">
            {messages.length === 0 ? (
               <div className="flex flex-col items-center justify-center min-h-[400px] text-center text-muted-foreground">
                 <p className="text-lg mb-2">Welcome to Darpan AI Trust Analysis</p>
                 <p>Enter text, paste a URL, or attach an image to begin.</p>
                 <p className="text-sm mt-4">Your session history will appear on the left.</p>
               </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <ChatMessage key={idx} {...message} isLastMessage={idx === messages.length - 1} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </ScrollArea>
          {/* Input Area */}
          <div className="sticky bottom-0 py-4 bg-background/95 backdrop-blur-sm border-t border-border/50 flex-shrink-0">
            <ChatInput onSend={handleSend} isLoading={isLoading} />
          </div>
        </div> {/* End Main Chat Area */}
      </div> {/* End Page Layout */}
    </div>
  );
};

export default Index;