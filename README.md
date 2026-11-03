# StudySphere – Smart Quiz Portal

## Introduction
StudySphere is a student-project web app that uses Google Gemini to generate quizzes, study notes and written content, and tracks your quiz results on a dashboard.

## Features
- **Dashboard:** welcome banner, quizzes completed, best/average score, recent activity, per-topic study progress
- **AI Quiz Generator:** topic, 5/10/15 questions, Easy/Medium/Hard, four options each, automatic marking and correct-answer review
- **Study Material:** AI notes with headings, a summary and bullet points
- **Writing Tool:** essays, summaries and explanations
- **Quiz History:** saved in your browser

## Technologies
HTML5, CSS3, vanilla JavaScript, Google Gemini API (`gemini-3.5-flash-lite`). No frameworks, backend or database.

## Configure the Gemini API key
1. Create a key in Google AI Studio.
2. Open `script.js` and edit the one marked line near the top:
   `const GEMINI_API_KEY = "YOUR_API_KEY_HERE";`
3. Save the file.

### Why `.env` is not read
A plain browser page **cannot read `.env` files**; only server-side tools (Node.js, etc.) can. The `.env` file here is only a **configuration template** that records the key and model names. The app really uses the `GEMINI_API_KEY` and `GEMINI_MODEL` constants in `script.js`.

## Run locally
Extract the ZIP and double-click `index.html` (or use VS Code "Live Server"). An internet connection is required.

## How localStorage works
After each submitted quiz, topic, score, total, percentage and date are saved in your browser's `localStorage` under the key `studysphere_history` (latest 100 attempts). The data stays on your device and browser. Clearing browser data, or the "Clear history" button, removes it.

## Why the frontend API key is visible
All JavaScript runs in the user's browser, so anyone can open `script.js` or the browser's developer tools / network tab and read the key. **It is not secret or protected.** Use a free, restricted key for demos, never commit it publicly, and delete it afterwards. A real product should keep the key on a backend server that calls Gemini for the user.
