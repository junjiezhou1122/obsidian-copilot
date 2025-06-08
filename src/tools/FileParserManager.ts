import { ProjectConfig } from "@/aiParams";
import { PDFCache } from "@/cache/pdfCache";
import { ProjectContextCache } from "@/cache/projectContextCache";
import { logError, logInfo } from "@/logger";
import { TFile, Vault } from "obsidian";
import { CanvasLoader } from "./CanvasLoader";
import { LocalPDFParser } from "./LocalPDFParser";
import { SelectivePDFParser, PDFProcessingOptions } from "./SelectivePDFParser";

interface FileParser {
  supportedExtensions: string[];
  parseFile: (file: TFile, vault: Vault, options?: any) => Promise<string>;
}

export class MarkdownParser implements FileParser {
  supportedExtensions = ["md"];

  async parseFile(file: TFile, vault: Vault, options?: any): Promise<string> {
    return await vault.read(file);
  }
}

export class PDFParser implements FileParser {
  supportedExtensions = ["pdf"];
  private pdfCache: PDFCache;

  constructor() {
    this.pdfCache = PDFCache.getInstance();
  }

  async parseFile(file: TFile, vault: Vault, options?: PDFProcessingOptions): Promise<string> {
    try {
      logInfo("Parsing PDF file locally:", file.path, options);

      // Create cache key including options for selective processing
      const cacheKey = this.getCacheKeyWithOptions(file, options);
      const cachedResponse = await this.pdfCache.getWithKey(cacheKey);

      if (cachedResponse) {
        logInfo("Using cached PDF content for:", file.path);
        return cachedResponse.response;
      }

      // Check file size and apply smart defaults if no options provided
      const fileSize = file.stat.size;
      const finalOptions = this.getProcessingOptions(fileSize, options);

      // Read the file content and process with selective parsing
      const binaryContent = await vault.readBinary(file);

      // Use selective parser if options are provided, otherwise fall back to original
      const extractedText =
        finalOptions && Object.keys(finalOptions).length > 0
          ? await SelectivePDFParser.extractTextFromPDF(binaryContent, finalOptions)
          : await LocalPDFParser.extractTextFromPDF(binaryContent);

      // Create a response object compatible with cache
      const response = {
        response: extractedText,
        elapsed_time_ms: 0,
        options: finalOptions,
      };

      // Cache the result
      await this.pdfCache.setWithKey(cacheKey, response);

      return extractedText;
    } catch (error) {
      logError(`Error extracting content from PDF ${file.path}:`, error);
      return `[Error: Could not extract content from PDF ${file.basename}. ${error.message}]`;
    }
  }

  private getCacheKeyWithOptions(file: TFile, options?: PDFProcessingOptions): string {
    const baseKey = `${file.path}:${file.stat.size}:${file.stat.mtime}`;
    if (!options || Object.keys(options).length === 0) {
      return baseKey;
    }
    const optionsKey = JSON.stringify(options);
    return `${baseKey}:${optionsKey}`;
  }

  private getProcessingOptions(
    fileSize: number,
    userOptions?: PDFProcessingOptions
  ): PDFProcessingOptions {
    const sizeMB = fileSize / (1024 * 1024);

    // Auto-adjust based on file size if no user options provided
    if (!userOptions || Object.keys(userOptions).length === 0) {
      if (sizeMB > 50) {
        // Large files (>50MB)
        logInfo(`Large PDF detected (${sizeMB.toFixed(1)}MB), applying smart limits`);
        return {
          maxPages: 20,
          maxCharacters: 50000,
        };
      } else if (sizeMB > 10) {
        // Medium files (>10MB)
        logInfo(`Medium PDF detected (${sizeMB.toFixed(1)}MB), applying moderate limits`);
        return {
          maxPages: 50,
          maxCharacters: 100000,
        };
      }
      // Small files - no limits
      return {};
    }

    return userOptions;
  }

  async clearCache(): Promise<void> {
    logInfo("Clearing PDF cache");
    await this.pdfCache.clear();
  }
}

export class CanvasParser implements FileParser {
  supportedExtensions = ["canvas"];

  async parseFile(file: TFile, vault: Vault, options?: any): Promise<string> {
    try {
      logInfo("Parsing Canvas file:", file.path);
      const canvasLoader = new CanvasLoader(vault);
      const canvasData = await canvasLoader.load(file);

      // Use the specialized buildPrompt method to create LLM-friendly format
      return canvasLoader.buildPrompt(canvasData);
    } catch (error) {
      logError(`Error parsing Canvas file ${file.path}:`, error);
      return `[Error: Could not parse Canvas file ${file.basename}]`;
    }
  }
}

export class Docs4LLMParser implements FileParser {
  // Support only PDF files for local processing
  supportedExtensions = ["pdf"];
  private projectContextCache: ProjectContextCache;
  private currentProject: ProjectConfig | null;

  constructor(project: ProjectConfig | null = null) {
    this.projectContextCache = ProjectContextCache.getInstance();
    this.currentProject = project;
  }

  async parseFile(file: TFile, vault: Vault, options?: PDFProcessingOptions): Promise<string> {
    try {
      logInfo(
        `[Docs4LLMParser] Project ${this.currentProject?.name}: Parsing PDF file locally: ${file.path}`
      );

      if (!this.currentProject) {
        logError("[Docs4LLMParser] No project context for parsing file: ", file.path);
        throw new Error("No project context provided for file parsing");
      }

      // Include options in cache key for project mode too
      const cacheKey =
        options && Object.keys(options).length > 0
          ? `${file.path}:${JSON.stringify(options)}`
          : file.path;

      const cachedContent = await this.projectContextCache.getFileContext(
        this.currentProject,
        cacheKey
      );
      if (cachedContent) {
        logInfo(
          `[Docs4LLMParser] Project ${this.currentProject.name}: Using cached content for: ${file.path}`
        );
        return cachedContent;
      }

      logInfo(
        `[Docs4LLMParser] Project ${this.currentProject.name}: Cache miss for: ${file.path}. Processing locally.`
      );

      const binaryContent = await vault.readBinary(file);

      // Use selective parser if options are provided
      const localText =
        options && Object.keys(options).length > 0
          ? await SelectivePDFParser.extractTextFromPDF(binaryContent, options)
          : await LocalPDFParser.extractTextFromPDF(binaryContent);

      // Cache the converted content
      await this.projectContextCache.setFileContext(this.currentProject, cacheKey, localText);

      logInfo(
        `[Docs4LLMParser] Project ${this.currentProject.name}: Successfully processed and cached: ${file.path}`
      );
      return localText;
    } catch (error) {
      logError(
        `[Docs4LLMParser] Project ${this.currentProject?.name}: Error processing file ${file.path}:`,
        error
      );

      return `[Error: Could not extract content from ${file.basename}]`;
    }
  }

  async clearCache(): Promise<void> {
    // This method is no longer needed as cache clearing is handled at the project level
    logInfo("Cache clearing is now handled at the project level");
  }
}

// Future parsers can be added like this:
/*
class DocxParser implements FileParser {
  supportedExtensions = ["docx", "doc"];

  async parseFile(file: TFile, vault: Vault): Promise<string> {
    // Implementation for Word documents
  }
}
*/

export class FileParserManager {
  private parsers: Map<string, FileParser> = new Map();
  private isProjectMode: boolean;
  private currentProject: ProjectConfig | null;

  constructor(vault: Vault, isProjectMode: boolean = false, project: ProjectConfig | null = null) {
    this.isProjectMode = isProjectMode;
    this.currentProject = project;

    // Register parsers
    this.registerParser(new MarkdownParser());

    // In project mode, use Docs4LLMParser for PDFs
    if (isProjectMode) {
      this.registerParser(new Docs4LLMParser(project));
    }

    // Always register PDFParser for non-project mode
    if (!isProjectMode) {
      this.registerParser(new PDFParser());
    }

    this.registerParser(new CanvasParser());
  }

  registerParser(parser: FileParser) {
    for (const ext of parser.supportedExtensions) {
      this.parsers.set(ext, parser);
    }
  }

  async parseFile(file: TFile, vault: Vault, options?: any): Promise<string> {
    const parser = this.parsers.get(file.extension);
    if (!parser) {
      throw new Error(`No parser found for file type: ${file.extension}`);
    }
    return await parser.parseFile(file, vault, options);
  }

  supportsExtension(extension: string): boolean {
    return this.parsers.has(extension);
  }

  async clearPDFCache(): Promise<void> {
    const pdfParser = this.parsers.get("pdf");
    if (pdfParser instanceof PDFParser) {
      await pdfParser.clearCache();
    }
  }
}
