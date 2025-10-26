// src/components/HistorySidebar.tsx

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, BarChart2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Message } from '@/pages'; // Import the main Message interface

// Define what a history item looks like
export interface HistoryItem {
  caseId: string;
  fileName: string;
  score: number;
  timestamp: string;
  analysis: Message['analysis']; // Store the *entire* analysis object
}

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelectHistory: (analysis: Message['analysis']) => void; // Function to show old report
}

export const HistorySidebar = ({ history, onSelectHistory }: HistorySidebarProps) => {
  if (history.length === 0) {
    return (
      <aside className="h-full p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Analysis History</h2>
        <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground bg-card p-4 rounded-lg border border-border/50">
          <Clock size={24} className="mb-2" />
          <p className="text-sm">Your past analyses will appear here.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full flex flex-col p-4">
      <h2 className="text-lg font-semibold mb-4 text-white">Analysis History</h2>
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {history.map((item) => (
            <Card
              key={item.caseId}
              className="bg-card hover:bg-muted/50 border-border/50 cursor-pointer transition-colors"
              onClick={() => onSelectHistory(item.analysis)}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">{item.caseId}</span>
                  <Badge 
                    className={`text-xs px-1.5 py-0.5 border-none ${
                      item.score < 40 ? 'bg-red-900/50 text-red-300' : 
                      item.score < 75 ? 'bg-yellow-900/50 text-yellow-300' : 
                      'bg-green-900/50 text-green-300'
                    }`}
                  >
                    <BarChart2 size={10} className="mr-1" /> {item.score}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-white truncate" title={item.fileName}>
                  {item.fileName || 'Text Analysis'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
};