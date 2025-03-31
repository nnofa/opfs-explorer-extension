interface FileDetails {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
}

interface FileResponse {
  success: boolean;
  data?: FileDetails[];
  error?: string;
}

interface UploadResponse {
  success: boolean;
  error?: string;
}

// Define message types for Chrome messaging
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

// Use chrome.tabs.Tab type instead of custom Tab interface
type Tab = chrome.tabs.Tab;

document.addEventListener("DOMContentLoaded", async () => {
  const fileList = document.getElementById("fileList") as HTMLDivElement;
  const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement;
  const deleteAllBtn = document.getElementById(
    "deleteAllBtn"
  ) as HTMLButtonElement;
  const modal = document.getElementById("fileDetailsModal") as HTMLDivElement;
  const modalClose = document.querySelector(
    ".modal-close"
  ) as HTMLButtonElement;

  console.log("DOM Content Loaded");

  // Function to format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Function to get file icon based on file type
  function getFileIcon(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const icons: Record<string, string> = {
      pdf: "fa-file-pdf",
      doc: "fa-file-word",
      docx: "fa-file-word",
      txt: "fa-file-lines",
      jpg: "fa-file-image",
      jpeg: "fa-file-image",
      png: "fa-file-image",
      gif: "fa-file-image",
      zip: "fa-file-zipper",
      rar: "fa-file-zipper",
      default: "fa-file",
    };
    return `<i class="fas ${icons[extension] || icons.default}"></i>`;
  }

  // Function to show file details
  function showFileDetails(file: FileDetails): void {
    const detailFileName = document.getElementById(
      "detailFileName"
    ) as HTMLDivElement;
    const detailFilePath = document.getElementById(
      "detailFilePath"
    ) as HTMLDivElement;
    const detailFileSize = document.getElementById(
      "detailFileSize"
    ) as HTMLDivElement;
    const detailFileType = document.getElementById(
      "detailFileType"
    ) as HTMLDivElement;

    detailFileName.textContent = file.name;
    detailFilePath.textContent = file.path;
    detailFileSize.textContent = formatFileSize(file.size);
    detailFileType.textContent = file.type || "Unknown";
    modal.style.display = "block";
  }

  // Function to hide file details
  function hideFileDetails(): void {
    modal.style.display = "none";
  }

  // Function to inject content script
  async function injectContentScript(tabId: number): Promise<void> {
    try {
      // First check if the content script is already injected
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: "ping",
        } as ChromeMessage);
        if (response && response.success) {
          console.log("Content script already injected");
          return;
        }
      } catch (error) {
        console.log(
          "Content script not injected yet, proceeding with injection"
        );
      }

      // If not injected, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["dist/content.js"],
      });
      console.log("Content script injected successfully");

      // Wait for the script to initialize and verify it's working
      let retries = 5;
      while (retries > 0) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, {
            action: "ping",
          } as ChromeMessage);
          if (response && response.success) {
            console.log("Content script initialized successfully");
            return;
          }
        } catch (error) {
          console.log(
            `Waiting for content script to initialize... (${retries} retries left)`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries--;
      }

      throw new Error(
        "Content script failed to initialize after multiple attempts"
      );
    } catch (error) {
      console.error("Error injecting content script:", error);
      throw error;
    }
  }

  // Function to get current tab
  async function getCurrentTab(): Promise<Tab> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id) {
      throw new Error("No active tab found");
    }
    return tab;
  }

  // Function to download file
  async function downloadFile(path: string): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (!tab.id) {
        throw new Error("Tab ID is undefined");
      }

      const response = (await chrome.tabs.sendMessage(tab.id, {
        action: "downloadFile",
        path,
      } as ChromeMessage)) as UploadResponse;

      if (!response.success) {
        throw new Error(response.error || "Failed to download file");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert(
        `Error downloading file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Function to delete file
  async function deleteFile(path: string): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (!tab.id) {
        throw new Error("Tab ID is undefined");
      }

      if (!confirm("Are you sure you want to delete this file?")) {
        return;
      }

      const response = (await chrome.tabs.sendMessage(tab.id, {
        action: "deleteFile",
        path,
      } as ChromeMessage)) as UploadResponse;

      if (!response.success) {
        throw new Error(response.error || "Failed to delete file");
      }

      // Refresh the file list after successful deletion
      listFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert(
        `Failed to delete file: ${
          error instanceof Error ? error.message : String(error)
        }\n\nPlease check the console for more details.`
      );
    }
  }

  // Function to delete all files
  async function deleteAllFiles(): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (!tab.id) {
        throw new Error("Tab ID is undefined");
      }

      if (
        !confirm(
          "Are you sure you want to delete all files? This action cannot be undone."
        )
      ) {
        return;
      }

      const response = (await chrome.tabs.sendMessage(tab.id, {
        action: "deleteAllFiles",
      } as ChromeMessage)) as UploadResponse;

      if (!response.success) {
        throw new Error(response.error || "Failed to delete all files");
      }

      // Refresh the file list after successful deletion
      listFiles();
    } catch (error) {
      console.error("Error deleting all files:", error);
      alert(
        `Failed to delete all files: ${
          error instanceof Error ? error.message : String(error)
        }\n\nPlease check the console for more details.`
      );
    }
  }

  // Function to list files in OPFS
  async function listFiles(): Promise<void> {
    try {
      const tab = await getCurrentTab();
      if (!tab.id) {
        throw new Error("Tab ID is undefined");
      }

      // Inject content script and wait for it to be ready
      await injectContentScript(tab.id);

      // Send message to get files
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getFiles",
      } as ChromeMessage);

      if (!response) {
        throw new Error("No response from content script");
      }

      const fileResponse = response as FileResponse;
      if (!fileResponse.success) {
        throw new Error(fileResponse.error || "Failed to get files");
      }

      const files = fileResponse.data || [];
      fileList.innerHTML = "";

      if (files.length === 0) {
        fileList.innerHTML = '<div class="empty-state">No files found</div>';
        return;
      }

      files.forEach((file: FileDetails) => {
        const fileElement = document.createElement("div");
        fileElement.className = "file-item";
        fileElement.innerHTML = `
          <div class="file-icon">${getFileIcon(file.name)}</div>
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
          <div class="file-actions">
            <button class="action-btn view-btn" title="View">
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn download-btn" title="Download">
              <i class="fas fa-download"></i>
            </button>
            <button class="action-btn delete-btn" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;

        // Add event listeners
        const viewBtn = fileElement.querySelector(
          ".view-btn"
        ) as HTMLButtonElement;
        const downloadBtn = fileElement.querySelector(
          ".download-btn"
        ) as HTMLButtonElement;
        const deleteBtn = fileElement.querySelector(
          ".delete-btn"
        ) as HTMLButtonElement;

        viewBtn.addEventListener("click", () => showFileDetails(file));
        downloadBtn.addEventListener("click", () => downloadFile(file.path));
        deleteBtn.addEventListener("click", () => deleteFile(file.path));

        fileList.appendChild(fileElement);
      });
    } catch (error) {
      console.error("Error listing files:", error);
      fileList.innerHTML = `<div class="error-state">Error: ${
        error instanceof Error ? error.message : String(error)
      }</div>`;
    }
  }

  // Add event listeners
  refreshBtn.addEventListener("click", listFiles);
  deleteAllBtn.addEventListener("click", deleteAllFiles);

  // Modal close button event listener
  modalClose.addEventListener("click", hideFileDetails);

  // Close modal when clicking outside
  window.addEventListener("click", (event: MouseEvent) => {
    if (event.target === modal) {
      hideFileDetails();
    }
  });

  // Initial load
  listFiles();
});
