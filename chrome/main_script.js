inject_script();


function inject_script() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected_script.js');
    s.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
}
