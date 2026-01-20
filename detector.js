/**
 * Detoxify Backend Client
 * Redirects analysis requests to our Flask server.
 */

class DetoxifyDetector {
    constructor() {
        // Change this if your server is hosted elsewhere
        this.apiUrl = 'http://localhost:5000/analyze';
    }

    async analyze(text, apiKey) {
        // apiKey is no longer needed here as it's on the server,
        // but we keep the signature for compatibility with background.js

        if (!text || !text.trim()) {
            return { isToxic: false, matches: [], kindSuggestion: "" };
        }

        try {
            console.log("Detoxify: Fetching analysis from backend for:", text.substring(0, 20) + "...");
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, groqKey: apiKey })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("Detoxify: Backend returned error:", err);
                throw new Error(err.error || 'Server request failed');
            }

            const data = await response.json();
            console.log("Detoxify: Backend response received:", data);
            return data;

        } catch (error) {
            console.error("Detoxify: Backend analysis failed:", error);
            // Check if server is potentially down
            if (error.message.includes('Failed to fetch')) {
                return {
                    isToxic: false,
                    matches: [],
                    kindSuggestion: "",
                    error: "Detoxify Server is not running. Please start app.py."
                };
            }
            return {
                isToxic: false,
                matches: [],
                kindSuggestion: "",
                error: error.message
            };
        }
    }
}

self.DetoxifyDetector = DetoxifyDetector;
