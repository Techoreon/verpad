// --- DOM Element References ---
const mainContainer = document.getElementById('mainContainer');
const editorPane = document.getElementById('editorPane'); // CodeMirror will be attached here
const previewWrapper = document.getElementById('previewWrapper');
const markdownPreviewPane = document.getElementById('markdownPreviewPane');
const codeExecutionFrame = document.getElementById('codeExecutionFrame');
const resizer = document.getElementById('resizer');
// markdownInput is removed, will use 'editor' (CodeMirror instance)
const charCountSpan = document.getElementById('charCount');
const wordCountSpan = document.getElementById('wordCount');
const lineColDisplaySpan = document.getElementById('lineColDisplay'); // New
const themeToggleButton = document.getElementById('themeToggle');
const bodyElement = document.body;

const tabMarkdown = document.getElementById('tabMarkdown');
const tabCode = document.getElementById('tabCode');
const previewTabMarkdown = document.getElementById('previewTabMarkdown');
const previewTabRunCode = document.getElementById('previewTabRunCode');
const currentModeDisplay = document.getElementById('currentModeDisplay');

const fileInput = document.getElementById('fileInput');
const openFileButton = document.getElementById('openFileButton');
const saveFileButton = document.getElementById('saveFileButton');
const clearEditorButton = document.getElementById('clearEditorButton'); // New
const copyCodeButton = document.getElementById('copyCodeButton'); // New

let currentEditorMode = 'markdown'; // 'markdown' or 'code'
let currentPreviewMode = 'markdown'; // 'markdown' or 'run_code'
let editor; // This will be our CodeMirror instance

// --- CORRECTED HTML Escaping Function ---
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    const str = String(unsafe);
    return str
     .replace(/&/g, "&")
     .replace(/</g, "<")
     .replace(/>/g, ">")
     .replace(/"/g, "'")
     .replace(/'/g, "'");

}


// --- Markdown Parser (Existing - assuming it's good) ---
function parseInline(text) { 
    let html = text;
    html = html.replace(/`([^`]+?)`/g, (match, codeContent) => `<code>${escapeHtml(codeContent)}</code>`);
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`);
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
        const parsedLinkText = parseInline(linkText); // Recursive call for nested inline elements in link text
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${parsedLinkText}</a>`;
    });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    return html;
}
function parseMarkdown(md) {
    const lines = md.split('\n'); let html = ""; let inUl = false, inOl = false, inCodeBlock = false;
    let codeLang = '', codeBuffer = [], currentParagraph = [];
    function flushP() { if (currentParagraph.length > 0) { html += `<p>${parseInline(currentParagraph.join('\n'))}</p>\n`; currentParagraph = []; } }
    function closeL() { if (inUl) { html += "</ul>\n"; inUl = false; } if (inOl) { html += "</ol>\n"; inOl = false; } }
    for (let l of lines) {
        if (l.startsWith("```")) { flushP(); closeL(); if (inCodeBlock) { html += `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBuffer.join('\n'))}\n</code></pre>\n`; inCodeBlock = false; codeBuffer = []; codeLang = ''; } else { inCodeBlock = true; codeLang = l.substring(3).trim(); } continue; }
        if (inCodeBlock) { codeBuffer.push(l); continue; }
        if (l.match(/^(\s*([-\*_])\s*){3,}\s*$/)) { flushP(); closeL(); html += "<hr>\n"; continue; }
        if (l.startsWith("### ")) { flushP(); closeL(); html += `<h3>${parseInline(l.substring(4))}</h3>\n`; }
        else if (l.startsWith("## ")) { flushP(); closeL(); html += `<h2>${parseInline(l.substring(3))}</h2>\n`; }
        else if (l.startsWith("# ")) { flushP(); closeL(); html += `<h1>${parseInline(l.substring(2))}</h1>\n`; }
        else if (l.startsWith(">")) { flushP(); closeL(); html += `<blockquote><p>${parseInline(l.substring(1).trimLeft())}</p></blockquote>\n`; }
        else if (l.match(/^(\s*[-\*\+]\s+)/)) { flushP(); if(inOl){html+="</ol>\n";inOl=false;} if(!inUl){html+="<ul>\n";inUl=true;} html += `<li>${parseInline(l.replace(/^(\s*[-\*\+]\s+)/, ''))}</li>\n`;}
        else if (l.match(/^(\s*\d+\.\s+)/)) { flushP(); if(inUl){html+="</ul>\n";inUl=false;} if(!inOl){html+="<ol>\n";inOl=true;} html += `<li>${parseInline(l.replace(/^(\s*\d+\.\s+)/, ''))}</li>\n`;}
        else if (l.trim() === "") { flushP(); closeL(); } else { closeL(); currentParagraph.push(l); }
    }
    flushP(); closeL(); if (inCodeBlock) { html += `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBuffer.join('\n'))}</code></pre>\n`;} return html;
}


// --- Input Handler ---
function handleInput() {
    const text = editor.getValue(); // Get content from CodeMirror
    localStorage.setItem(currentEditorMode === 'markdown' ? 'markdownPadContent' : 'codePadContent', text);

    charCountSpan.textContent = text.length;
    const words = text.trim().split(/\s+/).filter(Boolean);
    wordCountSpan.textContent = text.trim() === '' ? 0 : words.length;

    if (currentEditorMode === 'markdown' && currentPreviewMode === 'markdown') {
        if (text.trim() === '') {
            markdownPreviewPane.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Markdown Preview</p>';
        } else {
            try {
                markdownPreviewPane.innerHTML = parseMarkdown(text);
                // If you add a syntax highlighter for previewed code blocks (e.g., Prism.js)
                // You would call Prism.highlightAll() here or similar.
            }
            catch (e) { console.error("Markdown Error:", e); markdownPreviewPane.innerHTML = `<p class="error">Error rendering Markdown.</p>`; }
        }
    } else if (currentEditorMode === 'code' && currentPreviewMode === 'run_code') {
        runUserCodeDebounced(); // Use a debounced version
    }
}
// Debounce function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
const runUserCodeDebounced = debounce(runUserCode, 500); // Debounce runUserCode by 500ms


// --- Editor Mode Switching ---
function setEditorMode(mode) {
    currentEditorMode = mode;
    currentModeDisplay.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    
    const content = localStorage.getItem(mode === 'markdown' ? 'markdownPadContent' : 'codePadContent') || '';
    editor.setValue(content);

    if (mode === 'markdown') {
        editor.setOption('mode', 'markdown');
    } else if (mode === 'code') {
        editor.setOption('mode', 'htmlmixed');
    }
    
    tabMarkdown.classList.toggle('active', mode === 'markdown');
    tabCode.classList.toggle('active', mode === 'code');
    
    if (mode === 'markdown') setPreviewMode('markdown');
    else if (mode === 'code') setPreviewMode('run_code');

    handleInput(); // Refresh preview and counts
    editor.focus();
}
tabMarkdown.addEventListener('click', () => setEditorMode('markdown'));
tabCode.addEventListener('click', () => setEditorMode('code'));

// --- Preview Mode Switching ---
function setPreviewMode(mode) {
    currentPreviewMode = mode;
    previewTabMarkdown.classList.toggle('active', mode === 'markdown');
    previewTabRunCode.classList.toggle('active', mode === 'run_code');
    
    markdownPreviewPane.classList.toggle('active', mode === 'markdown');
    codeExecutionFrame.classList.toggle('active', mode === 'run_code');

    if (mode === 'markdown' && currentEditorMode === 'markdown') {
        handleInput(); 
    } else if (mode === 'run_code' && currentEditorMode === 'code') {
        runUserCode(); // Run immediately when switching to this tab
    } else if (mode === 'markdown' && currentEditorMode === 'code') {
         markdownPreviewPane.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Switch to Markdown editing tab to see Markdown preview, or "Run HTML/JS" tab to see code output.</p>';
    } else if (mode === 'run_code' && currentEditorMode === 'markdown') {
        // Optionally clear iframe or show a message
        codeExecutionFrame.srcdoc = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Switch to Code editing tab to run HTML/JS.</p>';
    }
}
previewTabMarkdown.addEventListener('click', () => setPreviewMode('markdown'));
previewTabRunCode.addEventListener('click', () => setPreviewMode('run_code'));

// --- Code Execution ---
function runUserCode() {
    if (currentEditorMode !== 'code' || currentPreviewMode !== 'run_code') return;
    const code = editor.getValue();

    // Construct the HTML to run, injecting current theme variables for basic consistency
    const isDark = bodyElement.classList.contains('dark-mode');
    const inheritedStyles = `
        body { 
            margin: 8px; 
            font-family: ${getComputedStyle(document.documentElement).getPropertyValue('--font-family-sans').trim() || 'sans-serif'};
            background-color: ${isDark ? '#1e1e1e' : '#ffffff'};
            color: ${isDark ? '#e0e0e0' : '#1a1a1a'};
        }
        /* Add more inherited styles if needed, e.g., for links */
        a { color: ${isDark ? '#4dabf7' : '#007bff'}; }
    `;

    const htmlToRun = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Code Execution</title>
            <style>
                ${inheritedStyles}
            </style>
        </head>
        <body>
            ${code}
        </body>
        </html>
    `;
    codeExecutionFrame.srcdoc = htmlToRun;
}

// --- Theme Toggle ---
function applyTheme(theme) {
    bodyElement.classList.toggle('dark-mode', theme === 'dark');
    themeToggleButton.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    if (editor) {
        editor.setOption('theme', theme === 'dark' ? 'material-darker' : 'eclipse'); // Use a light theme like 'eclipse' or 'default'
    }
    // If code is running in iframe, re-run to apply theme
    if (currentPreviewMode === 'run_code' && codeExecutionFrame.classList.contains('active')) {
        runUserCode();
    }
}
themeToggleButton.addEventListener('click', () => {
    const newTheme = bodyElement.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(newTheme); localStorage.setItem('theme', newTheme);
});

// --- File Operations ---
openFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            editor.setValue(e.target.result); // Set content to CodeMirror
            const ext = file.name.split('.').pop().toLowerCase();
            if (['md', 'txt'].includes(ext)) {
                setEditorMode('markdown');
            } else if (['html', 'htm'].includes(ext)) {
                setEditorMode('code'); // htmlmixed mode will be set
            } else if (['js', 'css'].includes(ext)) {
                setEditorMode('code'); // htmlmixed can handle this, or you could have specific sub-modes if editor was just for JS/CSS
            } else {
                handleInput(); // Refresh current mode with new content
            }
            fileInput.value = null; 
        };
        reader.readAsText(file);
    }
});

saveFileButton.addEventListener('click', () => {
    const content = editor.getValue();
    let filename = "document";
    let mimeType = "text/plain;charset=utf-8";
    const editorModeOption = editor.getOption("mode");

    if (editorModeOption === 'markdown') {
        filename = "document.md";
        mimeType = "text/markdown;charset=utf-8";
    } else if (editorModeOption === 'htmlmixed') {
        // Try to guess a more specific extension for code
        if (content.trim().toLowerCase().startsWith("<html") || content.trim().toLowerCase().startsWith("<!doctype html")) {
            filename = "document.html";
            mimeType = "text/html;charset=utf-8";
        } else if (content.match(/<\s*script[^>]*>/i) && !content.match(/<\s*style[^>]*>/i) && !content.match(/<\s*body[^>]*>/i)) {
            filename = "script.js"; // Primarily JS
             mimeType = "application/javascript;charset=utf-8";
        } else if (content.match(/<\s*style[^>]*>/i) && !content.match(/<\s*script[^>]*>/i) && !content.match(/<\s*body[^>]*>/i)) {
            filename = "style.css"; // Primarily CSS
            mimeType = "text/css;charset=utf-8";
        }
        else {
            filename = "code.html"; // Default to .html for htmlmixed
            mimeType = "text/html;charset=utf-8";
        }
    }
    downloadFile(filename, content, mimeType);
});

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// --- Resizer Logic (Existing) ---
let isResizing = false;
resizer.addEventListener('mousedown', (e) => {
    e.preventDefault(); isResizing = true; bodyElement.style.userSelect = 'none'; bodyElement.style.cursor = 'col-resize';
    // editorPane.style.pointerEvents = 'none'; // Might interfere with CodeMirror events if not careful
    // previewWrapper.style.pointerEvents = 'none';
    document.addEventListener('mousemove', handleResize); document.addEventListener('mouseup', stopResize);
});
function handleResize(e) {
    if (!isResizing) return;
    const containerRect = mainContainer.getBoundingClientRect();
    let editorWidth = e.clientX - containerRect.left;
    let previewAreaWidth = containerRect.right - e.clientX - resizer.offsetWidth;
    const minWidth = 100; 
    if (editorWidth < minWidth) { editorWidth = minWidth; previewAreaWidth = containerRect.width - editorWidth - resizer.offsetWidth; }
    if (previewAreaWidth < minWidth) { previewAreaWidth = minWidth; editorWidth = containerRect.width - previewAreaWidth - resizer.offsetWidth; }
    editorPane.style.flexBasis = editorWidth + 'px';
    previewWrapper.style.flexBasis = previewAreaWidth + 'px';
    if (editor) editor.refresh(); // Tell CodeMirror to refresh its layout
}
function stopResize() {
    if (!isResizing) return;
    isResizing = false; bodyElement.style.userSelect = 'auto'; bodyElement.style.cursor = 'default';
    // editorPane.style.pointerEvents = 'auto';
    // previewWrapper.style.pointerEvents = 'auto';
    document.removeEventListener('mousemove', handleResize); document.removeEventListener('mouseup', stopResize);
    if (editor) editor.refresh();
}

// --- New UI Feature Handlers ---
clearEditorButton.addEventListener('click', () => {
    editor.setValue('');
    editor.focus();
    handleInput(); // Update stats
});

copyCodeButton.addEventListener('click', () => {
    const textToCopy = editor.getValue();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Optional: Show "Copied!" feedback
            const originalText = copyCodeButton.textContent;
            copyCodeButton.textContent = 'Copied!';
            setTimeout(() => { copyCodeButton.textContent = originalText; }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy. Please try manual copy.');
        });
    } else {
        // Fallback for older browsers (less secure, more intrusive)
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed"; // Prevent scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            const originalText = copyCodeButton.textContent;
            copyCodeButton.textContent = 'Copied!';
            setTimeout(() => { copyCodeButton.textContent = originalText; }, 1500);
        } catch (err) {
            console.error('Fallback copy failed: ', err);
            alert('Failed to copy. Please try manual copy.');
        }
        document.body.removeChild(textArea);
    }
});


// --- Initialization ---
function init() {
    // Initialize CodeMirror
    editor = CodeMirror(editorPane, { // Pass the editorPane div as the parent
        value: '', // Initial content
        mode: 'markdown', // Default mode
        theme: 'eclipse', // Default light theme
        lineNumbers: true,
        lineWrapping: true,
        styleActiveLine: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        autoCloseTags: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        // lint: true, // Enable if you set up linters
    });

    // Event listener for CodeMirror changes
    editor.on('change', handleInput);

    // Event listener for cursor activity (line/col numbers)
    editor.on('cursorActivity', (cm) => {
        const cursor = cm.getCursor();
        lineColDisplaySpan.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    });
    
    // Load theme preference
    const savedUserTheme = localStorage.getItem('theme');
    if (savedUserTheme) {
        applyTheme(savedUserTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light'); // Default to light theme, CodeMirror theme will be set in applyTheme
    }
    
    // Set initial editor mode and content
    // Check localStorage for last active mode, default to markdown
    const lastActiveEditorMode = localStorage.getItem('lastActiveEditorMode') || 'markdown';
    setEditorMode(lastActiveEditorMode); 
    // handleInput will be called by setEditorMode, which loads content and updates UI

    // Refresh CodeMirror after everything is set up, especially if initially hidden or resized
    setTimeout(() => editor.refresh(), 100);
}

// Store last active editor mode to restore on next visit
window.addEventListener('beforeunload', () => {
    localStorage.setItem('lastActiveEditorMode', currentEditorMode);
});

init();
