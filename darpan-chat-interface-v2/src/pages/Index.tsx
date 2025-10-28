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
    text_forensics?: any;
    timestamp?: string; // <-- ** ADDED TIMESTAMP **
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
  // --- ** NEW STATE ** ---
  const [currentReportAnalysis, setCurrentReportAnalysis] = useState<Message['analysis'] | null>(null);
  // --- ** END NEW STATE ** ---
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
      // Use report_payload.forensic_report for media ID, or generate one for text using timestamp
      caseId: message.analysis.report_payload?.forensic_report?.case_id || `text-${message.analysis.timestamp?.split('T')[0] ?? uuidv4().split('-')[0]}`,
      fileName: fileName,
      score: message.analysis.score,
      timestamp: message.analysis.timestamp || new Date().toISOString(), // Use timestamp from analysis object
      analysis: message.analysis, // Save the complete analysis object
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

  // Load History Item Function - ** UPDATED **
  const handleSelectHistory = (analysis: Message['analysis']) => {
    if (isLoading || !analysis) return; // Added check for analysis object

    // --- *** NEW: Set selected history item as current report *** ---
    setCurrentReportAnalysis(analysis);
    // --- *** END NEW *** ---

    const historyMessage: Message = {
      role: 'assistant',
      analysis: analysis
    };
    setMessages(prev => [...prev, historyMessage]); // Still add to message list
    // Use timestamp from analysis object if available, otherwise fallback
    const displayTime = analysis.timestamp ? new Date(analysis.timestamp).toLocaleTimeString() : 'past';
    toast({ title: "Loaded from History", description: `Displaying report from ${displayTime}` });
  };


  // Main Send Function - ** UPDATED **
  const handleSend = async (content: string, file: File | null, imagePreviewUrl: string | null) => {
    let userMessageContent = content;
    let fileNameForHistory = "Text Analysis";

    if (file) {
      userMessageContent = content ? `${content} [Image Attached]` : `[Image Attached]`;
      fileNameForHistory = file.name;
    }
    if (!userMessageContent.trim() && !file) return;

    const userMessage: Message = {
      role: 'user',
      content: userMessageContent,
      imageUrl: file ? imagePreviewUrl : undefined
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
        formData.append('prompt', content);
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

      // --- *** NEW: Add timestamp and set as current report *** ---
      report.timestamp = new Date().toISOString(); // Add timestamp to the report object itself
      setCurrentReportAnalysis(report); // Set this new report as the one to export
      // --- *** END NEW *** ---

      const assistantMessage: Message = { role: 'assistant', analysis: report };
      setMessages(prev => [...prev, assistantMessage]);
      saveToHistory(assistantMessage, fileNameForHistory); // saveToHistory uses the analysis object, which now has timestamp
      toast({ title: "Analysis Complete", description: `Trust score: ${report.score}/100` });

    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
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
        setCurrentReportAnalysis(null); // Clear current report on reset
        localStorage.removeItem(HISTORY_KEY);
        toast({ title: "Session Reset", description: "Analysis and history cleared." });
    };

  // Advanced PDF Export Function - ** UPDATED **
   const handleExport = () => {
    // --- *** Use currentReportAnalysis state variable *** ---
    if (!currentReportAnalysis) {
        toast({ title: "No Report Selected", description: "Run an analysis or select one from history.", variant: "destructive" });
        return;
    }
    const analysis = currentReportAnalysis; // Use the analysis stored in state
    // --- *** END CHANGE *** ---

    const isMediaReport = !!analysis.report_payload;
    const forensicData = analysis.report_payload?.forensic_report;

    toast({ title: "Generating PDF Report...", description: "Please wait..." });
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = margin;

      // Watermark & Helper functions (no changes needed within them)
      const addWatermark = () => { /* ... definition ... */
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(90); doc.setFont('helvetica', 'bold'); doc.setTextColor(235, 235, 235);
            doc.text("DARPAN", pageWidth / 2, pageHeight / 2 + 30, { angle: 45, align: 'center', baseline: 'middle' });
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
        doc.setPage(totalPages); doc.setTextColor(0, 0, 0);
      };
      const checkPageBreak = (spaceNeeded: number) => {
        if (y + spaceNeeded > pageHeight - margin) { addWatermark(); doc.addPage(); y = margin + 10; }
      };
      const addSectionTitle = (title: string) => {
        checkPageBreak(15); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(48, 38, 107);
        doc.text(title, margin, y); doc.setLineWidth(0.5); doc.line(margin, y + 2, pageWidth - margin, y + 2); y += 12;
      };
      const addSubTitle = (title: string) => {
         checkPageBreak(10); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
         doc.text(title, margin, y); y += 8;
      };
      const addBodyText = (text: string | null | undefined, x = margin, size = 10, style = 'normal') => {
        if (!text) text = "N/A"; const lines = doc.splitTextToSize(text, pageWidth - margin - x);
        const spaceNeeded = (lines.length * (size * 0.4)) + 3; checkPageBreak(spaceNeeded);
        doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(0, 0, 0); doc.text(lines, x, y); y += spaceNeeded;
      };
       const addKeyValue = (key: string, value: string | number | null | undefined) => {
        if (value === null || value === undefined) value = "N/A";
        value = String(value);
        const linesValue = doc.splitTextToSize(value, pageWidth - (margin + 45) - margin);
        const spaceNeeded = (linesValue.length * 4) + 4; checkPageBreak(spaceNeeded);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50); doc.text(key, margin, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); doc.text(linesValue, margin + 40, y); y += spaceNeeded;
      };

      // --- START BUILDING PDF ---
      addSectionTitle("Case Details");
      // Use analysis.timestamp for text reports' case ID generation fallback
      const caseIdDisplay = forensicData?.case_id ?? (analysis.text_forensics ? `text-${analysis.timestamp?.split('T')[0] ?? 'unknown'}` : 'N/A');
      addKeyValue("Case ID:", caseIdDisplay);
      addKeyValue("File Name:", forensicData?.file_name ?? (analysis.text_forensics ? 'Text Input' : 'N/A')); // Show 'Text Input' for text
      addKeyValue("SHA-256:", forensicData?.file_sha256 ?? 'N/A');
      addKeyValue("Generated:", forensicData?.generated_at ? new Date(forensicData.generated_at).toUTCString() : (analysis.timestamp ? new Date(analysis.timestamp).toUTCString() : 'N/A')); // Use analysis timestamp if forensic one unavailable
      y += 5;

      addSectionTitle("AI Analysis Summary (Gemini)");
      addBodyText(analysis.analysis, margin, 11);
      y += 5;

      addSectionTitle(isMediaReport ? "C.O.N.T.E.X.T. Analysis Factors (Media)" : "C.O.N.T.E.X.T. Analysis Factors (Text)");
      for (const factor of analysis.factors) {
        addBodyText(factor.label, margin, 11, 'bold');
        addBodyText(factor.value, margin + 5, 10);
      }
      y += 5;

      // Add Text Forensics to PDF if it exists
      if (analysis.text_forensics && !analysis.text_forensics.error) {
          checkPageBreak(70);
          addSectionTitle("Text Forensics Summary");
          const tf = analysis.text_forensics;
          addKeyValue("AI Likelihood (Heuristic):", tf.ai_likelihood_heuristic?.toFixed(3));
          addKeyValue("Readability (Flesch Ease):", tf.readability_score_flesch?.toFixed(1));
          addKeyValue("Sentiment Polarity:", tf.sentiment_polarity?.toFixed(3));
          addKeyValue("Subjectivity:", tf.subjectivity?.toFixed(3));
          addKeyValue("Lexical Diversity (TTR):", tf.lexical_diversity_ttr?.toFixed(3));
          addKeyValue("Burstiness (Variance Heuristic):", tf.burstiness_variance?.toFixed(3));
          addKeyValue("Repetition (Trigram Ratio):", tf.repetition_trigram?.toFixed(3));
          y += 5;
      } else if (analysis.text_forensics?.error) {
          checkPageBreak(20);
          addSectionTitle("Text Forensics Summary");
          doc.setTextColor(255, 0, 0);
          addBodyText(`Text Forensics Error: ${analysis.text_forensics.error}`, margin, 10, 'bold');
          doc.setTextColor(0, 0, 0);
          y += 5;
      }

      // Add Detailed Forensic Findings ONLY if it's a media report
      if (isMediaReport) {
          checkPageBreak(pageHeight);
          addSectionTitle("Detailed Forensic Findings");
          if (forensicData?.error) { /* ... error handling ... */
              doc.setTextColor(255, 0, 0);
              addBodyText(`Forensic Service Error: ${forensicData.error}`, margin, 12, 'bold');
              addBodyText(`Details: ${forensicData.details || 'No details.'}`, margin, 10);
              doc.setTextColor(0, 0, 0);
          } else if (forensicData) {
              if (forensicData.scatter_analysis) { /* ... scatter plot ... */
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
                    checkPageBreak(imgHeight + 10);
                    doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
                    y += imgHeight + 10;
                  } catch (e) { addBodyText("(Scatter plot image failed to render)", margin, 10); }
                }
              }
              addSectionTitle("Appendix: Raw Forensic Data");
              addSubTitle("Metadata (ExifTool)");
              let exifDisplay = "No ExifTool data found.";
              if (forensicData.metadata && forensicData.metadata.ExifTool) { /* ... exif display logic ... */
                  try {
                      if (typeof forensicData.metadata.ExifTool === 'string' && forensicData.metadata.ExifTool.trim().startsWith('{')) {
                           exifDisplay = JSON.stringify(JSON.parse(forensicData.metadata.ExifTool), null, 2);
                      } else { exifDisplay = String(forensicData.metadata.ExifTool); }
                  } catch (e) { exifDisplay = String(forensicData.metadata.ExifTool); }
              }
              addBodyText(exifDisplay, margin, 8);
              addSubTitle("Binary Structure (Binwalk)");
              addBodyText(forensicData.binwalk, margin, 8);
              addSubTitle("Steganography (Steghide)");
              addBodyText(forensicData.steghide, margin, 8);
          } else {
             addBodyText("No detailed forensic data was found.", margin, 10);
          }
      } // End if(isMediaReport)

      addWatermark();
      const caseIdForFile = forensicData?.case_id || caseIdDisplay.replace(/[^a-zA-Z0-9-]/g, '_');
      const pdfFileName = `darpan-report-${caseIdForFile}.pdf`;
      doc.save(pdfFileName);
      toast({ title: "PDF Report Exported", description: "Report saved successfully." });

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
              {messages.length > 0 ? `Analysis Session (${messages.filter(m => m.role === 'assistant' && m.analysis).length} reports)` : "Start New Analysis"}
            </h2>
            <div className="flex gap-2">
              {/* --- ** UPDATED EXPORT BUTTON ** --- */}
              <Button variant="outline" size="sm" onClick={handleExport} className="border-border/50 hover:bg-muted/50 disabled:opacity-50"
                disabled={isLoading || !currentReportAnalysis}
                title={!currentReportAnalysis ? "Run or select an analysis to enable export" : "Export currently viewed report"} >
                 <Download className="w-4 h-4 mr-2" /> Export Report
              </Button>
              {/* --- ** END UPDATE ** --- */}
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