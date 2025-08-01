const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate invites for same workspace and email
inviteSchema.index({ workspace: 1, email: 1 }, { unique: true });

// Add a post-save hook for debugging
inviteSchema.post('save', function(doc) {
  console.log('Invite created/updated:', {
    id: doc._id,
    email: doc.email,
    workspace: doc.workspace,
    status: doc.status,
    createdAt: doc.createdAt
  });
});

module.exports = mongoose.model('Invite', inviteSchema);