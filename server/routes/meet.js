const express = require('express');
const { google } = require('googleapis');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Google OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// @route   GET /api/meet/auth/url
// @desc    Get Google OAuth URL for authentication
// @access  Private
router.get('/auth/url', auth, (req, res) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user.id,
      prompt: 'consent',
      include_granted_scopes: true
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Failed to generate auth URL' });
  }
});

// @route   GET /api/meet/auth/callback
// @desc    Handle Google OAuth callback
// @access  Public
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('OAuth callback received:', { 
      hasCode: !!code, 
      state, 
      error,
      fullQuery: req.query 
    });
    
    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`http://localhost:3000/workspace?error=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect('http://localhost:3000/workspace?error=no_code');
    }

    if (!state) {
      console.error('No state parameter received');
      return res.redirect('http://localhost:3000/workspace?error=no_state');
    }

    try {
      // Create a new OAuth2 client for this request
      const callbackOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      console.log('Exchanging authorization code for tokens...');
      
      // Exchange authorization code for tokens
      const tokenResponse = await callbackOAuth2Client.getToken(code);
      const tokens = tokenResponse.tokens;
      
      console.log('Token exchange successful:', { 
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      });
      
      // Store tokens in user profile
      const user = await User.findById(state);
      if (!user) {
        console.error('User not found for state:', state);
        return res.redirect('http://localhost:3000/workspace?error=user_not_found');
      }

      user.googleTokens = tokens;
      await user.save();
      
      console.log('Google tokens saved for user:', user.email);

      res.redirect('http://localhost:3000/workspace?success=google_connected');
      
    } catch (tokenError) {
      console.error('Error exchanging code for tokens:', tokenError);
      return res.redirect('http://localhost:3000/workspace?error=token_exchange_failed');
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('http://localhost:3000/workspace?error=authentication_failed');
  }
});

// @route   GET /api/meet/auth/status
// @desc    Check if user has connected Google account
// @access  Private
router.get('/auth/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const isConnected = !!(user.googleTokens && user.googleTokens.access_token);
    
    res.json({ 
      connected: isConnected,
      hasTokens: !!user.googleTokens,
      tokenInfo: user.googleTokens ? {
        hasAccessToken: !!user.googleTokens.access_token,
        hasRefreshToken: !!user.googleTokens.refresh_token,
        expiryDate: user.googleTokens.expiry_date
      } : null
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ message: 'Failed to check auth status' });
  }
});

// @route   POST /api/meet/workspace/:workspaceId/create
// @desc    Create a new meeting
// @access  Private
router.post('/workspace/:workspaceId/create', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { 
      title, 
      description, 
      scheduledTime, 
      duration = 60, 
      attendees = [],
      isRecurring = false,
      recurrencePattern 
    } = req.body;

    // Validate required fields
    if (!title || !scheduledTime) {
      return res.status(400).json({ message: 'Title and scheduled time are required' });
    }

    // Validate workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Access denied to this workspace' });
    }

    // Get user's Google tokens
    const user = await User.findById(req.user.id);
    if (!user.googleTokens || !user.googleTokens.access_token) {
      return res.status(400).json({ 
        message: 'Google account not connected. Please connect your Google account first.',
        needsAuth: true 
      });
    }

    // Set up OAuth2 client with user's tokens
    const userOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    userOAuth2Client.setCredentials(user.googleTokens);

    // Test and refresh tokens if needed
    try {
      await userOAuth2Client.getAccessToken();
    } catch (tokenError) {
      console.error('Token validation error:', tokenError);
      
      // Try to refresh tokens if we have a refresh token
      if (user.googleTokens.refresh_token) {
        try {
          const { credentials } = await userOAuth2Client.refreshAccessToken();
          user.googleTokens = credentials;
          await user.save();
          userOAuth2Client.setCredentials(credentials);
          console.log('Tokens refreshed successfully for user:', user.email);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          return res.status(401).json({
            message: 'Google authentication expired. Please reconnect your Google account.',
            needsAuth: true
          });
        }
      } else {
        return res.status(401).json({
          message: 'Google authentication expired. Please reconnect your Google account.',
          needsAuth: true
        });
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

    // Create Google Calendar event with Meet link
    const eventStartTime = new Date(scheduledTime);
    const eventEndTime = new Date(eventStartTime.getTime() + duration * 60000);

    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: eventStartTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventEndTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: attendees.filter(email => email.trim()).map(email => ({ email: email.trim() })),
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (isRecurring && recurrencePattern) {
      const recurrenceRules = {
        daily: 'RRULE:FREQ=DAILY',
        weekly: 'RRULE:FREQ=WEEKLY',
        monthly: 'RRULE:FREQ=MONTHLY'
      };
      event.recurrence = [recurrenceRules[recurrencePattern]];
    }

    console.log('Creating calendar event for user:', user.email);
    
    const calendarEvent = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    console.log('Calendar event created:', {
      id: calendarEvent.data.id,
      hangoutLink: calendarEvent.data.hangoutLink,
      htmlLink: calendarEvent.data.htmlLink
    });

    // Create meeting record in database
    const meetingId = uuidv4();
    const meeting = new Meeting({
      workspace: workspaceId,
      title,
      description: description || '',
      meetingId,
      meetingUrl: calendarEvent.data.hangoutLink || calendarEvent.data.htmlLink,
      scheduledTime: eventStartTime,
      duration,
      organizer: req.user.id,
      attendees: attendees.filter(email => email.trim()).map(email => ({ email: email.trim() })),
      isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      googleCalendarEventId: calendarEvent.data.id,
      googleMeetLink: calendarEvent.data.hangoutLink
    });

    await meeting.save();
    await meeting.populate('organizer', 'name email');

    res.status(201).json({
      success: true,
      meeting,
      message: 'Meeting created successfully'
    });

  } catch (error) {
    console.error('Error creating meeting:', error);
    
    if (error.code === 401 || error.message.includes('invalid_grant')) {
      return res.status(401).json({ 
        message: 'Google authentication expired. Please reconnect your Google account.',
        needsAuth: true 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create meeting',
      error: error.message 
    });
  }
});

// @route   GET /api/meet/workspace/:workspaceId/meetings
// @desc    Get meetings for a workspace
// @access  Private
router.get('/workspace/:workspaceId/meetings', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { status, upcoming } = req.query;

    // Validate workspace access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const userMembership = workspace.members.find(
      member => member.user.toString() === req.user.id
    );

    if (!userMembership) {
      return res.status(403).json({ message: 'Access denied to this workspace' });
    }

    let query = { workspace: workspaceId };
    
    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.scheduledTime = { $gte: new Date() };
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('attendees.user', 'name email')
      .sort({ scheduledTime: 1 });

    res.json({
      success: true,
      meetings
    });

  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
});

// @route   DELETE /api/meet/:meetingId
// @desc    Delete/Cancel a meeting
// @access  Private
router.delete('/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only organizer can delete meeting
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only meeting organizer can delete the meeting' });
    }

    // Cancel Google Calendar event if user still has valid tokens
    const user = await User.findById(req.user.id);
    if (user.googleTokens && user.googleTokens.access_token && meeting.googleCalendarEventId) {
      try {
        const userOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        
        userOAuth2Client.setCredentials(user.googleTokens);
        const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
        
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: meeting.googleCalendarEventId,
          sendUpdates: 'all'
        });
        
        console.log('Calendar event deleted:', meeting.googleCalendarEventId);
      } catch (calendarError) {
        console.error('Error deleting calendar event:', calendarError);
      }
    }

    await Meeting.findByIdAndDelete(meetingId);

    res.json({
      success: true,
      message: 'Meeting cancelled successfully'
    });

  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ message: 'Failed to cancel meeting' });
  }
});

module.exports = router;