// src/components/LearnMoreDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Analysis } from '@/pages/index'; // Import our main Analysis type
import { Link, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  analysis: Analysis;
}

// Helper component for clean key-value pairs
const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-zinc-100">{value}</p>
    </div>
  );
};

export const LearnMoreDialog = ({ analysis }: Props) => {
  const { t } = useTranslation();
  
  // Get the provenance report from the payload
  const provenance = analysis.report_payload?.provenance_report;

  // Don't render the button at all if there is no provenance data
  if (!provenance) {
    return null;
  }

  const webOrigin = provenance.web_origin;
  const metadata = provenance.metadata;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-zinc-700 border-zinc-600 hover:bg-zinc-600">
          <BookOpen className="w-4 h-4 mr-2" />
          {t('report.learnMore')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">{t('learnMore.title')}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t('learnMore.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Column 1: Web Origin */}
          <div className="space-y-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <h3 className="font-semibold text-lg text-indigo-300">{t('learnMore.webOriginTitle')}</h3>
            <InfoRow label={t('learnMore.bestGuess')} value={webOrigin?.best_guess_label} />

            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('learnMore.firstSeen')}</p>
              {webOrigin?.first_seen_url ? (
                <a
                  href={webOrigin.first_seen_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:underline break-all"
                >
                  {webOrigin.first_seen_url}
                </a>
              ) : (
                <p className="text-sm text-zinc-100">{t('learnMore.notFound')}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('learnMore.matchingPages')}</p>
              <div className="space-y-2 mt-2">
                {webOrigin?.pages_with_matching_images?.length > 0 ? (
                  webOrigin.pages_with_matching_images.map((page: { url: string; title: string }, idx: number) => (
                    <a
                      key={idx}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-sm text-zinc-300 hover:text-indigo-400 group"
                    >
                      <Link className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-500 group-hover:text-indigo-400" />
                      <span className="break-all">{page.title || page.url}</span>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-zinc-100">{t('learnMore.noMatches')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Metadata */}
          <div className="space-y-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <h3 className="font-semibold text-lg text-indigo-300">{t('learnMore.metadataTitle')}</h3>

            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('learnMore.suspiciousTags')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {metadata?.suspicious_tags?.length > 0 ? (
                  metadata.suspicious_tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="destructive">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="bg-zinc-700 text-zinc-300">
                    {t('learnMore.noneFound')}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('learnMore.allTags')}</p>
              {metadata?.has_metadata ? (
                <pre className="mt-2 p-3 bg-black/50 rounded-md text-xs text-zinc-300 overflow-x-auto max-h-60">
                  {JSON.stringify(metadata.all_tags, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-zinc-100">{t('learnMore.noMetadata')}</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};