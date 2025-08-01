const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const router = express.Router();

// Notion API configuration
const getNotionAPI = () => {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('Notion token not configured');
  }
  
  return axios.create({
    baseURL: 'https://api.notion.com/v1',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  });
};

// @route   GET /api/notion/test-connection
// @desc    Test Notion database connection
// @access  Private
router.get('/test-connection', auth, async (req, res) => {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      return res.status(400).json({ 
        success: false,
        message: 'NOTION_DATABASE_ID not configured in environment variables' 
      });
    }

    console.log('Testing connection with database ID:', databaseId);
    
    const notionAPI = getNotionAPI();
    
    // Test database access
    const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
    
    console.log('Database title:', dbResponse.data.title?.[0]?.plain_text || 'Untitled');
    console.log('Database properties:', Object.keys(dbResponse.data.properties));
    
    // Test query
    const queryResponse = await notionAPI.post(`/databases/${databaseId}/query`, {
      page_size: 1
    });
    
    res.json({
      success: true,
      message: 'Connection successful',
      database: {
        id: dbResponse.data.id,
        title: dbResponse.data.title?.[0]?.plain_text || 'Untitled',
        properties: Object.keys(dbResponse.data.properties),
        totalPages: queryResponse.data.results.length
      }
    });
  } catch (error) {
    console.error('Test connection error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Connection failed',
      error: error.response?.data || error.message,
      databaseId: process.env.NOTION_DATABASE_ID
    });
  }
});

// @route   GET /api/notion/workspace/:workspaceId/pages
// @desc    Get Notion pages for workspace
// @access  Private
router.get('/workspace/:workspaceId/pages', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      return res.status(500).json({ 
        message: 'Notion database not properly configured. Please check NOTION_DATABASE_ID in environment variables.' 
      });
    }

    console.log('Using database ID:', databaseId);
    console.log('Workspace name:', workspace.name);

    const notionAPI = getNotionAPI();

    // First verify database access and get properties
    let availableProperties = {};
    try {
      const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
      console.log('Database accessible:', dbResponse.data.title?.[0]?.plain_text || 'Untitled');
      
      availableProperties = dbResponse.data.properties;
      console.log('Available properties:', Object.keys(availableProperties));
      
    } catch (dbError) {
      console.error('Database access error:', dbError.response?.data || dbError.message);
      return res.status(400).json({ 
        message: 'Cannot access Notion database. Please ensure the database is shared with your integration.',
        details: dbError.response?.data?.message || 'Database not accessible',
        databaseId: databaseId
      });
    }

    // Build query with proper sorting
    let queryPayload = {
      page_size: 50
    };

    // Add sorting - use created_time as fallback if no Created property exists
    if (availableProperties.Created) {
      queryPayload.sorts = [
        {
          property: 'Created',
          direction: 'descending'
        }
      ];
    } else {
      // Use built-in created_time timestamp
      queryPayload.sorts = [
        {
          timestamp: 'created_time',
          direction: 'descending'
        }
      ];
    }

    // Add workspace filter if Workspace property exists
    if (availableProperties.Workspace) {
      queryPayload.filter = {
        property: 'Workspace',
        select: {
          equals: workspace.name
        }
      };
    }

    console.log('Querying database with payload:', JSON.stringify(queryPayload, null, 2));

    const response = await notionAPI.post(`/databases/${databaseId}/query`, queryPayload);

    console.log('Query successful, found', response.data.results.length, 'pages');

    const pages = response.data.results.map(page => {
      console.log('Processing page:', page.id, page.properties.Title?.title?.[0]?.plain_text);
      return {
        id: page.id,
        title: page.properties.Title?.title?.[0]?.plain_text || 'Untitled',
        type: page.properties.Type?.select?.name || 'Note',
        status: page.properties.Status?.select?.name || 'Draft',
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        url: page.url,
        workspace: page.properties.Workspace?.select?.name || 'No workspace'
      };
    });

    // Filter by workspace in code if no filter was applied
    const filteredPages = availableProperties.Workspace 
      ? pages 
      : pages.filter(page => page.workspace === workspace.name || page.workspace === 'No workspace');

    console.log(`Returning ${filteredPages.length} pages for workspace: ${workspace.name}`);

    res.json({
      success: true,
      pages: filteredPages,
      total: response.data.results.length,
      workspaceName: workspace.name,
      availableProperties: Object.keys(availableProperties)
    });

  } catch (error) {
    console.error('Notion API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        message: 'Notion authentication failed. Please check your Notion token.' 
      });
    }
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: 'Notion database not found. Please check your database ID and sharing permissions.',
        databaseId: process.env.NOTION_DATABASE_ID
      });
    }
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch Notion pages',
      details: error.response?.data || error.message
    });
  }
});

// @route   POST /api/notion/workspace/:workspaceId/create-page
// @desc    Create a new Notion page for workspace
// @access  Private
router.post('/workspace/:workspaceId/create-page', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { title, type = 'Meeting Notes', content } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Verify workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      return res.status(500).json({ 
        message: 'Notion database not properly configured. Please check NOTION_DATABASE_ID in environment variables.' 
      });
    }

    const notionAPI = getNotionAPI();

    // Get database properties to see what's available
    let availableProperties = {};
    try {
      const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
      availableProperties = dbResponse.data.properties;
    } catch (dbError) {
      console.error('Database access error:', dbError.response?.data || dbError.message);
      return res.status(400).json({ 
        message: 'Cannot access Notion database. Please ensure the database is shared with your integration.',
        details: dbError.response?.data?.message || 'Database not accessible'
      });
    }

    // Create page properties - only include properties that exist
    const pageData = {
      parent: {
        database_id: databaseId
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: title.trim()
              }
            }
          ]
        }
      },
      children: []
    };

    // Add optional properties only if they exist in the database
    if (availableProperties.Type) {
      pageData.properties.Type = {
        select: {
          name: type
        }
      };
    }

    if (availableProperties.Status) {
      pageData.properties.Status = {
        select: {
          name: 'Draft'
        }
      };
    }

    if (availableProperties.Workspace) {
      pageData.properties.Workspace = {
        select: {
          name: workspace.name
        }
      };
    }

    if (availableProperties['Created By']) {
      pageData.properties['Created By'] = {
        rich_text: [
          {
            text: {
              content: req.user.name
            }
          }
        ]
      };
    }

    // Add content
    if (content && content.trim()) {
      pageData.children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: content.trim()
              }
            }
          ]
        }
      });
    } else {
      // Add default meeting template
      pageData.children = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '📅 Meeting Details'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `Date: ${new Date().toLocaleDateString()}\nTime: ${new Date().toLocaleTimeString()}\nAttendees: `
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '🎯 Agenda'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Topic 1'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Topic 2'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '📝 Notes'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Meeting notes go here...'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '✅ Action Items'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Action item 1'
                }
              }
            ],
            checked: false
          }
        }
      ];
    }

    console.log('Creating page with data:', JSON.stringify(pageData, null, 2));

    // Create the page in Notion
    const response = await notionAPI.post('/pages', pageData);

    const newPage = {
      id: response.data.id,
      title: title.trim(),
      type: type,
      status: 'Draft',
      createdTime: response.data.created_time,
      lastEditedTime: response.data.last_edited_time,
      url: response.data.url,
      workspace: workspace.name
    };

    res.json({
      success: true,
      page: newPage,
      message: 'Page created successfully'
    });
  } catch (error) {
    console.error('Notion API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to create Notion page',
      details: error.response?.data || error.message
    });
  }
});

// @route   GET /api/notion/page/:pageId
// @desc    Get Notion page content
// @access  Private
router.get('/page/:pageId', auth, async (req, res) => {
  try {
    const { pageId } = req.params;
    const notionAPI = getNotionAPI();

    // Get page details
    const pageResponse = await notionAPI.get(`/pages/${pageId}`);
    
    // Get page content (blocks)
    const blocksResponse = await notionAPI.get(`/blocks/${pageId}/children`);

    const page = {
      id: pageResponse.data.id,
      title: pageResponse.data.properties.Title?.title?.[0]?.plain_text || 'Untitled',
      type: pageResponse.data.properties.Type?.select?.name || 'Note',
      status: pageResponse.data.properties.Status?.select?.name || 'Draft',
      createdTime: pageResponse.data.created_time,
      lastEditedTime: pageResponse.data.last_edited_time,
      url: pageResponse.data.url,
      workspace: pageResponse.data.properties.Workspace?.select?.name,
      createdBy: pageResponse.data.properties['Created By']?.rich_text?.[0]?.plain_text,
      blocks: blocksResponse.data.results
    };

    res.json({
      success: true,
      page
    });
  } catch (error) {
    console.error('Notion API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to fetch page content',
      details: error.response?.data || error.message
    });
  }
});

// @route   PATCH /api/notion/page/:pageId/status
// @desc    Update page status (with property validation)
// @access  Private
router.patch('/page/:pageId/status', auth, async (req, res) => {
  try {
    const { pageId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const notionAPI = getNotionAPI();

    // First, get the page to check what database it belongs to
    const pageResponse = await notionAPI.get(`/pages/${pageId}`);
    const databaseId = pageResponse.data.parent.database_id;

    if (!databaseId) {
      return res.status(400).json({ 
        message: 'Page is not part of a database' 
      });
    }

    // Get database properties to check if Status property exists
    const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
    const availableProperties = dbResponse.data.properties;

    if (!availableProperties.Status) {
      return res.status(400).json({ 
        message: 'Status property does not exist in this database. Please add a "Status" select property to your Notion database.',
        availableProperties: Object.keys(availableProperties)
      });
    }

    // Check if the status value is valid for this property
    const statusProperty = availableProperties.Status;
    if (statusProperty.type !== 'select') {
      return res.status(400).json({ 
        message: 'Status property is not a select type' 
      });
    }

    // Get available status options
    const availableOptions = statusProperty.select.options.map(option => option.name);
    
    if (!availableOptions.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status value. Available options: ${availableOptions.join(', ')}`,
        availableOptions
      });
    }

    // Update the page status
    const updateResponse = await notionAPI.patch(`/pages/${pageId}`, {
      properties: {
        Status: {
          select: {
            name: status
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      newStatus: status
    });

  } catch (error) {
    console.error('Notion API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: 'Page not found or not accessible' 
      });
    }
    
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        message: error.response?.data?.message || 'Invalid request to update page status',
        details: error.response?.data
      });
    }
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to update page status',
      details: error.response?.data || error.message
    });
  }
});

// @route   GET /api/notion/database/properties
// @desc    Get database properties for debugging
// @access  Private
router.get('/database/properties', auth, async (req, res) => {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      return res.status(400).json({ 
        message: 'NOTION_DATABASE_ID not configured' 
      });
    }

    const notionAPI = getNotionAPI();
    const dbResponse = await notionAPI.get(`/databases/${databaseId}`);
    
    const properties = {};
    Object.keys(dbResponse.data.properties).forEach(propName => {
      const prop = dbResponse.data.properties[propName];
      properties[propName] = {
        type: prop.type,
        id: prop.id
      };
      
      // Add select options if it's a select property
      if (prop.type === 'select' && prop.select?.options) {
        properties[propName].options = prop.select.options.map(option => option.name);
      }
    });

    res.json({
      success: true,
      databaseId,
      databaseTitle: dbResponse.data.title?.[0]?.plain_text || 'Untitled',
      properties
    });

  } catch (error) {
    console.error('Database properties error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get database properties',
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;