  import { Card } from "@/components/ui/card";
  import { Progress } from "@/components/ui/progress";
  import { Badge } from "@/components/ui/badge";
  import { CheckCircle2, AlertTriangle, XCircle, Shield } from "lucide-react";

  interface AnalysisResultProps {
    score: number;
    analysis: string;
    factors: Array<{ label: string; value: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
  }

  export const AnalysisResult = ({ score, analysis, factors }: AnalysisResultProps) => {
    const getScoreColor = (score: number) => {
      if (score >= 70) return 'text-success';
      if (score >= 40) return 'text-warning';
      return 'text-destructive';
    };

    const getScoreIcon = (score: number) => {
      if (score >= 70) return <CheckCircle2 className="w-6 h-6" />;
      if (score >= 40) return <AlertTriangle className="w-6 h-6" />;
      return <XCircle className="w-6 h-6" />;
    };

    const getScoreLabel = (score: number) => {
      if (score >= 70) return 'Trustworthy';
      if (score >= 40) return 'Questionable';
      return 'Not Trustworthy';
    };

    const getSentimentColor = (sentiment: string) => {
      if (sentiment === 'positive') return 'bg-success/10 text-success border-success/20';
      if (sentiment === 'negative') return 'bg-destructive/10 text-destructive border-destructive/20';
      return 'bg-muted text-muted-foreground border-border';
    };

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Card className="p-8 bg-gradient-card shadow-elegant border-primary/10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-primary" />
            <h2 className="text-2xl font-bold">Trust Analysis</h2>
          </div>
          
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className={`flex items-center gap-3 ${getScoreColor(score)}`}>
              {getScoreIcon(score)}
              <span className="text-5xl font-bold">{score}</span>
              <span className="text-2xl font-medium">/100</span>
            </div>
            <Badge 
              variant="outline" 
              className={`text-lg px-4 py-1 ${getSentimentColor(score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative')}`}
            >
              {getScoreLabel(score)}
            </Badge>
            <Progress value={score} className="w-full h-3" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Analysis Summary</h3>
            <p className="text-muted-foreground leading-relaxed">{analysis}</p>
          </div>
        </Card>

        {factors.length > 0 && (
          <Card className="p-8 bg-gradient-card shadow-elegant border-primary/10">
            <h3 className="text-xl font-semibold mb-6">Key Factors</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {factors.map((factor, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-sm">{factor.label}</span>
                    <Badge 
                      variant="outline"
                      className={getSentimentColor(factor.sentiment)}
                    >
                      {factor.sentiment}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{factor.value}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };
