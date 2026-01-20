/**
 * content.js - Primary observer for WhatsApp Web
 */

// --- Auto-Send Logic (Runs on newly opened alert tabs) ---
if (window.location.search.includes('autodetox=1')) {
    console.log("Detoxify: Auto-send mode activated. Waiting for send button...");

    const sendInterval = setInterval(() => {
        // WhatsApp Web Send Button selectors
        const sendBtn = document.querySelector('button span[data-icon="send"]') ||
            document.querySelector('button[aria-label="Send"]');

        if (sendBtn) {
            console.log("Detoxify: Send button found! Clicking...");
            const button = sendBtn.closest('button');
            button.click();
            clearInterval(sendInterval);

            // Close tab after a short delay to ensure message is sent
            setTimeout(() => {
                console.log("Detoxify: Mission accomplished. Closing tab.");
                window.close();
            }, 3000);
        }
    }, 1000);

    // Safety timeout to prevent infinite loop if button never appears
    setTimeout(() => clearInterval(sendInterval), 30000);
}

// Inject detector script if not already bundled
async function analyzeWithBackground(text) {
    if (!chrome.runtime?.id) {
        console.warn("Detoxify: Extension context invalidated. Please refresh the page.");
        return { isToxic: false };
    }

    const settings = await chrome.storage.sync.get(['groqApiKey']);
    console.log("Detoxify: content.js sending ANALYZE_TEXT...");
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({
                type: 'ANALYZE_TEXT',
                text,
                groqKey: settings.groqApiKey
            }, (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    console.warn("Detoxify: Runtime error (context likely invalid):", error.message);
                    resolve({ isToxic: false });
                } else {
                    console.log("Detoxify: content.js received response:", response);
                    resolve(response || { isToxic: false });
                }
            });
        } catch (e) {
            console.warn("Detoxify: Send message failed. Please refresh the page.");
            resolve({ isToxic: false });
        }
    });
}

// Listener for background messages (like WhatsApp alerts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SEND_WHATSAPP_ALERT') {
        sendWhatsAppAlert(request.data);
    }
});

function sendWhatsAppAlert(data) {
    const { phone, text, labels } = data;
    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
    const message = `🚨 *DETOXIFY SECURITY ALERT* 🚨

*Harmful Behavior Detected* in your WhatsApp conversations.

📍 *Chat ID:* ${data.conversationId}
⚠️ *Toxicity Type:* ${(labels || []).join(', ').toUpperCase() || 'GENERAL TOXICITY'}
💬 *Flagged Content:* "${text}"

---
*Automatic Action Taken:*
This message has been flagged and blurred. An automated report has also been dispatched to the trusted email on file.

_Detoxify: Making web space safer, one message at a time._`;

    console.log("Detoxify: Triggering WhatsApp alert to:", cleanPhone);

    // We open a direct web.whatsapp.com link to bypass the "Continue to Chat" landing page
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}&autodetox=1`;
    window.open(url, '_blank');
}

// Observe the chat window for new messages
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    processNewNode(node);
                }
            });
        }
    }
});

function processNewNode(node) {
    const messageElements = node.querySelectorAll?.('[data-pre-plain-text]') || [];

    messageElements.forEach(msgEl => {
        const text = msgEl.textContent;
        if (text && !msgEl.hasAttribute('data-detoxified')) {
            console.log("Detoxify: Found new message to analyze:", text.substring(0, 20) + "...");
            analyzeMessage(msgEl, text);
        }
    });

    // Also look for the input field to intercept outgoing messages
    const inputField = node.querySelector?.('footer div[contenteditable="true"]');
    if (inputField && !inputField.hasAttribute('data-detoxified-listener')) {
        setupInputListener(inputField);
    }
}

async function analyzeMessage(element, text) {
    element.setAttribute('data-detoxified', 'true');
    const isOutgoing = element.closest('.message-out') !== null;

    const result = await analyzeWithBackground(text);
    if (result && result.isToxic) {
        flagMessage(element, result.matches);

        // Notify background for tracking
        chrome.runtime.sendMessage({
            type: 'TOXIC_MESSAGE_DETECTED',
            data: {
                conversationId: getConversationId(),
                text: text,
                labels: result.matches,
                isOutgoing: isOutgoing
            }
        });
    }
}

function flagMessage(element, labels) {
    const badge = document.createElement('span');
    badge.className = 'detoxify-badge';
    badge.textContent = `⚠️ Flagged: ${labels.join(', ')}`;

    // Injected alert box
    const alertBox = document.createElement('div');
    alertBox.className = 'detoxify-alert';
    alertBox.innerHTML = `
        <strong>Detoxify Warning:</strong> This message may be harmful.
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            <button class="detoxify-kind-btn report-btn">Report to Trusted</button>
            <button class="detoxify-kind-btn hide-btn">Hide Message</button>
            <button class="detoxify-kind-btn unhide-btn" style="display: none;">Unhide Message</button>
        </div>
    `;

    element.appendChild(badge);
    element.prepend(alertBox);

    // Event Listeners for Report and Hide
    const reportBtn = alertBox.querySelector('.report-btn');
    const hideBtn = alertBox.querySelector('.hide-btn');
    const unhideBtn = alertBox.querySelector('.unhide-btn');

    reportBtn.addEventListener('click', async () => {
        if (!chrome.runtime?.id) {
            alert("Extension context invalidated. Please refresh.");
            return;
        }

        const settings = await chrome.storage.sync.get(['trustedEmail', 'trustedPhone']);
        if (!settings.trustedEmail && !settings.trustedPhone) {
            alert("Please set up a Trusted Contact in Extension Options first!");
            return;
        }

        // Extract original text (removing our UI text)
        const text = element.innerText.split('Detoxify Warning')[0].trim();
        chrome.runtime.sendMessage({
            type: 'REPORT_MESSAGE',
            data: {
                text: text,
                conversationId: getConversationId(),
                labels: labels
            }
        });

        reportBtn.textContent = 'ReportSent ✓';
        reportBtn.disabled = true;
        reportBtn.style.opacity = '0.7';
    });

    let isHidden = false;
    const toggleBlur = (hide) => {
        isHidden = hide;
        if (isHidden) {
            element.style.filter = 'blur(10px)';
            element.style.opacity = '0.3';
            hideBtn.style.display = 'none';
            unhideBtn.style.display = 'inline-block';
        } else {
            element.style.filter = 'none';
            element.style.opacity = '1';
            hideBtn.style.display = 'inline-block';
            unhideBtn.style.display = 'none';
        }
    };

    hideBtn.addEventListener('click', () => toggleBlur(true));
    unhideBtn.addEventListener('click', () => toggleBlur(false));
}

function setupInputListener(inputField) {
    inputField.setAttribute('data-detoxified-listener', 'true');

    inputField.addEventListener('input', debounce(async (e) => {
        const text = inputField.textContent;
        const result = await analyzeWithBackground(text);

        if (result && result.isToxic) {
            showOutboundWarning(inputField, text, result);
        } else {
            removeOutboundWarning(inputField);
        }
    }, 1000));
}

function showOutboundWarning(inputField, text, result) {
    let warning = document.getElementById('detoxify-input-warning');
    if (!warning) {
        warning = document.createElement('div');
        warning.id = 'detoxify-input-warning';
        warning.className = 'detoxify-alert';
        inputField.parentElement.parentElement.prepend(warning);
    }

    const suggestions = result.suggestions || {
        kind: result.kindSuggestion || "Let's be polite. / कृपया विनम्र रहें। / தயவுசெய்து பணிவாக இருங்கள்.",
        funny: "Let's add some humor! / थोड़ा मज़ाक हो जाए! / கொஞ்சம் நகைச்சுவையாக இருக்கலாம்!",
        professional: "Let's keep it formal. / इसे औपचारिक रखें। / இதை முறைப்படி வைத்திருங்கள்."
    };

    warning.innerHTML = `
        <strong>Be Kind!</strong> Your message might be seen as harmful.
        <div style="margin-top: 8px;">
            <div style="margin-bottom: 8px;">
                <span class="detox-style-label">Kind:</span> <em>"${suggestions.kind}"</em>
            </div>
            <div style="margin-bottom: 8px;">
                <span class="detox-style-label">Funny:</span> <em>"${suggestions.funny}"</em>
            </div>
            <div style="margin-bottom: 8px;">
                <span class="detox-style-label">Formal:</span> <em>"${suggestions.professional}"</em>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
            <button id="detoxify-replace-btn-kind" class="detoxify-kind-btn detoxify-style-btn">Use Kind</button>
            <button id="detoxify-replace-btn-funny" class="detoxify-kind-btn detoxify-style-btn">Use Funny</button>
            <button id="detoxify-replace-btn-professional" class="detoxify-kind-btn detoxify-style-btn">Use Professional</button>
        </div>
    `;

    const handleReplace = (newText) => {
        // Find the input field specifically
        const input = document.querySelector('footer div[contenteditable="true"]');
        if (!input) {
            console.error("Detoxify: Input field not found for replacement.");
            return;
        }

        console.log("Detoxify: Executing robust replacement to:", newText);
        input.focus();

        // Use a multi-stage approach to ensure framework state updates
        setTimeout(() => {
            try {
                // 1. Select everything
                document.execCommand('selectAll', false, null);

                // 2. Use DataTransfer to simulate a Paste event
                // This is often more reliable for React/Lexical than insertText
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', newText);

                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true
                });

                input.dispatchEvent(pasteEvent);

                // 3. Fallback: If paste didn't replace text, use insertText
                setTimeout(() => {
                    const currentText = input.textContent || "";
                    if (currentText !== newText) {
                        console.log("Detoxify: Paste fallback to insertText...");
                        document.execCommand('selectAll', false, null);
                        document.execCommand('insertText', false, newText);
                    }

                    // 4. Force state update events
                    ['input', 'change', 'keyup'].forEach(type => {
                        input.dispatchEvent(new Event(type, { bubbles: true }));
                    });
                }, 50);

            } catch (err) {
                console.error("Detoxify: Replacement failed:", err);
                // Last ditch effort: Direct DOM change (might break React state but visible)
                input.innerText = newText;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            removeOutboundWarning(input);
        }, 50);
    };

    warning.addEventListener('click', (e) => {
        const btn = e.target.closest('.detoxify-style-btn');
        if (!btn) return;

        if (btn.id === 'detoxify-replace-btn-kind') handleReplace(suggestions.kind);
        if (btn.id === 'detoxify-replace-btn-funny') handleReplace(suggestions.funny);
        if (btn.id === 'detoxify-replace-btn-professional') handleReplace(suggestions.professional);
    });
}

function removeOutboundWarning(inputField) {
    const warning = document.getElementById('detoxify-input-warning');
    if (warning) warning.remove();
}

function getConversationId() {
    const match = window.location.href.match(/[\/t\/]([\w@-]+)/);
    return match ? match[1] : 'default_convo';
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

observer.observe(document.body, { childList: true, subtree: true });
console.log("Detoxify: Observer started.");
