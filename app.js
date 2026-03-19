document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskForm = document.getElementById('task-form');
    const taskNameInput = document.getElementById('task-name');
    const taskDateInput = document.getElementById('task-date');
    const taskTimeInput = document.getElementById('task-time');
    const submitBtn = document.getElementById('submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    const activeTasksList = document.getElementById('active-tasks-list');
    const historyTasksList = document.getElementById('history-tasks-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const currentDateEl = document.getElementById('current-date');
    const notificationContainer = document.getElementById('notification-container');
    
    // Auth DOM Elements
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authForm = document.getElementById('auth-form');
    const nameGroup = document.getElementById('name-group');
    const authNameInput = document.getElementById('auth-name');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authSwitchBtn = document.getElementById('auth-switch-btn');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewContents = document.querySelectorAll('.view-content');

    // API Base URL
    const API_URL = '/api';

    // State
    let tasks = [];
    let users = JSON.parse(localStorage.getItem('users')) || [];
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let editTaskId = null;
    let reminderInterval;
    let isLoginMode = true;

    // Initialization
    function init() {
        if (currentUser) {
            showApp();
        } else {
            showAuth();
        }

        displayCurrentDate();
        startReminderCheck();
        
        // Event Listeners
        taskForm.addEventListener('submit', handleTaskSubmit);
        cancelEditBtn.addEventListener('click', cancelEdit);
        clearHistoryBtn.addEventListener('click', clearHistory);
        
        authForm.addEventListener('submit', handleAuthSubmit);
        
        // Fix for the sign up / login toggle
        authSwitchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuthMode(e);
        });
        
        logoutBtn.addEventListener('click', handleLogout);
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.target));
        });
    }

    // Auth Logic
    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }

    function showApp() {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        fetchTasks(); // Load from MongoDB
    }

    function toggleAuthMode(e) {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Sign in to your To-Do Companion';
            nameGroup.classList.add('hidden');
            authNameInput.removeAttribute('required');
            authSubmitBtn.textContent = 'Sign In';
            authSwitchText.textContent = "Don't have an account?";
            authSwitchBtn.textContent = 'Sign Up';
        } else {
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Get started with To-Do Companion';
            nameGroup.classList.remove('hidden');
            authNameInput.setAttribute('required', 'true');
            authSubmitBtn.textContent = 'Sign Up';
            authSwitchText.textContent = 'Already have an account?';
            authSwitchBtn.textContent = 'Sign In';
        }
        
        authForm.reset();
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value.trim();
        const name = authNameInput.value.trim();
        
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = 'Please wait...';

        try {
            if (isLoginMode) {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await res.json();
                if (res.ok) {
                    currentUser = data.user;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showApp();
                    showNotification('Successfully logged in!');
                } else {
                    showNotification(data.error || 'Login failed');
                }
            } else {
                const res = await fetch(`${API_URL}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                
                const data = await res.json();
                if (res.ok) {
                    currentUser = data.user;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showApp();
                    showNotification('Account created successfully!');
                } else {
                    showNotification(data.error || 'Signup failed');
                }
            }
        } catch (err) {
            console.error('Auth error:', err);
            showNotification('Server error. Please try again later.');
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        }
    }

    function handleLogout() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        tasks = []; // Clear current user's tasks
        showAuth();
        authForm.reset();
        showNotification('Logged out successfully');
    }

    // Tab Switching Logic
    function switchTab(targetId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
        
        viewContents.forEach(view => {
            view.classList.toggle('active', view.id === targetId);
        });
    }

    function displayCurrentDate() {
        if (currentDateEl) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            currentDateEl.textContent = new Date().toLocaleDateString(undefined, options);
        }
        
        if (taskDateInput) {
            const today = new Date().toISOString().split('T')[0];
            taskDateInput.min = today;
        }
    }

    // Backend API Calls
    async function fetchTasks() {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_URL}/tasks?email=${currentUser.email}`);
            if (res.ok) {
                tasks = await res.json();
                renderTasks();
            } else {
                console.error("Failed to load tasks from database");
            }
        } catch (err) {
            console.error("API Connection error (is server running?)", err);
            showNotification("Could not connect to database server");
        }
    }

    // Add or Edit Task
    async function handleTaskSubmit(e) {
        e.preventDefault();
        
        const name = taskNameInput.value.trim();
        const date = taskDateInput.value;
        const time = taskTimeInput.value;
        
        if (!name || !date || !time) return;

        if (editTaskId) {
            // Edit existing
            const taskIndex = tasks.findIndex(t => t.id === editTaskId);
            if (taskIndex !== -1) {
                const updatedData = { ...tasks[taskIndex], name, date, time };
                
                try {
                    const res = await fetch(`${API_URL}/tasks/${editTaskId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedData)
                    });
                    if (res.ok) {
                        tasks[taskIndex] = await res.json();
                        showNotification(`Task updated: ${name}`);
                        cancelEdit();
                        renderTasks();
                        switchTab('active-view');
                    }
                } catch (err) {
                    console.error("Update failed", err);
                }
            }
        } else {
            // Add new
            const newTask = {
                id: Date.now().toString(),
                name,
                date,
                time,
                completed: false,
                createdAt: new Date().toISOString(),
                userEmail: currentUser.email
            };
            
            try {
                const res = await fetch(`${API_URL}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTask)
                });
                if (res.ok) {
                    const savedTask = await res.json();
                    tasks.push(savedTask);
                    showNotification('New task added!');
                    taskForm.reset();
                    renderTasks();
                    switchTab('active-view');
                }
            } catch (err) {
                console.error("Create failed", err);
            }
        }
    }

    // Render Tasks
    function renderTasks() {
        if (!currentUser) return;
        
        const activeTasks = tasks.filter(t => !t.completed);
        const historyTasks = tasks.filter(t => t.completed);

        activeTasks.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
        historyTasks.sort((a, b) => b.id - a.id);

        renderList(activeTasksList, activeTasks, false);
        renderList(historyTasksList, historyTasks, true);
        
        checkRemindersImmediate();
    }

    function renderList(container, taskArray, isHistory) {
        container.innerHTML = '';
        
        if (taskArray.length === 0) {
            container.innerHTML = `<div id="empty-state">No tasks added yet</div>`;
            return;
        }

        taskArray.forEach(task => {
            const el = document.createElement('div');
            el.className = `task-item ${isHistory ? 'completed' : ''}`;
            el.dataset.id = task.id;
            
            const dateTime = new Date(`${task.date}T${task.time}`);
            const displayTime = dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let displayDate = new Date(task.date).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
            
            if (task.date === new Date().toISOString().split('T')[0]) {
                displayDate = "Today";
            }

            el.innerHTML = `
                <div class="task-content">
                    <h3>${task.name}</h3>
                    <div class="task-meta">
                        <span>&#128197; ${displayDate}</span>
                        <span>&#9200; ${displayTime}</span>
                    </div>
                </div>
                <div class="task-actions">
                    ${!isHistory ? `
                        <button class="icon-btn complete-btn" title="Mark Complete">&#10004;</button>
                        <button class="icon-btn edit-btn" title="Edit Task">&#9998;</button>
                    ` : `
                        <button class="icon-btn restore-btn" title="Restore Task">&#8635;</button>
                    `}
                    <button class="icon-btn delete-icon" title="Delete Task">&#10006;</button>
                </div>
            `;

            if (!isHistory) {
                el.querySelector('.complete-btn').addEventListener('click', () => toggleComplete(task.id));
                el.querySelector('.edit-btn').addEventListener('click', () => startEdit(task));
            } else {
                el.querySelector('.restore-btn').addEventListener('click', () => toggleComplete(task.id));
            }
            
            el.querySelector('.delete-icon').addEventListener('click', () => deleteTask(task.id));

            container.appendChild(el);
        });
    }

    // Toggle Complete Status
    async function toggleComplete(id) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            const task = tasks[taskIndex];
            const updatedStatus = !task.completed;
            
            try {
                const res = await fetch(`${API_URL}/tasks/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: updatedStatus })
                });
                if (res.ok) {
                    tasks[taskIndex].completed = updatedStatus;
                    renderTasks();
                    showNotification(updatedStatus ? "Task moved to History" : "Task restored");
                }
            } catch (err) {
                console.error("Status toggle failed", err);
            }
        }
    }

    // Delete Task
    async function deleteTask(id) {
        if (confirm("Are you sure you want to delete this task?")) {
            try {
                const res = await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    tasks = tasks.filter(t => t.id !== id);
                    renderTasks();
                    showNotification("Task deleted");
                    
                    if (editTaskId === id) {
                        cancelEdit();
                    }
                }
            } catch (err) {
                console.error("Delete failed", err);
            }
        }
    }

    // Start Editing
    function startEdit(task) {
        editTaskId = task.id;
        taskNameInput.value = task.name;
        taskDateInput.value = task.date;
        taskTimeInput.value = task.time;
        
        submitBtn.textContent = 'Update Task';
        cancelEditBtn.classList.remove('hidden');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        taskNameInput.focus();
    }

    // Cancel Editing
    function cancelEdit() {
        editTaskId = null;
        taskForm.reset();
        submitBtn.textContent = 'Add Task';
        cancelEditBtn.classList.add('hidden');
    }

    // Clear History
    async function clearHistory() {
        if (confirm("Clear all completed tasks?")) {
            try {
                const res = await fetch(`${API_URL}/history?email=${currentUser.email}`, { method: 'DELETE' });
                if (res.ok) {
                    tasks = tasks.filter(t => !t.completed);
                    renderTasks();
                    showNotification("History cleared");
                }
            } catch (err) {
                console.error("Clear history failed", err);
            }
        }
    }

    // Reminder System
    function startReminderCheck() {
        checkRemindersImmediate();
        reminderInterval = setInterval(checkRemindersImmediate, 60000); // 1 minute
    }

    function checkRemindersImmediate() {
        const now = new Date();
        const activeElements = activeTasksList.querySelectorAll('.task-item');
        
        activeElements.forEach(el => {
            const taskId = el.dataset.id;
            const task = tasks.find(t => t.id === taskId);
            
            if (task && !task.completed) {
                const taskTime = new Date(`${task.date}T${task.time}`);
                const diffMs = taskTime - now;
                const diffMins = Math.floor(diffMs / 60000);
                
                el.classList.remove('due-soon', 'overdue');
                
                if (diffMins < 0) {
                    el.classList.add('overdue');
                } else if (diffMins <= 60) {
                    el.classList.add('due-soon');
                    
                    if (!task.notified && diffMins > 0 && diffMins <= 15) {
                        tryTriggerBrowserNotification(task);
                    }
                }
            }
        });
    }

    function tryTriggerBrowserNotification(task) {
        if (!("Notification" in window)) return;
        
        if (Notification.permission === "granted") {
            new Notification("Task Due Soon!", {
                body: `${task.name} is due in less than 15 minutes!`,
                icon: 'favicon.ico'
            });
            task.notified = true;
            
            // Optionally save the notified state so it doesn't fire on reload
            fetch(`${API_URL}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notified: true })
            });
            
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    tryTriggerBrowserNotification(task);
                }
            });
        }
    }

    // Custom UI Notifications
    function showNotification(message) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.textContent = message;
        
        notificationContainer.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    // Run Initialization
    init();
});
