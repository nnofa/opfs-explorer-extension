document.addEventListener("DOMContentLoaded", async () => {
  const fileList = document.getElementById("fileList");
  const refreshBtn = document.getElementById("refreshBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const deleteAllBtn = document.getElementById("deleteAllBtn");
  const uploadProgress = document.getElementById("uploadProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const modal = document.getElementById("fileDetailsModal");
  const modalClose = document.querySelector(".modal-close");

  console.log("DOM Content Loaded");
  console.log("File input element:", fileInput);

  // Function to format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Function to get file icon based on file type
  function getFileIcon(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();
    const icons = {
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
  function showFileDetails(file) {
    document.getElementById("detailFileName").textContent = file.name;
    document.getElementById("detailFilePath").textContent = file.path;
    document.getElementById("detailFileSize").textContent = formatFileSize(
      file.size
    );
    document.getElementById("detailFileType").textContent =
      file.type || "Unknown";
    modal.style.display = "block";
  }

  // Function to hide file details
  function hideFileDetails() {
    modal.style.display = "none";
  }

  // Function to inject content script
  async function injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });
      console.log("Content script injected successfully");
    } catch (error) {
      console.error("Error injecting content script:", error);
      throw error;
    }
  }

  // Function to upload files to OPFS
  async function uploadFiles(files) {
    console.log("Upload files called with:", files);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      uploadProgress.style.display = "block";
      let uploadedCount = 0;

      for (const file of files) {
        try {
          console.log("Processing file:", file.name);
          const path = file.name;

          // Convert file to ArrayBuffer
          const buffer = await file.arrayBuffer();
          console.log("File converted to buffer, size:", buffer.byteLength);

          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "uploadFile",
            file: buffer,
            path: path,
            type: file.type,
            size: file.size,
          });

          if (response && response.error) {
            throw new Error(response.error);
          }

          uploadedCount++;
          const progress = (uploadedCount / files.length) * 100;
          progressFill.style.width = `${progress}%`;
          progressText.textContent = `Uploading files... ${uploadedCount}/${files.length}`;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          alert(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      // Hide progress bar after a short delay
      setTimeout(() => {
        uploadProgress.style.display = "none";
        progressFill.style.width = "0%";
        progressText.textContent = "Uploading files...";
      }, 1000);

      // Refresh the file list
      listFiles();
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Error uploading files: ${error.message}`);
      uploadProgress.style.display = "none";
    }
  }

  // Function to download file
  async function downloadFile(path) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: "downloadFile",
        path: path,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      alert(`Error downloading file: ${error.message}`);
    }
  }

  // Function to delete file
  async function deleteFile(path) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      if (!confirm("Are you sure you want to delete this file?")) {
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "deleteFile",
        path: path,
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      // Refresh the file list after successful deletion
      listFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert(
        `Failed to delete file: ${error.message}\n\nPlease check the console for more details.`
      );
    }
  }

  // Function to delete all files
  async function deleteAllFiles() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("No active tab found");
      }

      if (
        !confirm(
          "Are you sure you want to delete ALL files? This action cannot be undone!"
        )
      ) {
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "deleteAllFiles",
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      // Refresh the file list after successful deletion
      listFiles();
    } catch (error) {
      console.error("Error deleting all files:", error);
      alert(
        `Failed to delete all files: ${error.message}\n\nPlease check the console for more details.`
      );
    }
  }

  // Function to list files in OPFS
  async function listFiles() {
    try {
      fileList.innerHTML = '<div class="empty-state">Loading files...</div>';

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log("Current tab:", tab);

      if (!tab) {
        throw new Error("No active tab found");
      }

      // First, try to inject the content script
      await injectContentScript(tab.id);

      // Wait a bit for the content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send message to content script to get OPFS files
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getOPFSFiles",
      });
      console.log("Response from content script:", response);

      if (response && response.files) {
        const files = response.files;

        if (files.length === 0) {
          fileList.innerHTML =
            '<div class="empty-state">No files found in OPFS</div>';
          return;
        }

        fileList.innerHTML = files
          .map(
            (file) => `
          <div class="file-item" data-path="${file.path}">
            <span class="file-icon">${getFileIcon(file.name)}</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <div class="file-actions">
              <button class="btn btn-info" data-action="details"><i class="fas fa-info-circle"></i></button>
              <button class="btn btn-danger" data-action="delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `
          )
          .join("");

        // Add click handlers to file items
        document.querySelectorAll(".file-item").forEach((item) => {
          const fileName = item.querySelector(".file-name");
          const deleteBtn = item.querySelector("[data-action='delete']");
          const detailsBtn = item.querySelector("[data-action='details']");

          fileName.addEventListener("click", () => {
            const path = item.dataset.path;
            downloadFile(path);
          });

          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent triggering the file download
            const path = item.dataset.path;
            deleteFile(path);
          });

          detailsBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent triggering the file download
            const file = response.files.find(
              (f) => f.path === item.dataset.path
            );
            if (file) {
              showFileDetails(file);
            }
          });
        });
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("Invalid response from content script");
      }
    } catch (error) {
      console.error("Error listing files:", error);
      fileList.innerHTML = `<div class="empty-state">Error loading files: ${error.message}</div>`;
    }
  }

  // Add event listeners
  uploadBtn.addEventListener("click", () => {
    console.log("Upload button clicked");
    fileInput.click();
  });

  fileInput.addEventListener("change", (event) => {
    console.log("File input changed:", event.target.files);
    if (event.target.files.length > 0) {
      uploadFiles(event.target.files);
    }
    // Reset the file input
    event.target.value = "";
  });

  refreshBtn.addEventListener("click", listFiles);
  deleteAllBtn.addEventListener("click", deleteAllFiles);

  // Modal close button event listener
  modalClose.addEventListener("click", hideFileDetails);

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideFileDetails();
    }
  });

  // Initial load
  listFiles();
});
