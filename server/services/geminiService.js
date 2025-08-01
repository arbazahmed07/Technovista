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
DESCRIPTION: ${workspaceData.description || 'No description provided'}
MEMBER COUNT: ${workspaceData.memberCount}
USER ROLE: ${userProfile.role}
USER EXPERIENCE: ${userProfile.experienceLevel}
USER BACKGROUND: ${userProfile.background || 'General'}

WORKSPACE CONTEXT:
- Team Members: ${workspaceData.members?.map(m => `${m.name} (${m.role})`).join(', ') || 'No members listed'}
- GitHub Repository: ${workspaceData.githubRepo ? `${workspaceData.githubRepo.owner}/${workspaceData.githubRepo.repo}` : 'Not connected'}

Create a structured onboarding path in valid JSON format with these exact sections:

{
  "gettingStarted": [
    "First step to get oriented with the workspace",
    "Second step to understand the project structure",
    "Third step to start contributing"
  ],
  "keyPeople": [
    "Name (Role) - Why to connect with them",
    "Another important person to meet"
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

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown formatting
- No backticks, no code blocks, no extra text
- Each array should contain 2-5 relevant items
- Make recommendations specific to ${userProfile.experienceLevel} level
- Consider ${userProfile.background} background
`;

  const response = await this.generateContent(prompt);
  
  // Aggressive cleaning of the response
  let cleanedResponse = response.trim();
  
  // Remove any markdown formatting
  cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
  cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
  cleanedResponse = cleanedResponse.replace(/^json\s*/g, '');
  
  // Find the JSON object boundaries
  const firstBrace = cleanedResponse.indexOf('{');
  const lastBrace = cleanedResponse.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove any trailing text after the JSON
  const lines = cleanedResponse.split('\n');
  let jsonLines = [];
  let insideJson = false;
  let braceCount = 0;
  
  for (const line of lines) {
    if (line.includes('{')) {
      insideJson = true;
    }
    
    if (insideJson) {
      jsonLines.push(line);
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      if (braceCount === 0 && line.includes('}')) {
        break;
      }
    }
  }
  
  cleanedResponse = jsonLines.join('\n');
  
  // Validate and return JSON
  try {
    const parsed = JSON.parse(cleanedResponse);
    
    // Ensure all required fields exist and are arrays
    const validatedResponse = {
      gettingStarted: Array.isArray(parsed.gettingStarted) ? parsed.gettingStarted : [],
      keyPeople: Array.isArray(parsed.keyPeople) ? parsed.keyPeople : [],
      essentialDocuments: Array.isArray(parsed.essentialDocuments) ? parsed.essentialDocuments : [],
      criticalCodeAreas: Array.isArray(parsed.criticalCodeAreas) ? parsed.criticalCodeAreas : [],
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : []
    };
    
    return JSON.stringify(validatedResponse);
    
  } catch (parseError) {
    console.warn('Generated invalid JSON, returning fallback structure');
    console.log('Raw response:', response);
    console.log('Cleaned response:', cleanedResponse);
    
    // Return a valid fallback structure
    return JSON.stringify({
      gettingStarted: [
        `Explore the ${workspaceData.name} workspace and understand its purpose`,
        "Review team members and their roles in the project",
        "Familiarize yourself with available tools and resources",
        "Set up your development environment if needed"
      ],
      keyPeople: [
        `Workspace Creator - Primary contact for ${workspaceData.name}`,
        "Team Members - Collaborate and share knowledge"
      ],
      essentialDocuments: [
        "Project README - Overview and setup instructions",
        "Team Guidelines - Best practices and workflows"
      ],
      criticalCodeAreas: [
        "Main project directory - Core functionality",
        "Configuration files - Project settings"
      ],
      timeline: [
        "Week 1: Complete initial workspace exploration and setup",
        "Week 2: Begin active participation in team activities"
      ]
    });
  }
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

  async generateRepositorySummary(repositoryData, recentCommits, issues, pullRequests) {
    const prompt = `
Analyze the following GitHub repository data and generate a comprehensive summary:

REPOSITORY INFORMATION:
- Name: ${repositoryData.fullName}
- Description: ${repositoryData.description || 'No description provided'}
- Primary Language: ${repositoryData.language || 'Not specified'}
- Stars: ${repositoryData.stars}
- Forks: ${repositoryData.forks}
- Open Issues: ${repositoryData.openIssues}
- Created: ${repositoryData.createdAt}
- Last Updated: ${repositoryData.updatedAt}
- Default Branch: ${repositoryData.defaultBranch}

RECENT ACTIVITY:
- Recent Commits: ${recentCommits.length} commits
- Open Issues: ${issues.length} issues
- Pull Requests: ${pullRequests.length} PRs

RECENT COMMITS (Last 5):
${recentCommits.slice(0, 5).map(commit => `- ${commit.message.split('\n')[0]} by ${commit.author.name}`).join('\n')}

TOP ISSUES:
${issues.slice(0, 3).map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}

Please provide a comprehensive repository summary in the following JSON format:

{
  "overview": "Brief overview of what this repository is about",
  "techStack": "Primary technologies and frameworks used",
  "recentActivity": "Summary of recent development activity",
  "projectHealth": "Assessment of project health based on activity and issues",
  "keyInsights": [
    "Important insight about the project",
    "Another key finding"
  ],
  "recommendations": [
    "Suggestion for new team members",
    "Area that might need attention"
  ]
}

Respond ONLY with valid JSON. No markdown or explanatory text.
`;

    return await this.generateContent(prompt);
  }
}

module.exports = new GeminiService();