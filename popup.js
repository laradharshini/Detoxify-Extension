// popup.js
chrome.storage.sync.get({ blockedCount: 0 }, (data) => {
    document.getElementById('blocked-count').textContent = data.blockedCount;
});
