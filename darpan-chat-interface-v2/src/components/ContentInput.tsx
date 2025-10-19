import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Link as LinkIcon, Image, Loader2 } from "lucide-react";

interface ContentInputProps {
  onAnalyze: (content: string, type: 'text' | 'url' | 'image') => void;
  isLoading: boolean;
}

export const ContentInput = ({ onAnalyze, isLoading }: ContentInputProps) => {
  const [textContent, setTextContent] = useState("");
  const [urlContent, setUrlContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleSubmit = (type: 'text' | 'url' | 'image') => {
    if (type === 'text' && textContent.trim()) {
      onAnalyze(textContent, type);
    } else if (type === 'url' && urlContent.trim()) {
      onAnalyze(urlContent, type);
    } else if (type === 'image' && imageFile) {
      // Convert file to base64 for analysis
      const reader = new FileReader();
      reader.onloadend = () => {
        onAnalyze(reader.result as string, type);
      };
      reader.readAsDataURL(imageFile);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto p-6 sm:p-8 bg-gradient-card shadow-elegant border-primary/10">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center bg-gradient-primary bg-clip-text text-transparent">
        What would you like to verify?
      </h2>
      
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="text" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Link</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Image</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="text" className="space-y-4">
          <Textarea
            placeholder="Paste any text content you want to verify..."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="min-h-[200px] resize-none border-primary/20 focus:border-primary"
          />
          <Button 
            onClick={() => handleSubmit('text')}
            disabled={!textContent.trim() || isLoading}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Text'
            )}
          </Button>
        </TabsContent>
        
        <TabsContent value="url" className="space-y-4">
          <Input
            type="url"
            placeholder="https://example.com/article"
            value={urlContent}
            onChange={(e) => setUrlContent(e.target.value)}
            className="border-primary/20 focus:border-primary"
          />
          <Button 
            onClick={() => handleSubmit('url')}
            disabled={!urlContent.trim() || isLoading}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Link'
            )}
          </Button>
        </TabsContent>
        
        <TabsContent value="image" className="space-y-4">
          <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center hover:border-primary/40 transition-colors">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="hidden"
              id="image-upload"
            />
            <label 
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Image className="w-12 h-12 text-primary" />
              <span className="text-sm text-muted-foreground">
                {imageFile ? imageFile.name : 'Click to upload an image'}
              </span>
            </label>
          </div>
          <Button 
            onClick={() => handleSubmit('image')}
            disabled={!imageFile || isLoading}
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Image'
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
