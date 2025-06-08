import { logError, logInfo } from "@/logger";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker - use a more reliable CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export class LocalPDFParser {
  static async extractTextFromPDF(binaryContent: ArrayBuffer): Promise<string> {
    try {
      logInfo("Starting local PDF text extraction");

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(binaryContent),
        verbosity: 0, // Suppress console logs
      });

      const pdf = await loadingTask.promise;
      logInfo(`PDF loaded successfully. Pages: ${pdf.numPages}`);

      let fullText = "";

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Combine text items with better formatting
          const pageText = textContent.items
            .map((item: any) => {
              // Handle text items with proper spacing
              if (item.str && typeof item.str === "string") {
                return item.str;
              }
              return "";
            })
            .filter((text) => text.trim().length > 0)
            .join(" ")
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          if (pageText) {
            fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
          }

          logInfo(`Extracted text from page ${pageNum}: ${pageText.length} characters`);
        } catch (pageError) {
          logError(`Error extracting text from page ${pageNum}:`, pageError);
          fullText += `\n\n--- Page ${pageNum} ---\n[Error: Could not extract text from this page]`;
        }
      }

      if (fullText.trim()) {
        logInfo(`Successfully extracted ${fullText.length} characters from PDF`);
        return fullText.trim();
      } else {
        return "[No text content found in PDF - may be image-based or encrypted]";
      }
    } catch (error) {
      logError("Error in local PDF text extraction:", error);
      throw new Error(`Local PDF parsing failed: ${error.message}`);
    }
  }
}
