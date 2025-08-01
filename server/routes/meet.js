const express = require('express');
const { google } = require('googleapis');
const mongoose = require('mongoose'); // Add this import
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const MeetingCaption = require('../models/MeetingCaption');
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

    // Validate workspaceId format
    if (!workspaceId || workspaceId === 'undefined' || !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ 
        message: 'Invalid workspace ID format',
        workspaceId: workspaceId 
      });
    }

    // Validate workspace access
    const workspace = await Workspace.findById(workspaceId);
    console.log('Fetching meetings for workspace:', workspaceId, 'User:', req.user.id);
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

    console.log(`Found ${meetings.length} meetings for workspace ${workspaceId}`);

    res.json({
      success: true,
      meetings,
      count: meetings.length
    });

  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch meetings',
      error: error.message 
    });
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

// @route   POST /api/meet/:meetingId/captions
// @desc    Save meeting caption
// @access  Private
router.post('/:meetingId/captions', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { text, speaker, timestamp, confidence } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check if user is part of the meeting
    const isParticipant = meeting.organizer.toString() === req.user.id ||
      meeting.attendees.some(attendee => attendee.user?.toString() === req.user.id);
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied to this meeting' });
    }

    const caption = new MeetingCaption({
      meeting: meetingId,
      text: text.trim(),
      speaker: speaker || req.user.name,
      timestamp: timestamp || new Date(),
      confidence,
      userId: req.user.id
    });

    await caption.save();

    res.status(201).json({
      success: true,
      caption
    });

  } catch (error) {
    console.error('Error saving caption:', error);
    res.status(500).json({ message: 'Failed to save caption' });
  }
});

// @route   GET /api/meet/:meetingId/captions
// @desc    Get meeting captions
// @access  Private
router.get('/:meetingId/captions', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const captions = await MeetingCaption.find({ meeting: meetingId })
      .populate('userId', 'name')
      .sort({ timestamp: 1 });

    res.json({
      success: true,
      captions
    });

  } catch (error) {
    console.error('Error fetching captions:', error);
    res.status(500).json({ message: 'Failed to fetch captions' });
  }
});

// @route   POST /api/meet/:meetingId/generate-notes
// @desc    Generate meeting notes from captions
// @access  Private
router.post('/:meetingId/generate-notes', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { captions } = req.body;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Generate structured meeting notes
    const meetingNotes = generateMeetingNotesFromCaptions(captions, meeting);
    
    // Update meeting with generated notes
    meeting.notes = meetingNotes;
    meeting.status = 'completed';
    await meeting.save();

    res.json({
      success: true,
      notes: meetingNotes,
      message: 'Meeting notes generated successfully'
    });

  } catch (error) {
    console.error('Error generating meeting notes:', error);
    res.status(500).json({ message: 'Failed to generate meeting notes' });
  }
});

function generateMeetingNotesFromCaptions(captions, meeting) {
  const sortedCaptions = captions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  let notes = `# Meeting Notes: ${meeting.title}\n\n`;
  notes += `**Date:** ${meeting.scheduledTime.toLocaleDateString()}\n`;
  notes += `**Duration:** ${meeting.duration} minutes\n`;
  notes += `**Organizer:** ${meeting.organizer?.name || 'Unknown'}\n\n`;
  
  notes += `## Discussion Summary\n\n`;
  
  // Group captions by speaker and time segments
  const speakers = {};
  sortedCaptions.forEach(caption => {
    if (!speakers[caption.speaker]) {
      speakers[caption.speaker] = [];
    }
    speakers[caption.speaker].push(caption);
  });
  
  // Create timeline of discussion
  sortedCaptions.forEach((caption, index) => {
    const time = new Date(caption.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    notes += `**[${time}] ${caption.speaker}:** ${caption.text}\n\n`;
  });
  
  notes += `## Key Points\n\n`;
  notes += `- [Extract key discussion points here]\n`;
  notes += `- [Add action items]\n`;
  notes += `- [Note important decisions]\n\n`;
  
  notes += `## Action Items\n\n`;
  notes += `- [ ] [Add specific action items from discussion]\n`;
  notes += `- [ ] [Assign responsibilities]\n`;
  notes += `- [ ] [Set deadlines]\n\n`;
  
  return notes;
}

// @route   GET /api/meet/workspace/:workspaceId/notes
// @desc    Get meetings with notes for workspace
// @access  Private
router.get('/workspace/:workspaceId/notes', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { filter } = req.query;

    // Validate workspaceId format
    if (!workspaceId || workspaceId === 'undefined' || !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ 
        message: 'Invalid workspace ID format',
        workspaceId: workspaceId 
      });
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

    let query = { 
      workspace: workspaceId,
      scheduledTime: { $lt: new Date() } // Only past meetings
    };
    
    if (filter === 'missed') {
      query['missedByMembers.user'] = req.user.id;
    } else if (filter === 'completed') {
      query.status = 'completed';
      query.notesGenerated = true;
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('missedByMembers.user', 'name email')
      .sort({ scheduledTime: -1 });

    // Add information about whether current user missed the meeting and viewed notes
    const meetingsWithUserInfo = meetings.map(meeting => {
      const missedByUser = meeting.missedByMembers.find(
        missed => missed.user._id.toString() === req.user.id
      );
      
      return {
        ...meeting.toObject(),
        missedByCurrentUser: !!missedByUser,
        currentUserViewedNotes: missedByUser ? missedByUser.viewedNotes : false
      };
    });

    res.json({
      success: true,
      meetings: meetingsWithUserInfo
    });

  } catch (error) {
    console.error('Error fetching meetings with notes:', error);
    res.status(500).json({ message: 'Failed to fetch meetings with notes' });
  }
});

// @route   POST /api/meet/:meetingId/generate-automatic-notes
// @desc    Generate automatic meeting notes from captions
// @access  Private
router.post('/:meetingId/generate-automatic-notes', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { captions } = req.body;

    const meeting = await Meeting.findById(meetingId)
      .populate('organizer', 'name email')
      .populate('workspace');
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Get all captions if not provided
    let meetingCaptions = captions;
    if (!meetingCaptions) {
      const captionsFromDB = await MeetingCaption.find({ meeting: meetingId })
        .populate('userId', 'name')
        .sort({ timestamp: 1 });
      meetingCaptions = captionsFromDB;
    }

    // Generate comprehensive meeting notes
    const automaticNotes = generateComprehensiveMeetingNotes(meetingCaptions, meeting);
    
    // Find workspace members who weren't in the meeting
    const workspace = meeting.workspace;
    const meetingAttendeeIds = [
      meeting.organizer._id.toString(),
      ...meeting.attendees.map(a => a.user?.toString()).filter(Boolean)
    ];
    
    const missedByMembers = workspace.members
      .filter(member => !meetingAttendeeIds.includes(member.user.toString()))
      .map(member => ({
        user: member.user,
        notified: false,
        viewedNotes: false
      }));

    // Update meeting with generated notes
    meeting.automaticNotes = automaticNotes;
    meeting.notesGenerated = true;
    meeting.notesGeneratedAt = new Date();
    meeting.status = 'completed';
    meeting.missedByMembers = missedByMembers;
    
    await meeting.save();

    // TODO: Send notifications to users who missed the meeting
    // await sendMissedMeetingNotifications(meeting, missedByMembers);

    res.json({
      success: true,
      notes: automaticNotes,
      missedByCount: missedByMembers.length,
      message: 'Automatic meeting notes generated successfully'
    });

  } catch (error) {
    console.error('Error generating automatic meeting notes:', error);
    res.status(500).json({ message: 'Failed to generate automatic meeting notes' });
  }
});

// @route   POST /api/meet/:meetingId/mark-notes-viewed
// @desc    Mark meeting notes as viewed by user
// @access  Private
router.post('/:meetingId/mark-notes-viewed', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Find and update the missed member record
    const missedMemberIndex = meeting.missedByMembers.findIndex(
      missed => missed.user.toString() === req.user.id
    );

    if (missedMemberIndex !== -1) {
      meeting.missedByMembers[missedMemberIndex].viewedNotes = true;
      await meeting.save();
    }

    res.json({
      success: true,
      message: 'Notes marked as viewed'
    });

  } catch (error) {
    console.error('Error marking notes as viewed:', error);
    res.status(500).json({ message: 'Failed to mark notes as viewed' });
  }
});

function generateComprehensiveMeetingNotes(captions, meeting) {
  const sortedCaptions = captions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  let notes = `# Meeting Notes: ${meeting.title}\n\n`;
  notes += `**Date:** ${new Date(meeting.scheduledTime).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}\n`;
  notes += `**Time:** ${new Date(meeting.scheduledTime).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })}\n`;
  notes += `**Duration:** ${meeting.duration} minutes\n`;
  notes += `**Organizer:** ${meeting.organizer?.name || 'Unknown'}\n`;
  
  if (meeting.attendees && meeting.attendees.length > 0) {
    notes += `**Attendees:** ${meeting.attendees.map(a => a.email).join(', ')}\n`;
  }
  
  notes += `**Meeting ID:** ${meeting.meetingId}\n\n`;

  if (meeting.description) {
    notes += `## Meeting Description\n${meeting.description}\n\n`;
  }

  notes += `## Executive Summary\n\n`;
  notes += `This meeting took place on ${new Date(meeting.scheduledTime).toLocaleDateString()} and lasted ${meeting.duration} minutes. `;
  
  // Count unique speakers
  const speakers = [...new Set(sortedCaptions.map(c => c.speaker))];
  notes += `The discussion involved ${speakers.length} participant${speakers.length > 1 ? 's' : ''}: ${speakers.join(', ')}.\n\n`;

  notes += `## Discussion Timeline\n\n`;
  
  // Group captions by time segments (every 5 minutes)
  const timeSegments = {};
  sortedCaptions.forEach(caption => {
    const time = new Date(caption.timestamp);
    const segmentKey = Math.floor(time.getMinutes() / 5) * 5;
    const segmentLabel = `${String(time.getHours()).padStart(2, '0')}:${String(segmentKey).padStart(2, '0')}`;
    
    if (!timeSegments[segmentLabel]) {
      timeSegments[segmentLabel] = [];
    }
    timeSegments[segmentLabel].push(caption);
  });

  Object.entries(timeSegments).forEach(([timeLabel, segmentCaptions]) => {
    notes += `### ${timeLabel}\n\n`;
    segmentCaptions.forEach(caption => {
      const time = new Date(caption.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      notes += `**[${time}] ${caption.speaker}:** ${caption.text}\n\n`;
    });
  });

  notes += `## Key Discussion Points\n\n`;
  
  // Extract potential key points (longer messages, questions, etc.)
  const keyPoints = sortedCaptions.filter(caption => 
    caption.text.length > 50 || 
    caption.text.includes('?') || 
    caption.text.toLowerCase().includes('important') ||
    caption.text.toLowerCase().includes('decision') ||
    caption.text.toLowerCase().includes('action')
  );

  if (keyPoints.length > 0) {
    keyPoints.slice(0, 10).forEach((point, index) => {
      notes += `${index + 1}. **${point.speaker}:** ${point.text}\n\n`;
    });
  } else {
    notes += `- Review the discussion timeline above for detailed conversation\n`;
    notes += `- Key decisions and action items may be found in the conversation\n`;
    notes += `- Consider reviewing the full transcript for important details\n\n`;
  }

  notes += `## Action Items & Next Steps\n\n`;
  
  // Look for action-related keywords
  const actionCaptions = sortedCaptions.filter(caption => 
    caption.text.toLowerCase().includes('action') ||
    caption.text.toLowerCase().includes('todo') ||
    caption.text.toLowerCase().includes('next step') ||
    caption.text.toLowerCase().includes('follow up') ||
    caption.text.toLowerCase().includes('will do') ||
    caption.text.toLowerCase().includes('need to')
  );

  if (actionCaptions.length > 0) {
    actionCaptions.forEach(action => {
      notes += `- [ ] **${action.speaker}:** ${action.text}\n`;
    });
  } else {
    notes += `- [ ] Review meeting discussion for any commitments made\n`;
    notes += `- [ ] Follow up on topics that require further discussion\n`;
    notes += `- [ ] Schedule next meeting if needed\n`;
  }

  notes += `\n## Meeting Statistics\n\n`;
  notes += `- **Total Speaking Time Captured:** ~${sortedCaptions.length} speech segments\n`;
  notes += `- **Participants:** ${speakers.length}\n`;
  notes += `- **Meeting Duration:** ${meeting.duration} minutes\n`;
  notes += `- **Notes Generated:** ${new Date().toLocaleString()}\n\n`;

  notes += `---\n\n`;
  notes += `*These notes were automatically generated from meeting captions. For complete accuracy, please review the original meeting recording if available.*\n`;

  return notes;
}

// @route   GET /api/meet/workspace/:workspaceId/notes
// @desc    Get meetings with notes for workspace
// @access  Private
router.get('/workspace/:workspaceId/notes', auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { filter } = req.query;

    // Validate workspaceId format
    if (!workspaceId || workspaceId === 'undefined' || !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ 
        message: 'Invalid workspace ID format',
        workspaceId: workspaceId 
      });
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

    let query = { 
      workspace: workspaceId,
      scheduledTime: { $lt: new Date() } // Only past meetings
    };
    
    if (filter === 'missed') {
      query['missedByMembers.user'] = req.user.id;
    } else if (filter === 'completed') {
      query.status = 'completed';
      query.notesGenerated = true;
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('missedByMembers.user', 'name email')
      .sort({ scheduledTime: -1 });

    // Add information about whether current user missed the meeting and viewed notes
    const meetingsWithUserInfo = meetings.map(meeting => {
      const missedByUser = meeting.missedByMembers.find(
        missed => missed.user._id.toString() === req.user.id
      );
      
      return {
        ...meeting.toObject(),
        missedByCurrentUser: !!missedByUser,
        currentUserViewedNotes: missedByUser ? missedByUser.viewedNotes : false
      };
    });

    res.json({
      success: true,
      meetings: meetingsWithUserInfo
    });

  } catch (error) {
    console.error('Error fetching meetings with notes:', error);
    res.status(500).json({ message: 'Failed to fetch meetings with notes' });
  }
});

// @route   POST /api/meet/:meetingId/generate-automatic-notes
// @desc    Generate automatic meeting notes from captions
// @access  Private
router.post('/:meetingId/generate-automatic-notes', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { captions } = req.body;

    const meeting = await Meeting.findById(meetingId)
      .populate('organizer', 'name email')
      .populate('workspace');
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Get all captions if not provided
    let meetingCaptions = captions;
    if (!meetingCaptions) {
      const captionsFromDB = await MeetingCaption.find({ meeting: meetingId })
        .populate('userId', 'name')
        .sort({ timestamp: 1 });
      meetingCaptions = captionsFromDB;
    }

    // Generate comprehensive meeting notes
    const automaticNotes = generateComprehensiveMeetingNotes(meetingCaptions, meeting);
    
    // Find workspace members who weren't in the meeting
    const workspace = meeting.workspace;
    const meetingAttendeeIds = [
      meeting.organizer._id.toString(),
      ...meeting.attendees.map(a => a.user?.toString()).filter(Boolean)
    ];
    
    const missedByMembers = workspace.members
      .filter(member => !meetingAttendeeIds.includes(member.user.toString()))
      .map(member => ({
        user: member.user,
        notified: false,
        viewedNotes: false
      }));

    // Update meeting with generated notes
    meeting.automaticNotes = automaticNotes;
    meeting.notesGenerated = true;
    meeting.notesGeneratedAt = new Date();
    meeting.status = 'completed';
    meeting.missedByMembers = missedByMembers;
    
    await meeting.save();

    // TODO: Send notifications to users who missed the meeting
    // await sendMissedMeetingNotifications(meeting, missedByMembers);

    res.json({
      success: true,
      notes: automaticNotes,
      missedByCount: missedByMembers.length,
      message: 'Automatic meeting notes generated successfully'
    });

  } catch (error) {
    console.error('Error generating automatic meeting notes:', error);
    res.status(500).json({ message: 'Failed to generate automatic meeting notes' });
  }
});

// @route   POST /api/meet/:meetingId/mark-notes-viewed
// @desc    Mark meeting notes as viewed by user
// @access  Private
router.post('/:meetingId/mark-notes-viewed', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Find and update the missed member record
    const missedMemberIndex = meeting.missedByMembers.findIndex(
      missed => missed.user.toString() === req.user.id
    );

    if (missedMemberIndex !== -1) {
      meeting.missedByMembers[missedMemberIndex].viewedNotes = true;
      await meeting.save();
    }

    res.json({
      success: true,
      message: 'Notes marked as viewed'
    });

  } catch (error) {
    console.error('Error marking notes as viewed:', error);
    res.status(500).json({ message: 'Failed to mark notes as viewed' });
  }
});

function generateComprehensiveMeetingNotes(captions, meeting) {
  const sortedCaptions = captions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  let notes = `# Meeting Notes: ${meeting.title}\n\n`;
  notes += `**Date:** ${new Date(meeting.scheduledTime).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}\n`;
  notes += `**Time:** ${new Date(meeting.scheduledTime).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })}\n`;
  notes += `**Duration:** ${meeting.duration} minutes\n`;
  notes += `**Organizer:** ${meeting.organizer?.name || 'Unknown'}\n`;
  
  if (meeting.attendees && meeting.attendees.length > 0) {
    notes += `**Attendees:** ${meeting.attendees.map(a => a.email).join(', ')}\n`;
  }
  
  notes += `**Meeting ID:** ${meeting.meetingId}\n\n`;

  if (meeting.description) {
    notes += `## Meeting Description\n${meeting.description}\n\n`;
  }

  notes += `## Executive Summary\n\n`;
  notes += `This meeting took place on ${new Date(meeting.scheduledTime).toLocaleDateString()} and lasted ${meeting.duration} minutes. `;
  
  // Count unique speakers
  const speakers = [...new Set(sortedCaptions.map(c => c.speaker))];
  notes += `The discussion involved ${speakers.length} participant${speakers.length > 1 ? 's' : ''}: ${speakers.join(', ')}.\n\n`;

  notes += `## Discussion Timeline\n\n`;
  
  // Group captions by time segments (every 5 minutes)
  const timeSegments = {};
  sortedCaptions.forEach(caption => {
    const time = new Date(caption.timestamp);
    const segmentKey = Math.floor(time.getMinutes() / 5) * 5;
    const segmentLabel = `${String(time.getHours()).padStart(2, '0')}:${String(segmentKey).padStart(2, '0')}`;
    
    if (!timeSegments[segmentLabel]) {
      timeSegments[segmentLabel] = [];
    }
    timeSegments[segmentLabel].push(caption);
  });

  Object.entries(timeSegments).forEach(([timeLabel, segmentCaptions]) => {
    notes += `### ${timeLabel}\n\n`;
    segmentCaptions.forEach(caption => {
      const time = new Date(caption.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      notes += `**[${time}] ${caption.speaker}:** ${caption.text}\n\n`;
    });
  });

  notes += `## Key Discussion Points\n\n`;
  
  // Extract potential key points (longer messages, questions, etc.)
  const keyPoints = sortedCaptions.filter(caption => 
    caption.text.length > 50 || 
    caption.text.includes('?') || 
    caption.text.toLowerCase().includes('important') ||
    caption.text.toLowerCase().includes('decision') ||
    caption.text.toLowerCase().includes('action')
  );

  if (keyPoints.length > 0) {
    keyPoints.slice(0, 10).forEach((point, index) => {
      notes += `${index + 1}. **${point.speaker}:** ${point.text}\n\n`;
    });
  } else {
    notes += `- Review the discussion timeline above for detailed conversation\n`;
    notes += `- Key decisions and action items may be found in the conversation\n`;
    notes += `- Consider reviewing the full transcript for important details\n\n`;
  }

  notes += `## Action Items & Next Steps\n\n`;
  
  // Look for action-related keywords
  const actionCaptions = sortedCaptions.filter(caption => 
    caption.text.toLowerCase().includes('action') ||
    caption.text.toLowerCase().includes('todo') ||
    caption.text.toLowerCase().includes('next step') ||
    caption.text.toLowerCase().includes('follow up') ||
    caption.text.toLowerCase().includes('will do') ||
    caption.text.toLowerCase().includes('need to')
  );

  if (actionCaptions.length > 0) {
    actionCaptions.forEach(action => {
      notes += `- [ ] **${action.speaker}:** ${action.text}\n`;
    });
  } else {
    notes += `- [ ] Review meeting discussion for any commitments made\n`;
    notes += `- [ ] Follow up on topics that require further discussion\n`;
    notes += `- [ ] Schedule next meeting if needed\n`;
  }

  notes += `\n## Meeting Statistics\n\n`;
  notes += `- **Total Speaking Time Captured:** ~${sortedCaptions.length} speech segments\n`;
  notes += `- **Participants:** ${speakers.length}\n`;
  notes += `- **Meeting Duration:** ${meeting.duration} minutes\n`;
  notes += `- **Notes Generated:** ${new Date().toLocaleString()}\n\n`;

  notes += `---\n\n`;
  notes += `*These notes were automatically generated from meeting captions. For complete accuracy, please review the original meeting recording if available.*\n`;

  return notes;
}

// Make sure this line exists at the end of the file
module.exports = router;