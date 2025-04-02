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
  [Symbol.asyncIterator](): AsyncIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";
  getFile(): Promise<File>;
  createWritable(
    options?: FileSystemCreateWritableOptions
  ): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkOptions): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemWriteChunkOptions {
  type: "write" | "seek" | "truncate";
  data?: BufferSource | Blob | string;
  position?: number;
  size?: number;
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
    | "deleteFile"
    | "deleteAllFiles"
    | "ping";
  path?: string;
}

interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Function to get the root directory of OPFS
export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  try {
    const root =
      (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle;
    return root;
  } catch (error) {
    console.error("Error accessing OPFS:", error);
    throw error;
  }
}

// Function to recursively get all files in a directory
export async function getAllFiles(
  dir: FileSystemDirectoryHandle,
  path = ""
): Promise<FileDetails[]> {
  const files: FileDetails[] = [];

  try {
    for await (const entry of dir.values()) {
      const entryPath = path + "/" + entry.name;

      if (entry.kind === "file") {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
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
export async function readFile(
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
  data: number[] | ArrayBuffer,
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

    // Convert array data back to ArrayBuffer if needed
    const buffer = Array.isArray(data) ? new Uint8Array(data).buffer : data;
    console.log(`Writing file ${path} with buffer size:`, buffer.byteLength);

    // Write the data with proper type
    await writable.write({
      type: "write",
      data: buffer,
      position: 0,
    } as FileSystemWriteChunkOptions);

    // Truncate to ensure the file size is correct
    await writable.truncate(buffer.byteLength);

    console.log(`File ${path} saved successfully`);
  } catch (error) {
    console.error(`Error saving file ${path}:`, error);
    throw error;
  }
}

// Function to delete a file from OPFS
export async function deleteFile(path: string): Promise<boolean> {
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

// Handle messages from popup
chrome.runtime.onMessage.addListener(
  (message: ChromeMessage, sender, sendResponse) => {
    console.log(message);
    try {
      switch (message.action) {
        case "ping":
          sendResponse({ success: true });
          break;

        case "getFiles":
          (async () => {
            try {
              const root = await getOPFSRoot();
              const files = await getAllFiles(root);
              sendResponse({ success: true, data: files });
            } catch (error) {
              console.error("Error getting files:", error);
              sendResponse({
                success: false,
                error,
              });
            }
          })();
          break;

        case "openFile":
          (async () => {
            if (!message.path) {
              throw new Error("Path is required for openFile action");
            }
            const fileData = await readFile(message.path, await getOPFSRoot());
            sendResponse({ success: true, data: fileData });
          })();
          break;

        case "downloadFile":
          (async () => {
            if (!message.path) {
              throw new Error("Path is required for downloadFile action");
            }
            const downloadRoot = await getOPFSRoot();
            const file = await readFile(message.path, downloadRoot);
            await downloadFile(file, message.path);
            sendResponse({ success: true });
          })();
          break;

        case "deleteFile":
          (async () => {
            if (!message.path) {
              throw new Error("Path is required for deleteFile action");
            }
            await deleteFile(message.path);
            sendResponse({ success: true });
          })();
          break;

        case "deleteAllFiles":
          (async () => {
            await deleteAllFiles();
            sendResponse({ success: true });
          })();
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
