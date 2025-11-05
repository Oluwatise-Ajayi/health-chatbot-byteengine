import * as dotenv from "dotenv";
import * as axios from "axios";
dotenv.config({ path: ".env" });
import express from "express";
import { EngineClient, MessageRole, ToolChoice ,ToolConfig} from "@boolbyte/engine"; // Added MessageRole

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
const HERE_API_KEY = process.env.HERE_API_KEY;

if (!FHIR_BASE_URL || !FHIR_ACCESS_TOKEN || !FHIR_STORE_ID) {
  throw new Error("FHIR environment variables are required");
}
if (!BYTEENGINE_BASE_URL || !BYTEENGINE_API_KEY) {
  throw new Error("ByteEngine environment variables are required");
}
if (!HERE_API_KEY) {
  console.warn(
    "HERE_API_KEY is not set. The findNearByHospitals tool will fail."
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

// --- DEFINE YOUR TOOLS ---
// This is the schema that tells the AI what tools it can use.
const aiTools = [
  {
    type: "function",
    function: {
      name: "detectEmergency",
      description: "Checks if a user's message contains keywords indicating a medical emergency.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The user's message to check for emergencies.",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findNearByHospitals",
      description: "Finds up to 3 hospitals or clinics near a specific location provided by the user.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city, state, address, or zip code to search near (e.g., 'Ikeja, Lagos' or '1281 Jennifer Lane, USA').",
          },
        },
        required: ["location"],
      },
    },
  },
];


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
    await client.session.sendMessage(sessionId, {
      content: message,
      role: MessageRole.USER,
    });

    // --- Dynamic Tool Choice (This code is correct) ---
    const lowerCaseMessage = message.toLowerCase();
    const isHospitalRequest =
      lowerCaseMessage.includes("hospital") ||
      lowerCaseMessage.includes("clinic");

    let toolChoiceSetting = ToolChoice.AUTO; // Default
    if (isHospitalRequest) {
      toolChoiceSetting = ToolChoice.REQUIRED; 
      console.log("[Tool Choice] Setting ToolChoice.REQUIRED.");
    }
    // --- End Tool Choice Logic ---

    const task = await client.task.createTask(sessionId, {
      model: "gemini-2-5-flash",
      tools: aiTools,
      instructions: `
        You are a friendly, empathetic, and casual AI health assistant.
        Your main goal is to answer the user's *most recent message*.
    
        1. First, ALWAYS check the user's new message for an emergency using the 'detectEmergency' tool.
        
        2. For hospital requests:
           - Use the 'findNearByHospitals' tool which needs a 'location'.
           - Extract the location from the user's message (e.g., "hospitals in Ikeja" → location is "Ikeja").
           - If no location is provided (e.g., "find hospitals near me"), ask for their location.
           - DO NOT call 'findNearByHospitals' without a location.
           
           - When you receive hospital results, format them nicely like this:
             "I found [count] healthcare facilities near [location]:
             
             1. [Hospital Name]
                📍 [Address]
             
             2. [Hospital Name]
                📍 [Address]
             
             Would you like directions to any of these?"
        
        3. If it's not an emergency and not a hospital request, just answer the question.
        4. NEVER provide a medical diagnosis.
      `,
      toolChoice: toolChoiceSetting,
    });

    console.log(`[Task] Message sent and task created: ${task.data?.id}`);
    res.json(task); 
  } catch (error: unknown) {
    let errorDetails: string = "Unknown error";
    if (typeof error === "object" && error !== null) {
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

// ADD THIS LOGGING to your /submit-tool-outputs endpoint

app.post("/submit-tool-outputs", async (req, res) => {
  try {
    const { sessionId, taskId, toolOutputs } = req.body;
    if (!sessionId || !taskId || !toolOutputs) {
      return res
        .status(400)
        .json({ message: "sessionId, taskId, and toolOutputs are required" });
    }

    // LOG WHAT WE'RE SUBMITTING
    console.log("📤 [Backend] Submitting tool outputs:");
    console.log("  Session ID:", sessionId);
    console.log("  Task ID:", taskId);
    console.log("  Tool Outputs:", JSON.stringify(toolOutputs, null, 2));

    const submission = await client.task.submitToolOutputs(sessionId, taskId, {
      toolOutputs: toolOutputs,
    });

    // LOG THE RESPONSE
    console.log("✅ [Backend] Submission response:", JSON.stringify(submission, null, 2));

    res.json(submission);
  } catch (error: any) {
    console.error("❌ [Backend] Error submitting tool outputs:");
    console.error("  Error message:", error.message);
    console.error("  Error response:", error.response?.data);
    console.error("  Full error:", error);
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
//  SECURE TOOL ENDPOINTS
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

// --- NEW /find-hospitals USING HERE API ---
// --- UPDATED /find-hospitals (Wider Search) ---
// --- 100% FREE Version using OpenStreetMap ---
// --- FINAL 100% FREE Version (with User-Agent fix and better error logging) ---
// Replace your /find-hospitals endpoint with this improved version

// WORKING VERSION - Replace your /find-hospitals endpoint with this

// SIMPLE & RELIABLE VERSION - Uses only Nominatim (no Overpass)

// SIMPLE & RELIABLE VERSION - Uses only Nominatim (no Overpass)

app.post("/find-hospitals", async (req, res) => {
  const { location } = req.body;
  let toolOutput: any;
  console.log(`[Tool] /find-hospitals called with location: "${location}"`);

  if (!location) {
    toolOutput = {
      message: "Please provide your location.",
      hospitals: []
    };
    return res.json(toolOutput);
  }

  try {
    const userAgent = "HealthChatbot/1.0 (tise.dev)";
    
    // Use Nominatim to search for hospitals directly
    // This is more reliable than Overpass API
    const searchQuery = `hospital ${location}`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      searchQuery
    )}&format=json&limit=10&addressdetails=1`;
    
    console.log(`[Tool] Searching for hospitals in: ${location}`);
    
    const searchResponse = await axios.default.get(nominatimUrl, {
      headers: { "User-Agent": userAgent },
      timeout: 15000,
    });

    const results = searchResponse.data || [];
    console.log(`[Tool] Nominatim returned ${results.length} results`);

    if (results.length > 0) {
      // Filter to only include actual hospitals/clinics
      const healthFacilities = results.filter((place: any) => {
        const name = (place.display_name || "").toLowerCase();
        const type = (place.type || "").toLowerCase();
        const placeClass = (place.class || "").toLowerCase();
        
        return (
          placeClass === "amenity" ||
          type.includes("hospital") ||
          type.includes("clinic") ||
          name.includes("hospital") ||
          name.includes("clinic") ||
          name.includes("medical") ||
          name.includes("health")
        );
      });

      console.log(`[Tool] Filtered to ${healthFacilities.length} health facilities`);

      if (healthFacilities.length > 0) {
        const hospitalList = healthFacilities.slice(0, 3).map((place: any) => {
          const displayName = place.display_name || "Unknown Facility";
          
          // Extract just the facility name (first part before comma)
          const name = displayName.split(",")[0].trim();
          
          // Build address from the rest
          const addressParts = displayName.split(",").slice(1);
          const address = addressParts.slice(0, 2).join(",").trim() || "Address not available";

          return {
            name: name,
            address: address,
            type: place.type || "healthcare"
          };
        });

        toolOutput = {
          hospitals: hospitalList,
          count: hospitalList.length,
          location: location
        };
        
        console.log(`[Tool] ✅ Returning ${hospitalList.length} hospitals`);
      } else {
        toolOutput = {
          hospitals: [],
          message: `No hospitals found near ${location}. Try searching "Lagos" for a wider area.`,
        };
      }
    } else {
      console.log(`[Tool] No results found for ${location}`);
      toolOutput = {
        hospitals: [],
        message: `Couldn't find hospitals near "${location}". Try "Lagos, Nigeria".`,
      };
    }
  } catch (error: any) {
    console.error("❌ [Tool] Error:", error.message);

    let errorMessage = "Having trouble searching for hospitals right now.";
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = "Search timed out. Please try again.";
    } else if (error.response?.status === 429) {
      errorMessage = "Too many requests. Please wait a minute and try again.";
    }

    toolOutput = {
      hospitals: [],
      message: errorMessage,
    };
  }

  res.json(toolOutput);
});

// ===================================
//  OTHER API ENDPOINTS
// ===================================

// ===================================
//  START THE SERVER
// ===================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
