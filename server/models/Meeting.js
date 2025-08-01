const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  meetingUrl: {
    type: String,
    required: true
  },
  googleMeetLink: {
    type: String
  },
  googleCalendarEventId: {
    type: String
  },
  scheduledTime: {
    type: Date,
    required: [true, 'Scheduled time is required']
  },
  duration: {
    type: Number,
    default: 60,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [480, 'Duration cannot exceed 8 hours']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: function() {
      return this.isRecurring;
    }
  },
  notes: {
    type: String,
    trim: true
  },
  captionsEnabled: {
    type: Boolean,
    default: false
  },
  transcript: {
    type: String,
    trim: true
  },
  // Add these new fields for automatic notes
  automaticNotes: {
    type: String,
    trim: true
  },
  notesGenerated: {
    type: Boolean,
    default: false
  },
  notesGeneratedAt: {
    type: Date
  },
  missedByMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notified: {
      type: Boolean,
      default: false
    },
    viewedNotes: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
meetingSchema.index({ workspace: 1, scheduledTime: 1 });
meetingSchema.index({ organizer: 1, scheduledTime: 1 });
meetingSchema.index({ 'attendees.user': 1, scheduledTime: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);