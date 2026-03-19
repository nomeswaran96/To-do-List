const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Task = require('./models/Task');
const User = require('./models/User');

const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the current directory explicitly
app.use(express.static(__dirname));

// Explicit fallback to serve index.html on the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo-companion';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Database: todo-companion'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes

// Auth Routes
// Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Please enter all fields' });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const newUser = new User({ name, email, password });
        const savedUser = await newUser.save();
        
        res.status(201).json({
            user: { id: savedUser._id, name: savedUser.name, email: savedUser.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Please enter all fields' });
        }
        
        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        res.json({
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Get all tasks for a specific user
app.get('/api/tasks', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email query parameter is required' });
        }
        const tasks = await Task.find({ userEmail: email });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Create a new task
app.post('/api/tasks', async (req, res) => {
    try {
        const task = new Task(req.body);
        const savedTask = await task.save();
        res.status(201).json(savedTask);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Update an existing task (edit details or toggle completion)
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const updatedTask = await Task.findOneAndUpdate(
            { id: req.params.id }, 
            req.body, 
            { new: true }
        );
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
        res.json(updatedTask);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Delete a specific task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const deletedTask = await Task.findOneAndDelete({ id: req.params.id });
        if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Clear all completed tasks for a specific user (Clear History)
app.delete('/api/history', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email query parameter is required' });
        }
        await Task.deleteMany({ userEmail: email, completed: true });
        res.json({ message: 'History cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflicts
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
