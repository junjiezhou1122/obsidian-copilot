import { ChainType } from "@/chainFactory";
import { FileParserManager } from "@/tools/FileParserManager";
import { TFile, Vault } from "obsidian";
import { NOTE_CONTEXT_PROMPT_TAG } from "./constants";

export class ContextProcessor {
  private static instance: ContextProcessor;

  private constructor() {}

  static getInstance(): ContextProcessor {
    if (!ContextProcessor.instance) {
      ContextProcessor.instance = new ContextProcessor();
    }
    return ContextProcessor.instance;
  }

  async processEmbeddedPDFs(
    content: string,
    vault: Vault,
    fileParserManager: FileParserManager
  ): Promise<string> {
    // Enhanced regex to capture processing options
    const pdfRegex = /!\[\[(.*?\.pdf)(?:\|([^|\]]+))?\]\]/g;
    const matches = [...content.matchAll(pdfRegex)];

    for (const match of matches) {
      const pdfName = match[1];
      const optionsString = match[2]; // e.g., "pages:1-5" or "search:chapter 1"
      const pdfFile = vault.getAbstractFileByPath(pdfName);

      if (pdfFile instanceof TFile) {
        try {
          // Parse processing options from the link
          const options = this.parseEmbedOptions(optionsString);

          // Use enhanced parser with options
          const pdfContent = await fileParserManager.parseFile(pdfFile, vault, options);

          content = content.replace(
            match[0],
            `\n\nEmbedded PDF (${pdfName})${options && Object.keys(options).length > 0 ? ` [${optionsString}]` : ""}:\n${pdfContent}\n\n`
          );
        } catch (error) {
          console.error(`Error processing embedded PDF ${pdfName}:`, error);
          content = content.replace(
            match[0],
            `\n\nEmbedded PDF (${pdfName}): [Error: Could not process PDF]\n\n`
          );
        }
      }
    }
    return content;
  }

  private parseEmbedOptions(optionsString?: string): any {
    if (!optionsString) return {};

    const options: any = {};

    // Parse different option formats
    // Format: "pages:1-10,search:chapter 1,max:20"
    const parts = optionsString.split(",");

    for (const part of parts) {
      const [key, value] = part.split(":").map((s) => s.trim());

      switch (key.toLowerCase()) {
        case "pages": {
          const pageMatch = value.match(/(\d+)-(\d+)/);
          if (pageMatch) {
            options.pageRange = {
              start: parseInt(pageMatch[1]),
              end: parseInt(pageMatch[2]),
            };
          }
          break;
        }
        case "search":
          options.searchTerms = [value];
          break;
        case "chapter":
        case "chapters":
          options.chapters = [value];
          break;
        case "max":
          options.maxPages = parseInt(value);
          break;
        case "chars":
        case "characters":
          options.maxCharacters = parseInt(value);
          break;
      }
    }

    return options;
  }

  /**
   * Processes context notes, excluding any already handled by custom prompts.
   *
   * @param excludedNotePaths A set of file paths that should be skipped.
   * @param fileParserManager
   * @param vault
   * @param contextNotes
   * @param includeActiveNote
   * @param activeNote
   * @param currentChain
   * @returns The combined content string of the processed context notes.
   */
  async processContextNotes(
    excludedNotePaths: Set<string>,
    fileParserManager: FileParserManager,
    vault: Vault,
    contextNotes: TFile[],
    includeActiveNote: boolean,
    activeNote: TFile | null,
    currentChain: ChainType
  ): Promise<string> {
    let additionalContext = "";

    const processNote = async (note: TFile, prompt_tag: string = NOTE_CONTEXT_PROMPT_TAG) => {
      try {
        // Check if this note was already processed (via custom prompt)
        if (excludedNotePaths.has(note.path)) {
          console.log(`Skipping note ${note.path} as it was included via custom prompt.`);
          return;
        }

        console.log(
          `Processing note: ${note.path}, extension: ${note.extension}, chain: ${currentChain}`
        );

        // 1. Check if the file extension is supported by any parser
        if (!fileParserManager.supportsExtension(note.extension)) {
          console.warn(`Unsupported file type: ${note.extension}`);
          return;
        }

        // All supported file types are now available in all modes

        // 3. If we reach here, parse the file (md, canvas, or other supported type in Plus mode)
        let content = await fileParserManager.parseFile(note, vault);

        // Special handling for embedded PDFs within markdown (now available in all modes)
        if (note.extension === "md") {
          content = await this.processEmbeddedPDFs(content, vault, fileParserManager);
        }

        additionalContext += `\n\n <${prompt_tag}> \n Title: [[${note.basename}]]\nPath: ${note.path}\n\n${content}\n</${prompt_tag}>`;
      } catch (error) {
        console.error(`Error processing file ${note.path}:`, error);
        additionalContext += `\n\n <${prompt_tag}_error> \n Title: [[${note.basename}]]\nPath: ${note.path}\n\n[Error: Could not process file]\n</${prompt_tag}_error>`;
      }
    };

    const includedFilePaths = new Set<string>();

    // Process active note if included
    if (includeActiveNote && activeNote) {
      await processNote(activeNote, "active_note");
      includedFilePaths.add(activeNote.path);
    }

    // Process context notes
    for (const note of contextNotes) {
      if (includedFilePaths.has(note.path)) {
        continue;
      }
      await processNote(note);
      includedFilePaths.add(note.path);
    }

    return additionalContext;
  }

  async hasEmbeddedPDFs(content: string): Promise<boolean> {
    const pdfRegex = /!\[\[(.*?\.pdf)\]\]/g;
    return pdfRegex.test(content);
  }

  async addNoteToContext(
    note: TFile,
    vault: Vault,
    contextNotes: TFile[],
    activeNote: TFile | null,
    setContextNotes: (notes: TFile[] | ((prev: TFile[]) => TFile[])) => void,
    setIncludeActiveNote: (include: boolean) => void
  ): Promise<void> {
    // Only check if the note exists in contextNotes
    if (contextNotes.some((existing) => existing.path === note.path)) {
      return; // Note already exists in context
    }

    // Read the note content
    const content = await vault.read(note);
    const hasEmbeddedPDFs = await this.hasEmbeddedPDFs(content);

    // Set includeActiveNote if it's the active note
    if (activeNote && note.path === activeNote.path) {
      setIncludeActiveNote(true);
    }

    // Add to contextNotes with wasAddedViaReference flag
    setContextNotes((prev: TFile[]) => [
      ...prev,
      Object.assign(note, {
        wasAddedViaReference: true,
        hasEmbeddedPDFs,
      }),
    ]);
  }
}
