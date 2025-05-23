interface FileDetails {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
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

// Function to get the root directory of OPFS
export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  try {
    const root =
      (await navigator.storage.getDirectory()) as unknown as FileSystemDirectoryHandle;
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
