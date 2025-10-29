# Health Checker API

## Overview
This is a backend service built with Node.js and Express using TypeScript. It functions as an AI-driven health assistant by integrating with the Boolbyte Engine for session management, task processing, and interaction with a FHIR data store, as well as the Google Maps API for location-based services.

## Features
- **Express**: Provides a robust framework for building the RESTful API endpoints.
- **Boolbyte Engine SDK**: Manages AI sessions, task creation, and interaction with external AI models and tools.
- **Axios**: Used for making HTTP requests to third-party services like the Google Maps API.
- **FHIR Client**: Integrates with a FHIR data store for health record management (initialization shown).

## Getting Started
### Installation
1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd health-checker
    ```
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Create an environment file**
    Create a `.env` file in the root of the project and add the necessary environment variables.
    ```bash
    touch .env
    ```
4.  **Run the development server**
    ```bash
    npm run dev
    ```
    The server will be running at `http://localhost:3000`.

### Environment Variables
All required environment variables must be set in a `.env` file.

```ini
# Boolbyte Engine Configuration
BYTEENGINE_BASE_URL=https://api.boolbyte.com
BYTEENGINE_API_KEY=your_byteengine_api_key

# FHIR Store Configuration
FHIR_BASE_URL=https://your-fhir-server-url.com/fhir
FHIR_ACCESS_TOKEN=your_fhir_access_token
FHIR_STORE_ID=your_fhir_store_id

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Server Port (Optional)
PORT=3000
```

## API Documentation
### Base URL
`http://localhost:3000`

### Endpoints
#### POST /create-session
Creates a new AI session.

**Request**:
```json
{
  "metadata": {
    "userID": "some-user-id"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
    "createdAt": "2023-10-27T12:00:00.000Z",
    "updatedAt": "2023-10-27T12:00:00.000Z",
    "workerId": "bed83d83-689e-484b-ab32-9a9894591639",
    "metadata": {
      "userID": "some-user-id"
    }
  }
}
```

**Errors**:
- `500 Internal Server Error`: The session could not be created.

#### POST /send-and-process
Adds a user's message to a session and creates a task for the AI to process it.

**Request**:
```json
{
  "sessionId": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
  "message": "I have chest pain, can you find hospitals near Ikeja?"
}
```

**Response**:
```json
{
    "success": true,
    "data": {
        "id": "d4a5b810-7e6d-4c3a-8b2f-9d3e5f6g7h8i",
        "status": "pending",
        "createdAt": "2023-10-27T12:01:00.000Z",
        "updatedAt": "2023-10-27T12:01:00.000Z",
        "sessionId": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
        "step": null
    }
}
```

**Errors**:
- `400 Bad Request`: `sessionId` or `message` is missing from the request body.
- `500 Internal Server Error`: The message could not be processed.

#### GET /get-task-status/:sessionId/:taskId
Retrieves the status and result of a specific task.

**Request**:
- Path Parameters:
    - `sessionId`: `c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e`
    - `taskId`: `d4a5b810-7e6d-4c3a-8b2f-9d3e5f6g7h8i`

**Response**:
```json
{
    "success": true,
    "data": {
        "id": "d4a5b810-7e6d-4c3a-8b2f-9d3e5f6g7h8i",
        "status": "requires_action",
        "createdAt": "2023-10-27T12:01:00.000Z",
        "updatedAt": "2023-10-27T12:01:05.000Z",
        "sessionId": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
        "step": {
            "type": "tool_calls",
            "toolCalls": [
                {
                    "id": "tool_call_1",
                    "type": "function",
                    "function": {
                        "name": "detectEmergency",
                        "arguments": "{\"message\":\"I have chest pain...\"}"
                    }
                }
            ]
        }
    }
}
```

**Errors**:
- `500 Internal Server Error`: The task status could not be retrieved.

#### POST /submit-tool-outputs
Submits the results from tool calls back to a task for further processing.

**Request**:
```json
{
  "sessionId": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
  "taskId": "d4a5b810-7e6d-4c3a-8b2f-9d3e5f6g7h8i",
  "toolOutputs": [
    {
      "toolCallId": "tool_call_1",
      "output": "{\"isEmergency\":true}"
    }
  ]
}
```

**Response**:
```json
{
    "success": true,
    "data": {
        "id": "d4a5b810-7e6d-4c3a-8b2f-9d3e5f6g7h8i",
        "status": "pending",
        "createdAt": "2023-10-27T12:01:00.000Z",
        "updatedAt": "2023-10-27T12:02:00.000Z",
        "sessionId": "c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e",
        "step": null
    }
}
```

**Errors**:
- `400 Bad Request`: `sessionId`, `taskId`, or `toolOutputs` are missing.
- `500 Internal Server Error`: The tool outputs could not be submitted.

#### GET /get-session-messages/:sessionId
Lists all messages associated with a session.

**Request**:
- Path Parameters:
    - `sessionId`: `c13a0c5c-3f9e-4b4d-9c3f-4e6f7b1b1e8e`

**Response**:
```json
{
    "success": true,
    "data": [
        {
            "id": "msg_1",
            "role": "user",
            "content": "I have chest pain, can you find hospitals near Ikeja?",
            "createdAt": "2023-10-27T12:01:00.000Z"
        },
        {
            "id": "msg_2",
            "role": "assistant",
            "content": "It sounds like you're experiencing a medical emergency. Please seek immediate medical attention. I have found the following hospitals near Ikeja...",
            "createdAt": "2023-10-27T12:03:00.000Z"
        }
    ]
}
```

**Errors**:
- `500 Internal Server Error`: Messages could not be retrieved.

#### POST /detect-emergency
A secure tool endpoint to detect if a user message indicates an emergency.

**Request**:
```json
{
  "message": "I'm having severe chest pain and can't breathe."
}
```

**Response**:
```json
{
  "isEmergency": true
}
```

**Errors**:
- None explicitly defined, relies on server availability.

#### POST /find-hospitals
A secure tool endpoint to find nearby hospitals using the Google Maps API.

**Request**:
```json
{
  "location": "Ikeja, Lagos"
}
```

**Response**:
```json
{
    "hospitals": [
        {
            "name": "Lagoon Hospitals",
            "address": "123 Obafemi Awolowo Way, Ikeja, Lagos",
            "rating": 4.5
        },
        {
            "name": "Reddington Hospital",
            "address": "456 Isaac John St, Ikeja GRA, Ikeja",
            "rating": 4.2
        }
    ]
}
```

**Errors**:
- `500 Internal Server Error`: Server is misconfigured (missing `GOOGLE_MAPS_API_KEY`) or there was an error calling the Google Maps API.

#### POST /create-patient
Endpoint to create a patient record in the FHIR store. Note: The implementation is not provided in the source code.

**Request**:
```json
{
  "name": "John Doe",
  "birthDate": "1990-01-15",
  "gender": "male"
}
```

**Response**:
(Implementation dependent)

**Errors**:
(Implementation dependent)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://www.npmjs.com/package/dokugen)