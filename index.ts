import * as dotenv from "dotenv";
import * as axios from "axios";
dotenv.config({ path: ".env" });
import express from "express";
import { EngineClient, MessageRole, ToolChoice } from "@boolbyte/engine"; // Added MessageRole

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ===================================
//  CONFIGURATION & CLIENTS
// ===================================

const FHIR_BASE_URL = process.env.FHIR_BASE_URL!;
const FHIR_ACCESS_TOKEN = process.env.FHIR_ACCESS_TOKEN!;
const FHIR_STORE_ID = process.env.FHIR_STORE_ID!;
const BYTEENGINE_BASE_URL = process.env.BYTEENGINE_BASE_URL!;
const BYTEENGINE_API_KEY = process.env.BYTEENGINE_API_KEY!;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!FHIR_BASE_URL || !FHIR_ACCESS_TOKEN || !FHIR_STORE_ID) {
  throw new Error("FHIR environment variables are required");
}
if (!BYTEENGINE_BASE_URL || !BYTEENGINE_API_KEY) {
  throw new Error("ByteEngine environment variables are required");
}
if (!GOOGLE_MAPS_API_KEY) {
  console.warn(
    "GOOGLE_MAPS_API_KEY is not set. The findNearByHospitals tool will fail."
  );
}

const client = new EngineClient({
  baseUrl: process.env.BYTEENGINE_BASE_URL,
  apiKey: BYTEENGINE_API_KEY,
  timeout: 30000,
});

// Initialize FHIR client
(async () => {
  try {
    await client.dataStore.initializeFhirStoreClient(FHIR_STORE_ID);
    console.log("✅ FHIR Store Client initialized");
  } catch (error) {
    console.error("❌ Failed to initialize FHIR Store Client:", error);
  }
})();

const fhirClient = client.dataStore.getFhirStoreClient();

// ===================================
//  POLLING API ENDPOINTS
// ===================================

app.post("/create-session", async (req, res) => {
  try {
    const session = await client.session.createSession({
      workerId: "bed83d83-689e-484b-ab32-9a9894591639",
      metadata: req.body.metadata || { userID: "new-user" },
    });
    console.log(`✅ Session created: ${session.data?.id}`);
    res.json(session);
  } catch (error) {
    console.error("❌ Error creating session:", error);
    res.status(500).json({ message: "Error creating session", error });
  }
});

// --- THIS IS THE NEW, CORRECT ENDPOINT ---
/**
 * Step 1: Adds the user's message to the session.
 * Step 2: Creates an empty task to process that message.
 * Returns the task for the frontend to poll.
 */
app.post("/send-and-process", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res
        .status(400)
        .json({ message: "sessionId and message are required" });
    }

    // STEP 1: Add the user's message to the session's chat history
    // (This part is unchanged and correct)
    await client.session.sendMessage(sessionId, {
      content: message,
      role: MessageRole.USER,
    });

    const task = await client.task.createTask(sessionId, {
      model: "gemini-2-5-flash", 
      
      // These new instructions force the AI to be smarter.
      instructions: `
        You are a friendly, empathetic, and casual AI health assistant.
        Your main goal is to answer the user's *most recent message*.

        1.  First, ALWAYS check the user's new message for an emergency using the 'detectEmergency' tool.
        
        2.  Second, check if the user is asking for hospitals (which uses the 'findNearByHospitals' tool).
            -   If they are, you MUST get a location.
            -   FIRST, try to extract the location from the user's *current message*. (e.g., if they say "find hospitals in Ikeja", the location is "Ikeja").
            -   If the location is in the current message, USE IT immediately.
            -   If the location is NOT in the current message, your ONLY response must be to ask the user for their location (city, zip, or address).
            -   DO NOT call 'findNearByHospitals' if you do not have a location.
        
        3.  If it's not an emergency and not a hospital request, just answer the question.
        4.  NEVER provide a medical diagnosis.
      `,
      toolChoice: ToolChoice.AUTO,
    });
    // --- END OF FIX ---

    console.log(`[Task] Message sent and task created: ${task.data?.id}`);
    res.json(task); // Send the task back for polling
  } catch (error: unknown) {
    let errorDetails: string = "Unknown error";
    if (typeof error === "object" && error !== null) {
      // Check for Axios-style error with nested response object
      errorDetails =
        (error as any).response?.data?.message ||
        (error as any).message ||
        JSON.stringify(error);
    } else if (typeof error === "string") {
      errorDetails = error;
    }
    console.error("❌ Error in send-and-process:", errorDetails);
    res
      .status(500)
      .json({ message: "Error processing message", error: errorDetails });
  }
});

app.get("/get-task-status/:sessionId/:taskId", async (req, res) => {
  try {
    const { sessionId, taskId } = req.params;
    const taskStatus = await client.task.getTask(sessionId, taskId);
    res.json(taskStatus);
  } catch (error) {
    console.error("❌ Error getting task status:", error);
    res.status(500).json({ message: "Error getting task status", error });
  }
});

app.post("/submit-tool-outputs", async (req, res) => {
  try {
    const { sessionId, taskId, toolOutputs } = req.body;
    if (!sessionId || !taskId || !toolOutputs) {
      return res
        .status(400)
        .json({ message: "sessionId, taskId, and toolOutputs are required" });
    }

    const submission = await client.task.submitToolOutputs(sessionId, taskId, {
      toolOutputs: toolOutputs,
    });
    res.json(submission);
  } catch (error) {
    console.error("❌ Error submitting tool outputs:", error);
    res.status(500).json({ message: "Error submitting tool outputs", error });
  }
});

app.get("/get-session-messages/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await client.session.listMessages(sessionId);
    res.json(messages);
  } catch (error) {
    console.error("❌ Error getting session messages:", error);
    res.status(500).json({ message: "Error getting session messages", error });
  }
});

// ===================================
//  SECURE TOOL ENDPOINTS
// ===================================

app.post("/detect-emergency", async (req, res) => {
  const { message } = req.body;
  const userMessage = (message || "").toLowerCase();
  const emergencyKeywords = [
    "chest pain",
    "can't breathe",
    "bleeding",
    "suicidal",
    "passed out",
    "faint",
    "severe pain",
    "difficulty breathing",
  ];
  const isEmergency = emergencyKeywords.some((keyword) =>
    userMessage.includes(keyword)
  );
  console.log(`[Tool] detectEmergency result: ${isEmergency}`);
  res.json({ isEmergency: isEmergency });
});

app.post("/find-hospitals", async (req, res) => {
  const { location } = req.body;
  let toolOutput: any;

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("❌ [Tool] Google Maps API key is missing!");
    return res.status(500).json({ error: "Server configuration error." });
  }
  if (!location) {
    toolOutput = {
      error:
        "Please ask the user for their location (city, zip code, or address) first.",
    };
  } else {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=hospitals+near+${encodeURIComponent(
      location
    )}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log(`[Tool] Calling Google Maps URL: ${url}`);
    try {
      const response = await axios.default.get(url);
      const results = response.data.results;
      if (results && results.length > 0) {
        const hospitalList = results.slice(0, 3).map((place: any) => ({
          name: place.name,
          address: place.formatted_address,
          rating: place.rating,
        }));
        toolOutput = { hospitals: hospitalList };
      } else {
        toolOutput = {
          hospitals: [],
          message: `I couldn't find any hospitals in ${location}.`,
        };
      }
    } catch (error) {
      console.error("❌ [Tool] Error calling Google Maps API:", error);
      toolOutput = {
        error: "Sorry, I ran into an error trying to find hospitals.",
      };
    }
  }
  res.json(toolOutput);
});

// ===================================
//  OTHER API ENDPOINTS
// ===================================

app.post("/create-patient", async (req, res) => {
  // ... (your existing create-patient code)
});

// ===================================
//  START THE SERVER
// ===================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
