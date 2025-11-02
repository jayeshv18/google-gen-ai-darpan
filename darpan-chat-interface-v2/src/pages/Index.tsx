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
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

// --- 1. IMPORT ALL YOUR FONTS ---
import { hindiFontBase64 } from '../assets/fonts/hindiFontData';
import { tamilFontBase64 } from '../assets/fonts/tamilFontData';
import { bengaliFontBase64 } from '../assets/fonts/bengaliFontData';
import { kannadaFontBase64 } from '../assets/fonts/kannadaFontData';


// --- Interface Definitions (Unchanged) ---
export interface Factor {
  name: string;
  analysis: string;
  score: number;
}
export interface Analysis {
  score: number;
  summary: string; 
  factors: Factor[];
  report_payload: {
    rag_hits: any;
    web_hits: any;
    provenance_report?: any;
    forensic_report?: {
      scatter_analysis?: {
        entropies: any;
        correlations: any;
        synthetic_likelihood: number;
        scatter_image_base64: string;
      };
    };
  };
  caseId: string;
  timestamp: string;
  sha256_hash: string | null;
  text_forensics?: any;
  translation_error?: string;
  learn_more?: {
    title: string;
    explanation: string;
  };
}
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  imageUrl?: string;
  analysis?: Analysis | null;
}
// --- End Interface Definitions ---


const TEXT_API_ENDPOINT = 'https://darpan-ai-engine-361059167059.us-central1.run.app/analyze';
const MEDIA_API_ENDPOINT = 'https://darpan-ai-engine-361059167059.us-central1.run.app/analyze-media';
const HISTORY_KEY = 'darpanAnalysisHistory';

const Index = () => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const [currentReportAnalysis, setCurrentReportAnalysis] = useState<Analysis | null>(null);

  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- All functions from useEffect to handleReset are unchanged ---
  
  // Load History
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save History
  const saveToHistory = (message: Message, fileName: string = t('history.textAnalysisDefaultName')) => {
    if (!message.analysis) return;
    const newHistoryItem: HistoryItem = {
      caseId: message.analysis.caseId,
      fileName: fileName,
      score: message.analysis.score,
      timestamp: message.analysis.timestamp || new Date().toISOString(),
      analysis: message.analysis,
    };
    setHistory(prevHistory => {
      const exists = prevHistory.some(item => item.caseId === newHistoryItem.caseId);
      if (exists) return prevHistory;
      
      const updatedHistory = [newHistoryItem, ...prevHistory.slice(0, 19)];
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch (error) {
        console.error("Failed to save history:", error);
        toast({ title: t('toast.saveHistoryFail'), variant: "destructive" });
      }
      return updatedHistory;
    });
  };

  // Load History
  const handleSelectHistory = (analysis: Analysis) => {
    if (isLoading || !analysis) return;
    setCurrentReportAnalysis(analysis);
    const historyMessage: Message = { 
      id: uuidv4(), 
      role: 'assistant', 
      analysis: analysis 
    };
    setMessages(prev => [...prev, historyMessage]);
    const displayTime = analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : t('history.pastTime');
    toast({ title: t('toast.loadedHistory'), description: t('toast.loadedHistoryDesc', { time: displayTime }) });
  };

  // Send Message
  const handleSend = async (content: string, file: File | null, imagePreviewUrl: string | null) => {
     let userMessageContent = content;
    let fileNameForHistory = t('history.textAnalysisDefaultName');

    if (file) {
      userMessageContent = content ? `${content} [${t('chat.imageAttached')}]` : `[${t('chat.imageAttached')}]`;
      fileNameForHistory = file.name;
    }
    if (!userMessageContent.trim() && !file) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessageContent,
      imageUrl: file ? imagePreviewUrl : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setCurrentReportAnalysis(null); // Clear previous report

    try {
      const endpoint = file ? MEDIA_API_ENDPOINT : TEXT_API_ENDPOINT;
      let requestBody: BodyInit;
      let requestHeaders: HeadersInit = {};
      const currentLang = i18n.language.split('-')[0];

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('prompt', content);
        formData.append('lang', currentLang);
        requestBody = formData;
      } else {
        requestBody = JSON.stringify({ query: content, lang: currentLang });
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

      const report: Analysis = await response.json();

      if (!report || typeof report.score !== 'number' || !report.summary || !Array.isArray(report.factors)) {
        console.error("Invalid report structure received:", report);
        throw new Error(t('error.invalidReport'));
      }

      report.timestamp = report.timestamp || new Date().toISOString(); 
      report.caseId = report.caseId || `local-${uuidv4()}`;
      
      setCurrentReportAnalysis(report);

      const assistantMessage: Message = { 
        id: uuidv4(), 
        role: 'assistant', 
        analysis: report 
      };
      setMessages(prev => [...prev, assistantMessage]);
      saveToHistory(assistantMessage, fileNameForHistory);
      toast({ title: t('toast.analysisComplete'), description: t('toast.analysisCompleteDesc', { score: report.score }) });

    } catch (error) {
      console.error("Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : t('error.unknown');
      const errorAssistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `${t('error.analysisFailedPrefix')}: ${errorMessage}`
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
      toast({ title: t('toast.analysisFailed'), description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Chat
  const handleReset = () => {
        setMessages([]);
        setHistory([]);
        setCurrentReportAnalysis(null);
        localStorage.removeItem(HISTORY_KEY);
        toast({ title: t('toast.sessionReset'), description: t('toast.sessionResetDesc') });
   };


   // --- PDF EXPORT FUNCTION (FULLY FIXED) ---
   const handleExport = (analysis: Analysis | null) => {
    if (!analysis) {
        toast({ title: t('toast.noReportSelected'), description: t('toast.noReportSelectedDesc'), variant: "destructive" });
        return;
    }
    
    const reportPayload = analysis.report_payload;
    const isMediaReport = !!reportPayload?.provenance_report || !!reportPayload?.forensic_report;
    const textForensics = analysis.text_forensics;

    toast({ title: t('toast.generatingPdf'), description: t('toast.pleaseWait') });
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = margin;
      const reportLang = i18n.language.split('-')[0];

      // --- 2. REGISTER ALL YOUR FONTS ---
      let fontWarningShown = false;
      try {
          // Hindi / Marathi
          doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", hindiFontBase64);
          doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
          
          // Tamil
          doc.addFileToVFS("NotoSansTamil-Regular.ttf", tamilFontBase64);
          doc.addFont("NotoSansTamil-Regular.ttf", "NotoSansTamil", "normal");

          // Bengali
          doc.addFileToVFS("NotoSansBengali-Regular.ttf", bengaliFontBase64);
          doc.addFont("NotoSansBengali-Regular.ttf", "NotoSansBengali", "normal");

          // Kannada
          doc.addFileToVFS("NotoSansKannada-Regular.ttf", kannadaFontBase64);
          doc.addFont("NotoSansKannada-Regular.ttf", "NotoSansKannada", "normal");

          console.log("Registered all PDF fonts.");
      } catch (fontError) {
          console.error("Error registering custom fonts:", fontError);
          fontWarningShown = true; // Show warning for any font error
      }

      // --- 3. FULLY CORRECTED FONT SETTER ---
      const setDocFont = (style: 'normal' | 'bold' = 'normal') => {
          let fontName = 'helvetica'; // Default
          let effectiveStyle = style;

          // We set 'normal' for all custom fonts because jsPDF
          // doesn't handle bold/italic well with custom .ttf files.
          switch (reportLang) {
              case 'hi':
              case 'mr':
                  fontName = 'NotoSansDevanagari';
                  effectiveStyle = 'normal';
                  break;
              case 'ta':
                  fontName = 'NotoSansTamil';
                  effectiveStyle = 'normal';
                  break;
              case 'bn':
                  fontName = 'NotoSansBengali';
                  effectiveStyle = 'normal';
                  break;
              case 'kn':
                  fontName = 'NotoSansKannada';
                  effectiveStyle = 'normal';
                  break;
              default:
                  fontName = 'helvetica';
                  effectiveStyle = style;
          }

          try {
              doc.setFont(fontName, effectiveStyle);
          } catch (e) {
              doc.setFont('helvetica', style); // Fallback
              if (reportLang !== 'en' && !fontWarningShown) {
                  toast({ title: "PDF Font Warning", description: `Font for ${reportLang} not loaded. Characters may not display.`, variant: "destructive", duration: 7000 });
                  fontWarningShown = true;
              }
          }
      };

      // PDF Helper Functions (Unchanged)
      const addWatermark = () => {
         const totalPages = doc.getNumberOfPages();
         for (let i = 1; i <= totalPages; i++) {
             doc.setPage(i);
             doc.setGState(new doc.GState({opacity: 0.1})); 
             setDocFont('bold'); doc.setFontSize(90); doc.setTextColor(150, 150, 150);
             doc.text("DARPAN", pageWidth / 2, pageHeight / 2 + 30, { angle: 45, align: 'center', baseline: 'middle' });
             doc.setGState(new doc.GState({opacity: 1.0})); 
             setDocFont('normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
             doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
         }
         doc.setPage(totalPages); doc.setTextColor(0, 0, 0);
      };
      const checkPageBreak = (spaceNeeded: number) => {
        if (y + spaceNeeded > pageHeight - margin) { addWatermark(); doc.addPage(); y = margin + 10; }
      };
      const addSectionTitle = (title: string) => {
        checkPageBreak(15);
        setDocFont('bold');
        doc.setFontSize(16); doc.setTextColor(48, 38, 107);
        doc.text(title, margin, y);
        doc.setLineWidth(0.5); doc.line(margin, y + 2, pageWidth - margin, y + 2); y += 12;
      };
      const addSubTitle = (title: string) => {
         checkPageBreak(10);
         setDocFont('bold');
         doc.setFontSize(12); doc.setTextColor(0, 0, 0);
         doc.text(title, margin, y); y += 8;
      };
      const addBodyText = (text: string | null | undefined, x = margin, size = 10, style: 'normal' | 'bold' = 'normal') => {
        if (!text) text = "N/A";
        setDocFont(style);
        doc.setFontSize(size); doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(text, (x === margin) ? (pageWidth - margin - margin) : (pageWidth - margin - x));
        const spaceNeeded = (lines.length * (size * 0.4)) + 3;
        checkPageBreak(spaceNeeded);
        doc.text(lines, x, y); y += spaceNeeded;
      };
       const addKeyValue = (key: string, value: string | number | null | undefined) => {
        if (value === null || value === undefined) value = "N/A";
        value = String(value);
        const translatedKey = t(key);
        
        setDocFont('bold'); doc.setFontSize(10);
        const keyLines = doc.splitTextToSize(translatedKey, 45); // Increased key width
        const keySpace = (keyLines.length * 4) + 4;

        setDocFont('normal'); doc.setFontSize(10);
        const valueLines = doc.splitTextToSize(value, pageWidth - (margin + 50) - margin);
        const valueSpace = (valueLines.length * 4) + 4;

        const spaceNeeded = Math.max(keySpace, valueSpace);
        checkPageBreak(spaceNeeded);

        setDocFont('bold'); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
        doc.text(keyLines, margin, y);

        setDocFont('normal'); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
        doc.text(valueLines, margin + 50, y); // Increased value offset
        y += spaceNeeded;
      };

      // --- START BUILDING PDF (Unchanged) ---
      addSectionTitle(t('pdf.section.caseDetails'));
      
      const fileNameDisplay = reportPayload?.provenance_report?.file_name ?? (textForensics ? t('pdf.textInput') : 'N/A');
      addKeyValue("pdf.caseId", analysis.caseId || 'N/A');
      addKeyValue("pdf.fileName", fileNameDisplay);
      addKeyValue("pdf.sha256", analysis.sha256_hash || 'N/A'); 
      addKeyValue("pdf.generated", analysis.timestamp ? new Date(analysis.timestamp).toUTCString() : 'N/A');
      y += 5;

      addSectionTitle(t('pdf.section.aiSummary'));
      addBodyText(analysis.summary, margin, 11);
      y += 5;

      addSectionTitle(isMediaReport ? t('pdf.section.contextMedia') : t('pdf.section.contextText'));
      for (const factor of analysis.factors) {
        addBodyText(factor.name, margin, 11, 'bold');
        addBodyText(factor.analysis, margin + 5, 10);
      }
      y += 5;

      if (textForensics) {
          addSectionTitle(t('pdf.section.textForensics'));
          if (!textForensics.error) {
              const tf = textForensics;
              addKeyValue("pdf.tfAiLikelihood", tf.ai_likelihood_heuristic?.toFixed(3));
              addKeyValue("pdf.tfReadability", tf.readability_score_flesch?.toFixed(1));
              addKeyValue("pdf.tfSentiment", tf.sentiment_polarity?.toFixed(3));
              addKeyValue("pdf.tfSubjectivity", tf.subjectivity?.toFixed(3));
          } else {
              setDocFont('bold');
              doc.setTextColor(255, 0, 0);
              addBodyText(`${t('pdf.tfErrorPrefix')}: ${textForensics.error}`, margin, 10, 'bold');
              doc.setTextColor(0, 0, 0);
          }
          y += 5;
      }
      
      // --- SCATTER PLOT SECTION (Unchanged) ---
      if (isMediaReport && reportPayload?.forensic_report?.scatter_analysis) {
          const scatter_data = reportPayload.forensic_report.scatter_analysis;
          const scatter_image_b64 = scatter_data.scatter_image_base64;

          addSectionTitle(t('pdf.subSection.scatter'));
          
          addKeyValue(t('pdf.scatterSynthLikelihood'), scatter_data.synthetic_likelihood?.toFixed(3));
          
          if (scatter_data.entropies) {
              const e = scatter_data.entropies;
              addKeyValue(t('pdf.scatterEntropies'), `R: ${e.R_entropy?.toFixed(3)}, G: ${e.G_entropy?.toFixed(3)}, B: ${e.B_entropy?.toFixed(3)}`);
          }
          if (scatter_data.correlations) {
              const c = scatter_data.correlations;
              addKeyValue(t('pdf.scatterCorrelations'), `RG: ${c['R-G_corr']?.toFixed(3)}, RB: ${c['R-B_corr']?.toFixed(3)}, GB: ${c['G-B_corr']?.toFixed(3)}`);
          }
          y += 5; // Add padding
          
          // Add the scatter plot image
          if (scatter_image_b64) {
              try {
                  const imgData = "data:image/png;base64," + scatter_image_b64;
                  const imgWidth = 150;
                  const imgHeight = 50;
                  checkPageBreak(imgHeight + 10);
                  doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
                  y += imgHeight + 10;
              } catch (e) {
                  console.error("Failed to add scatter plot image to PDF:", e);
                  addBodyText(`(Failed to render scatter image)`, margin, 9, 'normal');
              }
          }
      }
      
      // --- DIGITAL PROVENANCE SECTION (Unchanged) ---
      if (isMediaReport && reportPayload?.provenance_report) {
           addSectionTitle(t('pdf.section.digitalProvenance'));
           const prov = reportPayload.provenance_report;
           
           addSubTitle(t('pdf.subSection.metadata'));
           if (prov.metadata?.has_metadata) {
               addKeyValue("pdf.prov.software", prov.metadata.all_tags?.['Image Software'] || 'N/A');
               addKeyValue("pdf.prov.make", prov.metadata.all_tags?.['Image Make'] || 'N/A');
               addKeyValue("pdf.prov.model", prov.metadata.all_tags?.['Image Model'] || 'N/A');
               addKeyValue("pdf.prov.suspicious", prov.metadata.suspicious_tags?.join(', ') || t('pdf.noneDetected'));
           } else {
               addBodyText(t('pdf.noExif'));
           }
           y += 5;

           addSubTitle(t('pdf.subSection.webOrigin'));
           addKeyValue("pdf.prov.bestGuess", prov.web_origin?.best_guess_label || t('pdf.noGuess'));
           addKeyValue("pdf.prov.firstSeen", prov.web_origin?.first_seen_url || t('pdf.notFound'));
           
           addBodyText(t('pdf.prov.matchingPages'), margin, 10, 'bold');
           const pages = prov.web_origin?.pages_with_matching_pages || [];
           if (pages.length > 0) {
               pages.forEach((page: {url: string, title: string}) => {
                   addBodyText(`- ${page.title || page.url}`, margin + 5, 9);
               });
           } else {
               addBodyText(t('pdf.noMatchingPages'), margin + 5, 9);
           }
      }

      addWatermark();

      const caseIdForFile = (analysis.caseId || 'report').replace(/[^a-zA-Z0-9-]/g, '_');
      const pdfFileName = `darpan-report-${caseIdForFile}.pdf`;
      doc.save(pdfFileName);
      toast({ title: t('toast.pdfExported'), description: t('toast.pdfExportedDesc') });

    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: t('toast.exportFailed'), description: (error as Error).message || t('toast.exportFailedDesc'), variant: "destructive" });
    }
   };
   // --- END PDF EXPORT ---


   // Language Changer Function
   const changeLanguage = (lng: string) => {
     i18n.changeLanguage(lng);
     toast({ title: t('toast.languageChanged'), description: t('toast.languageChangedDesc', { lng }) });
   };

  // --- RETURN STATEMENT (Unchanged) ---
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Hero />
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden">
        {/* History Sidebar */}
        <div className="hidden md:block w-56 flex-shrink-0 h-full overflow-y-auto border-r border-border/50">
          <HistorySidebar 
            history={history} 
            onSelectHistory={handleSelectHistory} 
            onClearHistory={handleReset}
          />
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col px-4 overflow-hidden">
          {/* Header Buttons */}
          <div className="flex items-center justify-between py-4 border-b border-border/50 flex-shrink-0">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {messages.length > 0 ? t('header.analysisSession', { count: messages.filter(m => m.role === 'assistant' && m.analysis).length }) : t('header.startAnalysis')}
            </h2>
            <div className="flex gap-2 items-center">
              {/* Language Selector */}
              <select onChange={(e) => changeLanguage(e.target.value)} value={i18n.language.split('-')[0]} className="bg-background text-foreground border border-border/50 rounded-md p-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                 <option value="en">English</option>
                 <option value="hi">हिन्दी (Hindi)</option>
                 <option value="ta">தமிழ் (Tamil)</option>
                 <option value="bn">বাংলা (Bengali)</option>
                 <option value="mr">मराठी (Marathi)</option>
                 <option value="kn">ಕನ್ನಡ (Kannada)</option>
              </select>

              {/* Export Button */}
              <Button variant="outline" size="sm" onClick={() => handleExport(currentReportAnalysis)} className="border-border/50 hover:bg-muted/50 disabled:opacity-50"
                disabled={isLoading || !currentReportAnalysis}
                title={!currentReportAnalysis ? t('header.exportDisabledTooltip') : t('header.exportTooltip')} >
                 <Download className="w-4 h-4 mr-2" /> {t('header.exportButton')}
              </Button>
              
              {/* Reset Button */}
              <Button variant="outline" size="sm" onClick={handleReset} className="border-border/50 hover:bg-muted/50 disabled:opacity-50"
                disabled={isLoading || messages.length === 0}
                title={messages.length === 0 ? t('header.resetDisabledTooltip') : t('header.resetTooltip')}>
                <RotateCcw className="w-4 h-4 mr-2" /> {t('header.resetButton')}
              </Button>
            </div>
          </div>
          
          {/* Chat Scroll */}
          <ScrollArea className="flex-1 py-6">
            {messages.length === 0 ? (
               <div className="flex flex-col min-h-[400px] text-muted-foreground p-4">
                 <h2 className="text-xl font-semibold text-foreground mb-4">{t('welcome.title')}</h2>
                 
                 <h3 className="font-semibold text-foreground mt-4 mb-2">{t('welcome.howToUse')}</h3>
                 
                 <div className="bg-background/50 border rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-foreground mb-2">{t('welcome.textTitle')}</h4>
                  <ul className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('welcome.textStep1')}</li>
                    <li>{t('welcome.textStep2')}</li>
                    <li>{t('welcome.textStep3')}</li>
                  </ul>
                 </div>

                 <div className="bg-background/50 border rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-foreground mb-2">{t('welcome.imageTitle')}</h4>
                  <ul className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('welcome.imageStep1')}</li>
                    <li>{t('welcome.imageStep2')}</li>
                    <li>{t('welcome.imageStep3')}</li>
                  </ul>
                 </div>
                 
                 <div className="bg-background/50 border rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-foreground mb-2">{t('welcome.micTitle')}</h4>
                  <ul className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('welcome.micStep1')}</li>
                    <li>{t('welcome.micStep2')}</li>
                    <li>{t('welcome.micStep3')}</li>
                  </ul>
                 </div>

                 <p className="text-sm mt-4 text-center">{t('welcome.history')}</p>
               </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message}
                    onExportPDF={handleExport}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </ScrollArea>
          
          {/* Input Area */}
          <div className="sticky bottom-0 py-4 bg-background/95 backdrop-blur-sm border-t border-border/50 flex-shrink-0">
            <ChatInput onSend={handleSend} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;