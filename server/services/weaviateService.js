const weaviate = require('weaviate-ts-client');

class WeaviateService {
  constructor() {
    this.client = null;
    this.isAvailable = false;
    this.initializeClient();
  }

  async initializeClient() {
    try {
      if (!process.env.WEAVIATE_HOST || !process.env.WEAVIATE_API_KEY) {
        console.warn('⚠️ Weaviate configuration missing');
        return;
      }

      this.client = weaviate.client({
        scheme: 'https',
        host: process.env.WEAVIATE_HOST,
        apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
      });

      // Test connection
      await this.client.schema.getter().do();
      this.isAvailable = true;
      console.log('✅ Weaviate client initialized successfully');
      
      // Initialize schema if needed
      await this.ensureSchema();
      
    } catch (error) {
      console.error('❌ Failed to initialize Weaviate client:', error.message);
      this.isAvailable = false;
    }
  }

  async ensureSchema() {
    try {
      // Check if Artifact class exists
      const schema = await this.client.schema.getter().do();
      const artifactClass = schema.classes?.find(cls => cls.class === 'Artifact');
      
      if (!artifactClass) {
        console.log('📝 Creating Artifact schema in Weaviate...');
        
        const classObj = {
          class: 'Artifact',
          description: 'Project artifacts like GitHub PRs, documentation, and meeting notes',
          properties: [
            {
              name: 'title',
              dataType: ['text'],
              description: 'Title of the artifact'
            },
            {
              name: 'content',
              dataType: ['text'],
              description: 'Content or description of the artifact'
            },
            {
              name: 'type',
              dataType: ['text'],
              description: 'Type of artifact (GitHub PR, Meeting Note, etc.)'
            },
            {
              name: 'project',
              dataType: ['text'],
              description: 'Project name the artifact belongs to'
            },
            {
              name: 'date',
              dataType: ['date'],
              description: 'Creation or update date'
            },
            {
              name: 'url',
              dataType: ['text'],
              description: 'URL to the artifact'
            },
            {
              name: 'author',
              dataType: ['text'],
              description: 'Author of the artifact'
            },
            {
              name: 'workspaceId',
              dataType: ['text'],
              description: 'Workspace ID the artifact belongs to'
            }
          ]
        };

        await this.client.schema.classCreator().withClass(classObj).do();
        console.log('✅ Artifact schema created successfully');
      }
    } catch (error) {
      console.error('❌ Error ensuring schema:', error.message);
    }
  }

  async searchArtifacts(query, filters = {}) {
    if (!this.isAvailable) {
      throw new Error('Weaviate service not available');
    }

    try {
      let searchQuery = this.client.graphql
        .get()
        .withClassName('Artifact')
        .withFields('title content type project date url author workspaceId _additional { certainty }')
        .withNearText({ concepts: [query] })
        .withLimit(5);

      // Apply filters if provided
      const whereConditions = [];

      if (filters.type) {
        whereConditions.push({
          path: ['type'],
          operator: 'Equal',
          valueText: filters.type
        });
      }

      if (filters.project) {
        whereConditions.push({
          path: ['project'],
          operator: 'Equal',
          valueText: filters.project
        });
      }

      if (filters.workspaceId) {
        whereConditions.push({
          path: ['workspaceId'],
          operator: 'Equal',
          valueText: filters.workspaceId
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        if (filters.dateFrom && filters.dateTo) {
          whereConditions.push({
            path: ['date'],
            operator: 'GreaterThanEqual',
            valueDate: filters.dateFrom
          });
          whereConditions.push({
            path: ['date'],
            operator: 'LessThanEqual',
            valueDate: filters.dateTo
          });
        } else if (filters.dateFrom) {
          whereConditions.push({
            path: ['date'],
            operator: 'GreaterThanEqual',
            valueDate: filters.dateFrom
          });
        } else if (filters.dateTo) {
          whereConditions.push({
            path: ['date'],
            operator: 'LessThanEqual',
            valueDate: filters.dateTo
          });
        }
      }

      // Apply where conditions
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          searchQuery = searchQuery.withWhere(whereConditions[0]);
        } else {
          searchQuery = searchQuery.withWhere({
            operator: 'And',
            operands: whereConditions
          });
        }
      }

      const result = await searchQuery.do();
      
      return result.data?.Get?.Artifact || [];
    } catch (error) {
      console.error('❌ Error searching artifacts:', error.message);
      throw error;
    }
  }

  async addArtifact(artifact) {
    if (!this.isAvailable) {
      console.warn('⚠️ Weaviate not available, skipping artifact indexing');
      return;
    }

    try {
      const dataObject = {
        title: artifact.title || '',
        content: artifact.content || artifact.description || '',
        type: artifact.type || '',
        project: artifact.project || '',
        date: artifact.date || new Date().toISOString(),
        url: artifact.url || '',
        author: artifact.author || '',
        workspaceId: artifact.workspaceId || ''
      };

      await this.client.data
        .creator()
        .withClassName('Artifact')
        .withProperties(dataObject)
        .do();

      console.log('✅ Artifact indexed successfully:', artifact.title);
    } catch (error) {
      console.error('❌ Error indexing artifact:', error.message);
    }
  }

  async bulkAddArtifacts(artifacts) {
    if (!this.isAvailable) {
      console.warn('⚠️ Weaviate not available, skipping bulk indexing');
      return;
    }

    try {
      const batcher = this.client.batch.objectsBatcher();
      
      artifacts.forEach(artifact => {
        const dataObject = {
          title: artifact.title || '',
          content: artifact.content || artifact.description || '',
          type: artifact.type || '',
          project: artifact.project || '',
          date: artifact.date || new Date().toISOString(),
          url: artifact.url || '',
          author: artifact.author || '',
          workspaceId: artifact.workspaceId || ''
        };

        batcher.withObject({
          class: 'Artifact',
          properties: dataObject
        });
      });

      await batcher.do();
      console.log(`✅ Bulk indexed ${artifacts.length} artifacts`);
    } catch (error) {
      console.error('❌ Error bulk indexing artifacts:', error.message);
    }
  }
}

module.exports = new WeaviateService();