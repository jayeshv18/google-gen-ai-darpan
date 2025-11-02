// src/components/ChatMessage.tsx

import { Message, Analysis } from "@/pages/index"; 
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, XCircle, ThumbsUp, ThumbsDown, Share2, User,
  Volume2, // Speaker icon
  Square,  // Stop icon
  ShieldAlert // Report icon
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { LearnMoreDialog } from './LearnMoreDialog';

const isSpeechSynthesisSupported = !!window.speechSynthesis;

interface ChatMessageProps {
  message: Message;
  onExportPDF: (analysis: Analysis | null) => void;
}

const getFactorSentimentStyles = (score: number) => {
  if (score >= 75)
    return { badge: "bg-green-900/50 text-green-300 border-green-700/50" };
  if (score >= 40)
    return { badge: "bg-zinc-800 text-zinc-400 border-zinc-700" };
  return { badge: "bg-red-900/50 text-red-300 border-red-700/50" };
};

export const ChatMessage = ({ message, onExportPDF }: ChatMessageProps) => {
  const { role, content, imageUrl, analysis } = message;
  const isUser = role === "user";
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getStatus = (score: number) => {
    if (score >= 75)
      return {
        text: t("status.trustworthy"),
        colorClass: "text-green-400",
        icon: CheckCircle2,
        progressClass: "bg-green-500",
        stanceText: t("status.stanceHigh"),
        stanceIcon: CheckCircle2,
        stanceColor: "text-green-500"
      };
    if (score >= 40)
      return {
        text: t("status.questionable"),
        colorClass: "text-yellow-400",
        icon: AlertTriangle,
        progressClass: "bg-yellow-500",
        stanceText: t("status.stanceMedium"),
        stanceIcon: AlertTriangle,
        stanceColor: "text-yellow-500"
      };
    return {
      text: t("status.notTrustworthy"),
      colorClass: "text-red-400",
      icon: XCircle,
      progressClass: "bg-red-500",
      stanceText: t("status.stanceLow"),
      stanceIcon: XCircle,
      stanceColor: "text-red-500"
    };
  };

  // Clean up TTS when unmounting
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (!isSpeechSynthesisSupported || !analysis?.summary) {
      toast({ title: t("toast.speechNotAvailable"), variant: "destructive" });
      return;
    }

    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(analysis.summary);
      utterance.lang =
        i18n.language.split("-")[0] === "hi" ? "hi-IN" : "en-US";
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        toast({ title: t("toast.speechError"), variant: "destructive" });
        setIsSpeaking(false);
      };
      setTimeout(() => {
        if (!window.speechSynthesis.speaking)
          window.speechSynthesis.speak(utterance);
      }, 50);
    }
  };

  const renderContent = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const contentWithLinks =
      content?.replace(
        urlRegex,
        (url) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline break-all">${url}</a>`
      ) || "";
    return contentWithLinks.replace(/\n/g, "<br />");
  };

  const handleFeedback = (isPositive: boolean) => {
    toast({
      title: t("toast.feedbackSubmitted"),
      description: t("toast.feedbackDesc")
    });
  };

  const handleShare = () => {
    if (analysis) {
      const status = getStatus(analysis.score);
      const shareText = `${t("report.shareTextPrefix")}\n${t(
        "report.shareTextScore"
      )}: ${analysis.score}/100 (${status.text})\n${t(
        "report.shareTextSummary"
      )}: ${analysis.summary}`;
      navigator.clipboard
        .writeText(shareText)
        .then(() => toast({ title: t("toast.copied") }))
        .catch(() =>
          toast({ title: t("toast.copyFailed"), variant: "destructive" })
        );
    }
  };

  const handleReportClick = () => {
    if (!analysis) return;
    onExportPDF(analysis);

    const authorityEmail = "contact@cybercrime.gov.in";
    const subject = t("report.mailSubject", {
      caseId: analysis.caseId || analysis.timestamp
    });
    const body = t("report.mailBody", {
      caseId: analysis.caseId || analysis.timestamp,
      score: analysis.score,
      summary: analysis.summary
    });

    const mailtoLink = `mailto:${authorityEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, "_blank");
  };

  // 🧍 USER MESSAGE
  if (isUser) {
    return (
      // --- FIX: Added responsive padding and width ---
      <div className="flex items-start gap-3 justify-end mb-5 animate-slide-in px-2 sm:px-0">
        <div className="max-w-[90%] sm:max-w-xl md:max-w-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-3 sm:p-4 rounded-lg rounded-tr-none shadow-md break-words">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="User upload"
              className="max-w-full h-auto max-h-48 rounded-md mb-2 border border-indigo-300/50"
            />
          )}
          {content && (
            <p
              // --- FIX: Added responsive text size ---
              className="text-sm sm:text-base"
              dangerouslySetInnerHTML={{ __html: renderContent() }}
            />
          )}
        </div>
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-indigo-500">
          <AvatarFallback className="bg-zinc-700 text-zinc-300">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // 🤖 ASSISTANT MESSAGE
  if (role === "assistant" && analysis) {
    const status = getStatus(analysis.score);
    const StanceIcon = status.stanceIcon;

    return (
      // --- FIX: Added responsive padding ---
      <div className="flex items-start gap-3 mb-6 animate-slide-in px-2 sm:px-0">
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-purple-500">
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
            <CheckCircle2 size={18} />
          </AvatarFallback>
        </Avatar>

        {/* --- FIX: Added responsive padding and width --- */}
        <div className="w-full max-w-[90%] sm:max-w-xl md:max-w-2xl bg-zinc-800 border border-zinc-700 p-3 sm:p-4 rounded-lg rounded-tl-none shadow-lg">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            {/* --- FIX: Added responsive text size --- */}
            <h3 className="font-bold text-white text-sm sm:text-md">
              {t("report.title")}
            </h3>
            {isSpeechSynthesisSupported && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 text-zinc-400 hover:bg-zinc-700 ${
                  isSpeaking
                    ? "text-indigo-400 animate-pulse"
                    : "hover:text-indigo-400"
                }`}
                onClick={handleSpeak}
                title={
                  isSpeaking ? t("report.ttsStop") : t("report.ttsRead")
                }
              >
                {isSpeaking ? <Square size={14} /> : <Volume2 size={16} />}
              </Button>
            )}
          </div>

          {/* Score */}
          {/* --- FIX: Added responsive padding --- */}
          <div className="bg-zinc-900/50 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4">
            <div className="flex items-center justify-between mb-2">
              {/* --- FIX: Added responsive text size --- */}
              <span
                className={`text-xs sm:text-sm font-semibold ${status.colorClass}`}
              >
                {status.text}
              </span>
              {/* --- FIX: Added responsive text size --- */}
              <span
                className={`font-bold text-xl sm:text-2xl ${status.colorClass}`}
              >
                {analysis.score} / 100
              </span>
            </div>
            <Progress
              value={analysis.score}
              className={`h-2 [&>div]:${status.progressClass}`}
            />
            {/* --- FIX: Added responsive text size --- */}
            <div
              className={`flex items-center gap-2 mt-3 text-xs sm:text-sm font-medium ${status.stanceColor}`}
            >
              <StanceIcon size={14} />
              <span>
                {t("report.stancePrefix")}: {status.stanceText}
              </span>
            </div>
          </div>

          {/* Summary */}
          {/* --- FIX: Added responsive margin --- */}
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">
              {t("report.analysisSummary")}
            </h4>
            {/* --- FIX: Added responsive text size --- */}
            <p className="text-sm sm:text-base text-zinc-300 whitespace-pre-wrap break-words">
              {analysis.summary}
            </p>
          </div>

          {/* Factors */}
          {/* --- FIX: Added responsive padding --- */}
          <div className="border-t border-zinc-700 pt-3 sm:pt-4">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
              {t("report.contextTitle")}
            </h4>
            {/* --- FIX: THIS IS THE KEY RESPONSIVE FIX --- */}
            {/* Stacks to 1 col on mobile, 2 on small screens, 3 on large */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {analysis.factors.map((factor, index) => {
                const sentimentStyles = getFactorSentimentStyles(factor.score);
                return (
                  <div
                    key={index}
                    className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-700/50 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-1">
                      <span className="truncate">{factor.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0.5 border-none capitalize ${sentimentStyles.badge}`}
                      >
                        {t(
                          `sentiment.${
                            factor.score >= 75
                              ? "positive"
                              : factor.score < 40
                              ? "negative"
                              : "neutral"
                          }`
                        )}
                      </Badge>
                    </div>
                    {/* --- FIX: Added responsive text size --- */}
                    <p className="text-sm text-zinc-200 break-words">
                      {factor.analysis}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Text Forensics */}
          {analysis.text_forensics && !analysis.text_forensics.error && (
            // --- FIX: Added responsive text size ---
            <div className="mt-4 pt-4 border-t border-zinc-700 text-sm">
              <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                {t("report.textForensicsTitle")}
              </h4>
              {/* --- FIX: Stacks to 1 col on mobile --- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-zinc-400">{t("report.tfAiLikelihood")}</span>
                <span className="text-white font-medium">
                  {analysis.text_forensics.ai_likelihood_heuristic?.toFixed(2)}
                </span>
                <span className="text-zinc-400">{t("report.tfReadability")}</span>
                <span className="text-white font-medium">
                  {analysis.text_forensics.readability_score_flesch?.toFixed(1)}
                </span>
                <span className="text-zinc-400">{t("report.tfSentiment")}</span>
                <span className="text-white font-medium">
                  {analysis.text_forensics.sentiment_polarity?.toFixed(2)}
                </span>
                <span className="text-zinc-400">{t("report.tfSubjectivity")}</span>
                <span className="text-white font-medium">
                  {analysis.text_forensics.subjectivity?.toFixed(2)}
                </span>
                <span className="text-zinc-400">{t("report.tfDiversity")}</span>
                <span className="text-white font-medium">
                  {analysis.text_forensics.lexical_diversity_ttr?.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          {/* --- FIX: Added responsive text size and flex-wrap --- */}
          <div className="mt-4 pt-3 border-t border-zinc-700 flex flex-wrap gap-2 justify-end items-center text-sm">
            <span className="text-xs text-zinc-500 mr-auto">
              {t("report.feedbackPrompt")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-green-500 hover:bg-zinc-700"
              onClick={() => handleFeedback(true)}
              title={t('report.feedbackHelpful')}
            >
              <ThumbsUp size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-zinc-700"
              onClick={() => handleFeedback(false)}
              title={t('report.feedbackNotHelpful')}
            >
              <ThumbsDown size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-700"
              onClick={handleShare}
              title={t('report.feedbackCopy')}
            >
              <Share2 size={16} />
            </Button>
            {analysis.score < 40 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/50"
                onClick={handleReportClick}
                title={t('report.feedbackReport')}
              >
                <ShieldAlert size={16} />
              </Button>
            )}
          </div>

          {/* Learn More */}
          {analysis.report_payload && <LearnMoreDialog analysis={analysis} />}
        </div>
      </div>
    );
  }

  // 🗨️ SIMPLE ASSISTANT TEXT
  if (role === "assistant" && content) {
    return (
      // --- FIX: Added responsive padding and width ---
      <div className="flex items-start gap-3 mb-5 animate-slide-in px-2 sm:px-0">
        <Avatar className="w-8 h-8 flex-shrink-0 border-2 border-purple-500">
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
            <CheckCircle2 size={18} />
          </AvatarFallback>
        </Avatar>
        {/* --- FIX: Added responsive padding and width --- */}
        <div className="max-w-[90%] sm:max-w-xl bg-zinc-800 border border-zinc-700 p-3 sm:p-4 rounded-lg rounded-tl-none shadow-lg">
          {/* --- FIX: Added responsive text size --- */}
          <p className="text-sm sm:text-base text-zinc-300 whitespace-pre-wrap break-words">
            {t(content)}
          </p>
        </div>
      </div>
    );
  }

  return null;
};