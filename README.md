# My_Workspace

Personal workspace for storing notes, documents, images, and various file types.

## Folder Structure

```
My_Workspace/
├── notes/              # General notes and text files
├── text_files/         # Plain text files (.txt)
├── markdown/           # Markdown files (.md)
├── images/             # Image files (.png, .jpg, .gif, etc.)
├── documents/
│   ├── pdf/            # PDF documents
│   ├── excel/          # Excel spreadsheets (.xlsx, .xls)
│   ├── word/           # Word documents (.docx, .doc)
│   └── pptx/           # PowerPoint presentations (.pptx, .ppt)
└── push_to_github.bat  # One-click push script
```

## Quick Start

1. **Add files** to the appropriate folders
2. **Run `push_to_github.bat`** to commit and push changes to GitHub
3. Enter a commit message when prompted (or press Enter for default)

## GitHub Repository

- **Remote**: https://github.com/izumi-dev98/My_Wrokspace.git
- **Branch**: main

## Setup (First Time Only)

Configure the remote with your Personal Access Token:

```bash
git remote set-url origin https://YOUR_PAT_TOKEN@github.com/izumi-dev98/My_Wrokspace.git
```

Replace `YOUR_PAT_TOKEN` with your GitHub Personal Access Token (classic) with `repo` scope.

## Notes

- Large files (>100MB) should use Git LFS
- The `.gitignore` excludes temporary files, OS files, and IDE folders
- Commit messages default to "Update workspace: [date] [time]"