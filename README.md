# Detoxify

Detoxify is a Chrome extension designed to monitor and mitigate toxic behavior on social platforms (starting with WhatsApp Web). It uses AI to analyze messages and provides non-toxic, kind, or professional alternatives in real-time.

## Features
- **Real-time Toxicity Detection:** Automatically scans messages for harmful content.
- **Smart Suggestions:** Powered by Groq/LLM to suggest polite or funny alternatives in multiple languages (Hindi, Tamil, English, etc.).
- **Incident Reporting:** Manual reporting system to notify trusted contacts via Email or WhatsApp.
- **Privacy First:** Analyzes text locally or via secure API calls.

## How to Install and Use

Since this extension is in development, others can access it by following these steps:

### 1. Download the Project
- Clone this repository:
  ```bash
  git clone https://github.com/laradharshini/Detoxify-Extension.git
  ```
- Or download the ZIP file from GitHub and extract it.

### 2. Load the Extension in Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click on **Load unpacked**.
4. Select the folder where you downloaded/extracted the project (the one containing `manifest.json`).

### 3. Start the Backend Server (Required for AI)
The AI analysis depends on a Flask backend.
1. Navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set your Groq API Key as an environment variable:
   - **Windows (PowerShell):** `$env:GROQ_API_KEY="your_key_here"`
   - **Mac/Linux:** `export GROQ_API_KEY="your_key_here"`
4. Run the server:
   ```bash
   python app.py
   ```
*The server must be running at `http://localhost:5000` for the AI features to work.*

## Configuration
Once installed, click the **Detoxify Icon** in your browser toolbar to:
- Set your preferred Toxicity Alert Threshold.
- Configure your **Trusted Email** for incident reports.
- Enter your own **Groq API Key** if you prefer to use your own quota.
