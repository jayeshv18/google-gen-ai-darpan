import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Image, Loader2, X, Mic } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string, type: 'text' | 'url' | 'image') => void;
  isLoading: boolean;
}

export const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
  const [inputContent, setInputContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (imagePreview) {
      onSend(imagePreview, 'image');
      clearImage();
    } else if (inputContent.trim()) {
      const isUrl = inputContent.trim().match(/^(https?:\/\/|www\.)/i);
      onSend(inputContent, isUrl ? 'url' : 'text');
      setInputContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-elegant p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        disabled={isLoading}
      />
      
      {imagePreview && (
        <div className="relative mb-3">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="w-full max-h-[120px] object-contain rounded-lg border border-border/50"
          />
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={clearImage}
            disabled={isLoading}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Type text or paste a URL to analyze..."
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[48px] max-h-[120px] bg-input border-border/50 focus:border-primary resize-none pr-20"
            disabled={isLoading}
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              type="button"
            >
              <Image className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary opacity-50 cursor-not-allowed"
              disabled
              type="button"
              title="Audio input coming soon"
            >
              <Mic className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={isLoading || (!inputContent.trim() && !imagePreview)}
          className="h-12 px-4 bg-gradient-primary hover:shadow-glow transition-all"
          size="icon"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </Card>
  );
};
