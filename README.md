# Health Checker API

An intelligent, AI-powered health assistant backend built with Node.js, Express, and TypeScript. This service provides a conversational interface for health-related queries, capable of detecting emergencies and locating nearby medical facilities.

---

### ✨ Features

- **AI Session Management**: Creates and maintains distinct chat sessions for each user.
- **Intelligent Tool Integration**: Leverages an AI model that can dynamically use tools for specific tasks like emergency detection or hospital lookups.
- **Emergency Detection**: Scans user messages for keywords indicating a potential medical emergency.
- **Nearby Hospital Locator**: Finds local hospitals and clinics using the OpenStreetMap Nominatim API.
- **Asynchronous Task Handling**: Manages AI processing through a non-blocking, poll-based task system.

---

### 🛠️ Technologies Used

| Technology | Description |
| :--- | :--- |
| [**Node.js**](https://nodejs.org/) | JavaScript runtime for building the server. |
| [**Express.js**](https://expressjs.com/) | Fast, unopinionated, minimalist web framework for Node.js. |
| [**TypeScript**](https://www.typescriptlang.org/) | Statically typed superset of JavaScript for robust code. |
| [**Boolbyte Engine**](https://www.boolbyte.com/) | The AI engine service powering the conversational logic and tool usage. |
| [**Axios**](https://axios-http.com/) | Promise-based HTTP client for making requests to external APIs. |
| [**Dotenv**](https://github.com/motdotla/dotenv) | A zero-dependency module that loads environment variables from a `.env` file. |

---

### 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

#### 1. Clone the Repository
```bash
git clone https://github.com/Oluwatise-Ajayi/health-chatbot-byteengine.git
cd health-chatbot-byteengine
```

#### 2. Install Dependencies
Install the required npm packages.
```bash
npm install
```

#### 3. Set Up Environment Variables
Create a `.env` file in the root of the project and add the following variables.

```env
# Boolbyte Engine Configuration
BYTEENGINE_BASE_URL=https://api.boolbyte.com
BYTEENGINE_API_KEY=your_boolbyte_api_key

# FHIR Store (Optional, for future data integration)
FHIR_BASE_URL=your_fhir_base_url
FHIR_ACCESS_TOKEN=your_fhir_access_token
FHIR_STORE_ID=your_fhir_store_id

# Server Port
PORT=3000
```

#### 4. Run the Server
Start the development server with hot-reloading.
```bash
npm run dev
```
The server will be running at `http://localhost:3000`.

---

### ⚙️ API Usage

The API provides endpoints to manage chat sessions and process user messages.

**Base URL**: `http://localhost:3000`

#### Create a New Chat Session
- **Endpoint**: `POST /create-session`
- **Description**: Initializes a new chat session with the AI worker.
- **Request Body**:
  ```json
  {
    "metadata": {
      "userID": "user-123"
    }
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "clztz17s6000108l421g4f9e1",
      "createdAt": "2024-09-06T14:30:00.000Z",
      "updatedAt": "2024-09-06T14:30:00.000Z",
      "workerId": "bed83d83-689e-484b-ab32-9a9894591639",
      "metadata": {
        "userID": "user-123"
      }
    }
  }
  ```

#### Send a Message and Create a Task
- **Endpoint**: `POST /send-and-process`
- **Description**: Sends a user message to a session and creates a task for the AI to process it. The response contains the task ID, which can be used to poll for the result.
- **Request Body**:
  ```json
  {
    "sessionId": "clztz17s6000108l421g4f9e1",
    "message": "Find hospitals near Ikeja, Lagos"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "clztz29b7000308l430hge9f2",
      "status": "in_progress",
      "createdAt": "2024-09-06T14:32:00.000Z",
      // ... other task details
    }
  }
  ```

#### Get Task Status
- **Endpoint**: `GET /get-task-status/:sessionId/:taskId`
- **Description**: Poll this endpoint to check the status of a task. The status will eventually change to `requires_action` (if a tool needs to be run) or `completed`.
- **URL Parameters**:
  - `sessionId`: `clztz17s6000108l421g4f9e1`
  - `taskId`: `clztz29b7000308l430hge9f2`
- **Success Response (`completed`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "clztz29b7000308l430hge9f2",
      "status": "completed",
      // ... other task details
    }
  }
  ```

#### List Session Messages
- **Endpoint**: `GET /get-session-messages/:sessionId`
- **Description**: Retrieves the full message history for a given session.
- **URL Parameters**:
  - `sessionId`: `clztz17s6000108l421g4f9e1`
- **Success Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "role": "user",
        "content": "Find hospitals near Ikeja, Lagos"
      },
      {
        "role": "assistant",
        "content": "I found 3 healthcare facilities near Ikeja, Lagos..."
      }
    ]
  }
  ```

---

### 🙌 Contributing

Contributions are welcome! If you have suggestions for improving the project, please feel free to contribute.

-   Fork the repository.
-   Create a new branch (`git checkout -b feature/YourFeatureName`).
-   Make your changes and commit them (`git commit -m 'Add some feature'`).
-   Push to the branch (`git push origin feature/YourFeatureName`).
-   Open a pull request.

---

### 📄 License

This project is licensed under the ISC License.

---

### 👨‍💻 Author

Connect with me on social media!

- **LinkedIn**: [Your LinkedIn Profile](https://linkedin.com/in/your_username)
- **Twitter / X**: [@your_handle](https://twitter.com/your_handle)

---

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![NPM](https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://www.npmjs.com/package/dokugen)