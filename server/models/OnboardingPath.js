const mongoose = require('mongoose');

const onboardingPathSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  path: {
    gettingStarted: [String],
    keyPeople: [String],
    essentialDocuments: [String],
    criticalCodeAreas: [String],
    timeline: [String]
  },
  learningPreferences: {
    experienceLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    style: {
      type: String,
      enum: ['visual', 'hands-on', 'reading', 'mixed'],
      default: 'mixed'
    },
    pace: {
      type: String,
      enum: ['slow', 'normal', 'fast'],
      default: 'normal'
    },
    background: String
  },
  progress: {
    completedTasks: [String],
    currentStep: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one path per user per workspace
onboardingPathSchema.index({ workspace: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('OnboardingPath', onboardingPathSchema);