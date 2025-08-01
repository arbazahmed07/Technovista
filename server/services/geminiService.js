const axios = require('axios');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  async generateContent(prompt) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error('Failed to generate content with Gemini');
    }
  }

  async generateOnboardingPath(workspaceData, userProfile) {
    const prompt = `
You are an AI assistant helping new team members navigate their workspace efficiently. 

Based on the following workspace information, create a personalized onboarding path.

WORKSPACE: ${workspaceData.name}
DESCRIPTION: ${workspaceData.description}
MEMBER COUNT: ${workspaceData.memberCount}
USER ROLE: ${userProfile.role}
USER EXPERIENCE: ${userProfile.experienceLevel}
USER BACKGROUND: ${userProfile.background || 'General'}

WORKSPACE CONTEXT:
- Team Members: ${workspaceData.members.map(m => `${m.name} (${m.role})`).join(', ')}
- GitHub Repository: ${workspaceData.githubRepo ? `${workspaceData.githubRepo.owner}/${workspaceData.githubRepo.repo}` : 'Not connected'}

Please provide a structured onboarding path in JSON format with the following sections:

{
  "gettingStarted": [
    "First step to get oriented",
    "Second step to understand the workspace",
    "Third step to start contributing"
  ],
  "keyPeople": [
    "Name (Role) - Why to connect with them",
    "Another person to meet"
  ],
  "essentialDocuments": [
    "README.md - Project overview and setup instructions",
    "CONTRIBUTING.md - How to contribute to the project"
  ],
  "criticalCodeAreas": [
    "src/components/ - Main UI components",
    "src/services/ - Business logic and API calls"
  ],
  "timeline": [
    "Week 1: Complete workspace familiarization",
    "Week 2: Start making small contributions"
  ]
}

Respond ONLY with valid JSON. Do not include any markdown formatting or explanatory text.
`;

    return await this.generateContent(prompt);
  }

  async generatePersonalizedTasks(userProfile, workspaceData, learningPreferences) {
    const prompt = `
Create personalized onboarding tasks for a new team member.

USER PROFILE:
- Role: ${userProfile.role}
- Experience Level: ${userProfile.experienceLevel}
- Background: ${userProfile.background}
- Learning Style: ${learningPreferences.style}
- Preferred Pace: ${learningPreferences.pace}

WORKSPACE:
- Name: ${workspaceData.name}
- Technology: ${workspaceData.primaryTech}
- Team Size: ${workspaceData.memberCount}

Generate 5-7 specific, actionable tasks in JSON format:

[
  {
    "title": "Task Title",
    "description": "Detailed description of what to do",
    "estimatedTime": "30 minutes",
    "priority": "high",
    "prerequisites": "None"
  }
]

Respond ONLY with valid JSON array. No markdown or explanatory text.
`;

    return await this.generateContent(prompt);
  }
}

module.exports = new GeminiService();