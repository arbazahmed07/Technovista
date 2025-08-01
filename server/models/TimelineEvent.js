const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['milestone', 'task', 'meeting', 'deployment', 'release', 'review'],
    default: 'milestone'
  },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed', 'delayed', 'cancelled'],
    default: 'planned'
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimelineEvent'
  }],
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for efficient queries
timelineEventSchema.index({ workspace: 1, date: 1 });
timelineEventSchema.index({ workspace: 1, status: 1 });

module.exports = mongoose.model('TimelineEvent', timelineEventSchema);