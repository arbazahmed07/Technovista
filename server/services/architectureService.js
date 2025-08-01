class ArchitectureService {
  constructor() {
    try {
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        this.isAvailable = true;
        console.log('✅ Gemini AI initialized successfully');
      } else {
        console.warn('⚠️ GEMINI_API_KEY not found, using fallback diagrams');
        this.isAvailable = false;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Gemini AI:', error.message);
      this.isAvailable = false;
    }
  }

  async analyzeCodebaseStructure(files, repositoryData) {
    const structure = {
      frontend: [],
      backend: [],
      config: [],
      tests: [],
      docs: []
    };

    const languages = new Set();

    files.forEach(file => {
      const path = file.path.toLowerCase();
      const name = file.name.toLowerCase();
      const extension = name.split('.').pop();

      // Categorize files
      if (path.includes('src/') || path.includes('client/') || name.includes('component') || 
          path.includes('frontend/') || extension === 'jsx' || extension === 'tsx' ||
          extension === 'vue' || extension === 'html') {
        structure.frontend.push(file);
      } else if (path.includes('server/') || path.includes('api/') || path.includes('backend/') ||
                 extension === 'py' || extension === 'java' || extension === 'php') {
        structure.backend.push(file);
      } else if (path.includes('test/') || name.includes('test') || name.includes('spec')) {
        structure.tests.push(file);
      } else if (name.includes('config') || name.includes('.env') || name.includes('settings') ||
                 name === 'package.json' || name === 'requirements.txt') {
        structure.config.push(file);
      } else if (name.includes('readme') || name.includes('doc') || path.includes('docs/')) {
        structure.docs.push(file);
      }

      if (extension) {
        languages.add(extension);
      }
    });

    return {
      structure,
      languages: Array.from(languages),
      totalFiles: files.length
    };
  }

  async generateFlowchartDiagram(analysis, repositoryData) {
    if (!this.isAvailable) {
      return this.getFallbackFlowchart(repositoryData);
    }

    const prompt = `Create a simple Mermaid.js flowchart for ${repositoryData.full_name || repositoryData.name}.
    
Frontend files: ${analysis.structure.frontend.length}
Backend files: ${analysis.structure.backend.length}
Total files: ${analysis.totalFiles}

Generate ONLY valid Mermaid flowchart syntax starting with "flowchart TD".
Show user flow, main components, and data flow.
Keep it simple with 5-8 nodes maximum.`;

    try {
      const response = await this.model.generateContent(prompt);
      const result = response.response.text();
      return this.cleanMermaidCode(result);
    } catch (error) {
      console.error('Error generating flowchart:', error);
      return this.getFallbackFlowchart(repositoryData);
    }
  }

  async generateComponentDiagram(analysis, repositoryData) {
    const prompt = `Create a Mermaid.js component diagram for ${repositoryData.full_name || repositoryData.name}.
    Return ONLY valid Mermaid graph syntax showing main components.`;

    try {
      if (!this.isAvailable) throw new Error('AI not available');
      const response = await this.model.generateContent(prompt);
      const result = response.response.text();
      return this.cleanMermaidCode(result);
    } catch (error) {
      return this.getFallbackComponent(repositoryData);
    }
  }

  async generateSequenceDiagram(analysis, repositoryData) {
    try {
      if (!this.isAvailable) throw new Error('AI not available');
      const prompt = `Create a Mermaid.js sequence diagram for ${repositoryData.full_name || repositoryData.name}.
      Return ONLY valid sequenceDiagram syntax.`;
      
      const response = await this.model.generateContent(prompt);
      const result = response.response.text();
      return this.cleanMermaidCode(result);
    } catch (error) {
      return this.getFallbackSequence(repositoryData);
    }
  }

  async generateClassDiagram(analysis, repositoryData) {
    try {
      if (!this.isAvailable) throw new Error('AI not available');
      const prompt = `Create a Mermaid.js class diagram for ${repositoryData.full_name || repositoryData.name}.
      Return ONLY valid classDiagram syntax.`;
      
      const response = await this.model.generateContent(prompt);
      const result = response.response.text();
      return this.cleanMermaidCode(result);
    } catch (error) {
      return this.getFallbackClass(repositoryData);
    }
  }

  async generateArchitecture(files, repositoryData, diagramType = 'flowchart') {
    try {
      console.log(`🏗️ Generating ${diagramType} diagram for ${repositoryData.full_name || repositoryData.name}`);
      
      const analysis = await this.analyzeCodebaseStructure(files, repositoryData);
      
      let mermaidCode;
      let description;

      switch (diagramType) {
        case 'component':
          mermaidCode = await this.generateComponentDiagram(analysis, repositoryData);
          description = 'Component architecture showing main application modules and their relationships';
          break;
        case 'sequence':
          mermaidCode = await this.generateSequenceDiagram(analysis, repositoryData);
          description = 'Sequence diagram showing user interactions and system flow';
          break;
        case 'class':
          mermaidCode = await this.generateClassDiagram(analysis, repositoryData);
          description = 'Class diagram showing object-oriented structure and relationships';
          break;
        default:
          mermaidCode = await this.generateFlowchartDiagram(analysis, repositoryData);
          description = 'Application flow diagram showing user journey and data flow';
      }

      // Ensure we have valid mermaid code
      if (!mermaidCode || mermaidCode.trim() === '') {
        console.warn('Empty mermaid code, using fallback');
        mermaidCode = this.getFallbackFlowchart(repositoryData);
      }

      // Count components and connections
      const componentsCount = Math.max((mermaidCode.match(/\w+\[|\w+\(|\w+\{/g) || []).length, 1);
      const connectionsCount = Math.max((mermaidCode.match(/-->/g) || []).length, 0);

      console.log('✅ Architecture diagram generated successfully');

      return {
        mermaidCode,
        description,
        diagramType,
        componentsCount,
        connectionsCount,
        analysis: {
          totalFiles: analysis.totalFiles,
          languages: analysis.languages,
          structure: {
            frontend: analysis.structure.frontend.length,
            backend: analysis.structure.backend.length,
            tests: analysis.structure.tests.length,
            config: analysis.structure.config.length
          }
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('❌ Error generating architecture:', error);
      
      // Return a basic fallback
      return {
        mermaidCode: this.getFallbackFlowchart(repositoryData),
        description: 'Basic application architecture diagram (fallback)',
        diagramType,
        componentsCount: 5,
        connectionsCount: 4,
        analysis: {
          totalFiles: files?.length || 0,
          languages: ['js'],
          structure: {
            frontend: 0,
            backend: 0,
            tests: 0,
            config: 0
          }
        },
        generatedAt: new Date()
      };
    }
  }

  cleanMermaidCode(code) {
    if (!code) return 'flowchart TD\n    A[Start] --> B[End]';
    
    // Remove markdown formatting and extra content
    code = code.replace(/```mermaid\n?/g, '').replace(/```/g, '');
    code = code.replace(/Here's.*?:\s*/i, ''); // Remove explanatory text
    
    // Find the actual mermaid code
    const lines = code.split('\n');
    let startIndex = -1;
    let endIndex = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('flowchart') || line.startsWith('graph') || 
          line.startsWith('sequenceDiagram') || line.startsWith('classDiagram')) {
        startIndex = i;
        break;
      }
    }
    
    if (startIndex === -1) {
      // No proper diagram declaration found, add one
      code = 'flowchart TD\n' + code;
    } else {
      code = lines.slice(startIndex, endIndex).join('\n');
    }

    // Clean up extra whitespace
    code = code.trim();
    
    return code;
  }

  getFallbackFlowchart(repositoryData) {
    const repoName = repositoryData.name || repositoryData.full_name || 'Repository';
    return `flowchart TD
    A[User] --> B[${repoName}]
    B --> C[Frontend]
    B --> D[Backend]
    C --> E[UI Components]
    D --> F[API Services]
    D --> G[Database]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fce4ec
    style F fill:#f1f8e9
    style G fill:#fff8e1`;
  }

  getFallbackComponent(repositoryData) {
    const repoName = repositoryData.name || repositoryData.full_name || 'App';
    return `graph TB
    subgraph "Frontend"
      A[${repoName} UI]
      B[Components]
      C[Services]
    end
    
    subgraph "Backend"
      D[API Server]
      E[Controllers]
      F[Models]
    end
    
    subgraph "Data Layer"
      G[Database]
      H[Cache]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G`;
  }

  getFallbackSequence(repositoryData) {
    return `sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database
    
    U->>F: User Action
    F->>A: API Request
    A->>D: Query Data
    D-->>A: Return Data
    A-->>F: Response
    F-->>U: Update UI`;
  }

  getFallbackClass(repositoryData) {
    return `classDiagram
    class User {
      +String name
      +String email
      +login()
      +logout()
    }
    
    class Application {
      +init()
      +run()
    }
    
    class Service {
      +process()
      +validate()
    }
    
    User --> Application
    Application --> Service`;
  }
}

module.exports = new ArchitectureService();