import { App, Modal, Setting, ButtonComponent } from "obsidian";
import { PDFProcessingOptions } from "@/tools/SelectivePDFParser";

export class PDFProcessingModal extends Modal {
  private options: PDFProcessingOptions = {};
  private onSubmit: (options: PDFProcessingOptions) => void;
  private fileName: string;

  constructor(app: App, fileName: string, onSubmit: (options: PDFProcessingOptions) => void) {
    super(app);
    this.fileName = fileName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: `PDF Processing Options - ${this.fileName}` });

    contentEl.createEl("p", {
      text: "Choose how to process this PDF. Leave fields empty to use smart defaults.",
      cls: "setting-item-description",
    });

    // Page range setting
    new Setting(contentEl)
      .setName("Page Range")
      .setDesc("Specify pages to process (e.g., 1-10, 5-25)")
      .addText((text) =>
        text.setPlaceholder("1-10").onChange((value) => {
          const match = value.match(/(\d+)-(\d+)/);
          if (match) {
            this.options.pageRange = {
              start: parseInt(match[1]),
              end: parseInt(match[2]),
            };
          } else if (value.trim() === "") {
            delete this.options.pageRange;
          }
        })
      );

    // Max pages setting
    new Setting(contentEl)
      .setName("Maximum Pages")
      .setDesc("Limit total pages to process (default: 50 for large PDFs)")
      .addText((text) =>
        text.setPlaceholder("50").onChange((value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            this.options.maxPages = num;
          } else if (value.trim() === "") {
            delete this.options.maxPages;
          }
        })
      );

    // Max characters setting
    new Setting(contentEl)
      .setName("Maximum Characters")
      .setDesc("Limit total characters extracted (default: 100,000)")
      .addText((text) =>
        text.setPlaceholder("100000").onChange((value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            this.options.maxCharacters = num;
          } else if (value.trim() === "") {
            delete this.options.maxCharacters;
          }
        })
      );

    // Search terms setting
    new Setting(contentEl)
      .setName("Search Terms")
      .setDesc("Extract pages containing these terms (comma-separated)")
      .addTextArea((text) =>
        text.setPlaceholder("chapter 1, introduction, summary, methodology").onChange((value) => {
          if (value.trim()) {
            this.options.searchTerms = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
          } else {
            delete this.options.searchTerms;
          }
        })
      );

    // Chapters setting
    new Setting(contentEl)
      .setName("Chapters/Sections")
      .setDesc("Extract specific chapters or sections (comma-separated)")
      .addTextArea((text) =>
        text.setPlaceholder("Introduction, Chapter 1, Conclusion, Abstract").onChange((value) => {
          if (value.trim()) {
            this.options.chapters = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
          } else {
            delete this.options.chapters;
          }
        })
      );

    // Info section
    const infoContainer = contentEl.createDiv("pdf-processing-info");
    infoContainer.createEl("h3", { text: "Processing Strategy" });

    const strategyList = infoContainer.createEl("ul");
    strategyList.createEl("li", {
      text: "If chapters are specified, the system will try to find them in the PDF outline",
    });
    strategyList.createEl("li", {
      text: "If search terms are provided, relevant pages will be ranked and selected",
    });
    strategyList.createEl("li", {
      text: "If page range is set, only those pages will be processed",
    });
    strategyList.createEl("li", {
      text: "Otherwise, smart extraction will process the most relevant content",
    });

    // Buttons
    const buttonContainer = contentEl.createDiv("modal-button-container");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.marginTop = "20px";

    new ButtonComponent(buttonContainer)
      .setButtonText("Process PDF")
      .setCta()
      .onClick(() => {
        this.onSubmit(this.options);
        this.close();
      });

    new ButtonComponent(buttonContainer).setButtonText("Use Smart Defaults").onClick(() => {
      // Clear all options to use smart defaults
      this.options = {};
      this.onSubmit(this.options);
      this.close();
    });

    new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
