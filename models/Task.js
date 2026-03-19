const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    completed: { type: Boolean, default: false },
    createdAt: { type: String },
    userEmail: { type: String, required: true }
});

module.exports = mongoose.model('Task', taskSchema);
