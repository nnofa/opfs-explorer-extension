// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("OPFS Explorer extension installed/updated");
});

// Handle any background tasks here if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Add any background message handling here
  return false;
});
