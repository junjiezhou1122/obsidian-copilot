import { Plus, X, Settings } from "lucide-react";
import { TFile } from "obsidian";
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PDFProcessingModal } from "@/components/modals/PDFProcessingModal";
import { PDFProcessingOptions } from "@/tools/SelectivePDFParser";

interface ChatContextMenuProps {
  activeNote: TFile | null;
  contextNotes: TFile[];
  contextUrls: string[];
  onAddContext: () => void;
  onRemoveContext: (path: string) => void;
  onRemoveUrl: (url: string) => void;
  onProcessPDF?: (file: TFile, options: PDFProcessingOptions) => void;
}

function ContextNote({
  note,
  isActive = false,
  onRemoveContext,
  onProcessPDF,
}: {
  note: TFile;
  isActive: boolean;
  onRemoveContext: (path: string) => void;
  onProcessPDF?: (file: TFile, options: PDFProcessingOptions) => void;
}) {
  const isPDF = note.extension === "pdf";

  const handlePDFOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPDF && onProcessPDF) {
      const modal = new PDFProcessingModal(app, note.basename, (options) =>
        onProcessPDF(note, options)
      );
      modal.open();
    }
  };

  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-2 tw-pr-0.5 tw-text-xs">
      <div className="tw-flex tw-items-center tw-gap-1">
        <span className="tw-max-w-40 tw-truncate">{note.basename}</span>
        {isActive && <span className="tw-text-xs tw-text-faint">Current</span>}
        {isPDF && <span className="tw-text-xs tw-text-faint">PDF</span>}
      </div>
      <div className="tw-flex tw-items-center tw-gap-0.5">
        {isPDF && onProcessPDF && (
          <Button
            variant="ghost2"
            size="fit"
            onClick={handlePDFOptions}
            aria-label="PDF processing options"
            title="Configure how this PDF is processed"
          >
            <Settings className="tw-size-3" />
          </Button>
        )}
        <Button
          variant="ghost2"
          size="fit"
          onClick={() => onRemoveContext(note.path)}
          aria-label="Remove from context"
        >
          <X className="tw-size-4" />
        </Button>
      </div>
    </Badge>
  );
}

function ContextUrl({ url, onRemoveUrl }: { url: string; onRemoveUrl: (url: string) => void }) {
  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-2 tw-pr-0.5 tw-text-xs">
      <div className="tw-flex tw-items-center tw-gap-1">
        <span className="tw-max-w-40 tw-truncate">{url}</span>
        <span className="tw-text-xs tw-text-faint">URL</span>
      </div>
      <Button
        variant="ghost2"
        size="fit"
        onClick={() => onRemoveUrl(url)}
        aria-label="Remove URL from context"
      >
        <X className="tw-size-4" />
      </Button>
    </Badge>
  );
}

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
  activeNote,
  contextNotes,
  contextUrls,
  onAddContext,
  onRemoveContext,
  onRemoveUrl,
  onProcessPDF,
}) => {
  const uniqueNotes = React.useMemo(() => {
    const notesMap = new Map(contextNotes.map((note) => [note.path, note]));

    return Array.from(notesMap.values()).filter((note) => {
      // If the note was added manually, always show it in the list
      if ((note as any).wasAddedManually) {
        return true;
      }

      // For non-manually added notes, show them if they're not the active note
      return !(activeNote && note.path === activeNote.path);
    });
  }, [contextNotes, activeNote]);

  const uniqueUrls = React.useMemo(() => Array.from(new Set(contextUrls)), [contextUrls]);

  const hasContext = uniqueNotes.length > 0 || uniqueUrls.length > 0 || !!activeNote;

  return (
    <div className="tw-flex tw-w-full tw-items-center tw-gap-1">
      <div className="tw-flex tw-h-full tw-items-start">
        <Button
          onClick={onAddContext}
          variant="ghost2"
          size="fit"
          className="tw-ml-1 tw-rounded-sm tw-border tw-border-solid tw-border-border"
        >
          <Plus className="tw-size-4" />
          {!hasContext && <span className="tw-pr-1 tw-text-xs tw-leading-4">Add context</span>}
        </Button>
      </div>
      <div className="tw-flex tw-flex-1 tw-flex-wrap tw-gap-1">
        {activeNote && (
          <ContextNote
            key={activeNote.path}
            note={activeNote}
            isActive={true}
            onRemoveContext={onRemoveContext}
            onProcessPDF={onProcessPDF}
          />
        )}
        {uniqueNotes.map((note) => (
          <ContextNote
            key={note.path}
            note={note}
            isActive={false}
            onRemoveContext={onRemoveContext}
            onProcessPDF={onProcessPDF}
          />
        ))}
        {uniqueUrls.map((url) => (
          <ContextUrl key={url} url={url} onRemoveUrl={onRemoveUrl} />
        ))}
      </div>
    </div>
  );
};
