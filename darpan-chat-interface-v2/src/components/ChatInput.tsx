// src/components/ChatInput.tsx

import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Mic, Image as ImageIcon, X, MicOff } from "lucide-react";

// Check for browser support just once
const isSpeechRecognitionSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
if (!isSpeechRecognitionSupported) {
  console.error("Speech Recognition not supported by this browser.");
}

interface ChatInputProps {
  // --- *** Updated onSend signature to include imagePreviewUrl *** ---
  onSend: (text: string, file: File | null, imagePreviewUrl: string | null) => void;
  // -----------------------------------------------------------------
  isLoading: boolean;
}

export const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
  const [inputContent, setInputContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null); // This holds the base64 URL for preview
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // --- Voice Input Logic (No changes needed here) ---
  useEffect(() => {
    if (!isSpeechRecognitionSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputContent(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
     recognition.onend = () => setIsListening(false);
    return () => { recognitionRef.current?.abort(); };
  }, []);

  const handleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try { recognitionRef.current.start(); }
      catch (error) { console.error("Error starting recognition:", error); setIsListening(false); }
    }
  };
  // --- End Voice Input Logic ---

  // --- Image Handling (No changes needed here) ---
  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (file && file.type.startsWith('image/')) {
       setImageFile(file);
       const reader = new FileReader();
       reader.onloadend = () => { setImagePreview(reader.result as string); }; // Store preview URL
       reader.readAsDataURL(file);
     } else { clearImage(); }
      if(fileInputRef.current) { fileInputRef.current.value = ""; }
  };

  const clearImage = () => {
     setImagePreview(null);
     setImageFile(null);
     if (fileInputRef.current) { fileInputRef.current.value = ""; }
  };
  // --- End Image Handling ---

  // --- *** CORRECTED handleSubmit *** ---
  const handleSubmit = () => {
    const trimmedContent = inputContent.trim();
    if (isLoading || (!trimmedContent && !imageFile)) { return; }
    // Pass the imagePreview state variable as the third argument
    onSend(trimmedContent, imageFile, imagePreview);
    setInputContent('');
    clearImage();
  };
  // --- *** END CORRECTION *** ---

  const handleKeyDown = (e: React.KeyboardEvent) => {
     if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-elegant p-3">
      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" style={{ display: 'none' }} />

      {/* Image Preview Area */}
      {imagePreview && (
          <div className="relative mb-2 w-24 h-24 border border-border/50 rounded-md overflow-hidden">
              <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 bg-background/50 hover:bg-destructive/80 hover:text-destructive-foreground rounded-full p-1" onClick={clearImage} disabled={isLoading} title="Remove image"> <X className="w-4 h-4" /> </Button>
          </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Type text, paste URL, attach an image, or use mic..."
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[48px] max-h-[120px] bg-input border-border/50 focus:border-primary resize-none pr-24"
            disabled={isLoading}
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* Image Upload Button */}
            <Button size="icon" variant="ghost" className={`h-8 w-8 hover:bg-primary/10 hover:text-primary p-1 ${imageFile ? 'text-primary' : ''}`} onClick={() => fileInputRef.current?.click()} disabled={isLoading} type="button" title="Attach image"> <ImageIcon className="w-4 h-4" /> </Button>

            {/* Mic Button */}
            {isSpeechRecognitionSupported ? (
              <Button size="icon" variant="ghost" className={`h-8 w-8 hover:bg-primary/10 p-1 ${isListening ? 'text-red-500 animate-pulse' : 'hover:text-primary'}`} onClick={handleListen} disabled={isLoading} type="button" title={isListening ? "Stop listening" : "Start voice input"}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            ) : ( <Button size="icon" variant="ghost" className="h-8 w-8 opacity-30 cursor-not-allowed p-1" disabled title="Voice input not supported"> <Mic className="w-4 h-4" /> </Button> )}
          </div>
        </div>

        {/* Send Button */}
        <Button onClick={handleSubmit} disabled={isLoading || (!inputContent.trim() && !imageFile)} className="h-12 px-4 bg-gradient-primary hover:shadow-glow transition-all">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" /> }
        </Button>
      </div>
    </Card>
  );
};