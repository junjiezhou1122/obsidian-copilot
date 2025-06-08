# 🔍 Selective PDF Processing Guide

## Overview

The new selective PDF processing functionality allows you to efficiently work with large PDFs by extracting only the content you need. This dramatically improves performance and reduces token usage when working with massive documents.

## 🚀 Features

### ✅ **Smart Auto-Processing**

- **Large PDFs (>50MB)**: Automatically limited to 20 pages or 50,000 characters
- **Medium PDFs (>10MB)**: Limited to 50 pages or 100,000 characters
- **Small PDFs**: Full processing

### ✅ **Selective Processing Options**

- **Page Range**: Extract specific page ranges (e.g., pages 1-10)
- **Search Terms**: Find and extract pages containing specific keywords
- **Chapter/Section**: Extract specific chapters or sections
- **Character Limits**: Set maximum character extraction limits
- **Smart Outline Detection**: Automatically use PDF bookmarks/outline

### ✅ **Multiple Usage Methods**

1. **Embedded Links with Options**: `![[document.pdf|pages:1-5]]`
2. **Interactive Modal**: Click the settings gear icon on PDF context notes
3. **Automatic Smart Processing**: Based on file size

## 📖 Usage Examples

### 1. Embedded PDF Links with Options

```markdown
<!-- Extract only pages 1-5 -->

![[large-document.pdf|pages:1-5]]

<!-- Extract chapter 1 -->

![[book.pdf|chapter:Chapter 1]]

<!-- Search for specific terms -->

![[research-paper.pdf|search:methodology,results]]

<!-- Limit to 10 pages max -->

![[huge-manual.pdf|max:10]]

<!-- Limit by character count -->

![[document.pdf|chars:25000]]

<!-- Combine multiple options -->

![[document.pdf|pages:1-20,search:summary,max:10]]
```

### 2. Option Syntax Reference

| Option             | Syntax         | Example               | Description                |
| ------------------ | -------------- | --------------------- | -------------------------- |
| **Page Range**     | `pages:X-Y`    | `pages:1-10`          | Extract pages X through Y  |
| **Search Terms**   | `search:term`  | `search:introduction` | Find pages containing term |
| **Chapters**       | `chapter:name` | `chapter:Chapter 1`   | Extract specific chapters  |
| **Max Pages**      | `max:N`        | `max:20`              | Limit to N pages           |
| **Max Characters** | `chars:N`      | `chars:50000`         | Limit to N characters      |

### 3. Interactive Modal Usage

1. **Add PDF to Chat Context**: Click "Add context" → Select PDF file
2. **Configure Processing**: Click the ⚙️ (gear) icon next to the PDF badge
3. **Set Options**: Fill out the processing options modal
4. **Process**: Click "Process PDF" to apply your settings

## 🧠 Processing Strategies

The system uses intelligent processing strategies in this order:

### 1. **Chapter-Based Processing**

- If chapters are specified, the system tries to find them in the PDF outline
- Falls back to text search if outline is not available

### 2. **Search-Based Processing**

- Scans pages for relevance to search terms
- Ranks pages by relevance score
- Selects the most relevant pages up to the limit

### 3. **Page Range Processing**

- Extracts only the specified page range
- Most efficient for known page locations

### 4. **Smart Auto-Processing**

- Uses PDF outline/bookmarks if available
- Applies size-based limits for large files
- Extracts the most important content first

## 💡 Best Practices

### 🎯 **For Large Documents (>50MB)**

```markdown
<!-- Focus on specific sections -->

![[large-manual.pdf|chapter:Getting Started,max:15]]

<!-- Search for specific topics -->

![[research.pdf|search:conclusion,results,methodology,max:25]]
```

### 📚 **For Academic Papers**

```markdown
<!-- Extract key sections -->

![[paper.pdf|search:abstract,introduction,conclusion]]

<!-- Focus on methodology -->

![[study.pdf|chapter:Methods,search:methodology]]
```

### 📖 **For Books**

```markdown
<!-- Read specific chapters -->

![[book.pdf|chapter:Chapter 1,Chapter 5]]

<!-- Search for topics -->

![[textbook.pdf|search:machine learning,neural networks,max:30]]
```

### 📋 **For Reports**

```markdown
<!-- Executive summary and conclusions -->

![[report.pdf|search:summary,executive,conclusion,max:15]]

<!-- Specific sections -->

![[analysis.pdf|pages:1-5,search:recommendations]]
```

## ⚡ Performance Benefits

### **Before Selective Processing**

- ❌ 500-page PDF → 500 pages processed → 2+ minutes
- ❌ High token usage → Expensive API calls
- ❌ Context overflow → Truncated results

### **After Selective Processing**

- ✅ 500-page PDF → 20 relevant pages → 30 seconds
- ✅ Reduced token usage → Lower costs
- ✅ Focused content → Better AI responses

## 🔧 Advanced Features

### **Smart Outline Detection**

The system automatically detects and uses PDF bookmarks/outline:

```markdown
<!-- Will use PDF's table of contents -->

![[structured-document.pdf|max:30]]
```

### **Relevance Scoring**

When using search terms, pages are scored by:

- Term frequency
- Term importance (longer terms = higher weight)
- Context relevance

### **Caching with Options**

- Each processing configuration is cached separately
- Change options → new cache entry
- Faster subsequent access with same options

## 🛠️ Technical Details

### **File Size Thresholds**

- **Small**: < 10MB → No automatic limits
- **Medium**: 10-50MB → 50 pages, 100k characters
- **Large**: > 50MB → 20 pages, 50k characters

### **Processing Pipeline**

1. **Option Parsing** → Extract user preferences
2. **Smart Strategy Selection** → Choose best approach
3. **Content Extraction** → Process relevant sections
4. **Caching** → Store results for future use
5. **Context Integration** → Add to chat context

### **Fallback Handling**

- Corrupted pages → Error messages, continue processing
- No outline → Fall back to text search
- Search fails → Use page-based processing
- All fails → Basic sequential processing with limits

## 🎨 UI Components

### **PDF Context Badge**

- Shows "PDF" indicator
- ⚙️ Settings gear for configuration
- ❌ Remove button

### **Processing Modal**

- Page range selector
- Max pages/characters
- Search terms input
- Chapter selection
- Processing strategy explanation

## 📊 Examples by Use Case

### **Research & Analysis**

```markdown
# Analyzing multiple research papers

![[paper1.pdf|search:methodology,results]]
![[paper2.pdf|chapter:Abstract,Conclusion]]
![[paper3.pdf|pages:1-3,search:discussion]]

What are the main methodological differences between these studies?
```

### **Learning & Education**

```markdown
# Studying specific chapters

![[textbook.pdf|chapter:Chapter 5,max:25]]

Explain the key concepts from this chapter.
```

### **Business & Reports**

```markdown
# Executive summary analysis

![[quarterly-report.pdf|search:executive summary,key findings,max:10]]

Summarize the main business insights.
```

This selective PDF processing feature makes working with large documents practical and efficient, allowing you to focus on exactly the content you need while maintaining fast performance and reasonable costs.
