// src/components/ChatInput.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Loader2, Sparkles, Mic, MicOff } from 'lucide-react'; // Import Mic and MicOff
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

// --- Check for SpeechRecognition API ---
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

interface ChatInputProps {
  onSend: (content: string, file: File | null, imagePreviewUrl: string | null) => void;
  isLoading: boolean;
}

const thinkingMessages = [
  "thinking.analyzing",
  "thinking.forensics",
  "thinking.provenance",
  "thinking.ml",
  "thinking.synthesizing"
];

export const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  
  // --- NEW: MIC & THOUGHTFUL LOADING STATES ---
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null); // SpeechRecognition instance
  const [thinkingMessage, setThinkingMessage] = useState(thinkingMessages[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Thoughtful Loading Effect
  useEffect(() => {
    if (isLoading) {
      setMessageIndex(0);
      setThinkingMessage(thinkingMessages[0]);
      intervalRef.current = setInterval(() => {
        setMessageIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % thinkingMessages.length;
          setThinkingMessage(thinkingMessages[nextIndex]);
          return nextIndex;
        });
      }, 3000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLoading]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ title: t('toast.fileTooLarge'), description: t('toast.fileTooLargeDesc'), variant: 'destructive' });
        return;
      }
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(previewUrl);
    }
  };

  const handleTriggerFile = () => {
    fileInputRef.current?.click();
  };

  // --- NEW: FUNCTIONAL MICROPHONE HANDLER ---
  const handleMicClick = () => {
    if (!isSpeechRecognitionSupported) {
      toast({ title: t('toast.micNotSupported'), description: t('toast.micNotSupportedDesc'), variant: 'destructive' });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = i18n.language; // Use current language
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      toast({ title: t('toast.listening'), description: t('toast.micListeningDesc') });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      toast({ title: t('toast.micError'), description: event.error, variant: 'destructive' });
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join('');
      
      setContent(transcript); // Update textarea with live transcript
    };

    recognition.start();
  };
  // --- END MIC HANDLER ---

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!content.trim() && !file) return;
    onSend(content, file, imagePreviewUrl);
    setContent('');
    setFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative"> 
      <form onSubmit={handleSubmit} className="flex items-start gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
        />
        <Button
          type="button"
          variant={file ? "secondary" : "ghost"}
          size="icon"
          onClick={handleTriggerFile}
          disabled={isLoading}
          className={`flex-shrink-0 ${file ? 'border-2 border-indigo-500' : ''}`}
          title={t('chat.attachImage')}
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <div className="flex-1 relative">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            className="pr-24 min-h-[52px] resize-none" // Increased padding for 2 buttons
            disabled={isLoading}
          />
          {/* --- FIX: Mic Button --- */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isLoading}
            onClick={handleMicClick} 
            className={`absolute right-[52px] top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground ${isListening ? 'text-red-500 animate-pulse' : ''}`}
            title="Voice input"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          {/* --- END FIX --- */}
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || (!content.trim() && !file)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            {isLoading ? (
              <div className="flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
          {imagePreviewUrl && (
            <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-background border rounded-lg shadow-lg">
              <img src={imagePreviewUrl} alt="Preview" className="h-24 w-auto rounded" />
            </div>
          )}
        </div>
      </form>
      
      {isLoading && (
        <div className="absolute bottom-full left-0 right-0 mb-2 flex justify-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-background p-2 rounded-lg border shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="animate-pulse">{t(thinkingMessage)}</p>
          </div>
        </div>
      )}
    </div>
  );
};