# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation (PL-5) creates a Mutual NDA via AI chat, with a fake sign-in screen (no authentication yet). Support for all 11 document types (PL-6) and real accounts with saved documents (PL-7) are planned.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use OpenAI. An OPENAI_API_KEY is in .env in the project root
Use `gpt-4o-mini` as the model. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.


## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed (PL-4)
- Docker multi-stage build (Node frontend + Python backend)
- FastAPI backend with SQLite (fresh DB each container start)
- Next.js static export served by FastAPI at localhost:8000
- SQLite users table (no auth endpoints yet); GET /api/health
- Fake sign-in screen at / (no authentication); NDA creator at /nda
- Start/stop scripts for Mac, Linux, Windows
- Mutual NDA form with live preview and PDF download

### Completed (PL-5)
- AI chat interface for NDA creation, with an "Edit fields" tab to edit the same fields by hand
- Use OpenAI for the AI calls. An OPENAI_API_KEY is in .env in the project root
- Use `gpt-4o-mini` as the model
- Structured outputs for reliable field extraction from conversation
- Live preview updates as AI extracts fields from chat
- AI greets user, asks questions conversationally, and confirms when complete
- Download button appears when all required fields are gathered (everything except modifications)
- Stateless chat: POST /api/chat/message takes the conversation + current fields, returns reply + fields

### Planned (PL-6)
- Support for all 11 document types from catalog.json
- AI detects document type from user requests and routes accordingly
- Dedicated preview/PDF components for Mutual NDA, Cloud Service Agreement, Pilot Agreement
- Generic preview/PDF components for remaining document types (Design Partner, SLA, Professional Services, Partnership, Software License, DPA, BAA, AI Addendum)
- Auto-focus chat input after sending messages
- AI always asks follow-on questions when more information is needed

### Planned (PL-7)
- Functional user authentication with JWT tokens in HttpOnly cookies
- User signup and signin with email/password (bcrypt password hashing)
- Document persistence - users can save documents to their account
- My Documents modal to view, load, and delete saved documents
- User menu with sign out functionality
- New Document button to start fresh
- Auth context for managing user state across the app
- Protected document save/load endpoints

### Current API Endpoints
- `GET /api/chat/greeting` - Get AI greeting
- `POST /api/chat/message` - Send chat message and get AI response
- `GET /api/health` - Health check

### Planned API Endpoints (PL-7)
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - Sign in and receive JWT cookie
- `POST /api/auth/signout` - Clear auth cookie
- `GET /api/auth/me` - Get current user info
- `GET /api/documents` - List user's saved documents (auth required)
- `POST /api/documents` - Save new document (auth required)
- `GET /api/documents/{id}` - Get specific document (auth required)
- `PUT /api/documents/{id}` - Update document (auth required)
- `DELETE /api/documents/{id}` - Delete document (auth required)
