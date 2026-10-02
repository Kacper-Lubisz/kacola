// Setup for the eval tier: live providers are called here, so keys pass through. TYPESAFE_AI_API_KEY is
// accepted as another name for TYPESAFE_API_KEY (the SDK and kacola read the latter).
if (!process.env.TYPESAFE_API_KEY?.trim() && process.env.TYPESAFE_AI_API_KEY?.trim())
  process.env.TYPESAFE_API_KEY = process.env.TYPESAFE_AI_API_KEY
