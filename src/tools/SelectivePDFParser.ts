import { logError, logInfo } from "@/logger";
import * as pdfjsLib from "pdfjs-dist";

export interface PDFProcessingOptions {
  pageRange?: { start: number; end: number };
  maxPages?: number;
  searchTerms?: string[];
  chapters?: string[];
  maxCharacters?: number;
  sectionPattern?: RegExp;
  contextWindow?: number; // Pages around relevant content
  minRelevanceScore?: number;
  extractImages?: boolean;
  preserveStructure?: boolean;
}

export interface PDFSection {
  title: string;
  startPage: number;
  endPage: number;
  content: string;
  confidence: number;
}

export interface PageContent {
  pageNum: number;
  content: string;
  relevance: number;
  sections: TextSection[];
  hasImages: boolean;
  metadata: PageMetadata;
}

export interface TextSection {
  type: "header" | "paragraph" | "list" | "table" | "footer";
  content: string;
  level?: number; // For headers
  position: { x: number; y: number; width: number; height: number };
}

export interface PageMetadata {
  wordCount: number;
  avgWordLength: number;
  hasNumbers: boolean;
  hasReferences: boolean;
  textDensity: number;
  language?: string;
}

export class SelectivePDFParser {
  private static readonly DEFAULT_MAX_PAGES = 50;
  private static readonly DEFAULT_MAX_CHARACTERS = 100000;
  private static readonly DEFAULT_CONTEXT_WINDOW = 2;
  private static readonly DEFAULT_MIN_RELEVANCE = 0.01;

  // Common section patterns for academic papers, books, etc.
  private static readonly SECTION_PATTERNS = [
    /^(?:chapter|section|part)\s+\d+/i,
    /^\d+\.?\s+[A-Z][^.]*$/,
    /^[A-Z][A-Z\s]{2,}$/,
    /^(?:introduction|conclusion|abstract|references|bibliography|appendix)/i,
    /^(?:method|results|discussion|related work|background)/i,
  ];

  static async extractTextFromPDF(
    binaryContent: ArrayBuffer,
    options: PDFProcessingOptions = {}
  ): Promise<string> {
    try {
      logInfo("Starting intelligent PDF text extraction with options:", options);

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(binaryContent),
        verbosity: 0,
      }).promise;

      logInfo(`PDF loaded successfully. Total pages: ${pdf.numPages}`);

      // Enhanced processing strategy
      if (options.chapters?.length) {
        return await this.extractByChapters(pdf, options.chapters, options);
      }

      if (options.searchTerms?.length) {
        return await this.extractByIntelligentSearch(pdf, options.searchTerms, options);
      }

      if (options.pageRange) {
        return await this.extractByPageRange(pdf, options.pageRange, options);
      }

      // Enhanced smart processing
      return await this.intelligentExtraction(pdf, options);
    } catch (error) {
      logError("Error in selective PDF text extraction:", error);
      throw new Error(`Selective PDF parsing failed: ${error.message}`);
    }
  }

  private static async intelligentExtraction(
    pdf: any,
    options: PDFProcessingOptions
  ): Promise<string> {
    const maxPages = options.maxPages || this.DEFAULT_MAX_PAGES;
    const maxChars = options.maxCharacters || this.DEFAULT_MAX_CHARACTERS;

    logInfo(`Intelligent extraction: Processing up to ${maxPages} pages or ${maxChars} characters`);

    // 1. Extract document structure and metadata
    const documentStructure = await this.analyzeDocumentStructure(pdf, options);

    // 2. Identify key sections intelligently
    const keySections = await this.identifyKeySections(pdf, documentStructure, options);

    // 3. Extract content with context preservation
    if (keySections.length > 0) {
      logInfo(`Found ${keySections.length} key sections, using structure-aware extraction`);
      return await this.extractByIntelligentSections(pdf, keySections, options);
    }

    // Fallback to enhanced sequential processing
    return await this.extractWithIntelligentLimits(pdf, maxPages, maxChars, options);
  }

  private static async extractByPageRange(
    pdf: any,
    pageRange: { start: number; end: number },
    options: PDFProcessingOptions = {}
  ): Promise<string> {
    const { start, end } = pageRange;
    const actualEnd = Math.min(end, pdf.numPages);
    const actualStart = Math.max(1, start);

    logInfo(`Extracting pages ${actualStart} to ${actualEnd}`);

    const pages = await this.extractPagesWithStructure(pdf, actualStart, actualEnd, options);
    return this.formatExtractedContent(pages, options);
  }

  private static async extractByIntelligentSearch(
    pdf: any,
    searchTerms: string[],
    options: PDFProcessingOptions
  ): Promise<string> {
    logInfo(`Intelligent search for terms: ${searchTerms.join(", ")}`);

    const maxPages = options.maxPages || this.DEFAULT_MAX_PAGES;
    const contextWindow = options.contextWindow || this.DEFAULT_CONTEXT_WINDOW;
    const minRelevance = options.minRelevanceScore || this.DEFAULT_MIN_RELEVANCE;

    // Enhanced relevance scoring with multiple factors
    const pageAnalysis: PageContent[] = [];

    // First pass: analyze all pages for relevance
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const pageContent = await this.extractPageWithStructure(pdf, pageNum, options);
      if (!pageContent) continue;

      const relevance = this.calculateEnhancedRelevance(pageContent, searchTerms);

      if (relevance >= minRelevance) {
        pageAnalysis.push({
          pageNum,
          content: pageContent.content,
          relevance,
          sections: pageContent.sections,
          hasImages: pageContent.hasImages,
          metadata: pageContent.metadata,
        });
      }
    }

    // Sort by relevance and apply intelligent selection
    pageAnalysis.sort((a, b) => b.relevance - a.relevance);

    // Select pages with context window
    const selectedPages = this.selectPagesWithContext(pageAnalysis, maxPages, contextWindow);

    logInfo(
      `Selected ${selectedPages.length} pages with context (${pageAnalysis.length} initially relevant)`
    );

    return this.formatExtractedContent(selectedPages, options);
  }

  private static async extractByChapters(
    pdf: any,
    chapters: string[],
    options: PDFProcessingOptions
  ): Promise<string> {
    logInfo(`Extracting chapters: ${chapters.join(", ")}`);

    // Try outline first
    const outline = await this.extractEnhancedOutline(pdf);
    const matchingChapters = outline.filter((section) =>
      chapters.some(
        (chapter) =>
          this.fuzzyMatch(section.title, chapter) ||
          section.title.toLowerCase().includes(chapter.toLowerCase())
      )
    );

    if (matchingChapters.length > 0) {
      logInfo(`Found ${matchingChapters.length} matching chapters in outline`);
      return await this.extractChapterContent(pdf, matchingChapters, options);
    }

    // Fallback to intelligent text-based chapter detection
    logInfo("No matching chapters in outline, using intelligent chapter detection");
    const detectedChapters = await this.detectChaptersInText(pdf, chapters, options);

    if (detectedChapters.length > 0) {
      return await this.extractChapterContent(pdf, detectedChapters, options);
    }

    // Final fallback to search terms
    return await this.extractByIntelligentSearch(pdf, chapters, { ...options, maxPages: 20 });
  }

  private static async extractPagesWithStructure(
    pdf: any,
    startPage: number,
    endPage: number,
    options: PDFProcessingOptions
  ): Promise<PageContent[]> {
    const pages: PageContent[] = [];

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const pageContent = await this.extractPageWithStructure(pdf, pageNum, options);
      if (pageContent) {
        pages.push({
          pageNum,
          content: pageContent.content,
          relevance: 1.0, // All pages in range are considered relevant
          sections: pageContent.sections,
          hasImages: pageContent.hasImages,
          metadata: pageContent.metadata,
        });
      }
    }

    return pages;
  }

  private static async extractPageWithStructure(
    pdf: any,
    pageNum: number,
    options: PDFProcessingOptions
  ): Promise<{
    content: string;
    sections: TextSection[];
    hasImages: boolean;
    metadata: PageMetadata;
  } | null> {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract structured text with positioning
      const sections = this.parseTextStructure(textContent);
      const content = this.combineTextSections(sections, options.preserveStructure);

      // Extract metadata
      const metadata = this.analyzePageMetadata(content, sections);

      // Check for images
      const hasImages = options.extractImages ? await this.hasImages(page) : false;

      return { content, sections, hasImages, metadata };
    } catch (error) {
      logError(`Error extracting structured text from page ${pageNum}:`, error);
      return null;
    }
  }

  private static parseTextStructure(textContent: any): TextSection[] {
    const sections: TextSection[] = [];
    const items = textContent.items;

    let currentSection: TextSection | null = null;
    let currentText = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = item.str?.trim() || "";

      if (!text) continue;

      const position = {
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      };

      // Detect section type based on formatting and content
      const sectionType = this.detectSectionType(text, item, i === 0, currentSection);

      if (
        !currentSection ||
        sectionType !== currentSection.type ||
        this.isNewSection(text, position, currentSection)
      ) {
        // Save previous section
        if (currentSection && currentText.trim()) {
          currentSection.content = currentText.trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          type: sectionType,
          content: "",
          position,
        };
        currentText = text;
      } else {
        currentText += " " + text;
      }
    }

    // Add final section
    if (currentSection && currentText.trim()) {
      currentSection.content = currentText.trim();
      sections.push(currentSection);
    }

    return sections;
  }

  private static detectSectionType(
    text: string,
    item: any,
    isFirstItem: boolean,
    currentSection: TextSection | null
  ): TextSection["type"] {
    const fontSize = item.transform?.[0] || 12;
    const isBold = item.fontName?.includes("Bold") || false;
    const isAllCaps = text === text.toUpperCase() && text.length > 2;

    // Header detection
    if (
      this.SECTION_PATTERNS.some((pattern) => pattern.test(text)) ||
      (isBold && fontSize > 14) ||
      (isAllCaps && text.length < 100)
    ) {
      return "header";
    }

    // List detection
    if (/^[-*•]\s/.test(text) || /^\d+[.)]\s/.test(text)) {
      return "list";
    }

    // Footer detection (position-based)
    if (item.transform?.[5] < 50) {
      // Near bottom of page
      return "footer";
    }

    // Table detection (basic)
    if (text.includes("\t") || /\s{4,}/.test(text)) {
      return "table";
    }

    return "paragraph";
  }

  private static isNewSection(
    text: string,
    position: any,
    currentSection: TextSection | null
  ): boolean {
    if (!currentSection) return true;

    // Large vertical gap indicates new section
    const yGap = Math.abs(position.y - currentSection.position.y);
    if (yGap > 20) return true;

    // Significant indentation change
    const xGap = Math.abs(position.x - currentSection.position.x);
    if (xGap > 50) return true;

    return false;
  }

  private static combineTextSections(sections: TextSection[], preserveStructure?: boolean): string {
    if (!preserveStructure) {
      return sections
        .map((s) => s.content)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return sections
      .map((section) => {
        switch (section.type) {
          case "header":
            return `\n\n## ${section.content}\n`;
          case "list":
            return `\n- ${section.content}`;
          case "table":
            return `\n\n${section.content}\n`;
          case "footer":
            return `\n---\n${section.content}\n---\n`;
          default:
            return `\n${section.content}`;
        }
      })
      .join("")
      .trim();
  }

  private static analyzePageMetadata(content: string, sections: TextSection[]): PageMetadata {
    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount || 0;

    return {
      wordCount,
      avgWordLength,
      hasNumbers: /\d/.test(content),
      hasReferences: /\[\d+\]|\(\d{4}\)|et al\./.test(content),
      textDensity: wordCount / Math.max(content.length, 1),
    };
  }

  private static async hasImages(page: any): Promise<boolean> {
    try {
      const operatorList = await page.getOperatorList();
      return operatorList.fnArray.some((fn: number) => fn === pdfjsLib.OPS.paintImageXObject);
    } catch {
      return false;
    }
  }

  private static calculateEnhancedRelevance(pageContent: any, searchTerms: string[]): number {
    const text = pageContent.content.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();

      // Basic term frequency
      const matches = (text.match(new RegExp(lowerTerm, "g")) || []).length;
      let termScore = matches * Math.log(term.length + 1);

      // Boost for exact phrase matches
      if (term.includes(" ")) {
        const phraseMatches = (text.match(new RegExp(lowerTerm, "g")) || []).length;
        termScore += phraseMatches * 2;
      }

      // Boost for matches in headers
      const headerMatches =
        pageContent.sections
          ?.filter((s: TextSection) => s.type === "header")
          .reduce(
            (count: number, section: TextSection) =>
              count +
              (section.content.toLowerCase().match(new RegExp(lowerTerm, "g")) || []).length,
            0
          ) || 0;
      termScore += headerMatches * 3;

      // Position-based scoring (early in document gets higher score)
      const firstMatchIndex = text.indexOf(lowerTerm);
      if (firstMatchIndex !== -1) {
        const positionBoost = 1 - (firstMatchIndex / text.length) * 0.5;
        termScore *= positionBoost;
      }

      score += termScore;
    }

    // Normalize by content length and apply metadata boosts
    let normalizedScore = score / Math.max(text.length, 1);

    // Boost for high-quality content
    if (pageContent.metadata) {
      if (pageContent.metadata.hasReferences) normalizedScore *= 1.2;
      if (pageContent.metadata.textDensity > 0.5) normalizedScore *= 1.1;
      if (pageContent.metadata.wordCount > 100) normalizedScore *= 1.1;
    }

    return normalizedScore;
  }

  private static selectPagesWithContext(
    pageAnalysis: PageContent[],
    maxPages: number,
    contextWindow: number
  ): PageContent[] {
    const selected = new Set<number>();
    const result: PageContent[] = [];

    // First, select the most relevant pages
    const topPages = pageAnalysis.slice(0, Math.min(maxPages, pageAnalysis.length));

    for (const page of topPages) {
      selected.add(page.pageNum);

      // Add context pages
      for (let i = 1; i <= contextWindow; i++) {
        selected.add(page.pageNum - i);
        selected.add(page.pageNum + i);
      }
    }

    // Collect all selected pages
    const allPageNums = Array.from(selected)
      .filter((num) => num > 0)
      .sort((a, b) => a - b);

    for (const pageNum of allPageNums.slice(0, maxPages)) {
      const pageData = pageAnalysis.find((p) => p.pageNum === pageNum);
      if (pageData) {
        result.push(pageData);
      }
    }

    return result.sort((a, b) => a.pageNum - b.pageNum);
  }

  private static formatExtractedContent(
    pages: PageContent[],
    options: PDFProcessingOptions
  ): string {
    if (!pages.length) return "";

    return pages
      .map((page) => {
        let pageHeader = `\n\n--- Page ${page.pageNum}`;
        if (page.relevance < 1.0) {
          pageHeader += ` (Relevance: ${page.relevance.toFixed(3)})`;
        }
        if (page.hasImages) {
          pageHeader += ` [Contains Images]`;
        }
        pageHeader += " ---\n";

        return pageHeader + page.content;
      })
      .join("")
      .trim();
  }

  private static async analyzeDocumentStructure(
    pdf: any,
    options: PDFProcessingOptions
  ): Promise<any> {
    // Sample first few pages to understand document structure
    const samplePages = Math.min(5, pdf.numPages);
    const structure = {
      hasOutline: false,
      avgPageLength: 0,
      commonPatterns: [],
      documentType: "unknown",
    };

    const outline = await this.extractEnhancedOutline(pdf);
    structure.hasOutline = outline.length > 0;

    // Analyze sample pages for patterns
    let totalLength = 0;
    for (let i = 1; i <= samplePages; i++) {
      const pageContent = await this.extractPageWithStructure(pdf, i, options);
      if (pageContent) {
        totalLength += pageContent.content.length;
      }
    }
    structure.avgPageLength = totalLength / samplePages;

    return structure;
  }

  private static async identifyKeySections(
    pdf: any,
    structure: any,
    options: PDFProcessingOptions
  ): Promise<PDFSection[]> {
    if (structure.hasOutline) {
      return await this.extractEnhancedOutline(pdf);
    }

    // Fallback: detect sections from text patterns
    return await this.detectSectionsFromText(pdf, options);
  }

  private static async extractEnhancedOutline(pdf: any): Promise<PDFSection[]> {
    try {
      const outline = await pdf.getOutline();
      if (!outline) return [];

      const sections: PDFSection[] = [];

      for (let i = 0; i < outline.length; i++) {
        const item = outline[i];
        const nextItem = outline[i + 1];

        const startPage = await this.getPageFromDest(pdf, item.dest);
        const endPage = nextItem
          ? (await this.getPageFromDest(pdf, nextItem.dest)) - 1
          : pdf.numPages;

        sections.push({
          title: item.title,
          startPage,
          endPage,
          content: "",
          confidence: 1.0,
        });
      }

      return sections;
    } catch (error) {
      logError("Error extracting PDF outline:", error);
      return [];
    }
  }

  private static async detectSectionsFromText(
    pdf: any,
    options: PDFProcessingOptions
  ): Promise<PDFSection[]> {
    const sections: PDFSection[] = [];
    const maxSamplePages = Math.min(20, pdf.numPages);

    let currentSection: PDFSection | null = null;

    for (let pageNum = 1; pageNum <= maxSamplePages; pageNum++) {
      const pageContent = await this.extractPageWithStructure(pdf, pageNum, options);
      if (!pageContent) continue;

      // Look for section headers
      const headers = pageContent.sections.filter((s) => s.type === "header");

      for (const header of headers) {
        if (this.SECTION_PATTERNS.some((pattern) => pattern.test(header.content))) {
          // Close previous section
          if (currentSection) {
            currentSection.endPage = pageNum - 1;
            sections.push(currentSection);
          }

          // Start new section
          currentSection = {
            title: header.content,
            startPage: pageNum,
            endPage: pdf.numPages,
            content: "",
            confidence: 0.8,
          };
        }
      }
    }

    // Close final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private static async extractByIntelligentSections(
    pdf: any,
    sections: PDFSection[],
    options: PDFProcessingOptions
  ): Promise<string> {
    const maxPages = options.maxPages || this.DEFAULT_MAX_PAGES;
    let processedPages = 0;
    let fullText = "";

    for (const section of sections) {
      if (processedPages >= maxPages) break;

      const sectionPages = section.endPage - section.startPage + 1;
      const pagesToProcess = Math.min(sectionPages, maxPages - processedPages);

      const sectionContent = await this.extractPagesWithStructure(
        pdf,
        section.startPage,
        section.startPage + pagesToProcess - 1,
        options
      );

      const formattedContent = this.formatExtractedContent(sectionContent, options);
      fullText += `\n\n=== ${section.title} ===\n${formattedContent}`;
      processedPages += pagesToProcess;
    }

    return fullText.trim();
  }

  private static async extractWithIntelligentLimits(
    pdf: any,
    maxPages: number,
    maxChars: number,
    options: PDFProcessingOptions
  ): Promise<string> {
    const pages: PageContent[] = [];
    let charCount = 0;
    const actualMaxPages = Math.min(maxPages, pdf.numPages);

    logInfo(`Extracting with intelligent limits: ${actualMaxPages} pages, ${maxChars} characters`);

    for (let pageNum = 1; pageNum <= actualMaxPages; pageNum++) {
      const pageContent = await this.extractPageWithStructure(pdf, pageNum, options);
      if (!pageContent) continue;

      const pageSize = pageContent.content.length;
      if (charCount + pageSize > maxChars) {
        logInfo(`Reached character limit at page ${pageNum}`);
        break;
      }

      pages.push({
        pageNum,
        content: pageContent.content,
        relevance: 1.0,
        sections: pageContent.sections,
        hasImages: pageContent.hasImages,
        metadata: pageContent.metadata,
      });

      charCount += pageSize;
    }

    const result = this.formatExtractedContent(pages, options);
    if (charCount >= maxChars) {
      return (
        result +
        `\n\n[... Truncated at ${maxChars} characters. Total pages in PDF: ${pdf.numPages} ...]`
      );
    }

    return result;
  }

  private static async detectChaptersInText(
    pdf: any,
    chapters: string[],
    options: PDFProcessingOptions
  ): Promise<PDFSection[]> {
    const detectedChapters: PDFSection[] = [];
    const maxScanPages = Math.min(50, pdf.numPages);

    for (let pageNum = 1; pageNum <= maxScanPages; pageNum++) {
      const pageContent = await this.extractPageWithStructure(pdf, pageNum, options);
      if (!pageContent) continue;

      const headers = pageContent.sections.filter((s) => s.type === "header");

      for (const header of headers) {
        for (const chapter of chapters) {
          if (this.fuzzyMatch(header.content, chapter)) {
            detectedChapters.push({
              title: header.content,
              startPage: pageNum,
              endPage: pageNum + 10, // Estimate chapter length
              content: "",
              confidence: 0.7,
            });
          }
        }
      }
    }

    return detectedChapters;
  }

  private static async extractChapterContent(
    pdf: any,
    chapters: PDFSection[],
    options: PDFProcessingOptions
  ): Promise<string> {
    let fullText = "";

    for (const chapter of chapters) {
      const chapterContent = await this.extractPagesWithStructure(
        pdf,
        chapter.startPage,
        chapter.endPage,
        options
      );

      const formattedContent = this.formatExtractedContent(chapterContent, options);
      fullText += `\n\n=== ${chapter.title} ===\n${formattedContent}`;
    }

    return fullText.trim();
  }

  private static fuzzyMatch(text1: string, text2: string, threshold: number = 0.6): boolean {
    const t1 = text1.toLowerCase().trim();
    const t2 = text2.toLowerCase().trim();

    if (t1.includes(t2) || t2.includes(t1)) return true;

    // Simple Levenshtein-based similarity
    const maxLen = Math.max(t1.length, t2.length);
    const distance = this.levenshteinDistance(t1, t2);
    const similarity = 1 - distance / maxLen;

    return similarity >= threshold;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private static async getPageFromDest(pdf: any, dest: any): Promise<number> {
    try {
      if (Array.isArray(dest)) {
        const pageRef = dest[0];
        const pageIndex = await pdf.getPageIndex(pageRef);
        return pageIndex + 1; // Convert to 1-based
      }
      return 1;
    } catch {
      return 1;
    }
  }
}
