interface FileDetails {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
}

// Define interfaces for the File System Access API
interface FileSystemHandle {
  readonly kind: "file" | "directory";
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  getFile(): Promise<File>; // Add getFile method
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: "directory";
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";
  createWritable(
    options?: FileSystemCreateWritableOptions
  ): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

// Define interfaces for Chrome extension messaging
interface ChromeMessage {
  action:
    | "getFiles"
    | "openFile"
    | "downloadFile"
    | "uploadFile"
    | "deleteFile"
    | "deleteAllFiles"
    | "ping";
  path?: string;
  data?: ArrayBuffer;
  type?: string;
  size?: number; // Add size property
}

interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Function to get the root directory of OPFS
async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  try {
    const root = await navigator.storage.getDirectory();
    return root;
  } catch (error) {
    console.error("Error accessing OPFS:", error);
    throw error;
  }
}

// Function to recursively get all files in a directory
async function getAllFiles(
  dir: FileSystemDirectoryHandle,
  path = ""
): Promise<FileDetails[]> {
  const files: FileDetails[] = [];

  try {
    for await (const entry of dir.values()) {
      const entryPath = path + "/" + entry.name;

      if (entry.kind === "file") {
        const file = await entry.getFile();
        files.push({
          name: entry.name,
          path: entryPath,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        });
      } else if (entry.kind === "directory") {
        const subFiles = await getAllFiles(
          entry as FileSystemDirectoryHandle,
          entryPath
        );
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
    throw error;
  }

  return files;
}

// Function to read a file from OPFS
async function readFile(
  path: string,
  root: FileSystemDirectoryHandle
): Promise<File> {
  try {
    const parts = path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create: false });
    }

    const fileName = parts[parts.length - 1];
    const fileHandle = await current.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    return file;
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
}

// Function to save file to OPFS
async function saveFile(
  path: string,
  data: ArrayBuffer,
  type?: string
): Promise<void> {
  try {
    const root = await getOPFSRoot();
    const parts = path.split("/");
    let current = root;

    // Create directories if they don't exist
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      try {
        current = await current.getDirectoryHandle(part, { create: true });
      } catch (error) {
        console.error(`Error creating directory ${part}:`, error);
        throw error;
      }
    }

    // Create or get the file handle
    const fileName = parts[parts.length - 1];
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await current.getFileHandle(fileName, { create: true });
    } catch (error) {
      console.error(`Error getting file handle for ${fileName}:`, error);
      throw error;
    }

    // Create a writable stream
    const writable = await fileHandle.createWritable();
    if (!writable) {
      throw new Error("Failed to create writable stream");
    }

    // Write the data with proper type
    await writable.write({
      type: "write",
      data: data,
      position: 0,
    });

    // Truncate to ensure the file size is correct
    await writable.truncate(data.byteLength);

    console.log(`File ${path} saved successfully`);
  } catch (error) {
    console.error(`Error saving file ${path}:`, error);
    throw error;
  }
}

// Function to delete a file from OPFS
async function deleteFile(path: string): Promise<boolean> {
  try {
    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);
    let current = root;

    // Navigate to the parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i], { create: false });
      } catch (error) {
        throw new Error(`Directory '${parts[i]}' not found in path: ${path}`);
      }
    }

    const fileName = parts[parts.length - 1];
    try {
      await current.removeEntry(fileName);
      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete file '${fileName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

// Function to download a file
async function downloadFile(file: File, fileName: string): Promise<void> {
  try {
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
}

// Function to delete all files in OPFS
async function deleteAllFiles(): Promise<boolean> {
  try {
    const root = await getOPFSRoot();
    console.log("Starting deletion of all files");

    // Get all entries in the root directory
    for await (const entry of root.values()) {
      try {
        console.log(`Deleting: ${entry.name}`);
        await root.removeEntry(entry.name, { recursive: true });
      } catch (error) {
        console.error(`Error deleting ${entry.name}:`, error);
        throw new Error(
          `Failed to delete ${entry.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    console.log("Successfully deleted all files");
    return true;
  } catch (error) {
    console.error("Error deleting all files:", error);
    throw error;
  }
}

// Function to upload a file to OPFS
async function uploadFile(
  fileData: ArrayBuffer,
  path: string,
  size: number
): Promise<boolean> {
  let writable = undefined;
  try {
    console.log("Starting file upload:", { path, size });
    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);
    let current = root;

    // Navigate to the parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i], { create: true });
        console.log("Created/accessed directory:", parts[i]);
      } catch (error) {
        console.error(`Error accessing directory ${parts[i]}:`, error);
        throw new Error(`Directory '${parts[i]}' not found in path: ${path}`);
      }
    }

    const fileName = parts[parts.length - 1];
    try {
      console.log("Creating file handle for:", fileName);
      const fileHandle = await current.getFileHandle(fileName, {
        create: true,
      });
      writable = await fileHandle.createWritable();

      // Verify the file data
      if (!fileData || fileData.byteLength === 0) {
        throw new Error("Invalid file data: empty or zero length");
      }

      console.log("Writing file data, size:", fileData.byteLength);
      await writable.write(fileData);
      await writable.close();

      // Verify the file was written
      const file = await fileHandle.getFile();
      console.log("File written successfully, actual size:", file.size);

      if (file.size !== size) {
        console.warn(`File size mismatch: expected ${size}, got ${file.size}`);
      }

      return true;
    } catch (error) {
      console.error("Error writing file:", error);
      throw new Error(
        `Failed to write file '${fileName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  } finally {
    await writable?.close();
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(
  async (message: ChromeMessage, sender, sendResponse) => {
    try {
      switch (message.action) {
        case "ping":
          sendResponse({ success: true });
          break;

        case "getFiles":
          const root = await getOPFSRoot();
          const files = await getAllFiles(root);
          sendResponse({ success: true, data: files });
          break;

        case "openFile":
          if (!message.path) {
            throw new Error("Path is required for openFile action");
          }
          const fileData = await readFile(message.path, await getOPFSRoot());
          sendResponse({ success: true, data: fileData });
          break;

        case "downloadFile":
          if (!message.path) {
            throw new Error("Path is required for downloadFile action");
          }
          const downloadRoot = await getOPFSRoot();
          const file = await readFile(message.path, downloadRoot);
          await downloadFile(file, message.path);
          sendResponse({ success: true });
          break;

        case "uploadFile":
          if (!message.path || !message.data) {
            throw new Error("Path and data are required for uploadFile action");
          }
          await saveFile(message.path, message.data, message.type);
          sendResponse({ success: true });
          break;

        case "deleteFile":
          if (!message.path) {
            throw new Error("Path is required for deleteFile action");
          }
          await deleteFile(message.path);
          sendResponse({ success: true });
          break;

        case "deleteAllFiles":
          await deleteAllFiles();
          sendResponse({ success: true });
          break;

        default:
          throw new Error(`Unknown action: ${message.action}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true; // Keep the message channel open for async response
  }
);
