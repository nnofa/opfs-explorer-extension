# OPFS Explorer Chrome Extension

A Chrome extension that allows you to view and access files stored in your Origin Private File System (OPFS) from any website.

## Features

- View all files stored in your OPFS
- Display file sizes and types
- Open files directly in new tabs
- Modern and intuitive user interface
- Works across all websites

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the OPFS Explorer icon in your Chrome toolbar
2. The extension will show all files stored in your OPFS
3. Click on any file to open it in a new tab
4. Use the refresh button to update the file list

## Technical Details

This extension uses the following Chrome Extension APIs:

- `storage` - For accessing OPFS
- `activeTab` - For interacting with the current tab
- `tabs` - For opening files in new tabs

## Development

The extension is built using:

- Manifest V3
- Modern JavaScript (ES6+)
- Chrome Extension APIs
- Origin Private File System API

## License

MIT License
