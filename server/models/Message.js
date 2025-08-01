const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [2000, 'Message content cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'file', 'image'],
    default: 'text'
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);