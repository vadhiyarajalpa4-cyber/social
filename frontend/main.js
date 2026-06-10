import { io } from 'socket.io-client';
import { 
  renderFeedView, 
  renderSearchView, 
  renderNotificationsView, 
  renderChatView, 
  renderBookmarksView, 
  renderAnalyticsView, 
  renderAdminView, 
  renderProfileView,
  loadUserSuggestions
} from './app.js';

export const API_URL = 'http://127.0.0.1:5000';
let socket = null;
let currentUser = null;

// Global App State
export const state = {
  currentView: 'feed',
  activeChatPartnerId: null,
  activeStoryIndex: 0,
  activeStoryGroup: null,
  activeStoryTimer: null
};

// Global Toast Manager
export const showToast = (message, type = 'info') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#10b981;fill:none;stroke-width:2;"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'error') {
    icon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#ef4444;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    icon = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#8b5cf6;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  // Slide out and remove
  setTimeout(() => {
    toast.style.animation = 'floatIn 0.3s ease-in reverse';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Central API Request Wrapper
export const apiCall = async (endpoint, method = 'GET', body = null, isMultipart = false) => {
  const token = localStorage.getItem('token');
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let options = { method, headers };

  if (body) {
    if (isMultipart) {
      options.body = body; // Body is FormData, browser sets boundary automatically
    } else {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  try {
    const res = await fetch(`${API_URL}/api${endpoint}`, options);
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    showToast(error.message, 'error');
    throw error;
  }
};

// Connect to WebSockets
const initSocketConnection = (token, userId) => {
  if (socket) socket.disconnect();

  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Socket client connected successfully');
    socket.emit('join', userId);
  });

  // Listen for real-time messages
  socket.on('receive_message', (msg) => {
    if (state.currentView === 'chat' && state.activeChatPartnerId === msg.sender._id) {
      // Direct render message in active conversation
      const log = document.getElementById('chat-messages-log');
      if (log) {
        const row = document.createElement('div');
        row.className = 'chat-bubble-row received';
        row.innerHTML = `
          <div class="chat-msg-bubble">
            ${msg.text ? `<div>${msg.text}</div>` : ''}
            ${msg.mediaUrl ? `<img src="${API_URL}${msg.mediaUrl}" style="max-width:200px;border-radius:8px;margin-top:5px;display:block;">` : ''}
            <span class="chat-msg-time">${new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        `;
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;
      }
    } else {
      // Incremented unread count
      const badge = document.getElementById('unread-chat-count');
      if (badge) {
        const count = parseInt(badge.textContent || '0') + 1;
        badge.textContent = count;
        badge.style.display = 'block';
      }
      showToast(`New message from @${msg.sender.username}`, 'info');
    }
  });

  // Listen for real-time notifications
  socket.on('receive_notification', (notif) => {
    const badge = document.getElementById('unread-notifications-count');
    if (badge) {
      const count = parseInt(badge.textContent || '0') + 1;
      badge.textContent = count;
      badge.style.display = 'block';
    }

    let verb = '';
    if (notif.type === 'like') verb = 'liked your post';
    else if (notif.type === 'comment') verb = 'commented on your post';
    else if (notif.type === 'follow') verb = 'started following you';
    else if (notif.type === 'mention') verb = 'mentioned you in a post';

    showToast(`@${notif.senderName} ${verb}!`, 'success');
  });

  return socket;
};

export const getSocketInstance = () => socket;
export const getCurrentUser = () => currentUser;

// Update UI Shell details
const updateShellUserUI = (user) => {
  document.getElementById('sidebar-fullname').textContent = user.fullName;
  document.getElementById('sidebar-username').textContent = `@${user.username}`;
  document.getElementById('nav-welcome-user').textContent = `Hello, ${user.fullName.split(' ')[0]}`;
  
  const avatarEl = document.getElementById('sidebar-avatar');
  avatarEl.src = user.profilePic ? `${API_URL}${user.profilePic}` : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;

  // If Admin, display link
  const adminItem = document.querySelector('.admin-only-item');
  if (user.role === 'admin') {
    adminItem.style.display = 'flex';
  } else {
    adminItem.style.display = 'none';
  }
};

// Check Auth State on Startup
const checkAuth = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    return;
  }

  try {
    const data = await apiCall('/auth/me');
    currentUser = data.data;
    updateShellUserUI(currentUser);
    
    // Connect WebSockets
    initSocketConnection(token, currentUser._id);

    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    
    // Load default feed view
    navigateViewByHash();
    loadUserSuggestions();
  } catch (error) {
    console.error('Session verify failed:', error);
    localStorage.removeItem('token');
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  }
};

// View routing by Hash changes
export const navigateTo = (view, extraParam = '') => {
  let hash = `#/${view}`;
  if (extraParam) {
    hash += `/${extraParam}`;
  }
  window.location.hash = hash;
};

const navigateViewByHash = () => {
  const hash = window.location.hash || '#/feed';
  const parts = hash.split('/');
  const route = parts[1] || 'feed';
  const param = parts[2] || '';

  // Update active sidebar style
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === route) {
      item.classList.add('active');
    }
  });

  state.currentView = route;

  // Toggle layout widgets column and active page layout classes
  const widgetsCol = document.getElementById('widgets-column-container');
  const contentBodyRoot = document.getElementById('content-body-root');
  
  if (route === 'search') {
    if (widgetsCol) widgetsCol.style.display = 'none';
    if (contentBodyRoot) contentBodyRoot.classList.add('explore-page-active');
  } else if (route === 'feed' || route === 'bookmarks') {
    if (widgetsCol) widgetsCol.style.display = 'flex';
    if (contentBodyRoot) contentBodyRoot.classList.remove('explore-page-active');
  } else {
    if (widgetsCol) widgetsCol.style.display = 'none';
    if (contentBodyRoot) contentBodyRoot.classList.remove('explore-page-active');
  }

  // Clear main container
  const container = document.getElementById('main-view-container');
  container.innerHTML = '';

  // Invoke routing handlers
  switch (route) {
    case 'feed':
      renderFeedView(container);
      break;
    case 'search':
      renderSearchView(container);
      break;
    case 'notifications':
      renderNotificationsView(container);
      // Clear badge count
      const badge = document.getElementById('unread-notifications-count');
      if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
      break;
    case 'chat':
      renderChatView(container, param);
      // Clear badge count
      const chatBadge = document.getElementById('unread-chat-count');
      if (chatBadge) {
        chatBadge.textContent = '0';
        chatBadge.style.display = 'none';
      }
      break;
    case 'bookmarks':
      renderBookmarksView(container);
      break;
    case 'analytics':
      renderAnalyticsView(container);
      break;
    case 'admin':
      if (currentUser && currentUser.role === 'admin') {
        renderAdminView(container);
      } else {
        navigateTo('feed');
      }
      break;
    case 'profile':
      renderProfileView(container, param || currentUser.username);
      break;
    default:
      renderFeedView(container);
  }
};

// Event Listeners setup
document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  checkAuth();

  // Route hash listener
  window.addEventListener('hashchange', navigateViewByHash);

  // Switch Auth Modes
  document.getElementById('go-to-register').addEventListener('click', () => {
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('register-card').style.display = 'block';
  });
  document.getElementById('go-to-login').addEventListener('click', () => {
    document.getElementById('register-card').style.display = 'none';
    document.getElementById('login-card').style.display = 'block';
  });

  // Login handler
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailOrUsername = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await apiCall('/auth/login', 'POST', { emailOrUsername, password });
      localStorage.setItem('token', data.token);
      showToast('Logged in successfully', 'success');
      
      // Refresh auth state
      checkAuth();
    } catch (err) {
      // Error is already alerted by apiCall wrapper
    }
  });

  // Register handler
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('reg-fullname').value;
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const interests = document.getElementById('reg-interests').value;

    try {
      const data = await apiCall('/auth/register', 'POST', {
        fullName,
        username,
        email,
        password,
        interests
      });
      localStorage.setItem('token', data.token);
      showToast('Account created successfully!', 'success');
      checkAuth();
    } catch (err) {
      // Handled
    }
  });

  // Sidebar Menu clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
    });
  });

  // Profile chip clicks
  document.getElementById('user-profile-chip').addEventListener('click', () => {
    if (currentUser) navigateTo('profile', currentUser.username);
  });

  // Logout Handler
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    currentUser = null;
    if (socket) socket.disconnect();
    showToast('Logged out successfully', 'info');
    
    // Show login page
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    window.location.hash = '';
  });

  // Global search enter
  document.getElementById('global-search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) {
        navigateTo('search', `query=${encodeURIComponent(q)}`);
        e.target.value = '';
      }
    }
  });

  // Theme Toggle Button
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
      html.setAttribute('data-theme', 'light');
      document.querySelector('.moon-icon').style.display = 'none';
      document.querySelector('.sun-icon').style.display = 'block';
    } else {
      html.setAttribute('data-theme', 'dark');
      document.querySelector('.sun-icon').style.display = 'none';
      document.querySelector('.moon-icon').style.display = 'block';
    }
  });

  // Modal overlay close clicks
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', () => {
    overlay.style.display = 'none';
    
    // Clear story timers if open
    if (state.activeStoryTimer) {
      clearTimeout(state.activeStoryTimer);
      state.activeStoryTimer = null;
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      if (state.activeStoryTimer) {
        clearTimeout(state.activeStoryTimer);
        state.activeStoryTimer = null;
      }
    }
  });
});
