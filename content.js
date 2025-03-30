// Function to get the root directory of OPFS
async function getOPFSRoot() {
  try {
    const root = await navigator.storage.getDirectory();
    return root;
  } catch (error) {
    console.error("Error accessing OPFS:", error);
    throw error;
  }
}

// Function to recursively get all files in a directory
async function getAllFiles(dir, path = "") {
  const files = [];

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
        });
      } else if (entry.kind === "directory") {
        const subFiles = await getAllFiles(entry, entryPath);
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
async function readFile(path) {
  try {
    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectory(parts[i], { create: false });
    }

    const fileName = parts[parts.length - 1];
    const file = await current.getFile(fileName);
    return file;
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
}

// Function to save a file to OPFS
async function saveFile(file, path) {
  try {
    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);
    let current = root;

    // Create directories if they don't exist
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectory(parts[i], { create: true });
    }

    const fileName = parts[parts.length - 1];
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    return true;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

// Function to delete a file from OPFS
async function deleteFile(path) {
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
      throw new Error(`Failed to delete file '${fileName}': ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

// Function to download a file
async function downloadFile(file, fileName) {
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
async function deleteAllFiles() {
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
        throw new Error(`Failed to delete ${entry.name}: ${error.message}`);
      }
    }

    console.log("Successfully deleted all files");
    return true;
  } catch (error) {
    console.error("Error deleting all files:", error);
    throw error;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received request:", request);
  if (request.action === "getOPFSFiles") {
    // Get all files from OPFS
    getOPFSRoot()
      .then((root) => {
        return getAllFiles(root);
      })
      .then((files) => {
        sendResponse({ files });
      })
      .catch((error) => {
        console.error("Error getting OPFS files:", error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === "openFile") {
    // Read and open the file
    readFile(request.path)
      .then((file) => {
        // Create a blob URL for the file
        const blobUrl = URL.createObjectURL(file);

        // Open the file in a new tab
        window.open(blobUrl, "_blank");

        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error opening file:", error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === "downloadFile") {
    // Download file from OPFS
    downloadFile(request.path)
      .then(() => {
        console.log(`Successfully downloaded file: ${request.path}`);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error(`Error downloading file ${request.path}:`, error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === "uploadFile") {
    console.log("Processing file upload:", request.path);
    uploadFile(request.file, request.path, request.type, request.size)
      .then(() => {
        console.log(`Successfully uploaded file: ${request.path}`);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error(`Error uploading file ${request.path}:`, error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === "deleteFile") {
    // Delete the file from OPFS
    deleteFile(request.path)
      .then(() => {
        console.log(`Successfully deleted file: ${request.path}`);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error(`Error deleting file ${request.path}:`, error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === "deleteAllFiles") {
    deleteAllFiles()
      .then(() => {
        console.log("Successfully deleted all files");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error deleting all files:", error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

// Function to upload a file to OPFS
async function uploadFile(fileData, path, type, size) {
  try {
    console.log("Starting file upload:", { path, type, size });
    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);
    let current = root;

    // Navigate to the parent directory
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectory(parts[i], { create: true });
        console.log("Created/accessed directory:", parts[i]);
      } catch (error) {
        throw new Error(`Directory '${parts[i]}' not found in path: ${path}`);
      }
    }

    const fileName = parts[parts.length - 1];
    try {
      console.log("Creating file handle for:", fileName);
      const fileHandle = await current.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      console.log("Writing file data, size:", fileData.byteLength);
      await writable.write(fileData);
      await writable.close();
      console.log("File upload completed successfully");
      return true;
    } catch (error) {
      console.error("Error writing file:", error);
      throw new Error(`Failed to write file '${fileName}': ${error.message}`);
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}
