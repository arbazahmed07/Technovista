const mongoose = require('mongoose');

const meetingCaptionSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  speaker: {
    type: String,
    default: 'Unknown Speaker'
  },
  timestamp: {
    type: Date,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
meetingCaptionSchema.index({ meeting: 1, timestamp: 1 });

module.exports = mongoose.model('MeetingCaption', meetingCaptionSchema);