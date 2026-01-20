// background.js - Service worker for Detoxify

importScripts(
    'detector.js'
);

let detector = new DetoxifyDetector();
let toxicityState = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_TEXT') {
        handleAnalysis(request.text, request.groqKey, sendResponse);
        return true;
    }
    if (request.type === 'TOXIC_MESSAGE_DETECTED') {
        handleToxicMessage(request.data, sender.tab.id);
    }
    if (request.type === 'REPORT_MESSAGE') {
        sendEmailReport(request.data);
        triggerWhatsAppAlert(request.data);
    }
});

async function handleAnalysis(text, groqKey, sendResponse) {
    console.log("Detoxify: background.js received ANALYZE_TEXT for:", text.substring(0, 20) + "...");
    try {
        const result = await detector.analyze(text, groqKey);
        console.log("Detoxify: Analysis result from for detector:", result);
        sendResponse(result);
    } catch (error) {
        console.error("Detoxify: Analysis failed:", error);
        sendResponse({ isToxic: false, error: error.message });
    }
}
// Removed redundant handleToxicStateUpdate

async function handleToxicMessage(data, tabId) {
    const { conversationId, text, labels, isOutgoing } = data;

    // Fetch settings
    const settings = await chrome.storage.sync.get({
        alertThreshold: 3,
        blockedCount: 0
    });

    // 1. Increment global blocked count for the popup
    chrome.storage.sync.set({
        blockedCount: settings.blockedCount + 1
    });

    // 2. Track toxicity in state for this conversation
    if (!toxicityState[conversationId]) {
        toxicityState[conversationId] = {
            count: 0,
            lastSeen: Date.now()
        };
    }

    toxicityState[conversationId].count++;

    // 3. Trigger alert if threshold reached
    const threshold = Number(settings.alertThreshold);
    if (toxicityState[conversationId].count === threshold) {
        // We only trigger a browser notification when threshold is reached, 
        // but WE DO NOT send an email automatically anymore to prevent spam.
        // The user prefers manual reporting via the 'Report' button.
        showThresholdNotification(conversationId, threshold);
    }
}

function showThresholdNotification(conversationId, threshold) {
    if (chrome.notifications) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Detoxify: High Toxicity',
            message: `Warning: ${threshold} toxic messages detected in this chat. Consider reporting if you feel unsafe.`,
            priority: 1
        });
    }
}

// function triggerEmergencyAlert(...) { ... } is now replaced by showThresholdNotification for manual flow preference.

async function sendEmailReport(data) {
    const settings = await chrome.storage.sync.get([
        'trustedEmail',
        'emailServiceId',
        'emailTemplateId',
        'emailjsKey'
    ]);

    const trustedEmail = settings.trustedEmail;
    const service_id = settings.emailServiceId;
    const template_id = settings.emailTemplateId;
    const user_id = settings.emailjsKey;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trustedEmail || !emailRegex.test(trustedEmail)) {
        console.warn("Detoxify: Invalid or missing trusted email address. skipping report.");
        return;
    }

    const emailData = {
        service_id: service_id,
        template_id: template_id,
        user_id: user_id,
        template_params: {
            trustedEmail: trustedEmail,
            message: `A toxic message was detected and flagged on WhatsApp Web.

DETAILS:
- Conversation: ${data.conversationId || 'Private Chat'}
- Toxicity Flags: ${(data.labels || []).join(', ') || 'General Warning'}
- Message Content: "${data.text}"

Please check in with the user if this behavior persists.`,
            title: "🚨 DETOXIFY: TOXICITY REPORT GENERATED",
            name: "Detoxify Guard System",
            toxicity_labels: (data.labels || []).join(', ')
        }
    };

    try {
        console.log("Detoxify: Sending email report via EmailJS...", emailData);
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
        });

        if (response.ok) {
            console.log("Detoxify: Email report sent successfully!");
        } else {
            const error = await response.text();
            console.error("Detoxify: EmailJS error:", error);
        }
    } catch (err) {
        console.error("Detoxify: Failed to send email report:", err);
    }
}

async function triggerWhatsAppAlert(data) {
    const { trustedPhone } = await chrome.storage.sync.get('trustedPhone');
    if (!trustedPhone) {
        console.warn("Detoxify: No trusted WhatsApp number configured.");
        return;
    }

    // Since we need to interact with the WhatsApp Web DOM or open a tab,
    // we send a message back to the content script to handle the UI part.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'SEND_WHATSAPP_ALERT',
                data: {
                    phone: trustedPhone,
                    text: data.text,
                    labels: data.labels
                }
            });
        }
    });
}
