// options.js

function saveOptions() {
    const trustedEmail = document.getElementById('trustedEmail').value;
    const trustedPhone = document.getElementById('trustedPhone').value;
    const emailServiceId = document.getElementById('emailServiceId').value;
    const emailTemplateId = document.getElementById('emailTemplateId').value;
    const emailjsKey = document.getElementById('emailjsKey').value;
    const alertThreshold = document.getElementById('alertThreshold').value;
    const groqApiKey = document.getElementById('groqApiKey').value;

    chrome.storage.sync.set({
        trustedEmail: trustedEmail,
        trustedPhone: trustedPhone,
        emailServiceId: emailServiceId,
        emailTemplateId: emailTemplateId,
        emailjsKey: emailjsKey,
        alertThreshold: alertThreshold,
        groqApiKey: groqApiKey // Use Groq instead of Gemini
    }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Settings saved successfully!';
        status.style.color = '#128c7e';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });
}

function restoreOptions() {
    chrome.storage.sync.get({
        trustedEmail: '',
        trustedPhone: '',
        emailServiceId: 'service_xn41bmg',
        emailTemplateId: 'template_lzfvjhn',
        emailjsKey: '2_gC-ZKy79JYi5pY9',
        alertThreshold: '3',
        groqApiKey: ''
    }, (items) => {
        document.getElementById('trustedEmail').value = items.trustedEmail;
        document.getElementById('trustedPhone').value = items.trustedPhone;
        document.getElementById('emailServiceId').value = items.emailServiceId;
        document.getElementById('emailTemplateId').value = items.emailTemplateId;
        document.getElementById('emailjsKey').value = items.emailjsKey;
        document.getElementById('alertThreshold').value = items.alertThreshold;
        document.getElementById('groqApiKey').value = items.groqApiKey;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
