import { Shield, Sparkles, Zap, Lock } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative py-12 px-4 overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="relative">
            <Shield className="w-10 h-10 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Darpan
          </h1>
        </div>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Your AI-powered trust companion. Verify any content instantly with advanced credibility analysis.
        </p>
        
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          {[
            { icon: Sparkles, text: "AI-Powered" },
            { icon: Zap, text: "Instant Analysis" },
            { icon: Lock, text: "Secure & Private" }
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-muted-foreground">
              <feature.icon className="w-4 h-4 text-primary" />
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
