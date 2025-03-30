// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("OPFS Explorer extension installed/updated");
});
