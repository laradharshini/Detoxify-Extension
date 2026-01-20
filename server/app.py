from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import os
import json

app = Flask(__name__)
CORS(app)

# --- Configuration ---
# Your Groq API Key
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

print("\n--- DETOXIFY: GROQ ENGINE ACTIVE ---")
print("Listening on http://localhost:5000\n")

# --- Fallback Logic ---
def heuristic_analyze(text):
    toxic_words = ['stupid', 'idiot', 'shut up', 'hate', 'kill', 'die', 'ugly', 'loser', 'trash', 'dumb']
    matches = [word for word in toxic_words if word in text.lower()]
    return {
        "isToxic": len(matches) > 0,
        "matches": matches,
        "suggestions": {
            "kind": "Let's keep our language polite and respectful.",
            "funny": "I'm sure we can express that more positively! 😄",
            "professional": "Please rephrase this to be more professional."
        },
        "kindSuggestion": "Checking your message... (Local Guard Active)",
        "provider": "local_heuristic"
    }

def analyze_with_groq(text, api_key=None):
    try:
        # Use provided key or fallback to default
        key_to_use = api_key if api_key and api_key.startswith("gsk_") else GROQ_API_KEY
        local_client = Groq(api_key=key_to_use)

        # Prompt for strict JSON output with Multi-language support
        prompt = f"""
        Analyze the following message for toxicity (insults, hate speech, threats, harassment, or verbal aggression).
        Message: "{text}"

        If the message is toxic, provide three alternative ways to say the SAME THING but in a non-toxic manner, using the SAME LANGUAGE as the original message.

        Style Guidelines for Suggestions:
        1. "kind": A polite, empathetic, and respectful way to express the core idea. Avoid literal translations; use idiomatic expressions that sound natural in the target language.
        2. "funny": A lighthearted, humorous, or witty take that defuses the situation without being offensive.
        3. "professional": A formal, objective, and workplace-appropriate version.

        Respond ONLY with a valid JSON object in this exact format:
        {{
          "isToxic": boolean,
          "matches": ["list", "of", "toxicity", "types"],
          "suggestions": {{
            "kind": "string",
            "funny": "string",
            "professional": "string"
          }}
        }}

        IMPORTANT:
        - If NOT toxic, suggestions MUST be empty strings.
        - The language of suggestions MUST match the language of the original message.
        - For Indian languages (Tamil, Hindi, etc.), ensure the grammar and tone are natural and socially appropriate.
        """
        
        chat_completion = local_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are 'Detoxify', an expert multi-lingual social mediator. You excel at de-escalating conflict by suggesting natural, idiomatic alternatives to toxic messages in English and all major Indian languages (Hindi, Tamil, Telugu, etc.). You always respond in strict JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.4, # Slightly higher for more creative/natural suggestions
            max_tokens=512
        )
        
        result = json.loads(chat_completion.choices[0].message.content)
        result["provider"] = "groq"
        # Backward compatibility for old extension versions
        if "suggestions" in result:
            result["kindSuggestion"] = result["suggestions"].get("kind", "")
        return result
    except Exception as e:
        print(f"Groq API Error: {e}")
        return None

# --- API Route ---
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({"isToxic": False, "matches": [], "kindSuggestion": ""})

        # Try Groq with optional user key
        result = analyze_with_groq(text, api_key=data.get('groqKey'))
        if result:
            return jsonify(result)
        
        # Final Fallback (Heuristic) if Groq fails
        print("Detoxify: Groq failed or limit reached. Using local heuristic.")
        return jsonify(heuristic_analyze(text))

    except Exception as e:
        print(f"Server Error: {str(e)}")
        return jsonify({
            "isToxic": False, 
            "matches": [], 
            "kindSuggestion": "", 
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Start the Flask app
    app.run(port=5000, debug=True)
