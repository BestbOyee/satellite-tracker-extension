document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('toggle-override');
    
    chrome.storage.local.get(['customNewTabEnabled'], (data) => {
      const isEnabled = data.customNewTabEnabled !== false;
      btn.textContent = isEnabled ? "Disable Custom New Tab" : "Enable Custom New Tab";
    });
  
    btn.addEventListener('click', () => {
      chrome.storage.local.get(['customNewTabEnabled'], (data) => {
        const isEnabled = data.customNewTabEnabled !== false;
        const newState = !isEnabled;
        
        chrome.storage.local.set({ customNewTabEnabled: newState }, () => {
          btn.textContent = newState ? "Disable Custom New Tab" : "Enable Custom New Tab";
        });
      });
    });
  });