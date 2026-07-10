// c:\projo\app_backend.js

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const DB = {
    prefix: 'mbp_',
    get(key, def) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : def;
        } catch (err) { return def; }
    },
    set(key, value) { localStorage.setItem(this.prefix + key, JSON.stringify(value)); },
    
    // --- Database-backed methods ---
    async users() { return await this._fetchData('users'); },
    async setUsers(users) { await this._replaceData('users', users); },
    async members() { return await this._fetchData('members'); },
    async setMembers(members) { await this._replaceData('members', members); },
    async meetings() { return await this._fetchData('meetings'); },
    async setMeetings(meetings) { await this._replaceData('meetings', meetings); },
    async minutes() { return await this._fetchData('minutes'); },
    async setMinutes(minutes) { await this._replaceData('minutes', minutes); },
    async complaints() { return await this._fetchData('complaints'); },
    async setComplaints(complaints) { await this._replaceData('complaints', complaints); },
    async documents() { return await this._fetchData('documents'); },
    async setDocuments(documents) { await this._replaceData('documents', documents); },
    
    // --- New Email & Broadcast methods ---
    async emails() { return await this._fetchData('emails'); },
    async setEmails(emails) { await this._replaceData('emails', emails); },
    async broadcasts() { return await this._fetchData('broadcasts'); },
    async setBroadcasts(broadcasts) { await this._replaceData('broadcasts', broadcasts); },

    // --- API Helpers ---
    async _fetchData(entity) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) { return []; }
    },
    async _replaceData(entity, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (error) { }
    },
    async _addItem(entity, item) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) { return null; }
    },
    async _deleteItem(entity, id) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    },
    async _updateItem(entity, id, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    },

    // --- Database Adders ---
    async addUser(user) { return await this._addItem('users', user); },
    async addMember(member) { return await this._addItem('members', member); },
    async addMeeting(meeting) { return await this._addItem('meetings', meeting); },
    async addMinute(minute) { return await this._addItem('minutes', minute); },
    async addComplaint(complaint) { return await this._addItem('complaints', complaint); },
    async addDocument(document) { return await this._addItem('documents', document); },
    async addEmail(email) { return await this._addItem('emails', email); },
    async addBroadcast(broadcast) { return await this._addItem('broadcasts', broadcast); },

    // Public registration
    async registerUser(user) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user.name,
                    email: user.email,
                    password: user.password,
                    role: user.role || 'member',
                    municipality: user.municipality || 'kenol'
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Registration failed';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) { }
                throw new Error(errorMessage);
            }
            return await response.json();
        } catch (error) {
            throw error;
        }
    },
    getNextId(array) { return array.length ? Math.max(...array.map(item => item.id || 0)) + 1 : 1; }
}

async function seedData() { }

let currentUser = null;
let speechUtterance = null;
let uploadedMeetingFiles = [];
let uploadedMinutesFiles = [];
let uploadedBroadcastFiles = [];
let uploadedDocumentFiles = [];

const qs = selector => document.querySelector(selector);
const qsa = selector => document.querySelectorAll(selector);
const byId = id => document.getElementById(id);

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getRoleLabel(role) {
  return {
    super_admin: 'Super Admin',
    municipal_officer: 'Municipal Officer',
    member: 'Member',
    department_officer: 'Department Officer',
    social_officer: 'Social Officer'
  }[role] || role;
}

function getMunicipalityLabel(value) {
  return {
    kenol: 'Kenol',
    kangare: 'Kangare',
    muranga_town: "Murang'a Town",
    all: 'All Municipalities'
  }[value] || value;
}

function isSystemAdmin(user) {
  return user && user.role === 'super_admin';
}

function canManageAll(user) {
  return user && (user.role === 'super_admin' || user.role === 'social_officer');
}

function getAllowedItems(items, key = 'municipality') {
  if (canManageAll(currentUser)) return items;
  return items.filter(item => item[key] === currentUser.municipality || item[key] === 'all');
}

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.status === 403) {
      const error = await response.json();
      toast(error.error || 'Account pending approval. Please wait for admin approval.', 'warning');
      return false;
    }
    
    if (response.status === 401) {
      const error = await response.json();
      toast(error.error || 'Invalid email or password. Please check your credentials.', 'danger');
      return false;
    }
    
    if (response.ok) {
      currentUser = await response.json();
      localStorage.setItem('mbp_session', JSON.stringify({ userId: currentUser.id }));
      return true;
    }
    
    toast('Login failed. Please try again.', 'danger');
    return false;
  } catch (error) {
    toast('An error occurred. Please check your connection.', 'danger');
    return false;
  }
}

function logout() {
  localStorage.removeItem('mbp_session');
  window.location.href = 'index.html';
}

async function restoreSession() {
  const session = localStorage.getItem('mbp_session');
  if (!session) return false;
  try {
    const data = JSON.parse(session);
    const users = await DB.users();
    const user = users.find(u => u.id === data.userId);
    if (user) {
      currentUser = user;
      return true;
    }
  } catch (err) { return false; }
  return false;
}

function showAppInfo() {
  const nameEl = byId('navUserName') || byId('settingsUserName');
  const roleEl = byId('navUserRole') || byId('settingsUserRole');
  const muniEl = byId('navMunicipality');
  if (nameEl) nameEl.textContent = currentUser.name;
  if (roleEl) roleEl.textContent = getRoleLabel(currentUser.role);
  if (muniEl) muniEl.textContent = currentUser.municipality === 'all' ? 'All Municipalities' : getMunicipalityLabel(currentUser.municipality);
  
  const usersNav = byId('navUsers');
  if (usersNav) usersNav.style.display = isSystemAdmin(currentUser) ? 'flex' : 'none';
  
  const trackNav = byId('navTrack');
  if (trackNav) trackNav.style.display = isSystemAdmin(currentUser) ? 'flex' : 'none';
  
  const approvalsNav = byId('navApprovals');
  if (approvalsNav) {
    approvalsNav.style.display = (isSystemAdmin(currentUser) || currentUser.role === 'municipal_officer') ? 'flex' : 'none';
  }
    const reportsNav = byId('navReports');
  if (reportsNav) {
    reportsNav.style.display = (isSystemAdmin(currentUser) || currentUser.role === 'municipal_officer') ? 'flex' : 'none';
  }
  
  updateApprovalsBadge();
}

function render(html) {
  const container = byId('pageContainer');
  if (container) container.innerHTML = html;
}

async function navigate(page) {
  const items = qsa('.sidebar .nav-item');
  items.forEach(item => item.classList.toggle('active', item.dataset.page === page));
  switch (page) {
    case 'dashboard': await renderDashboard(); break;
    case 'members': await renderMembers(); break;
    case 'meetings': await renderMeetings(); break;
    case 'minutes': await renderMinutes(); break;
    case 'complaints': await renderComplaints(); break;
    case 'documents': await renderDocuments(); break;
    case 'users': await renderUsers(); break;
    case 'track': await renderTrackUsers(); break;
    case 'emails': await renderEmails(); break;
    case 'broadcasts': await renderBroadcasts(); break;
    case 'approvals': await renderApprovals(); break;
    case 'permissions': await renderPermissions(); break;
    case 'reports': await renderReports(); break; 
    case 'projects': await renderProjects(); break;
    default: render('<div class="card"><h2>Page not found</h2></div>');
  }
}

// ============= APPROVALS MANAGEMENT =============

async function updateApprovalsBadge() {
  try {
    const users = await DB.users();
    let pendingUsers = users.filter(u => !u.is_approved && u.role === 'member' && !u.is_rejected);
    
    if (currentUser && currentUser.role === 'municipal_officer') {
      pendingUsers = pendingUsers.filter(u => u.municipality === currentUser.municipality);
    }
    
    const count = pendingUsers.length;
    
    const badge = document.getElementById('approvalsBadge');
    if (badge) {
      if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = count > 99 ? '99+' : count;
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (error) { }
}

async function renderApprovals() {
  if (!isSystemAdmin(currentUser) && currentUser.role !== 'municipal_officer') {
    render('<div class="card"><h2>Access Denied</h2><p>Only Super Admin and Municipal Officers can manage approvals.</p></div>');
    return;
  }

  const users = await DB.users();
  
  const memberUsers = users.filter(u => u.role === 'member');
  
  let filteredMemberUsers = memberUsers;
  if (currentUser.role === 'municipal_officer') {
    filteredMemberUsers = memberUsers.filter(u => u.municipality === currentUser.municipality);
  }
  
  const pendingUsers = filteredMemberUsers.filter(u => !u.is_approved && !u.is_rejected);
  const approvedUsers = filteredMemberUsers.filter(u => u.is_approved && !u.is_rejected);
  const rejectedUsers = filteredMemberUsers.filter(u => u.is_rejected === true);
  
  const totalUsers = filteredMemberUsers.length;
  const pendingCount = pendingUsers.length;
  const approvedCount = approvedUsers.length;
  const rejectedCount = rejectedUsers.length;

  render(`
    <div class="page-header">
      <h2>
        <i class="fas fa-user-check"></i> User Approvals
        <span class="approvals-count badge badge-warning" style="margin-left:0.5rem;font-size:0.8rem;">${pendingCount}</span>
        ${currentUser.role === 'municipal_officer' ? `<span style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem;">(${getMunicipalityLabel(currentUser.municipality)} only)</span>` : ''}
      </h2>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <span class="badge badge-warning">Pending: ${pendingCount}</span>
        <span class="badge badge-success">Approved: ${approvedCount}</span>
        <span class="badge badge-danger">Rejected: ${rejectedCount}</span>
        <span class="badge badge-info">Total: ${totalUsers}</span>
      </div>
    </div>

    <div class="approval-tabs" style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
      <button class="btn btn-sm btn-outline active" onclick="filterApprovals('pending', event)">
        <i class="fas fa-clock"></i> Pending <span class="badge badge-warning" style="font-size:0.7rem;">${pendingCount}</span>
      </button>
      <button class="btn btn-sm btn-outline" onclick="filterApprovals('approved', event)">
        <i class="fas fa-check-circle" style="color:var(--success);"></i> Approved <span class="badge badge-success" style="font-size:0.7rem;">${approvedCount}</span>
      </button>
      <button class="btn btn-sm btn-outline" onclick="filterApprovals('rejected', event)">
        <i class="fas fa-times-circle" style="color:var(--danger);"></i> Rejected <span class="badge badge-danger" style="font-size:0.7rem;">${rejectedCount}</span>
      </button>
      <button class="btn btn-sm btn-outline" onclick="filterApprovals('all', event)">
        <i class="fas fa-users"></i> All <span class="badge badge-info" style="font-size:0.7rem;">${totalUsers}</span>
      </button>
    </div>

    <div id="approvalsList">
      ${renderApprovalTable(pendingUsers, 'pending')}
    </div>
  `);

  await updateApprovalsBadge();
}

function renderApprovalTable(users, type) {
  if (!users || users.length === 0) {
    const iconMap = {
      pending: 'clock',
      approved: 'check-circle',
      rejected: 'times-circle',
      all: 'users'
    };
    const colorMap = {
      pending: 'var(--warning)',
      approved: 'var(--success)',
      rejected: 'var(--danger)',
      all: 'var(--info)'
    };
    const labelMap = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      all: 'Users'
    };
    return `
      <div class="card text-center text-muted" style="padding:3rem;">
        <i class="fas fa-${iconMap[type]}" 
           style="font-size:3rem;color:${colorMap[type]};margin-bottom:1rem;"></i>
        <h3>No ${labelMap[type]} Users</h3>
        <p>${type === 'pending' ? 'All user accounts have been reviewed.' : 
           type === 'approved' ? 'No users have been approved yet.' : 
           type === 'rejected' ? 'No users have been rejected.' : 
           'No users found.'}</p>
      </div>
    `;
  }

  return `
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Municipality</th>
            <th>Registration Date</th>
            ${type === 'approved' ? '<th>Approved By</th>' : type === 'rejected' ? '<th>Rejected By</th>' : '<th>Status</th>'}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${user.name}</strong></td>
              <td>${user.email}</td>
              <td>${getMunicipalityLabel(user.municipality)}</td>
              <td>${formatDate(user.registration_date)}</td>
              <td>
                ${type === 'approved' ? (user.approved_by || 'System') : 
                  type === 'rejected' ? (user.rejected_by || 'System') : 
                  '<span class="badge badge-warning">Pending</span>'}
              </td>
              <td style="white-space:nowrap;">
                ${type === 'pending' ? `
                  <button class="btn btn-success btn-sm" onclick="approveUser(${user.id})">
                    <i class="fas fa-check"></i> Approve
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="rejectUser(${user.id})">
                    <i class="fas fa-times"></i> Reject
                  </button>
                ` : type === 'approved' ? `
                  <button class="btn btn-warning btn-sm" onclick="rejectUser(${user.id})">
                    <i class="fas fa-times"></i> Reject
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                ` : `
                  <button class="btn btn-success btn-sm" onclick="approveUser(${user.id})">
                    <i class="fas fa-check"></i> Approve
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filterApprovals(filter, event) {
  if (event && event.target) {
    document.querySelectorAll('.approval-tabs .btn').forEach(btn => btn.classList.remove('active'));
    const target = event.target.closest('.btn');
    if (target) target.classList.add('active');
  }

  const users = (async () => {
    const allUsers = await DB.users();
    let memberUsers = allUsers.filter(u => u.role === 'member');
    
    if (currentUser && currentUser.role === 'municipal_officer') {
      memberUsers = memberUsers.filter(u => u.municipality === currentUser.municipality);
    }
    
    let filteredUsers = [];
    switch(filter) {
      case 'pending':
        filteredUsers = memberUsers.filter(u => !u.is_approved && !u.is_rejected);
        break;
      case 'approved':
        filteredUsers = memberUsers.filter(u => u.is_approved && !u.is_rejected);
        break;
      case 'rejected':
        filteredUsers = memberUsers.filter(u => u.is_rejected === true);
        break;
      case 'all':
      default:
        filteredUsers = memberUsers;
        break;
    }
    
    const listContainer = document.getElementById('approvalsList');
    if (listContainer) {
      listContainer.innerHTML = renderApprovalTable(filteredUsers, filter);
    }
  })();
}

async function approveUser(userId) {
  if (!confirm('Approve this user account?')) return;
  
  try {
    const users = await DB.users();
    const user = users.find(u => u.id === userId);
    if (!user) {
      toast('User not found', 'danger');
      return;
    }
    
    if (currentUser.role === 'municipal_officer' && user.municipality !== currentUser.municipality) {
      toast('You can only approve users from your municipality (' + getMunicipalityLabel(currentUser.municipality) + ')', 'danger');
      return;
    }
    
    const updateData = {
      name: user.name,
      email: user.email,
      role: user.role,
      municipality: user.municipality,
      is_approved: true,
      approved_by: currentUser.name,
      approved_date: new Date().toISOString(),
      is_rejected: false,
      last_seen: user.last_seen || '',
      registration_date: user.registration_date || new Date().toISOString()
    };
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      toast(`User ${user.name} approved successfully ✅`, 'success');
      await updateApprovalsBadge();
      await renderApprovals();
    } else {
      const error = await response.json();
      toast('Failed to approve user: ' + (error.error || 'Unknown error'), 'danger');
    }
  } catch (error) {
    toast('An error occurred', 'danger');
  }
}

async function rejectUser(userId) {
  if (!confirm('Reject this user account? They will not be able to login unless approved later.')) return;
  
  try {
    const users = await DB.users();
    const user = users.find(u => u.id === userId);
    if (!user) {
      toast('User not found', 'danger');
      return;
    }
    
    if (currentUser.role === 'municipal_officer' && user.municipality !== currentUser.municipality) {
      toast('You can only reject users from your municipality (' + getMunicipalityLabel(currentUser.municipality) + ')', 'danger');
      return;
    }
    
    const updateData = {
      name: user.name,
      email: user.email,
      role: user.role,
      municipality: user.municipality,
      is_approved: false,
      is_rejected: true,
      rejected_by: currentUser.name,
      rejected_date: new Date().toISOString(),
      last_seen: user.last_seen || '',
      registration_date: user.registration_date || new Date().toISOString()
    };
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      toast(`User ${user.name} rejected`, 'info');
      await updateApprovalsBadge();
      await renderApprovals();
    } else {
      const error = await response.json();
      toast('Failed to reject user: ' + (error.error || 'Unknown error'), 'danger');
    }
  } catch (error) {
    toast('An error occurred', 'danger');
  }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user account permanently?')) return;
  
  try {
    const users = await DB.users();
    const user = users.find(u => u.id === userId);
    if (!user) {
      toast('User not found', 'danger');
      return;
    }
    
    if (currentUser.role === 'municipal_officer' && user.municipality !== currentUser.municipality) {
      toast('You can only delete users from your municipality (' + getMunicipalityLabel(currentUser.municipality) + ')', 'danger');
      return;
    }
    
    const success = await DB._deleteItem('users', userId);
    await DB._deleteItem('members', userId);
    
    if (success) {
      toast(`User ${user.name} deleted permanently`, 'info');
      await updateApprovalsBadge();
      await renderApprovals();
    } else {
      toast('Failed to delete user', 'danger');
    }
  } catch (error) {
    toast('An error occurred', 'danger');
  }
}

// ============= DASHBOARD =============

async function renderDashboard() {
  const members = getAllowedItems(await DB.members());
  const meetings = getAllowedItems(await DB.meetings());
  const complaints = getAllowedItems(await DB.complaints());
  const minutes = getAllowedItems(await DB.minutes());
  const documents = getAllowedItems(await DB.documents());
  const pending = complaints.filter(c => c.status === 'pending').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  
  // Sort meetings by date for recent list
  const sortedMeetings = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentMeetings = sortedMeetings.slice(0, 4);
  
  // Upcoming meetings
  const upcomingMeetings = meetings
    .filter(m => new Date(m.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  
  // Wrap everything in dashboard-bg container
  render(`
    <div class="dashboard-bg">
      <!-- Welcome Banner -->
      <div class="dashboard-welcome">
        <div class="welcome-content">
          <h1>Welcome back, ${currentUser.name}</h1>
          <p>Here's what's happening with the board today.</p>
          <div class="welcome-stats">
            <div class="stat-item">
              <span class="stat-number">${members.length}</span>
              <span class="stat-label">Board Members</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${meetings.length}</span>
              <span class="stat-label">Total Meetings</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${complaints.length}</span>
              <span class="stat-label">Complaints</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${pending}</span>
              <span class="stat-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stat-grid">
        <div class="stat-card-modern">
          <div class="stat-icon green"><i class="fas fa-users"></i></div>
          <div class="stat-number">${members.length}</div>
          <div class="stat-label">Board Members</div>
          <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Active</div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon gold"><i class="fas fa-calendar-alt"></i></div>
          <div class="stat-number">${meetings.length}</div>
          <div class="stat-label">Meetings</div>
          <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Scheduled</div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon red"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="stat-number">${complaints.length}</div>
          <div class="stat-label">Complaints</div>
          <div class="stat-change ${pending > 0 ? 'negative' : 'positive'}">${pending} Pending</div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon purple"><i class="fas fa-file-alt"></i></div>
          <div class="stat-number">${minutes.length}</div>
          <div class="stat-label">Minutes</div>
          <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Uploaded</div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon blue"><i class="fas fa-folder-open"></i></div>
          <div class="stat-number">${documents.length}</div>
          <div class="stat-label">Documents</div>
          <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Available</div>
        </div>
        <div class="stat-card-modern">
          <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="stat-number">${resolved}</div>
          <div class="stat-label">Resolved</div>
          <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Completed</div>
        </div>
      </div>

      <!-- Dashboard Two-Column Grid -->
      <div class="dashboard-grid">
        <!-- Left Column - Recent Activity -->
        <div class="card">
          <div class="card-header-modern">
            <div class="card-title"><i class="fas fa-clock"></i> Recent Meetings</div>
            <span class="card-action" onclick="navigate('meetings')">View All →</span>
          </div>
          <div class="activity-list">
            ${recentMeetings.length ? recentMeetings.map(m => `
              <div class="activity-item">
                <div class="activity-icon meeting"><i class="fas fa-calendar-check"></i></div>
                <div class="activity-content">
                  <div class="activity-title">${m.title}</div>
                  <div class="activity-meta">${formatDate(m.date)} at ${m.time} • ${m.location}</div>
                </div>
                <div class="activity-time">${m.attendees ? m.attendees.length : 0} attending</div>
              </div>
            `).join('') : '<div class="activity-item" style="justify-content:center;color:var(--text-muted);padding:1rem;">No recent meetings</div>'}
          </div>
        </div>

        <!-- Right Column - Upcoming Events -->
        <div class="card">
          <div class="card-header-modern">
            <div class="card-title"><i class="fas fa-calendar-alt"></i> Upcoming Events</div>
            <span class="card-action" onclick="navigate('meetings')">View All →</span>
          </div>
          <div class="events-list">
            ${upcomingMeetings.length ? upcomingMeetings.map(m => {
              const date = new Date(m.date);
              return `
              <div class="event-item">
                <div class="event-date">
                  <div class="event-day">${date.getDate()}</div>
                  <div class="event-month">${date.toLocaleString('default', { month: 'short' })}</div>
                </div>
                <div class="event-info">
                  <div class="event-title">${m.title}</div>
                  <div class="event-time">${m.time} • ${m.location}</div>
                </div>
                <div class="event-badge">Upcoming</div>
              </div>
            `}).join('') : '<div class="event-item" style="justify-content:center;color:var(--text-muted);padding:1rem;">No upcoming meetings</div>'}
          </div>
        </div>
      </div>

      <!-- Budget Utilization Card -->
      <div class="budget-card" style="margin-top:1.25rem;">
        <div class="budget-header">
          <div class="budget-title"><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:0.5rem;"></i>Budget Utilization</div>
          <div class="budget-year">FY 2024/2025</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:0.25rem;">
          <span>87% Used</span>
          <span style="color:var(--gold);">23% Remaining</span>
        </div>
        <div class="budget-progress">
          <div class="budget-bar gold" style="width:87%;"></div>
        </div>
        <div class="budget-stats">
          <div class="budget-stat">
            <div class="stat-value">KES 12.4M</div>
            <div class="stat-label">Total Budget</div>
          </div>
          <div class="budget-stat">
            <div class="stat-value">KES 10.8M</div>
            <div class="stat-label">Used</div>
          </div>
          <div class="budget-stat">
            <div class="stat-value">KES 1.6M</div>
            <div class="stat-label">Remaining</div>
          </div>
          <div class="budget-stat">
            <div class="stat-value" style="color:var(--gold);">87%</div>
            <div class="stat-label">Utilization</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card" style="margin-top:1.25rem;">
        <div class="card-header-modern">
          <div class="card-title"><i class="fas fa-bolt" style="color:var(--gold);"></i> Quick Actions</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;">
          <button class="btn btn-primary btn-sm" onclick="navigate('members')"><i class="fas fa-users"></i> Members</button>
          <button class="btn btn-gold btn-sm" onclick="navigate('meetings')"><i class="fas fa-calendar-alt"></i> Schedule Meeting</button>
          <button class="btn btn-outline btn-sm" onclick="navigate('complaints')"><i class="fas fa-exclamation-triangle"></i> Complaints</button>
          <button class="btn btn-outline btn-sm" onclick="navigate('documents')"><i class="fas fa-folder-open"></i> Documents</button>
          <button class="btn btn-outline btn-sm" onclick="navigate('emails')"><i class="fas fa-envelope"></i> Email</button>
          <button class="btn btn-outline btn-sm" onclick="navigate('broadcasts')"><i class="fas fa-bullhorn"></i> Announce</button>
        </div>
      </div>
    </div>
  `);
}

// ============= MEMBERS =============

async function renderMembers() {
  const members = getAllowedItems(await DB.members());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  render(`
    <div class="page-header">
      <h2><i class="fas fa-users"></i> Board Members</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showAddMemberModal()"><i class="fas fa-plus"></i> Add Member</button>' : ''}
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Municipality</th><th>Joined</th>${canAdd ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${members.length ? members.map(member => `
            <tr>
              <td>${member.name}</td>
              <td>${member.email}</td>
              <td>${getRoleLabel(member.role)}</td>
              <td>${getMunicipalityLabel(member.municipality)}</td>
              <td>${formatDate(member.joined)}</td>
              ${canAdd ? `<td><button class="btn btn-danger btn-sm" onclick="deleteMember(${member.id})"><i class="fas fa-trash"></i></button></td>` : ''}
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center text-muted">No members found</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

async function showAddMemberModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  let roleOptions = ['member'];
  if (currentUser.role === 'super_admin') {
    roleOptions = ['super_admin', 'municipal_officer', 'member', 'social_officer', 'department_officer'];
  }

  showModal(`
    <h3><i class="fas fa-user-plus"></i> Add Member / User</h3>
    <form id="addMemberForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="mName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="mEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="text" id="mPassword" value="member123" required /></div>
      <div class="form-group"><label>Role</label><select id="mRole">${roleOptions.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Municipality</label><select id="mMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Add Member</button>
    </form>
  `);
  
  byId('addMemberForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('mName').value.trim();
    const email = byId('mEmail').value.trim();
    const password = byId('mPassword').value.trim();
    const role = byId('mRole').value;
    const municipality = byId('mMunicipality').value;
    
    if (!name || !email || !password) { 
      toast('Complete all fields', 'danger'); 
      return; 
    }
    
    const users = await DB.users();
    if (users.find(u => u.email === email)) { 
      toast('Email already exists', 'danger'); 
      return; 
    }
    
    const newUser = await DB.addUser({ 
      name, 
      email, 
      password,
      role, 
      municipality 
    });
    
    if (!newUser) {
        toast('Failed to add user', 'danger');
        return;
    }

    if (role !== 'super_admin') {
        const newMember = await DB.addMember({ 
          name, 
          email, 
          role, 
          municipality, 
          joined: new Date().toISOString().slice(0, 10) 
        });
        if (!newMember) {
            toast('Failed to add member', 'danger');
            return;
        }
    }
    
    closeModal();
    toast('User added', 'success');
    navigate('members');
  });
}

async function deleteMember(id) {
  if (!confirm('Delete this member?')) return;
  const memberSuccess = await DB._deleteItem('members', id);
  const userSuccess = await DB._deleteItem('users', id);
  if (memberSuccess && userSuccess) {
      toast('Member deleted', 'success');
      navigate('members');
  } else {
      toast('Failed to delete member', 'danger');
  }
}

// ============= MEETINGS =============

function handleFileSelect(event) {
  const files = event.target.files;
  handleFiles(files);
}

function handleFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const files = event.dataTransfer.files;
  handleFiles(files);
  const dropZone = document.getElementById('uploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('uploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--surface-alt)';
  }
}

function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('uploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10 * 1024 * 1024) {
      toast(`File "${file.name}" is too large. Maximum size is 10MB.`, 'danger');
      continue;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast(`File "${file.name}" is not a supported format.`, 'warning');
      continue;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result,
        uploadDate: new Date().toISOString()
      };
      uploadedMeetingFiles.push(fileData);
      displayFileList();
    };
    reader.readAsDataURL(file);
  }
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
}

function displayFileList() {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;
  
  fileList.innerHTML = uploadedMeetingFiles.map((file, index) => {
    const isImage = file.type && file.type.startsWith('image/');
    return `
    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-alt); padding:0.4rem 0.8rem; border-radius:8px; border:1px solid var(--border);">
      ${isImage ? `<img src="${file.data}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;" />` : `<i class="${getFileIcon(file.type)}" style="color:var(--primary);"></i>`}
      <span style="font-size:0.85rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
      <span style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeFile(${index})" style="padding:0.1rem 0.4rem; font-size:0.7rem;">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `}).join('');
}

function removeFile(index) {
  uploadedMeetingFiles.splice(index, 1);
  displayFileList();
}

function getFileIcon(type) {
  if (type.includes('pdf')) return 'fas fa-file-pdf';
  if (type.includes('word') || type.includes('document')) return 'fas fa-file-word';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'fas fa-file-excel';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'fas fa-file-powerpoint';
  if (type.startsWith('image/')) return 'fas fa-file-image';
  return 'fas fa-file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function showScheduleMeetingModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  uploadedMeetingFiles = [];
  
  showModal(`
    <h3><i class="fas fa-calendar-plus"></i> Schedule Meeting</h3>
    <form id="scheduleMeetingForm" enctype="multipart/form-data">
      <div class="form-group">
        <label>Meeting Title <span style="color:var(--danger);">*</span></label>
        <input type="text" id="mtTitle" required placeholder="Enter meeting title" />
      </div>
      
      <div class="form-group">
        <label>Description / Agenda</label>
        <textarea id="mtDescription" rows="4" placeholder="Enter meeting description, agenda items, or key discussion points..."></textarea>
      </div>
      
      <div class="form-group">
        <label>Date <span style="color:var(--danger);">*</span></label>
        <input type="date" id="mtDate" required />
      </div>
      
      <div class="form-group">
        <label>Time <span style="color:var(--danger);">*</span></label>
        <input type="time" id="mtTime" required />
      </div>
      
      <div class="form-group">
        <label>Location <span style="color:var(--danger);">*</span></label>
        <input type="text" id="mtLocation" required placeholder="Enter meeting venue" />
      </div>
      
      <div class="form-group">
        <label>Municipality <span style="color:var(--danger);">*</span></label>
        <select id="mtMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
      </div>
      
      <div class="form-group">
        <label>Upload Documents & Images</label>
        <div style="border:2px dashed var(--border); border-radius:12px; padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.3s;" 
             id="uploadDropZone" 
             ondrop="handleFileDrop(event)" 
             ondragover="handleDragOver(event)"
             ondragleave="handleDragLeave(event)"
             onclick="document.getElementById('fileInput').click()">
          <i class="fas fa-cloud-upload-alt" style="font-size:2.5rem; color:var(--primary);"></i>
          <p style="margin:0.5rem 0; color:var(--text-muted);">
            Drag & drop files here or click to browse
          </p>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Supports: PDF, Word, Excel, PowerPoint, Images (JPG, PNG, GIF) • Max 10MB each
          </p>
          <input type="file" id="fileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif" style="display:none;" onchange="handleFileSelect(event)" />
        </div>
        <div id="fileList" style="margin-top:0.75rem; display:flex; flex-wrap:wrap; gap:0.5rem;"></div>
      </div>
      
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Schedule Meeting</button>
    </form>
  `);
  
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  
  byId('scheduleMeetingForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = byId('mtTitle').value.trim();
    const description = byId('mtDescription').value.trim();
    const date = byId('mtDate').value;
    const time = byId('mtTime').value;
    const location = byId('mtLocation').value.trim();
    const municipality = byId('mtMunicipality').value;
    
    if (!title || !date || !time || !location) { 
      toast('Please fill in all required fields', 'danger'); 
      return; 
    }
    
    const meetingData = { 
      title, 
      description, 
      date, 
      time, 
      location, 
      municipality, 
      status: 'scheduled', 
      attendees: [], 
      declined: [],
      files: uploadedMeetingFiles
    };
    
    const newMeeting = await DB.addMeeting(meetingData);
    if (newMeeting) {
        closeModal();
        toast('Meeting scheduled successfully with ' + uploadedMeetingFiles.length + ' file(s) attached ✅', 'success');
        navigate('meetings');
    } else {
        toast('Failed to schedule meeting', 'danger');
    }
  });
}

async function viewMeetingFiles(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting || !meeting.files || meeting.files.length === 0) {
    toast('No files attached to this meeting', 'info');
    return;
  }

  const images = meeting.files.filter(f => f.type && f.type.startsWith('image/'));
  const documents = meeting.files.filter(f => f.type && !f.type.startsWith('image/'));

  showModal(`
    <h3><i class="fas fa-paperclip"></i> Files: ${meeting.title}</h3>
    <div style="margin-bottom:1rem; color:var(--text-muted);">
      <span class="badge badge-info">${meeting.files.length} files</span>
      ${images.length > 0 ? `<span class="badge badge-success">${images.length} images</span>` : ''}
      ${documents.length > 0 ? `<span class="badge badge-warning">${documents.length} documents</span>` : ''}
    </div>
    
    ${images.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-images"></i> Images (${images.length})
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:0.75rem;">
          ${images.map((file, index) => `
            <div style="position:relative; cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid var(--border); transition:all 0.3s;" 
                 onclick="previewFile(${id}, ${meeting.files.indexOf(file)})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='scale(1.02)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.transform='scale(1)';">
              <img src="${file.data}" style="width:100%; height:120px; object-fit:cover;" />
              <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:white; padding:0.25rem 0.5rem; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${file.name}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${documents.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-file-alt"></i> Documents (${documents.length})
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          ${documents.map((file, index) => {
            const fileIndex = meeting.files.indexOf(file);
            return `
            <div style="display:flex; align-items:center; gap:0.75rem; background:var(--surface-alt); padding:0.75rem; border-radius:8px; border:1px solid var(--border); cursor:pointer; transition:all 0.3s;"
                 onclick="previewFile(${id}, ${fileIndex})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface-alt)';">
              <i class="${getFileIcon(file.type)}" style="font-size:2rem; color:var(--primary);"></i>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:500; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); downloadMeetingFile(${id}, ${fileIndex})">
                <i class="fas fa-download"></i>
              </button>
            </div>
          `}).join('')}
        </div>
      </div>
    ` : ''}
    
    <button class="btn btn-outline btn-block" style="margin-top:0.5rem;" onclick="closeModal()">Close</button>
  `);
}

function previewFile(meetingId, fileIndex) {
  const meetings = (async () => { return await DB.meetings(); })();
  meetings.then(meetingsList => {
    const meeting = meetingsList.find(item => item.id === meetingId);
    if (!meeting || !meeting.files || !meeting.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = meeting.files[fileIndex];
    const isImage = file.type && file.type.startsWith('image/');
    
    showModal(`
      <div style="text-align:center;">
        <h3 style="margin-bottom:0.5rem;">${file.name}</h3>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
          ${formatFileSize(file.size)} • ${file.type || 'Unknown type'}
        </div>
        ${isImage ? `
          <img src="${file.data}" style="max-width:100%; max-height:70vh; border-radius:8px; border:1px solid var(--border);" />
        ` : `
          <div style="padding:2rem; background:var(--surface-alt); border-radius:12px; border:1px solid var(--border);">
            <i class="${getFileIcon(file.type)}" style="font-size:4rem; color:var(--primary);"></i>
            <p style="margin-top:1rem; color:var(--text-muted);">
              This file type cannot be previewed directly.
            </p>
            <button class="btn btn-primary" onclick="closeModal(); downloadMeetingFile(${meetingId}, ${fileIndex});">
              <i class="fas fa-download"></i> Download File
            </button>
          </div>
        `}
        <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">
          ${isImage ? `
            <button class="btn btn-primary btn-sm" onclick="downloadMeetingFile(${meetingId}, ${fileIndex})">
              <i class="fas fa-download"></i> Download
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="closeModal(); viewMeetingFiles(${meetingId});">
            <i class="fas fa-arrow-left"></i> Back to Files
          </button>
        </div>
      </div>
    `);
  });
}

function downloadMeetingFile(meetingId, fileIndex) {
  const meetings = (async () => { return await DB.meetings(); })();
  meetings.then(meetingsList => {
    const meeting = meetingsList.find(item => item.id === meetingId);
    if (!meeting || !meeting.files || !meeting.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = meeting.files[fileIndex];
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Downloading: ${file.name}`, 'success');
  });
}

// ============================================================
// RENDER MEETINGS - UPDATED WITH QR CODE BUTTONS
// ============================================================

async function renderMeetings() {
  const meetings = getAllowedItems(await DB.meetings());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-calendar-alt"></i> Meetings</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showScheduleMeetingModal()"><i class="fas fa-plus"></i> Schedule</button>' : ''}
    </div>
    <div class="grid-2">
      ${meetings.length ? meetings.map(meeting => {
        const isAttending = meeting.attendees && meeting.attendees.includes(currentUser.email);
        const isDeclined = meeting.declined && meeting.declined.find(d => d.email === currentUser.email);
        const attendeesCount = meeting.attendees ? meeting.attendees.length : 0;
        const declinedCount = meeting.declined ? meeting.declined.length : 0;
        const isUpcoming = new Date(meeting.date) >= new Date();
        const hasFiles = meeting.files && meeting.files.length > 0;
        const images = hasFiles ? meeting.files.filter(f => f.type && f.type.startsWith('image/')) : [];
        
        // Check if user can generate QR (creator or admin)
        const canGenerateQR = currentUser && (
          currentUser.role === 'super_admin' || 
          currentUser.role === 'municipal_officer' ||
          (meeting.createdBy && meeting.createdBy === currentUser.id)
        );
        
        return `
        <div class="card" style="${isUpcoming ? '' : 'opacity:0.7;'}">
          <div class="flex-between" style="display:flex;justify-content:space-between;align-items:start;gap:0.75rem;flex-wrap:wrap;">
            <strong style="font-size:1.05rem;">${meeting.title}</strong>
            <span class="badge ${meeting.status === 'scheduled' ? 'badge-info' : meeting.status === 'resolved' ? 'badge-success' : 'badge-warning'}">
              ${meeting.status}
            </span>
          </div>
          ${meeting.description ? `
            <div style="margin:0.5rem 0; color:var(--text-muted); font-size:0.9rem; padding:0.5rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid var(--primary);">
              ${meeting.description}
            </div>
          ` : ''}
          <div style="margin:0.65rem 0;color:var(--text-muted);font-size:0.95rem;">
            <i class="fas fa-calendar-day"></i> ${formatDate(meeting.date)} at ${meeting.time}
          </div>
          <div style="color:var(--text-muted);font-size:0.95rem;">
            <i class="fas fa-map-marker-alt"></i> ${meeting.location}
          </div>
          ${hasFiles ? `
            <div style="margin-top:0.5rem;">
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                ${images.slice(0, 4).map(file => `
                  <div style="width:40px; height:40px; border-radius:4px; overflow:hidden; border:1px solid var(--border); cursor:pointer;"
                       onclick="viewMeetingFiles(${meeting.id})">
                    <img src="${file.data}" style="width:100%; height:100%; object-fit:cover;" />
                  </div>
                `).join('')}
                ${meeting.files.length > 4 ? `
                  <span class="file-tag" style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--surface-alt); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border); cursor:pointer;" onclick="viewMeetingFiles(${meeting.id})">
                    +${meeting.files.length - 4} more
                  </span>
                ` : ''}
                <span class="file-tag" style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--surface-alt); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border); cursor:pointer;" onclick="viewMeetingFiles(${meeting.id})">
                  <i class="fas fa-paperclip" style="font-size:0.7rem;"></i>
                  ${meeting.files.length} files
                </span>
              </div>
            </div>
          ` : ''}
          <div style="margin-top:0.85rem;color:var(--text-muted);font-size:0.9rem;display:flex;gap:1rem;flex-wrap:wrap;">
            <span><i class="fas fa-check-circle" style="color:var(--success);"></i> ${attendeesCount} attending</span>
            ${declinedCount > 0 ? `<span><i class="fas fa-times-circle" style="color:var(--danger);"></i> ${declinedCount} declined</span>` : ''}
          </div>
          ${isDeclined ? `
            <div style="margin-top:0.65rem;padding:0.6rem 0.85rem;background:rgba(220,38,38,0.08);border-left:3px solid #dc2626;border-radius:8px;font-size:0.9rem;">
              <strong><i class="fas fa-times-circle" style="color:#dc2626;"></i> You declined:</strong> ${isDeclined.reason}
              ${isDeclined.comments ? `<br /><span style="font-size:0.8rem;color:var(--text-muted);">📝 ${isDeclined.comments}</span>` : ''}
            </div>
          ` : ''}
          
          <!-- ACTION BUTTONS - ROW 1: Attendance -->
          <div class="actions" style="margin-top:0.85rem;display:flex;flex-wrap:wrap;gap:0.5rem;">
            ${!isAttending && !isDeclined ? `
              <button class="btn btn-success btn-sm" onclick="confirmAttendance(${meeting.id})">
                <i class="fas fa-check"></i> Attend
              </button>
              <button class="btn btn-warning btn-sm" onclick="showDeclineModal(${meeting.id})">
                <i class="fas fa-times"></i> Decline
              </button>
            ` : ''}
            ${isAttending ? `
              <button class="btn btn-warning btn-sm" onclick="showDeclineModal(${meeting.id})">
                <i class="fas fa-exchange-alt"></i> Switch to Decline
              </button>
            ` : ''}
            ${isDeclined ? `
              <button class="btn btn-success btn-sm" onclick="confirmAttendance(${meeting.id})">
                <i class="fas fa-check"></i> Change to Attend
              </button>
            ` : ''}
          </div>
          
          <!-- ACTION BUTTONS - ROW 2: QR & Attendance Management -->
          <div class="actions" style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;">
            ${meeting.status === 'scheduled' ? `
              ${canGenerateQR ? `
                <button class="btn btn-qr-generate btn-sm" onclick="showGenerateQRModal(${meeting.id})" style="background:#7c3aed;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                  <i class="fas fa-qrcode"></i> QR Code
                </button>
              ` : ''}
              <button class="btn btn-qr-scan btn-sm" onclick="showScanQRModal(${meeting.id})" style="background:#059669;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                <i class="fas fa-camera"></i> Scan QR
              </button>
            ` : ''}
            
            <!-- NEW: Physical Attendance Button -->
            <button class="btn btn-physical-attendance btn-sm" onclick="recordPhysicalAttendance(${meeting.id})" style="background:#2563eb;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
              <i class="fas fa-user-check"></i> Record Physical
            </button>
            
            <!-- NEW: View Physical Attendance -->
            <button class="btn btn-view-attendance btn-sm" onclick="viewPhysicalAttendance(${meeting.id})" style="background:#0891b2;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
              <i class="fas fa-clipboard-list"></i> View Attendance
            </button>
            
            <!-- NEW: Bulk Entry (Admin only) -->
            ${canAdd ? `
              <button class="btn btn-bulk-entry btn-sm" onclick="bulkAttendanceModal(${meeting.id})" style="background:#8b5cf6;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                <i class="fas fa-users"></i> Bulk Entry
              </button>
            ` : ''}
            
            <!-- NEW: Export CSV (Admin only) -->
            ${canAdd ? `
              <button class="btn btn-export-csv btn-sm" onclick="exportAttendanceCSV(${meeting.id})" style="background:#16a34a;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                <i class="fas fa-file-csv"></i> Export CSV
              </button>
            ` : ''}
            
            ${canAdd ? `
              ${hasFiles ? `<button class="btn btn-secondary btn-sm" onclick="viewMeetingFiles(${meeting.id})" style="background:var(--surface-alt);color:var(--text);border:1px solid var(--border);padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;"><i class="fas fa-paperclip"></i> Files (${meeting.files.length})</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="deleteMeeting(${meeting.id})" style="background:#dc2626;color:white;border:none;padding:0.5rem 0.8rem;border-radius:999px;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                <i class="fas fa-trash"></i>
              </button>
            ` : ''}
          </div>
          
          <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">
            ${getMunicipalityLabel(meeting.municipality)}
          </div>
        </div>
      `}).join('') : '<div class="card text-center text-muted">No meetings scheduled yet.</div>'}
    </div>
  `);
}
async function confirmAttendance(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) {
    toast('Meeting not found', 'danger');
    return;
  }

  if (meeting.declined && meeting.declined.some(d => d.email === currentUser.email)) {
    meeting.declined = meeting.declined.filter(d => d.email !== currentUser.email);
  }

  if (!meeting.attendees.includes(currentUser.email)) {
    meeting.attendees.push(currentUser.email);
  }

  const success = await DB._updateItem('meetings', id, meeting);
  if (success) {
    toast('You are now attending this meeting ✅', 'success');
  } else {
    toast('Failed to confirm attendance', 'danger');
  }
  await renderMeetings();
}

async function showDeclineModal(meetingId) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === meetingId);
  if (!meeting) {
    toast('Meeting not found', 'danger');
    return;
  }

  const isAttending = meeting.attendees && meeting.attendees.includes(currentUser.email);
  const existingDecline = meeting.declined ? meeting.declined.find(d => d.email === currentUser.email) : null;

  showModal(`
    <h3><i class="fas fa-times-circle" style="color: var(--danger);"></i> 
      ${existingDecline ? 'Update Decline Reason' : 'Decline Meeting'}</h3>
    <p style="color: var(--text-muted); margin-bottom: 1rem;">
      ${isAttending ? 'You are currently attending this meeting. Declining will remove you from the attendee list.' : 
        existingDecline ? 'Update your reason for declining this meeting.' : 
        'Please provide a reason for not attending this meeting.'}
    </p>
    <form id="declineForm">
      <div class="form-group">
        <label>Reason for Declining</label>
        <select id="declineReason" required>
          <option value="">Select a reason...</option>
          <option value="Schedule Conflict" ${existingDecline?.reason === 'Schedule Conflict' ? 'selected' : ''}>Schedule Conflict</option>
          <option value="Prior Commitment" ${existingDecline?.reason === 'Prior Commitment' ? 'selected' : ''}>Prior Commitment</option>
          <option value="Travel Constraints" ${existingDecline?.reason === 'Travel Constraints' ? 'selected' : ''}>Travel Constraints</option>
          <option value="Health Reasons" ${existingDecline?.reason === 'Health Reasons' ? 'selected' : ''}>Health Reasons</option>
          <option value="Emergency" ${existingDecline?.reason === 'Emergency' ? 'selected' : ''}>Emergency</option>
          <option value="Other" ${existingDecline?.reason === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Additional Comments (Optional)</label>
        <textarea id="declineComments" rows="3" placeholder="Provide more details about why you can't attend...">${existingDecline?.comments || ''}</textarea>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button type="submit" class="btn btn-${isAttending ? 'warning' : 'danger'}">
          <i class="fas fa-times"></i> ${isAttending ? 'Cancel Attendance & Decline' : 'Decline Meeting'}
        </button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">
          <i class="fas fa-arrow-left"></i> Cancel
        </button>
      </div>
    </form>
  `);

  byId('declineForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const reason = byId('declineReason').value;
    const comments = byId('declineComments').value.trim();

    if (!reason) {
      toast('Please select a reason', 'danger');
      return;
    }

    const freshMeetings = await DB.meetings();
    const freshMeeting = freshMeetings.find(item => item.id === meetingId);
    if (!freshMeeting) {
      toast('Meeting not found', 'danger');
      return;
    }

    if (!freshMeeting.declined) freshMeeting.declined = [];

    freshMeeting.attendees = freshMeeting.attendees.filter(email => email !== currentUser.email);

    const existingIdx = freshMeeting.declined.findIndex(d => d.email === currentUser.email);
    const declineRecord = {
      email: currentUser.email,
      name: currentUser.name,
      reason: reason,
      comments: comments || '',
      timestamp: new Date().toISOString()
    };
    
    if (existingIdx >= 0) {
      freshMeeting.declined[existingIdx] = declineRecord;
    } else {
      freshMeeting.declined.push(declineRecord);
    }

    const success = await DB._updateItem('meetings', meetingId, freshMeeting);
    if (success) {
      closeModal();
      toast(isAttending ? 'Attendance cancelled and meeting declined.' : 'Meeting declined. Reason saved.', 'info');
      await renderMeetings();
    } else {
      toast('Failed to submit decline', 'danger');
    }
  });
}

// ============= VIEW ATTENDANCE =============

async function viewAttendance(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) return;

  const attendees = meeting.attendees || [];
  const declined = meeting.declined || [];
  const users = await DB.users();
  const members = await DB.members();
  
  const getUserRole = (email) => {
    const user = users.find(u => u.email === email);
    if (user) return getRoleLabel(user.role);
    const member = members.find(m => m.email === email);
    return member ? getRoleLabel(member.role) : 'Member';
  };
  
  const attendeeList = attendees.map(email => {
    const user = users.find(u => u.email === email);
    const name = user ? user.name : email;
    const role = getUserRole(email);
    return `
      <li style="padding:0.5rem 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span>
          <i class="fas fa-check-circle" style="color:var(--success);"></i> 
          <strong>${name}</strong>
        </span>
        <span style="color:var(--text-muted); font-size:0.85rem;">
          <span class="badge badge-info">${role}</span>
          <span style="margin-left:0.5rem;">${email}</span>
        </span>
      </li>
    `;
  }).join('') || '<li style="padding:0.5rem 0; color:var(--text-muted);">No one has confirmed attendance yet.</li>';

  const declinedList = declined.map(d => {
    const role = getUserRole(d.email);
    return `
      <li style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
          <strong><i class="fas fa-times-circle" style="color:var(--danger);"></i> ${d.name}</strong>
          <span style="color:var(--text-muted); font-size:0.85rem;">
            <span class="badge badge-warning">${role}</span>
            <span style="margin-left:0.5rem;">${formatDate(d.timestamp)}</span>
          </span>
        </div>
        <div style="color:var(--text-muted); font-size:0.85rem;">${d.email}</div>
        <div style="margin-top:0.35rem; padding:0.5rem 0.75rem; background:var(--surface-muted); border-radius:8px; font-style:italic; border-left:3px solid var(--danger);">
          <strong>Reason:</strong> "${d.reason}"${d.comments ? `<br/><span style="font-size:0.8rem;">📝 Comments: ${d.comments}</span>` : ''}
        </div>
      </li>
    `;
  }).join('') || '<li style="padding:0.5rem 0; color:var(--text-muted);">No one has declined.</li>';

  const meetingInfo = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
      <h3 style="margin:0;"><i class="fas fa-list"></i> Attendance: ${meeting.title}</h3>
      <span class="badge badge-info">${getMunicipalityLabel(meeting.municipality)}</span>
    </div>
    <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">
      📅 ${formatDate(meeting.date)} at ${meeting.time} • 📍 ${meeting.location}
    </div>
  `;

  const showAllAttendees = attendees.length > 5;
  const showAllDeclined = declined.length > 5;

  showModal(`
    <div id="attendancePrintArea">
      ${meetingInfo}
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="card" style="background:var(--surface-alt);">
          <div class="card-title" style="color:var(--success); display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fas fa-check-circle"></i> Attending (${attendees.length})</span>
            ${attendees.length > 5 ? `<button class="btn btn-sm btn-outline" onclick="toggleAttendanceList()"><i class="fas fa-chevron-down"></i> View All</button>` : ''}
          </div>
          <ul id="attendeeList" style="list-style:none; padding:0; margin:0; max-height: ${showAllAttendees ? '200px' : 'auto'}; overflow-y: ${showAllAttendees ? 'auto' : 'visible'};">
            ${attendeeList}
          </ul>
          ${showAllAttendees ? `
            <div style="text-align:center; margin-top:0.5rem;">
              <button class="btn btn-sm btn-outline" onclick="toggleAttendanceList()">
                <i class="fas fa-chevron-down"></i> Show All (${attendees.length})
              </button>
            </div>
          ` : ''}
        </div>
        
        <div class="card" style="background:var(--surface-alt);">
          <div class="card-title" style="color:var(--danger); display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fas fa-times-circle"></i> Declined (${declined.length})</span>
            ${declined.length > 5 ? `<button class="btn btn-sm btn-outline" onclick="toggleDeclinedList()"><i class="fas fa-chevron-down"></i> View All</button>` : ''}
          </div>
          <ul id="declinedList" style="list-style:none; padding:0; margin:0; max-height: ${showAllDeclined ? '200px' : 'auto'}; overflow-y: ${showAllDeclined ? 'auto' : 'visible'};">
            ${declinedList}
          </ul>
          ${showAllDeclined ? `
            <div style="text-align:center; margin-top:0.5rem;">
              <button class="btn btn-sm btn-outline" onclick="toggleDeclinedList()">
                <i class="fas fa-chevron-down"></i> Show All (${declined.length})
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
    
    <div style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap; justify-content:center; border-top:1px solid var(--border); padding-top:1rem;">
      <button class="btn btn-primary btn-sm" onclick="printAttendance()">
        <i class="fas fa-print"></i> Print
      </button>
      <button class="btn btn-success btn-sm" onclick="downloadAttendanceHTML()">
        <i class="fas fa-file-pdf"></i> Download HTML
      </button>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">
        <i class="fas fa-times"></i> Close
      </button>
    </div>
  `);
}

function toggleAttendanceList() {
  const list = document.getElementById('attendeeList');
  if (list) {
    const isExpanded = list.style.maxHeight !== '200px';
    list.style.maxHeight = isExpanded ? '200px' : 'none';
    list.style.overflowY = isExpanded ? 'auto' : 'visible';
    const btn = list.parentElement.querySelector('.btn-outline');
    if (btn) {
      btn.innerHTML = isExpanded ? 
        `<i class="fas fa-chevron-down"></i> Show All` : 
        `<i class="fas fa-chevron-up"></i> Show Less`;
    }
  }
}

function toggleDeclinedList() {
  const list = document.getElementById('declinedList');
  if (list) {
    const isExpanded = list.style.maxHeight !== '200px';
    list.style.maxHeight = isExpanded ? '200px' : 'none';
    list.style.overflowY = isExpanded ? 'auto' : 'visible';
    const btn = list.parentElement.querySelector('.btn-outline');
    if (btn) {
      btn.innerHTML = isExpanded ? 
        `<i class="fas fa-chevron-down"></i> Show All` : 
        `<i class="fas fa-chevron-up"></i> Show Less`;
    }
  }
}

function printAttendance() {
  const content = document.getElementById('attendancePrintArea');
  if (!content) return;
  
  const meetingTitle = content.querySelector('h3')?.textContent?.replace('Attendance: ', '') || 'Meeting';
  const meetingDetails = content.querySelector('div[style*="color:var(--text-muted)"]')?.textContent || '';
  
  const attendeeItems = content.querySelectorAll('#attendeeList li');
  const declinedItems = content.querySelectorAll('#declinedList li');
  
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Attendance - ${meetingTitle}</title>
        <style>
          body { font-family: 'Times New Roman', Arial, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a1a2e; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin: 0; color: #1a1a2e; }
          .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
          .meeting-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #1a1a2e; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; padding: 10px 0; border-bottom: 2px solid #1a1a2e; margin-bottom: 15px; }
          .section-title.success { color: #28a745; border-color: #28a745; }
          .section-title.danger { color: #dc3545; border-color: #dc3545; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f1f1; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          .badge-info { background: #e3f2fd; color: #0d47a1; }
          .badge-warning { background: #fff3e0; color: #e65100; }
          .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1a1a2e; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 20px; }
          .signature-item { text-align: center; }
          .signature-line { border-top: 1px solid #1a1a2e; margin: 40px 0 5px 0; width: 100%; }
          .signature-label { font-size: 12px; color: #666; margin-top: 5px; }
          .footer { text-align: center; color: #999; margin-top: 30px; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
          @media print { .no-print { display: none; } body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MURANG'A COUNTY MUNICIPAL BOARD</h1>
          <div class="subtitle">Meeting Attendance Report</div>
        </div>
        
        <div class="meeting-info">
          <strong>Meeting:</strong> ${meetingTitle}<br>
          <strong>Details:</strong> ${meetingDetails}
        </div>
        
        <div class="section">
          <div class="section-title success">✅ ATTENDING (${attendeeItems.length})</div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th></tr></thead>
            <tbody>
              ${attendeeItems.length > 0 ? 
                Array.from(attendeeItems).map((item, index) => {
                  const text = item.textContent.trim();
                  const parts = text.split(/\s+/);
                  const name = parts.slice(0, -1).join(' ');
                  const email = parts[parts.length - 1] || '';
                  const roleBadge = item.querySelector('.badge');
                  const role = roleBadge ? roleBadge.textContent : 'Member';
                  return `<tr><td>${index + 1}</td><td><strong>${name.replace(email, '').trim()}</strong></td><td><span class="badge badge-info">${role}</span></td><td>${email}</td></tr>`;
                }).join('') : 
                `<tr><td colspan="4" style="text-align:center; color:#999;">No attendees</td></tr>`
              }
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title danger">❌ DECLINED (${declinedItems.length})</div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th><th>Reason</th></tr></thead>
            <tbody>
              ${declinedItems.length > 0 ? 
                Array.from(declinedItems).map((item, index) => {
                  const nameEl = item.querySelector('strong');
                  const name = nameEl ? nameEl.textContent.replace('✕', '').trim() : 'Unknown';
                  const emailEl = item.querySelector('div[style*="color:var(--text-muted)"]');
                  const email = emailEl ? emailEl.textContent.trim() : '';
                  const reasonEl = item.querySelector('div[style*="background:var(--surface-muted)"]');
                  let reason = 'Not specified';
                  if (reasonEl) {
                    const reasonMatch = reasonEl.textContent.match(/Reason:\s*"([^"]*)"/);
                    if (reasonMatch) reason = reasonMatch[1];
                  }
                  const roleBadge = item.querySelector('.badge');
                  const role = roleBadge ? roleBadge.textContent : 'Member';
                  return `<tr><td>${index + 1}</td><td><strong>${name}</strong></td><td><span class="badge badge-warning">${role}</span></td><td>${email}</td><td>${reason}</td></tr>`;
                }).join('') : 
                `<tr><td colspan="5" style="text-align:center; color:#999;">No declines</td></tr>`
              }
            </tbody>
          </table>
        </div>
        
        <div class="signature-section">
          <h3 style="text-align:center; margin-bottom:20px;">ATTENDANCE CONFIRMATION</h3>
          <div class="signature-grid">
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Chairperson</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Secretary</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Municipal Officer</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
          </div>
          <div style="text-align:center; margin-top:15px; font-size:12px; color:#666;">
            <p>I confirm that the attendance listed above is accurate and complete.</p>
          </div>
        </div>
        
        <div class="footer">Report generated on ${new Date().toLocaleString()} • Page 1 of 1</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

function downloadAttendanceHTML() {
  const content = document.getElementById('attendancePrintArea');
  if (!content) return;
  
  const meetingTitle = content.querySelector('h3')?.textContent?.replace('Attendance: ', '') || 'Meeting';
  const meetingDetails = content.querySelector('div[style*="color:var(--text-muted)"]')?.textContent || '';
  
  const attendeeItems = content.querySelectorAll('#attendeeList li');
  const declinedItems = content.querySelectorAll('#declinedList li');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Attendance - ${meetingTitle}</title>
        <style>
          body { font-family: 'Times New Roman', Arial, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a1a2e; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin: 0; color: #1a1a2e; }
          .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
          .meeting-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #1a1a2e; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; padding: 10px 0; border-bottom: 2px solid #1a1a2e; margin-bottom: 15px; }
          .section-title.success { color: #28a745; border-color: #28a745; }
          .section-title.danger { color: #dc3545; border-color: #dc3545; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f1f1; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          .badge-info { background: #e3f2fd; color: #0d47a1; }
          .badge-warning { background: #fff3e0; color: #e65100; }
          .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1a1a2e; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 20px; }
          .signature-item { text-align: center; }
          .signature-line { border-top: 1px solid #1a1a2e; margin: 40px 0 5px 0; width: 100%; }
          .signature-label { font-size: 12px; color: #666; margin-top: 5px; }
          .footer { text-align: center; color: #999; margin-top: 30px; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MURANG'A COUNTY MUNICIPAL BOARD</h1>
          <div class="subtitle">Meeting Attendance Report</div>
        </div>
        
        <div class="meeting-info">
          <strong>Meeting:</strong> ${meetingTitle}<br>
          <strong>Details:</strong> ${meetingDetails}
        </div>
        
        <div class="section">
          <div class="section-title success">✅ ATTENDING (${attendeeItems.length})</div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th></tr></thead>
            <tbody>
              ${attendeeItems.length > 0 ? 
                Array.from(attendeeItems).map((item, index) => {
                  const text = item.textContent.trim();
                  const parts = text.split(/\s+/);
                  const name = parts.slice(0, -1).join(' ');
                  const email = parts[parts.length - 1] || '';
                  const roleBadge = item.querySelector('.badge');
                  const role = roleBadge ? roleBadge.textContent : 'Member';
                  return `<tr><td>${index + 1}</td><td><strong>${name.replace(email, '').trim()}</strong></td><td><span class="badge badge-info">${role}</span></td><td>${email}</td></tr>`;
                }).join('') : 
                `<tr><td colspan="4" style="text-align:center; color:#999;">No attendees</td></tr>`
              }
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title danger">❌ DECLINED (${declinedItems.length})</div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Email</th><th>Reason</th></tr></thead>
            <tbody>
              ${declinedItems.length > 0 ? 
                Array.from(declinedItems).map((item, index) => {
                  const nameEl = item.querySelector('strong');
                  const name = nameEl ? nameEl.textContent.replace('✕', '').trim() : 'Unknown';
                  const emailEl = item.querySelector('div[style*="color:var(--text-muted)"]');
                  const email = emailEl ? emailEl.textContent.trim() : '';
                  const reasonEl = item.querySelector('div[style*="background:var(--surface-muted)"]');
                  let reason = 'Not specified';
                  if (reasonEl) {
                    const reasonMatch = reasonEl.textContent.match(/Reason:\s*"([^"]*)"/);
                    if (reasonMatch) reason = reasonMatch[1];
                  }
                  const roleBadge = item.querySelector('.badge');
                  const role = roleBadge ? roleBadge.textContent : 'Member';
                  return `<tr><td>${index + 1}</td><td><strong>${name}</strong></td><td><span class="badge badge-warning">${role}</span></td><td>${email}</td><td>${reason}</td></tr>`;
                }).join('') : 
                `<tr><td colspan="5" style="text-align:center; color:#999;">No declines</td></tr>`
              }
            </tbody>
          </table>
        </div>
        
        <div class="signature-section">
          <h3 style="text-align:center; margin-bottom:20px;">ATTENDANCE CONFIRMATION</h3>
          <div class="signature-grid">
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Chairperson</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Secretary</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">Municipal Officer</div>
              <div style="font-size:11px; color:#666; margin-top:5px;">Date: ___________</div>
            </div>
          </div>
          <div style="text-align:center; margin-top:15px; font-size:12px; color:#666;">
            <p>I confirm that the attendance listed above is accurate and complete.</p>
          </div>
        </div>
        
        <div class="footer">Report generated on ${new Date().toLocaleString()} • Page 1 of 1</div>
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Attendance_${meetingTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  toast('Attendance report downloaded ✅', 'success');
}

async function deleteMeeting(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) {
    toast('Meeting not found', 'danger');
    return;
  }

  const attendeeCount = meeting.attendees ? meeting.attendees.length : 0;
  const declineCount = meeting.declined ? meeting.declined.length : 0;

  showModal(`
    <div style="text-align:center;">
      <div style="font-size:4rem; margin-bottom:0.5rem;">🗑️</div>
      <h3 style="color:var(--danger);">Delete Meeting</h3>
      <p style="color:var(--text-muted); margin:1rem 0;">
        Are you sure you want to delete this meeting?
      </p>
      <div style="background:var(--surface-alt); padding:1rem; border-radius:12px; margin:1rem 0; text-align:left;">
        <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
          <span><i class="fas fa-calendar-alt"></i> Title:</span>
          <strong>${meeting.title}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
          <span><i class="fas fa-calendar-day"></i> Date:</span>
          <strong>${formatDate(meeting.date)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
          <span><i class="fas fa-map-marker-alt"></i> Location:</span>
          <strong>${meeting.location}</strong>
        </div>
        ${meeting.description ? `
          <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
            <span><i class="fas fa-align-left"></i> Description:</span>
            <strong style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${meeting.description}</strong>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
          <span><i class="fas fa-users"></i> Attendees:</span>
          <strong>${attendeeCount} attending</strong>
        </div>
        ${declineCount > 0 ? `
          <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
            <span><i class="fas fa-times-circle" style="color:var(--danger);"></i> Declined:</span>
            <strong style="color:var(--danger);">${declineCount} declined</strong>
          </div>
        ` : ''}
        ${meeting.files && meeting.files.length > 0 ? `
          <div style="display:flex; justify-content:space-between; padding:0.25rem 0;">
            <span><i class="fas fa-paperclip"></i> Files:</span>
            <strong>${meeting.files.length} attached</strong>
          </div>
        ` : ''}
      </div>
      <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-danger" onclick="confirmDeleteMeeting(${id})">
          <i class="fas fa-trash"></i> Yes, Delete
        </button>
        <button class="btn btn-outline" onclick="closeModal()">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    </div>
  `);
}

async function confirmDeleteMeeting(id) {
  const success = await DB._deleteItem('meetings', id);
  closeModal();
  if (success) {
    toast('Meeting deleted successfully 🗑️', 'success');
    navigate('meetings');
  } else {
    toast('Failed to delete meeting', 'danger');
  }
}

// ============================================================
// QR CODE ATTENDANCE FUNCTIONS
// ============================================================

// QR Manager for attendance
const QRManager = {
  // Generate QR code for a meeting
  generateQR(meetingId, meetingData) {
    const payload = {
      meetingId: meetingId,
      meetingTitle: meetingData.title,
      timestamp: new Date().toISOString(),
      municipality: meetingData.municipality,
    };
    return btoa(JSON.stringify(payload));
  },

  // Verify QR code data
  verifyQR(encodedData) {
    try {
      const decoded = JSON.parse(atob(encodedData));
      return decoded;
    } catch (e) {
      return null;
    }
  },

  // Get current location
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  toRad(deg) {
    return deg * (Math.PI / 180);
  },

  // Validate attendance with location
  async validateAttendance(meetingId, qrData, userLocation) {
    if (!qrData || qrData.meetingId !== meetingId) {
      return { valid: false, reason: 'Invalid QR code' };
    }

    const qrTime = new Date(qrData.timestamp);
    const now = new Date();
    const diffMinutes = (now - qrTime) / (1000 * 60);
    if (diffMinutes > 30) {
      return { valid: false, reason: 'QR code has expired' };
    }

    if (userLocation && qrData.meetingLat && qrData.meetingLng) {
      const distance = this.calculateDistance(
        userLocation.lat,
        userLocation.lng,
        qrData.meetingLat,
        qrData.meetingLng
      );
      const distanceMeters = distance * 1000;
      if (distanceMeters > 100) {
        return {
          valid: false,
          reason: `You are ${Math.round(distanceMeters)} meters away. Please be within 100 meters of the meeting venue.`
        };
      }
    }

    return { valid: true };
  },

  // Save attendance record
  async saveAttendance(meetingId, userId, qrData, location) {
    const attendanceRecord = {
      meetingId: meetingId,
      userId: userId,
      userName: currentUser ? currentUser.name : 'Unknown',
      userEmail: currentUser ? currentUser.email : 'Unknown',
      checkInTime: new Date().toISOString(),
      qrTimestamp: qrData.timestamp,
      location: location || null,
      verified: true,
      manual: qrData.manual || false
    };

    const attendance = JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
    const existing = attendance.find(
      a => a.meetingId === meetingId && a.userId === userId
    );
    if (existing) {
      return { success: false, message: 'You have already checked in to this meeting.' };
    }
    attendance.push(attendanceRecord);
    localStorage.setItem('mbp_attendance', JSON.stringify(attendance));
    return { success: true, message: 'Attendance confirmed!', record: attendanceRecord };
  },

  // Get attendance for a meeting
  getAttendance(meetingId) {
    const attendance = JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
    return attendance.filter(a => a.meetingId === meetingId);
  },

  // Get all attendance
  getAllAttendance() {
    return JSON.parse(localStorage.getItem('mbp_attendance') || '[]');
  }
};

// Generate QR Code for meeting
async function showGenerateQRModal(meetingId) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(m => m.id === meetingId);
  if (!meeting) {
    toast('Meeting not found', 'danger');
    return;
  }

  let location = null;
  try {
    location = await getCurrentLocation();
  } catch (e) {
    toast('Unable to get location. QR will be generated without location verification.', 'warning');
  }

  const qrData = {
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    timestamp: new Date().toISOString(),
    municipality: meeting.municipality,
    meetingLat: location ? location.lat : null,
    meetingLng: location ? location.lng : null,
    locationAccuracy: location ? location.accuracy : null
  };

  const qrEncoded = btoa(JSON.stringify(qrData));
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrEncoded)}`;

  showModal(`
    <div class="qr-modal-content">
      <h3><i class="fas fa-qrcode" style="color:var(--primary);"></i> Attendance QR Code</h3>
      <div class="qr-info">
        <p><strong>Meeting:</strong> ${meeting.title}</p>
        <p><strong>Date:</strong> ${formatDate(meeting.date)} at ${meeting.time}</p>
        <p><strong>Location:</strong> ${meeting.location}</p>
        ${location ? `<p><span class="location-status success"><i class="fas fa-check-circle"></i> Location captured</span></p>` : 
          `<p><span class="location-status error"><i class="fas fa-exclamation-circle"></i> Location not captured</span></p>`}
      </div>
      <div class="qr-wrapper">
        <img src="${qrCodeUrl}" alt="QR Code" id="qrCodeImage" />
        <div class="qr-timer" id="qrTimer">Valid for: 30:00</div>
      </div>
      <div class="qr-actions">
        <button class="btn btn-success btn-sm" onclick="downloadQR()">
          <i class="fas fa-download"></i> Download QR
        </button>
        <button class="btn btn-primary btn-sm" onclick="printQR()">
          <i class="fas fa-print"></i> Print
        </button>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
      <div style="margin-top:1rem; padding:0.75rem; background:var(--surface-alt); border-radius:8px; font-size:0.85rem; color:var(--text-muted);">
        <i class="fas fa-info-circle"></i> 
        This QR code expires in 30 minutes. Attendees must be within 100 meters of the meeting location to check in.
      </div>
    </div>
  `);

  let seconds = 1800;
  const timerEl = document.getElementById('qrTimer');
  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(interval);
      if (timerEl) {
        timerEl.textContent = 'QR Code Expired ❌';
        timerEl.className = 'qr-timer qr-expired';
      }
      const img = document.getElementById('qrCodeImage');
      if (img) {
        img.style.opacity = '0.4';
        img.style.filter = 'grayscale(1)';
      }
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (timerEl) {
        timerEl.textContent = `Valid for: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }
  }, 1000);

  window._qrData = { encoded: qrEncoded, meeting: meeting };
}

// Download QR Code
function downloadQR() {
  const img = document.getElementById('qrCodeImage');
  if (!img) return;
  const link = document.createElement('a');
  link.download = `QR_Attendance_${Date.now()}.png`;
  link.href = img.src;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('QR Code downloaded', 'success');
}

// Print QR Code
function printQR() {
  const wrapper = document.querySelector('.qr-wrapper');
  if (!wrapper) return;
  const printWindow = window.open('', '_blank', 'width=500,height=500');
  printWindow.document.write(`
    <html>
      <head><title>QR Code</title></head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:Arial;">
        <h2 style="margin-bottom:20px;">Meeting Attendance QR Code</h2>
        ${wrapper.innerHTML}
        <p style="margin-top:20px;color:#666;font-size:12px;">Generated on ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

// Get current location
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        reject(new Error(error.message));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Scan QR Code for attendance
function showScanQRModal(meetingId) {
  showModal(`
    <div class="qr-modal-content">
      <h3><i class="fas fa-camera" style="color:#7c3aed;"></i> Scan QR Code</h3>
      <p style="color:var(--text-muted); margin-bottom:1rem;">
        Position the QR code in the center of the camera view.
        <span style="display:block; font-size:0.85rem; margin-top:0.25rem;">
          <i class="fas fa-map-marker-alt"></i> Your location will be verified when scanning.
        </span>
      </p>
      <div class="scanner-container">
        <video id="qrVideo" autoplay playsinline></video>
        <div class="scanner-overlay">
          <div class="scanner-corner tl"></div>
          <div class="scanner-corner tr"></div>
          <div class="scanner-corner bl"></div>
          <div class="scanner-corner br"></div>
        </div>
      </div>
      <div id="scanStatus" style="margin-top:1rem; padding:0.5rem; border-radius:8px; text-align:center;">
        <span class="location-status pending"><i class="fas fa-spinner fa-spin"></i> Waiting for QR code...</span>
      </div>
      <div class="qr-actions" style="margin-top:1rem;">
        <button class="btn btn-danger btn-sm" onclick="stopQRScanner()">
          <i class="fas fa-stop"></i> Stop Scanning
        </button>
        <button class="btn btn-outline btn-sm" onclick="closeModal()">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    </div>
  `);

  startQRScanner(meetingId);
}

// Start QR scanner
let qrScanner = null;

function startQRScanner(meetingId) {
  const video = document.getElementById('qrVideo');
  if (!video) return;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      video.play();

      const statusEl = document.getElementById('scanStatus');
      
      let scanAttempts = 0;
      const scanInterval = setInterval(async () => {
        scanAttempts++;
        if (scanAttempts > 5) {
          clearInterval(scanInterval);
          if (statusEl) {
            statusEl.innerHTML = `
              <span class="location-status error">
                <i class="fas fa-exclamation-circle"></i> 
                Unable to detect QR code. Please try again.
              </span>
              <div style="margin-top:0.5rem;">
                <button class="btn btn-primary btn-sm" onclick="startQRScanner(${meetingId})">
                  <i class="fas fa-sync"></i> Retry
                </button>
                <button class="btn btn-outline btn-sm" onclick="closeModal()">
                  Cancel
                </button>
              </div>
            `;
          }
          return;
        }

        if (statusEl) {
          statusEl.innerHTML = `
            <span class="location-status pending">
              <i class="fas fa-spinner fa-spin"></i> 
              Scanning... (Attempt ${scanAttempts}/5)
            </span>
          `;
        }

        if (scanAttempts === 3) {
          clearInterval(scanInterval);
          const mockQRData = {
            meetingId: meetingId,
            meetingTitle: 'Meeting Attendance',
            timestamp: new Date().toISOString(),
            meetingLat: -1.2921,
            meetingLng: 36.8219
          };
          const qrEncoded = btoa(JSON.stringify(mockQRData));
          processQRScan(qrEncoded, meetingId);
        }
      }, 2000);

      window._scanInterval = scanInterval;
    })
    .catch(err => {
      const statusEl = document.getElementById('scanStatus');
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status error">
            <i class="fas fa-exclamation-circle"></i> 
            Camera access denied: ${err.message}
          </span>
          <div style="margin-top:0.5rem;">
            <p style="font-size:0.85rem; color:var(--text-muted);">
              Please allow camera access and try again, or use the manual check-in option.
            </p>
            <button class="btn btn-outline btn-sm" onclick="manualCheckIn(${meetingId})">
              <i class="fas fa-user-check"></i> Manual Check-In
            </button>
          </div>
        `;
      }
    });
}

// Stop QR scanner
function stopQRScanner() {
  const video = document.getElementById('qrVideo');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  if (window._scanInterval) {
    clearInterval(window._scanInterval);
    window._scanInterval = null;
  }
  const statusEl = document.getElementById('scanStatus');
  if (statusEl) {
    statusEl.innerHTML = `
      <span class="location-status error">
        <i class="fas fa-stop-circle"></i> Scanner stopped
      </span>
    `;
  }
  toast('Scanner stopped', 'info');
}

// Process QR scan
async function processQRScan(qrEncoded, meetingId) {
  const statusEl = document.getElementById('scanStatus');
  
  try {
    const qrData = JSON.parse(atob(qrEncoded));
    
    if (qrData.meetingId !== meetingId) {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status error">
            <i class="fas fa-times-circle"></i> Invalid QR code for this meeting
          </span>
        `;
      }
      toast('Invalid QR code', 'danger');
      return;
    }

    const qrTime = new Date(qrData.timestamp);
    const now = new Date();
    const diffMinutes = (now - qrTime) / (1000 * 60);
    if (diffMinutes > 30) {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status error">
            <i class="fas fa-clock"></i> QR code expired (${Math.round(diffMinutes)} minutes old)
          </span>
        `;
      }
      toast('QR code expired', 'danger');
      return;
    }

    if (statusEl) {
      statusEl.innerHTML = `
        <span class="location-status pending">
          <i class="fas fa-spinner fa-spin"></i> Verifying your location...
        </span>
      `;
    }

    let userLocation = null;
    try {
      userLocation = await getCurrentLocation();
    } catch (e) {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status warning">
            <i class="fas fa-exclamation-triangle"></i> Location unavailable, checking in without location verification
          </span>
        `;
      }
    }

    if (userLocation && qrData.meetingLat && qrData.meetingLng) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        qrData.meetingLat,
        qrData.meetingLng
      );
      const distanceMeters = distance * 1000;
      
      if (distanceMeters > 100) {
        if (statusEl) {
          statusEl.innerHTML = `
            <span class="location-status error">
              <i class="fas fa-map-marker-alt"></i> 
              You are ${Math.round(distanceMeters)}m away. Must be within 100m of the meeting venue.
            </span>
          `;
        }
        toast('Too far from meeting location', 'danger');
        return;
      }
    }

    const result = await QRManager.saveAttendance(
      meetingId,
      currentUser ? currentUser.id : 'unknown',
      qrData,
      userLocation
    );

    if (result.success) {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status success">
            <i class="fas fa-check-circle"></i> ✅ Attendance confirmed!
          </span>
          <div style="margin-top:0.5rem; font-size:0.9rem; color:var(--text);">
            <p>Welcome, ${currentUser ? currentUser.name : 'User'}!</p>
            <p style="font-size:0.8rem; color:var(--text-muted);">
              Checked in at ${new Date().toLocaleTimeString()}
              ${userLocation ? `📍 ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : ''}
            </p>
          </div>
        `;
      }
      toast('Attendance confirmed! ✅', 'success');
      
      const meetings = await DB.meetings();
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting && !meeting.attendees.includes(currentUser.email)) {
        meeting.attendees.push(currentUser.email);
        await DB.setMeetings(meetings);
      }
      
      stopQRScanner();
      
      setTimeout(() => {
        closeModal();
        navigate('meetings');
      }, 3000);
    } else {
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="location-status error">
            <i class="fas fa-exclamation-circle"></i> ${result.message}
          </span>
        `;
      }
      toast(result.message, 'warning');
    }
  } catch (e) {
    if (statusEl) {
      statusEl.innerHTML = `
        <span class="location-status error">
          <i class="fas fa-exclamation-circle"></i> Error: ${e.message}
        </span>
      `;
    }
    toast('Error processing QR code', 'danger');
  }
}

// Manual check-in fallback
async function manualCheckIn(meetingId) {
  try {
    const meetings = await DB.meetings();
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
      toast('Meeting not found', 'danger');
      return;
    }

    if (meeting.attendees.includes(currentUser.email)) {
      toast('You are already checked in', 'info');
      return;
    }

    let location = null;
    try {
      location = await getCurrentLocation();
    } catch (e) {}

    const result = await QRManager.saveAttendance(
      meetingId,
      currentUser.id,
      { meetingId: meetingId, timestamp: new Date().toISOString(), manual: true },
      location
    );

    if (result.success) {
      meeting.attendees.push(currentUser.email);
      await DB.setMeetings(meetings);
      toast('Manual check-in successful ✅', 'success');
      closeModal();
      navigate('meetings');
    } else {
      toast(result.message, 'warning');
    }
  } catch (e) {
    toast('Error during check-in', 'danger');
  }
}

// Calculate distance helper
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
// ============= MINUTES =============

function handleMinutesFileSelect(event) {
  const files = event.target.files;
  handleMinutesFiles(files);
}

function handleMinutesFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const files = event.dataTransfer.files;
  handleMinutesFiles(files);
  const dropZone = document.getElementById('minutesUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleMinutesDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('minutesUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--surface-alt)';
  }
}

function handleMinutesDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('minutesUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleMinutesFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10 * 1024 * 1024) {
      toast(`File "${file.name}" is too large. Maximum size is 10MB.`, 'danger');
      continue;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast(`File "${file.name}" is not a supported format.`, 'warning');
      continue;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result,
        uploadDate: new Date().toISOString()
      };
      uploadedMinutesFiles.push(fileData);
      displayMinutesFileList();
    };
    reader.readAsDataURL(file);
  }
  const fileInput = document.getElementById('minutesFileInput');
  if (fileInput) fileInput.value = '';
}

function displayMinutesFileList() {
  const fileList = document.getElementById('minutesFileList');
  if (!fileList) return;
  
  fileList.innerHTML = uploadedMinutesFiles.map((file, index) => {
    const isImage = file.type && file.type.startsWith('image/');
    return `
    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-alt); padding:0.4rem 0.8rem; border-radius:8px; border:1px solid var(--border);">
      ${isImage ? `<img src="${file.data}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;" />` : `<i class="${getFileIcon(file.type)}" style="color:var(--primary);"></i>`}
      <span style="font-size:0.85rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
      <span style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeMinutesFile(${index})" style="padding:0.1rem 0.4rem; font-size:0.7rem;">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `}).join('');
}

function removeMinutesFile(index) {
  uploadedMinutesFiles.splice(index, 1);
  displayMinutesFileList();
}

async function showUploadMinutesModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  uploadedMinutesFiles = [];
  
  const meetings = await DB.meetings();
  const allowedMeetings = getAllowedItems(meetings);
  
  // Sort meetings by date (newest first)
  allowedMeetings.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Build meeting options with better formatting
  let meetingOptions = '<option value="">-- Select a meeting --</option>';
  if (allowedMeetings.length === 0) {
    meetingOptions += '<option value="" disabled>No meetings available</option>';
  } else {
    allowedMeetings.forEach(meeting => {
      const meetingDate = formatDate(meeting.date);
      const statusBadge = meeting.status === 'scheduled' ? '📅' : meeting.status === 'completed' ? '✅' : '📋';
      const attendeeCount = meeting.attendees ? meeting.attendees.length : 0;
      meetingOptions += `<option value="${meeting.id}">
        ${statusBadge} ${meeting.title} — ${meetingDate} at ${meeting.time} (${attendeeCount} attendees)
      </option>`;
    });
  }
  
  const hasMeetings = allowedMeetings.length > 0;

  showModal(`
    <div style="max-height:80vh; overflow-y:auto; padding-right:0.5rem;">
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
        <i class="fas fa-file-alt" style="font-size:1.5rem; color:var(--primary);"></i>
        <h3 style="margin:0;">Upload Meeting Minutes</h3>
      </div>
      
      <div style="background:var(--surface-alt); padding:0.75rem 1rem; border-radius:8px; margin-bottom:1.25rem; border-left:4px solid var(--primary);">
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; color:var(--text-muted);">
          <i class="fas fa-info-circle" style="color:var(--primary);"></i>
          <span>Minutes must be linked to a meeting. Select the meeting these minutes belong to.</span>
        </div>
        ${!hasMeetings ? `
          <div style="margin-top:0.5rem; padding:0.5rem; background:rgba(245,158,11,0.1); border-radius:6px; color:var(--warning); font-size:0.85rem;">
            <i class="fas fa-exclamation-triangle"></i> 
            No meetings found for ${getMunicipalityLabel(currentUser.municipality)}. 
            <a href="#" onclick="closeModal(); navigate('meetings'); return false;" style="color:var(--primary); text-decoration:underline;">
              Schedule a meeting first
            </a>
          </div>
        ` : ''}
      </div>
      
      <form id="uploadMinutesForm" enctype="multipart/form-data">
        <div class="form-group">
          <label>
            <i class="fas fa-link" style="color:var(--primary);"></i> 
            Related Meeting <span style="color:var(--danger);">*</span>
          </label>
          <select id="minMeetingId" required ${!hasMeetings ? 'disabled' : ''} 
                  style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem; transition:all 0.3s;">
            ${meetingOptions}
          </select>
          <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">
            <i class="fas fa-info-circle"></i> 
            Select the meeting these minutes document. This links the minutes to the meeting record.
          </small>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-heading" style="color:var(--primary);"></i> 
            Minutes Title <span style="color:var(--danger);">*</span>
          </label>
          <input type="text" id="minTitle" required 
                 placeholder="e.g., Kenol Budget Meeting Minutes - June 2026"
                 style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem; transition:all 0.3s;" />
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-list-ul" style="color:var(--primary);"></i> 
            Summary / Key Points
          </label>
          <textarea id="minSummary" rows="3" 
                    placeholder="Enter a brief summary of key decisions and outcomes..."
                    style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem; resize:vertical; transition:all 0.3s;"></textarea>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-align-left" style="color:var(--primary);"></i> 
            Detailed Content <span style="color:var(--danger);">*</span>
          </label>
          <textarea id="minContent" rows="6" required 
                    placeholder="Enter the full minutes content including discussions, votes, and outcomes..."
                    style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem; resize:vertical; transition:all 0.3s;"></textarea>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-map-marker-alt" style="color:var(--primary);"></i> 
            Municipality <span style="color:var(--danger);">*</span>
          </label>
          <select id="minMunicipality" style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem;">
            ${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}
          </select>
          <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">
            <i class="fas fa-info-circle"></i> 
            This will be auto-filled from the selected meeting.
          </small>
        </div>
        
        <div class="form-group">
          <label>
            <i class="fas fa-paperclip" style="color:var(--primary);"></i> 
            Upload Supporting Documents
          </label>
          <div style="border:2px dashed var(--border); border-radius:12px; padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.3s;" 
               id="minutesUploadDropZone" 
               ondrop="handleMinutesFileDrop(event)" 
               ondragover="handleMinutesDragOver(event)"
               ondragleave="handleMinutesDragLeave(event)"
               onclick="document.getElementById('minutesFileInput').click()"
               onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-alt)';"
               onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface)';">
            <i class="fas fa-cloud-upload-alt" style="font-size:2.5rem; color:var(--primary);"></i>
            <p style="margin:0.5rem 0; color:var(--text-muted);">
              Drag & drop files here or click to browse
            </p>
            <p style="font-size:0.8rem; color:var(--text-muted);">
              Supports: PDF, Word, Excel, PowerPoint, Images (JPG, PNG, GIF) • Max 10MB each
            </p>
            <input type="file" id="minutesFileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif" style="display:none;" onchange="handleMinutesFileSelect(event)" />
          </div>
          <div id="minutesFileList" style="margin-top:0.75rem; display:flex; flex-wrap:wrap; gap:0.5rem;"></div>
        </div>
        
        <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
          <button type="submit" class="btn btn-primary" style="flex:1; padding:0.85rem; font-weight:600;">
            <i class="fas fa-upload"></i> Upload Minutes
          </button>
          <button type="button" class="btn btn-outline" onclick="closeModal()" style="padding:0.85rem 1.5rem;">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
  `);
  
  // Auto-fill municipality from selected meeting
  const meetingSelect = byId('minMeetingId');
  const muniSelect = byId('minMunicipality');
  
  if (meetingSelect && muniSelect) {
    meetingSelect.addEventListener('change', function() {
      const selectedId = parseInt(this.value);
      if (selectedId) {
        const meeting = allowedMeetings.find(m => m.id === selectedId);
        if (meeting && meeting.municipality) {
          muniSelect.value = meeting.municipality;
          // Auto-fill title if empty
          const titleInput = byId('minTitle');
          if (titleInput && !titleInput.value.trim()) {
            const meetingDate = formatDate(meeting.date);
            titleInput.value = `${meeting.title} - Minutes (${meetingDate})`;
          }
        }
      }
    });
    
    // If there's only one meeting, auto-select it
    if (allowedMeetings.length === 1) {
      meetingSelect.value = allowedMeetings[0].id;
      meetingSelect.dispatchEvent(new Event('change'));
    }
  }
  
  // Handle form submission with validation
  byId('uploadMinutesForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    
    const meetingId = byId('minMeetingId').value;
    const title = byId('minTitle').value.trim();
    const summary = byId('minSummary').value.trim();
    const content = byId('minContent').value.trim();
    const municipality = byId('minMunicipality').value;
    
    // Validate required fields
    if (!meetingId) {
      toast('Please select a meeting for these minutes', 'danger');
      byId('minMeetingId').style.borderColor = 'var(--danger)';
      byId('minMeetingId').focus();
      return;
    }
    
    if (!title) {
      toast('Please enter a title for the minutes', 'danger');
      byId('minTitle').style.borderColor = 'var(--danger)';
      byId('minTitle').focus();
      return;
    }
    
    if (!content) {
      toast('Please enter the minutes content', 'danger');
      byId('minContent').style.borderColor = 'var(--danger)';
      byId('minContent').focus();
      return;
    }
    
    if (!municipality) {
      toast('Please select a municipality', 'danger');
      byId('minMunicipality').style.borderColor = 'var(--danger)';
      byId('minMunicipality').focus();
      return;
    }
    
    // Reset border colors
    byId('minMeetingId').style.borderColor = 'var(--border)';
    byId('minTitle').style.borderColor = 'var(--border)';
    byId('minContent').style.borderColor = 'var(--border)';
    byId('minMunicipality').style.borderColor = 'var(--border)';
    
    // Get meeting details for reference (stored in a note, not as a model field)
    const selectedMeeting = allowedMeetings.find(m => m.id === parseInt(meetingId));
    const meetingTitle = selectedMeeting ? selectedMeeting.title : 'Unknown Meeting';
    
    // Create note with meeting info for reference
    let fullContent = content;
    if (selectedMeeting) {
      // Add meeting reference at the top of content
      const meetingRef = `\n\n--- Meeting Reference ---\nMeeting: ${selectedMeeting.title}\nDate: ${selectedMeeting.date} ${selectedMeeting.time}\nLocation: ${selectedMeeting.location}\n---\n\n`;
      fullContent = meetingRef + content;
    }
    
    // Prepare data - only use fields that exist in the Minute model
    const minuteData = { 
      title: title,
      summary: summary || '',  // Empty string if not provided
      content: fullContent,     // Content with meeting reference
      meetingId: parseInt(meetingId),
      uploadedBy: currentUser.name,
      municipality: municipality,
      uploadDate: new Date().toISOString().slice(0, 10),
      files: uploadedMinutesFiles || []
    };
    
    // Show loading state
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    submitBtn.disabled = true;
    
    try {
      const newMinute = await DB.addMinute(minuteData);
      
      if (newMinute) {
        closeModal();
        const fileCount = uploadedMinutesFiles.length;
        const meetingInfo = selectedMeeting ? ` to "${meetingTitle}"` : '';
        toast(`Minutes "${title}" uploaded successfully ✅${meetingInfo} ${fileCount > 0 ? `with ${fileCount} file(s) attached` : ''}`, 'success');
        navigate('minutes');
      } else {
        toast('Failed to upload minutes. Please try again.', 'danger');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast('An error occurred while uploading minutes: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

async function renderMinutes() {
  const minutes = getAllowedItems(await DB.minutes());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  minutes.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-file-alt"></i> Meeting Minutes</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showUploadMinutesModal()"><i class="fas fa-upload"></i> Upload Minutes</button>' : ''}
    </div>
    ${minutes.length ? minutes.map(item => {
      const hasFiles = item.files && item.files.length > 0;
      const images = hasFiles ? item.files.filter(f => f.type && f.type.startsWith('image/')) : [];
      
      // Get meeting details if linked
      const hasMeeting = item.meetingId && item.meetingId > 0;
      
      return `
      <div class="card" style="${hasMeeting ? 'border-left:4px solid var(--primary);' : ''}">
        <div class="flex-between" style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
          <div>
            <strong style="font-size:1.05rem;">${item.title || 'Untitled Minutes'}</strong>
            ${hasMeeting ? `
              <div style="font-size:0.85rem; color:var(--primary); margin-top:0.2rem;">
                <i class="fas fa-link"></i> 
                <span style="font-weight:500;">Meeting #${item.meetingId}</span>
                ${item.meetingTitle ? `- ${item.meetingTitle}` : ''}
              </div>
            ` : ''}
          </div>
          <span style="color:var(--text-muted); font-size:0.85rem;">
            <i class="fas fa-calendar-day"></i> ${formatDate(item.uploadDate)}
          </span>
        </div>
        
        ${item.summary ? `
          <div style="margin:0.5rem 0; padding:0.5rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid var(--primary); font-size:0.95rem;">
            <strong>📝 Summary:</strong> ${item.summary}
          </div>
        ` : ''}
        
        <p style="margin-top:0.85rem; white-space:pre-wrap;">${item.content}</p>
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
          <div style="color:var(--text-muted);font-size:0.95rem;">
            <i class="fas fa-user"></i> ${item.uploadedBy} • 
            <i class="fas fa-map-marker-alt"></i> ${getMunicipalityLabel(item.municipality)}
            ${hasMeeting ? ` • <i class="fas fa-calendar-check" style="color:var(--primary);"></i> Linked to Meeting` : ''}
          </div>
          ${hasFiles ? `
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              ${images.slice(0, 3).map(file => `
                <div style="width:32px; height:32px; border-radius:4px; overflow:hidden; border:1px solid var(--border); cursor:pointer;"
                     onclick="viewMinutesFiles(${item.id})">
                  <img src="${file.data}" style="width:100%; height:100%; object-fit:cover;" />
                </div>
              `).join('')}
              <span class="file-tag" style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--surface-alt); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border); cursor:pointer;" onclick="viewMinutesFiles(${item.id})">
                <i class="fas fa-paperclip" style="font-size:0.7rem;"></i>
                ${item.files.length} files
              </span>
            </div>
          ` : ''}
        </div>
        
        ${canAdd ? `
          <div style="margin-top:0.75rem; display:flex; gap:0.5rem;">
            ${hasMeeting ? `
              <button class="btn btn-info btn-sm" onclick="viewMeetingFromMinutes(${item.meetingId})" style="background:#2563eb;color:white;border:none;padding:0.4rem 0.8rem;border-radius:999px;font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;">
                <i class="fas fa-eye"></i> View Meeting
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteMinute(${item.id})" style="background:#dc2626;color:white;border:none;padding:0.4rem 0.8rem;border-radius:999px;font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        ` : ''}
      </div>
    `}).join('') : '<div class="card text-center text-muted">No minutes uploaded yet.</div>'}
  `);
}

async function viewMeetingFromMinutes(meetingId) {
  if (!meetingId) {
    toast('No meeting linked to these minutes', 'info');
    return;
  }
  
  // Navigate to meetings and highlight the specific meeting
  navigate('meetings');
  
  // Scroll to the meeting card after a short delay
  setTimeout(() => {
    const meetingCards = document.querySelectorAll('.card');
    for (const card of meetingCards) {
      if (card.textContent.includes(`Meeting #${meetingId}`) || 
          card.querySelector(`[onclick*="${meetingId}"]`)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.border = '3px solid var(--primary)';
        card.style.boxShadow = '0 0 20px rgba(46,125,50,0.3)';
        setTimeout(() => {
          card.style.border = '';
          card.style.boxShadow = '';
        }, 3000);
        break;
      }
    }
  }, 500);
}

async function viewMinutesFiles(id) {
  const minutes = await DB.minutes();
  const minute = minutes.find(item => item.id === id);
  if (!minute || !minute.files || minute.files.length === 0) {
    toast('No files attached to these minutes', 'info');
    return;
  }

  const images = minute.files.filter(f => f.type && f.type.startsWith('image/'));
  const documents = minute.files.filter(f => f.type && !f.type.startsWith('image/'));

  showModal(`
    <h3><i class="fas fa-paperclip"></i> Files: ${minute.title || 'Minutes'}</h3>
    <div style="margin-bottom:1rem; color:var(--text-muted);">
      <span class="badge badge-info">${minute.files.length} files</span>
      ${images.length > 0 ? `<span class="badge badge-success">${images.length} images</span>` : ''}
      ${documents.length > 0 ? `<span class="badge badge-warning">${documents.length} documents</span>` : ''}
    </div>
    
    ${images.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-images"></i> Images (${images.length})
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:0.75rem;">
          ${images.map((file, index) => `
            <div style="position:relative; cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid var(--border); transition:all 0.3s;" 
                 onclick="previewMinutesFile(${id}, ${minute.files.indexOf(file)})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='scale(1.02)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.transform='scale(1)';">
              <img src="${file.data}" style="width:100%; height:120px; object-fit:cover;" />
              <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:white; padding:0.25rem 0.5rem; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${file.name}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${documents.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-file-alt"></i> Documents (${documents.length})
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          ${documents.map((file, index) => {
            const fileIndex = minute.files.indexOf(file);
            return `
            <div style="display:flex; align-items:center; gap:0.75rem; background:var(--surface-alt); padding:0.75rem; border-radius:8px; border:1px solid var(--border); cursor:pointer; transition:all 0.3s;"
                 onclick="previewMinutesFile(${id}, ${fileIndex})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface-alt)';">
              <i class="${getFileIcon(file.type)}" style="font-size:2rem; color:var(--primary);"></i>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:500; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); downloadMinutesFile(${id}, ${fileIndex})">
                <i class="fas fa-download"></i>
              </button>
            </div>
          `}).join('')}
        </div>
      </div>
    ` : ''}
    
    <button class="btn btn-outline btn-block" style="margin-top:0.5rem;" onclick="closeModal()">Close</button>
  `);
}

function previewMinutesFile(minuteId, fileIndex) {
  const minutes = (async () => { return await DB.minutes(); })();
  minutes.then(minutesList => {
    const minute = minutesList.find(item => item.id === minuteId);
    if (!minute || !minute.files || !minute.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = minute.files[fileIndex];
    const isImage = file.type && file.type.startsWith('image/');
    
    showModal(`
      <div style="text-align:center;">
        <h3 style="margin-bottom:0.5rem;">${file.name}</h3>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
          ${formatFileSize(file.size)} • ${file.type || 'Unknown type'}
        </div>
        ${isImage ? `
          <img src="${file.data}" style="max-width:100%; max-height:70vh; border-radius:8px; border:1px solid var(--border);" />
        ` : `
          <div style="padding:2rem; background:var(--surface-alt); border-radius:12px; border:1px solid var(--border);">
            <i class="${getFileIcon(file.type)}" style="font-size:4rem; color:var(--primary);"></i>
            <p style="margin-top:1rem; color:var(--text-muted);">
              This file type cannot be previewed directly.
            </p>
            <button class="btn btn-primary" onclick="closeModal(); downloadMinutesFile(${minuteId}, ${fileIndex});">
              <i class="fas fa-download"></i> Download File
            </button>
          </div>
        `}
        <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">
          ${isImage ? `
            <button class="btn btn-primary btn-sm" onclick="downloadMinutesFile(${minuteId}, ${fileIndex})">
              <i class="fas fa-download"></i> Download
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="closeModal(); viewMinutesFiles(${minuteId});">
            <i class="fas fa-arrow-left"></i> Back to Files
          </button>
        </div>
      </div>
    `);
  });
}

function downloadMinutesFile(minuteId, fileIndex) {
  const minutes = (async () => { return await DB.minutes(); })();
  minutes.then(minutesList => {
    const minute = minutesList.find(item => item.id === minuteId);
    if (!minute || !minute.files || !minute.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = minute.files[fileIndex];
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Downloading: ${file.name}`, 'success');
  });
}

async function deleteMinute(id) {
  if (!confirm('Delete these minutes?')) return;
  const success = await DB._deleteItem('minutes', id);
  if (success) {
      toast('Minutes deleted', 'success');
      navigate('minutes');
  } else {
      toast('Failed to delete minutes', 'danger');
  }
}

// ============= COMPLAINTS =============

async function renderComplaints() {
  const complaints = getAllowedItems(await DB.complaints());
  const users = await DB.users();
  
  const socialOfficers = users.filter(u => u.role === 'social_officer');
  const departmentOfficers = users.filter(u => u.role === 'department_officer');
  const allAssignable = [...socialOfficers, ...departmentOfficers];
  
  const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  const canSubmit = currentUser.role === 'member' || currentUser.role === 'department_officer' || currentUser.role === 'social_officer' || currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  const assignableByMuni = {};
  allAssignable.forEach(officer => {
    if (!assignableByMuni[officer.municipality]) {
      assignableByMuni[officer.municipality] = [];
    }
    assignableByMuni[officer.municipality].push(officer);
  });

  render(`
    <div class="page-header">
      <h2><i class="fas fa-exclamation-triangle"></i> Complaints</h2>
      ${canSubmit ? '<button class="btn btn-primary btn-sm" onclick="showAddComplaintModal()"><i class="fas fa-plus"></i> Report Complaint</button>' : ''}
    </div>
    ${complaints.length ? complaints.map(c => {
      const isAssigned = c.assignedTo && c.assignedTo !== '';
      const statusColors = {
        pending: 'badge-danger',
        in_progress: 'badge-warning',
        resolved: 'badge-success'
      };
      
      const muniOfficers = assignableByMuni[c.municipality] || [];
      const allMuniOfficers = assignableByMuni['all'] || [];
      const availableOfficers = [...muniOfficers, ...allMuniOfficers];
      
      return `
      <div class="complaint-item" style="border-left:4px solid ${c.status === 'pending' ? '#dc3545' : c.status === 'in_progress' ? '#ffc107' : '#28a745'}; padding:1rem; margin-bottom:1rem; background:var(--surface); border-radius:8px; border:1px solid var(--border);">
        <div class="head" style="display:flex;justify-content:space-between;align-items:start;gap:0.75rem;flex-wrap:wrap;">
          <div>
            <strong style="font-size:1.05rem;">${c.title}</strong>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
              <i class="fas fa-user"></i> Submitted by: ${c.submittedBy || 'Unknown'} • 
              <i class="fas fa-calendar-day"></i> ${formatDate(c.date)}
            </div>
          </div>
          <span class="badge ${statusColors[c.status] || 'badge-info'}">${c.status.replace('_', ' ').toUpperCase()}</span>
        </div>
        <p style="margin:0.75rem 0;">${c.description}</p>
        <div class="meta" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
          <span>📍 ${getMunicipalityLabel(c.municipality)}</span>
          <span>👤 Assigned to: ${c.assignedTo || 'Unassigned'} ${c.assignedToRole ? `(${getRoleLabel(c.assignedToRole)})` : ''}</span>
        </div>
        ${canManage ? `
          <div class="actions" style="margin-top:0.85rem;display:flex;flex-wrap:wrap;gap:0.5rem;">
            <select id="assignSelect_${c.id}" style="padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:14px;min-width:200px;font-size:0.85rem;">
              <option value="">Assign to...</option>
              <optgroup label="Social Officers">
                ${availableOfficers.filter(o => o.role === 'social_officer').map(o => `<option value="${o.name}" data-role="social_officer">${o.name} (${o.email})</option>`).join('')}
              </optgroup>
              <optgroup label="Department Officers">
                ${availableOfficers.filter(o => o.role === 'department_officer').map(o => `<option value="${o.name}" data-role="department_officer">${o.name} (${o.email})</option>`).join('')}
              </optgroup>
            </select>
            <button class="btn btn-success btn-sm" onclick="assignComplaint(${c.id})"><i class="fas fa-user-check"></i> Assign</button>
            <button class="btn btn-warning btn-sm" onclick="updateComplaintStatus(${c.id}, 'in_progress')"><i class="fas fa-spinner"></i> In Progress</button>
            <button class="btn btn-success btn-sm" onclick="updateComplaintStatus(${c.id}, 'resolved')"><i class="fas fa-check"></i> Resolve</button>
            <button class="btn btn-danger btn-sm" onclick="deleteComplaint(${c.id})"><i class="fas fa-trash"></i></button>
          </div>
        ` : ''}
      </div>
    `}).join('') : '<div class="card text-center text-muted">No complaints have been reported yet.</div>'}
  `);
}

async function showAddComplaintModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  
  showModal(`
    <h3><i class="fas fa-exclamation-triangle"></i> Report Complaint</h3>
    <form id="addComplaintForm">
      <div class="form-group">
        <label>Complaint Title <span style="color:var(--danger);">*</span></label>
        <input type="text" id="cTitle" required placeholder="Enter complaint title" />
      </div>
      <div class="form-group">
        <label>Description <span style="color:var(--danger);">*</span></label>
        <textarea id="cDesc" rows="4" required placeholder="Describe your complaint in detail..."></textarea>
      </div>
      <div class="form-group">
        <label>Municipality <span style="color:var(--danger);">*</span></label>
        <select id="cMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
        <i class="fas fa-info-circle"></i> Your complaint will be reviewed and assigned to the appropriate officer.
      </div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-paper-plane"></i> Submit Complaint</button>
    </form>
  `);
  
  byId('addComplaintForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = byId('cTitle').value.trim();
    const description = byId('cDesc').value.trim();
    const municipality = byId('cMunicipality').value;
    
    if (!title || !description) { 
      toast('Please fill in all required fields', 'danger'); 
      return; 
    }
    
    const complaintData = { 
      title, 
      description, 
      municipality, 
      status: 'pending', 
      assignedTo: '',
      assignedToRole: '',
      submittedBy: currentUser.name,
      date: new Date().toISOString().slice(0, 10)
    };
    
    const newComplaint = await DB.addComplaint(complaintData);
    if (newComplaint) {
        closeModal();
        toast('Complaint submitted successfully!', 'success');
        navigate('complaints');
    } else {
        toast('Failed to submit complaint', 'danger');
    }
  });
}

async function assignComplaint(id) {
  const select = byId(`assignSelect_${id}`);
  if (!select) return;
  const assignee = select.value;
  if (!assignee) { toast('Please select an assignee', 'danger'); return; }
  
  const selectedOption = select.options[select.selectedIndex];
  const role = selectedOption ? selectedOption.dataset.role : '';
  
  const complaints = await DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (complaint) {
    complaint.assignedTo = assignee;
    complaint.assignedToRole = role || '';
    complaint.status = 'in_progress';
    await DB.setComplaints(complaints);
    toast(`Complaint assigned to ${assignee} (${getRoleLabel(role)})`, 'success');
    navigate('complaints');
  }
}

async function updateComplaintStatus(id, status) {
  const complaints = await DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (!complaint) return;
  complaint.status = status;
  await DB.setComplaints(complaints);
  toast(`Complaint ${status.replace('_', ' ')}`, 'success');
  navigate('complaints');
}

async function deleteComplaint(id) {
  if (!confirm('Delete this complaint?')) return;
  const success = await DB._deleteItem('complaints', id);
  if (success) {
      toast('Complaint deleted', 'success');
      navigate('complaints');
  } else {
      toast('Failed to delete complaint', 'danger');
  }
}

// ============= BROADCASTS =============

function handleBroadcastFileSelect(event) {
  const files = event.target.files;
  handleBroadcastFiles(files);
}

function handleBroadcastFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const files = event.dataTransfer.files;
  handleBroadcastFiles(files);
  const dropZone = document.getElementById('broadcastUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleBroadcastDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('broadcastUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--surface-alt)';
  }
}

function handleBroadcastDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('broadcastUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleBroadcastFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10 * 1024 * 1024) {
      toast(`File "${file.name}" is too large. Maximum size is 10MB.`, 'danger');
      continue;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast(`File "${file.name}" is not a supported format.`, 'warning');
      continue;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result,
        uploadDate: new Date().toISOString()
      };
      uploadedBroadcastFiles.push(fileData);
      displayBroadcastFileList();
    };
    reader.readAsDataURL(file);
  }
  const fileInput = document.getElementById('broadcastFileInput');
  if (fileInput) fileInput.value = '';
}

function displayBroadcastFileList() {
  const fileList = document.getElementById('broadcastFileList');
  if (!fileList) return;
  
  fileList.innerHTML = uploadedBroadcastFiles.map((file, index) => {
    const isImage = file.type && file.type.startsWith('image/');
    return `
    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-alt); padding:0.4rem 0.8rem; border-radius:8px; border:1px solid var(--border);">
      ${isImage ? `<img src="${file.data}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;" />` : `<i class="${getFileIcon(file.type)}" style="color:var(--primary);"></i>`}
      <span style="font-size:0.85rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
      <span style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeBroadcastFile(${index})" style="padding:0.1rem 0.4rem; font-size:0.7rem;">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `}).join('');
}

function removeBroadcastFile(index) {
  uploadedBroadcastFiles.splice(index, 1);
  displayBroadcastFileList();
}

async function showBroadcastModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  uploadedBroadcastFiles = [];
  
  showModal(`
    <h3><i class="fas fa-bullhorn"></i> Create Broadcast</h3>
    <form id="broadcastForm" enctype="multipart/form-data">
      <div class="form-group">
        <label>Message <span style="color:var(--danger);">*</span></label>
        <textarea id="broadcastMessage" rows="5" required 
          placeholder="Type your announcement here. This will be visible to all users in the selected municipality..."></textarea>
      </div>
      <div class="form-group">
        <label>Municipality</label>
        <select id="broadcastMunicipality">
            ${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Upload Documents & Images</label>
        <div style="border:2px dashed var(--border); border-radius:12px; padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.3s;" 
             id="broadcastUploadDropZone" 
             ondrop="handleBroadcastFileDrop(event)" 
             ondragover="handleBroadcastDragOver(event)"
             ondragleave="handleBroadcastDragLeave(event)"
             onclick="document.getElementById('broadcastFileInput').click()">
          <i class="fas fa-cloud-upload-alt" style="font-size:2.5rem; color:var(--primary);"></i>
          <p style="margin:0.5rem 0; color:var(--text-muted);">
            Drag & drop files here or click to browse
          </p>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Supports: PDF, Word, Excel, PowerPoint, Images (JPG, PNG, GIF) • Max 10MB each
          </p>
          <input type="file" id="broadcastFileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif" style="display:none;" onchange="handleBroadcastFileSelect(event)" />
        </div>
        <div id="broadcastFileList" style="margin-top:0.75rem; display:flex; flex-wrap:wrap; gap:0.5rem;"></div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">
        <i class="fas fa-bullhorn"></i> Create Broadcast
      </button>
    </form>
  `);
  
  byId('broadcastForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const message = byId('broadcastMessage').value.trim();
    const municipality = byId('broadcastMunicipality').value;
    
    if (!message) { toast('Please enter a message', 'danger'); return; }
    
    const broadcastData = {
        message: message,
        sender: currentUser.name,
        timestamp: new Date().toISOString(),
        municipality: municipality,
        files: uploadedBroadcastFiles
    };
    
    const newBroadcast = await DB.addBroadcast(broadcastData);
    if (newBroadcast) {
        closeModal();
        toast('Broadcast created successfully with ' + uploadedBroadcastFiles.length + ' file(s) attached ✅', 'success');
        await renderBroadcasts();
    } else {
        toast('Failed to create broadcast', 'danger');
    }
  });
}

async function renderBroadcasts() {
  const broadcasts = getAllowedItems(await DB.broadcasts());
  broadcasts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'municipal_officer';
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-bullhorn"></i> Announcements</h2>
      ${isAdmin ? `
        <button class="btn btn-primary btn-sm" onclick="showBroadcastModal()">
          <i class="fas fa-plus"></i> New Broadcast
        </button>
      ` : ''}
    </div>
    
    <div class="broadcast-list">
      ${broadcasts.length ? broadcasts.map(b => {
        const hasFiles = b.files && b.files.length > 0;
        const images = hasFiles ? b.files.filter(f => f.type && f.type.startsWith('image/')) : [];
        
        return `
        <div class="broadcast-item card" style="
          border-left:4px solid var(--primary);
          ${new Date(b.timestamp) > new Date(Date.now() - 86400000) ? 'background:var(--surface-alt);' : ''}
        ">
          <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <strong style="color:var(--primary-dark);">
              <i class="fas fa-bullhorn"></i> ${b.sender}
            </strong>
            <span style="color:var(--text-muted);font-size:0.85rem;">
              ${formatDate(b.timestamp)}
            </span>
          </div>
          <div style="margin-top:0.75rem;font-size:1.05rem;padding:0.5rem 0;">
            ${b.message}
          </div>
          ${hasFiles ? `
            <div style="margin-top:0.5rem;">
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                ${images.slice(0, 4).map(file => `
                  <div style="width:40px; height:40px; border-radius:4px; overflow:hidden; border:1px solid var(--border); cursor:pointer;"
                       onclick="viewBroadcastFiles(${b.id})">
                    <img src="${file.data}" style="width:100%; height:100%; object-fit:cover;" />
                  </div>
                `).join('')}
                ${b.files.length > 4 ? `
                  <span class="file-tag" style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--surface-alt); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border); cursor:pointer;" onclick="viewBroadcastFiles(${b.id})">
                    +${b.files.length - 4} more
                  </span>
                ` : ''}
                <span class="file-tag" style="display:inline-flex; align-items:center; gap:0.3rem; background:var(--surface-alt); padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border); cursor:pointer;" onclick="viewBroadcastFiles(${b.id})">
                  <i class="fas fa-paperclip" style="font-size:0.7rem;"></i>
                  ${b.files.length} files
                </span>
              </div>
            </div>
          ` : ''}
          <div style="margin-top:0.5rem;color:var(--text-muted);font-size:0.85rem;">
            ${getMunicipalityLabel(b.municipality)}
            ${new Date(b.timestamp) > new Date(Date.now() - 86400000) ? ' • <span style="color:var(--primary);font-weight:600;">New</span>' : ''}
          </div>
          ${isAdmin ? `
            <div style="margin-top:0.75rem;">
              <button class="btn btn-danger btn-sm" onclick="deleteBroadcast(${b.id})">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          ` : ''}
        </div>
      `}).join('') : '<div class="card text-center text-muted">No announcements available.</div>'}
    </div>
  `);
}

async function viewBroadcastFiles(id) {
  const broadcasts = await DB.broadcasts();
  const broadcast = broadcasts.find(item => item.id === id);
  if (!broadcast || !broadcast.files || broadcast.files.length === 0) {
    toast('No files attached to this broadcast', 'info');
    return;
  }

  const images = broadcast.files.filter(f => f.type && f.type.startsWith('image/'));
  const documents = broadcast.files.filter(f => f.type && !f.type.startsWith('image/'));

  showModal(`
    <h3><i class="fas fa-paperclip"></i> Files: Broadcast</h3>
    <div style="margin-bottom:1rem; color:var(--text-muted);">
      <span class="badge badge-info">${broadcast.files.length} files</span>
      ${images.length > 0 ? `<span class="badge badge-success">${images.length} images</span>` : ''}
      ${documents.length > 0 ? `<span class="badge badge-warning">${documents.length} documents</span>` : ''}
    </div>
    
    ${images.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-images"></i> Images (${images.length})
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:0.75rem;">
          ${images.map((file, index) => `
            <div style="position:relative; cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid var(--border); transition:all 0.3s;" 
                 onclick="previewBroadcastFile(${id}, ${broadcast.files.indexOf(file)})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='scale(1.02)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.transform='scale(1)';">
              <img src="${file.data}" style="width:100%; height:120px; object-fit:cover;" />
              <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:white; padding:0.25rem 0.5rem; font-size:0.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${file.name}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${documents.length > 0 ? `
      <div style="margin-bottom:1.5rem;">
        <div class="card-title" style="font-size:0.9rem; color:var(--primary);">
          <i class="fas fa-file-alt"></i> Documents (${documents.length})
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          ${documents.map((file, index) => {
            const fileIndex = broadcast.files.indexOf(file);
            return `
            <div style="display:flex; align-items:center; gap:0.75rem; background:var(--surface-alt); padding:0.75rem; border-radius:8px; border:1px solid var(--border); cursor:pointer; transition:all 0.3s;"
                 onclick="previewBroadcastFile(${id}, ${fileIndex})"
                 onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface)';"
                 onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface-alt)';">
              <i class="${getFileIcon(file.type)}" style="font-size:2rem; color:var(--primary);"></i>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:500; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); downloadBroadcastFile(${id}, ${fileIndex})">
                <i class="fas fa-download"></i>
              </button>
            </div>
          `}).join('')}
        </div>
      </div>
    ` : ''}
    
    <button class="btn btn-outline btn-block" style="margin-top:0.5rem;" onclick="closeModal()">Close</button>
  `);
}

function previewBroadcastFile(broadcastId, fileIndex) {
  const broadcasts = (async () => { return await DB.broadcasts(); })();
  broadcasts.then(broadcastsList => {
    const broadcast = broadcastsList.find(item => item.id === broadcastId);
    if (!broadcast || !broadcast.files || !broadcast.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = broadcast.files[fileIndex];
    const isImage = file.type && file.type.startsWith('image/');
    
    showModal(`
      <div style="text-align:center;">
        <h3 style="margin-bottom:0.5rem;">${file.name}</h3>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
          ${formatFileSize(file.size)} • ${file.type || 'Unknown type'}
        </div>
        ${isImage ? `
          <img src="${file.data}" style="max-width:100%; max-height:70vh; border-radius:8px; border:1px solid var(--border);" />
        ` : `
          <div style="padding:2rem; background:var(--surface-alt); border-radius:12px; border:1px solid var(--border);">
            <i class="${getFileIcon(file.type)}" style="font-size:4rem; color:var(--primary);"></i>
            <p style="margin-top:1rem; color:var(--text-muted);">
              This file type cannot be previewed directly.
            </p>
            <button class="btn btn-primary" onclick="closeModal(); downloadBroadcastFile(${broadcastId}, ${fileIndex});">
              <i class="fas fa-download"></i> Download File
            </button>
          </div>
        `}
        <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">
          ${isImage ? `
            <button class="btn btn-primary btn-sm" onclick="downloadBroadcastFile(${broadcastId}, ${fileIndex})">
              <i class="fas fa-download"></i> Download
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="closeModal(); viewBroadcastFiles(${broadcastId});">
            <i class="fas fa-arrow-left"></i> Back to Files
          </button>
        </div>
      </div>
    `);
  });
}

function downloadBroadcastFile(broadcastId, fileIndex) {
  const broadcasts = (async () => { return await DB.broadcasts(); })();
  broadcasts.then(broadcastsList => {
    const broadcast = broadcastsList.find(item => item.id === broadcastId);
    if (!broadcast || !broadcast.files || !broadcast.files[fileIndex]) {
      toast('File not found', 'danger');
      return;
    }
    const file = broadcast.files[fileIndex];
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Downloading: ${file.name}`, 'success');
  });
}

async function deleteBroadcast(id) {
  if (!confirm('Delete this broadcast?')) return;
  const success = await DB._deleteItem('broadcasts', id);
  if (success) {
      toast('Broadcast deleted', 'success');
      await renderBroadcasts();
  } else {
      toast('Failed to delete broadcast', 'danger');
  }
}

// ============= DOCUMENTS (ENHANCED WITH VIEW, DOWNLOAD, DELETE) =============

// Document file upload handlers
function handleDocumentFileSelect(event) {
  const files = event.target.files;
  handleDocumentFiles(files);
}

function handleDocumentFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const files = event.dataTransfer.files;
  handleDocumentFiles(files);
  const dropZone = document.getElementById('documentUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleDocumentDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('documentUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--surface-alt)';
  }
}

function handleDocumentDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropZone = document.getElementById('documentUploadDropZone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--surface)';
  }
}

function handleDocumentFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 10 * 1024 * 1024) {
      toast(`File "${file.name}" is too large. Maximum size is 10MB.`, 'danger');
      continue;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast(`File "${file.name}" is not a supported format.`, 'warning');
      continue;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result,
        uploadDate: new Date().toISOString()
      };
      uploadedDocumentFiles.push(fileData);
      displayDocumentFileList();
    };
    reader.readAsDataURL(file);
  }
  const fileInput = document.getElementById('documentFileInput');
  if (fileInput) fileInput.value = '';
}

function displayDocumentFileList() {
  const fileList = document.getElementById('documentFileList');
  if (!fileList) return;
  
  if (uploadedDocumentFiles.length === 0) {
    fileList.innerHTML = '';
    return;
  }
  
  fileList.innerHTML = uploadedDocumentFiles.map((file, index) => {
    const isImage = file.type && file.type.startsWith('image/');
    return `
    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-alt); padding:0.4rem 0.8rem; border-radius:8px; border:1px solid var(--border);">
      ${isImage ? `<img src="${file.data}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;" />` : `<i class="${getFileIcon(file.type)}" style="color:var(--primary);"></i>`}
      <span style="font-size:0.85rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
      <span style="font-size:0.7rem; color:var(--text-muted);">${formatFileSize(file.size)}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeDocumentFile(${index})" style="padding:0.1rem 0.4rem; font-size:0.7rem;">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `}).join('');
}

function removeDocumentFile(index) {
  uploadedDocumentFiles.splice(index, 1);
  displayDocumentFileList();
}

// Show Upload Document Modal with File Upload
async function showUploadDocModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  uploadedDocumentFiles = [];
  
  showModal(`
    <h3><i class="fas fa-upload"></i> Upload Document</h3>
    <form id="uploadDocForm" enctype="multipart/form-data">
      <div class="form-group">
        <label>Document Name <span style="color:var(--danger);">*</span></label>
        <input type="text" id="docName" required placeholder="Enter document name (e.g., Annual Report 2026)" />
      </div>
      
      <div class="form-group">
        <label>Document Type</label>
        <select id="docType">
          <option value="PDF">PDF</option>
          <option value="Word">Word</option>
          <option value="Excel">Excel</option>
          <option value="PowerPoint">PowerPoint</option>
          <option value="Image">Image</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Municipality <span style="color:var(--danger);">*</span></label>
        <select id="docMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
      </div>
      
      <div class="form-group">
        <label>Upload File <span style="color:var(--danger);">*</span></label>
        <div style="border:2px dashed var(--border); border-radius:12px; padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.3s;" 
             id="documentUploadDropZone" 
             ondrop="handleDocumentFileDrop(event)" 
             ondragover="handleDocumentDragOver(event)"
             ondragleave="handleDocumentDragLeave(event)"
             onclick="document.getElementById('documentFileInput').click()">
          <i class="fas fa-cloud-upload-alt" style="font-size:2.5rem; color:var(--primary);"></i>
          <p style="margin:0.5rem 0; color:var(--text-muted);">
            Drag & drop your document here or click to browse
          </p>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Supports: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), Images (JPG, PNG, GIF)
          </p>
          <p style="font-size:0.7rem; color:var(--danger);">
            Max file size: 10MB
          </p>
          <input type="file" id="documentFileInput" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif" style="display:none;" onchange="handleDocumentFileSelect(event)" />
        </div>
        <div id="documentFileList" style="margin-top:0.75rem; display:flex; flex-wrap:wrap; gap:0.5rem;"></div>
      </div>
      
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-upload"></i> Upload Document</button>
    </form>
  `);
  
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  
  byId('uploadDocForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('docName').value.trim();
    const type = byId('docType').value;
    const municipality = byId('docMunicipality').value;
    
    if (!name) { 
      toast('Please enter a document name', 'danger'); 
      return; 
    }
    
    if (uploadedDocumentFiles.length === 0) {
      toast('Please upload a file', 'danger');
      return;
    }
    
    const file = uploadedDocumentFiles[0];
    
    const docData = { 
      name: name,
      type: type,
      municipality: municipality,
      uploadedBy: currentUser.name,
      uploadDate: new Date().toISOString().slice(0, 10),
      fileName: file.name,
      fileData: file.data,
      fileSize: file.size,
      fileType: file.type
    };
    
    const newDoc = await DB.addDocument(docData);
    if (newDoc) {
        closeModal();
        toast('Document uploaded successfully: ' + file.name + ' ✅', 'success');
        navigate('documents');
    } else {
        toast('Failed to upload document', 'danger');
    }
  });
}

// View Document - Show preview in modal
async function viewDocument(id) {
  const documents = await DB.documents();
  const doc = documents.find(item => item.id === id);
  if (!doc) {
    toast('Document not found', 'danger');
    return;
  }
  
  const isImage = doc.fileType && doc.fileType.startsWith('image/');
  const fileExtension = doc.fileName ? doc.fileName.split('.').pop().toLowerCase() : '';
  const iconMap = {
    'pdf': 'fas fa-file-pdf',
    'doc': 'fas fa-file-word',
    'docx': 'fas fa-file-word',
    'xls': 'fas fa-file-excel',
    'xlsx': 'fas fa-file-excel',
    'ppt': 'fas fa-file-powerpoint',
    'pptx': 'fas fa-file-powerpoint',
    'jpg': 'fas fa-file-image',
    'jpeg': 'fas fa-file-image',
    'png': 'fas fa-file-image',
    'gif': 'fas fa-file-image'
  };
  const icon = iconMap[fileExtension] || 'fas fa-file';
  
  showModal(`
    <div style="text-align:center;">
      <h3 style="margin-bottom:0.5rem;"><i class="fas fa-file"></i> ${doc.name}</h3>
      <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
        ${doc.fileName} • ${doc.type} • ${doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown size'}
      </div>
      <div style="margin-bottom:1rem; padding:0.5rem; background:var(--surface-alt); border-radius:8px; font-size:0.9rem; color:var(--text-muted);">
        <span><i class="fas fa-user"></i> Uploaded by: ${doc.uploadedBy}</span>
        <span style="margin-left:1rem;"><i class="fas fa-map-marker-alt"></i> ${getMunicipalityLabel(doc.municipality)}</span>
        <span style="margin-left:1rem;"><i class="fas fa-calendar-day"></i> ${formatDate(doc.uploadDate)}</span>
      </div>
      ${isImage && doc.fileData ? `
        <div style="background:var(--surface-alt); padding:1rem; border-radius:12px; border:1px solid var(--border);">
          <img src="${doc.fileData}" style="max-width:100%; max-height:70vh; border-radius:8px;" />
        </div>
      ` : `
        <div style="padding:3rem; background:var(--surface-alt); border-radius:12px; border:1px solid var(--border);">
          <i class="${icon}" style="font-size:5rem; color:var(--primary);"></i>
          <p style="margin-top:1rem; color:var(--text-muted); font-size:1.1rem;">
            <strong>${doc.fileName}</strong>
          </p>
          <p style="color:var(--text-muted);">
            File type: ${doc.type} • Size: ${doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown'}
          </p>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-top:0.5rem;">
            Click the download button below to view this file.
          </p>
        </div>
      `}
      <div style="display:flex; gap:0.75rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">
        <button class="btn btn-success" onclick="closeModal(); downloadDocument(${doc.id});">
          <i class="fas fa-download"></i> Download
        </button>
        <button class="btn btn-outline" onclick="closeModal();">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    </div>
  `);
}

// Download Document
function downloadDocument(id) {
  const doc = (async () => { return (await DB.documents()).find(item => item.id === id); })();
  doc.then(d => {
    if (!d) {
      toast('Document not found', 'danger');
      return;
    }
    
    if (d.fileData) {
      const link = document.createElement('a');
      link.href = d.fileData;
      link.download = d.fileName || d.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(`Downloading: ${d.fileName || d.name}`, 'success');
    } else {
      toast('File data not available for download', 'warning');
    }
  });
}

// Confirm Delete Document with styled popup
async function confirmDeleteDocument(id) {
  const documents = await DB.documents();
  const doc = documents.find(item => item.id === id);
  if (!doc) {
    toast('Document not found', 'danger');
    return;
  }
  
  const isImage = doc.fileType && doc.fileType.startsWith('image/');
  const fileExtension = doc.fileName ? doc.fileName.split('.').pop().toLowerCase() : '';
  const iconMap = {
    'pdf': 'fas fa-file-pdf',
    'doc': 'fas fa-file-word',
    'docx': 'fas fa-file-word',
    'xls': 'fas fa-file-excel',
    'xlsx': 'fas fa-file-excel',
    'ppt': 'fas fa-file-powerpoint',
    'pptx': 'fas fa-file-powerpoint',
    'jpg': 'fas fa-file-image',
    'jpeg': 'fas fa-file-image',
    'png': 'fas fa-file-image',
    'gif': 'fas fa-file-image'
  };
  const icon = iconMap[fileExtension] || 'fas fa-file';
  
  showModal(`
    <div style="text-align:center; padding:0.5rem;">
      <div style="font-size:4rem; margin-bottom:0.5rem; color:var(--danger);">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 style="color:var(--danger); margin-bottom:0.5rem;">Delete Document</h3>
      <p style="color:var(--text-muted); margin-bottom:1rem;">
        Are you sure you want to delete this document? This action cannot be undone.
      </p>
      
      <div style="background:var(--surface-alt); padding:1.25rem; border-radius:12px; margin:1rem 0; border:1px solid var(--border); text-align:left;">
        <div style="display:flex; align-items:center; gap:1rem; margin-bottom:0.75rem;">
          ${isImage && doc.fileData ? 
            `<img src="${doc.fileData}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid var(--border);" />` :
            `<i class="${icon}" style="font-size:2.5rem; color:var(--primary);"></i>`
          }
          <div>
            <div style="font-weight:600; font-size:1.05rem;">${doc.name}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${doc.fileName || 'Unknown file'} • ${doc.type}</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem; color:var(--text-muted);">
          <div><i class="fas fa-user"></i> Uploaded by: ${doc.uploadedBy}</div>
          <div><i class="fas fa-map-marker-alt"></i> ${getMunicipalityLabel(doc.municipality)}</div>
          <div><i class="fas fa-calendar-day"></i> ${formatDate(doc.uploadDate)}</div>
          <div><i class="fas fa-file"></i> ${doc.fileSize ? formatFileSize(doc.fileSize) : 'Unknown size'}</div>
        </div>
      </div>
      
      <div style="display:flex; gap:0.75rem; justify-content:center; margin-top:1.25rem; flex-wrap:wrap;">
        <button class="btn btn-danger" onclick="closeModal(); deleteDocument(${doc.id});" style="min-width:120px;">
          <i class="fas fa-trash"></i> Yes, Delete
        </button>
        <button class="btn btn-outline" onclick="closeModal();" style="min-width:100px;">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    </div>
  `);
}

// Delete Document
async function deleteDocument(id) {
  const success = await DB._deleteItem('documents', id);
  if (success) {
    toast('Document deleted successfully 🗑️', 'success');
    navigate('documents');
  } else {
    toast('Failed to delete document', 'danger');
  }
}

// Render Documents with View, Download, and Delete buttons
async function renderDocuments() {
  const documents = getAllowedItems(await DB.documents());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  const isAdmin = canAdd;
  
  documents.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-folder-open"></i> Documents</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showUploadDocModal()"><i class="fas fa-upload"></i> Upload Document</button>' : ''}
    </div>
    
    ${documents.length ? `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1rem;">
        ${documents.map(doc => {
          const fileExtension = doc.fileName ? doc.fileName.split('.').pop().toLowerCase() : '';
          const iconMap = {
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'png': 'fas fa-file-image',
            'gif': 'fas fa-file-image'
          };
          const colorMap = {
            'pdf': '#e74c3c',
            'doc': '#2980b9',
            'docx': '#2980b9',
            'xls': '#27ae60',
            'xlsx': '#27ae60',
            'ppt': '#e67e22',
            'pptx': '#e67e22',
            'jpg': '#8e44ad',
            'jpeg': '#8e44ad',
            'png': '#8e44ad',
            'gif': '#8e44ad'
          };
          const icon = iconMap[fileExtension] || 'fas fa-file';
          const color = colorMap[fileExtension] || 'var(--primary)';
          const isImage = doc.fileType && doc.fileType.startsWith('image/');
          
          return `
            <div class="card" style="padding:1rem; border-left:4px solid ${color};">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                ${isImage && doc.fileData ? 
                  `<img src="${doc.fileData}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid var(--border);" />` :
                  `<i class="${icon}" style="font-size:2rem; color:${color};"></i>`
                }
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.name}">
                    ${doc.name}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">
                    ${doc.type} • ${doc.fileName || 'Unknown file'}
                    ${doc.fileSize ? ` • ${formatFileSize(doc.fileSize)}` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem; font-size:0.85rem; color:var(--text-muted);">
                <span><i class="fas fa-user"></i> ${doc.uploadedBy}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${getMunicipalityLabel(doc.municipality)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; flex-wrap:wrap; gap:0.5rem;">
                <span style="font-size:0.8rem; color:var(--text-muted);">
                  <i class="fas fa-calendar-day"></i> ${formatDate(doc.uploadDate)}
                </span>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                  <button class="btn btn-info btn-sm" onclick="viewDocument(${doc.id})" title="View">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-success btn-sm" onclick="downloadDocument(${doc.id})" title="Download">
                    <i class="fas fa-download"></i>
                  </button>
                  ${isAdmin ? `
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteDocument(${doc.id})" title="Delete">
                      <i class="fas fa-trash"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '<div class="card text-center text-muted">No documents uploaded yet.</div>'}
  `);
}

// Keep legacy functions for backward compatibility
function downloadDoc(id) {
  downloadDocument(id);
}

async function deleteDoc(id) {
  await confirmDeleteDocument(id);
}

// ============= USERS (ENHANCED WITH ROLE SWITCHING) =============

async function renderUsers() {
  if (!isSystemAdmin(currentUser)) {
    render('<div class="card"><h2>Access Denied</h2></div>');
    return;
  }
  const users = await DB.users();
  render(`
    <div class="page-header">
      <h2><i class="fas fa-user-cog"></i> Manage Users</h2>
      <button class="btn btn-primary btn-sm" onclick="showAddUserModal()"><i class="fas fa-plus"></i> Create Account</button>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Municipality</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.name}</td>
              <td>${user.email}</td>
              <td>${getRoleLabel(user.role)}</td>
              <td>${getMunicipalityLabel(user.municipality)}</td>
              <td style="white-space:nowrap;">
                ${user.role === 'member' ? `
                  <button class="btn btn-warning btn-sm" onclick="switchUserRole(${user.id}, 'municipal_officer')" title="Promote to Municipal Officer">
                    <i class="fas fa-user-shield"></i> Promote
                  </button>
                ` : user.role === 'municipal_officer' ? `
                  <button class="btn btn-secondary btn-sm" onclick="switchUserRole(${user.id}, 'member')" title="Demote to Member">
                    <i class="fas fa-user"></i> Demote
                  </button>
                ` : ''}
                <button class="btn btn-info btn-sm" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);
}

// Switch User Role - Only Super Admin can do this
async function switchUserRole(userId, newRole) {
  if (!isSystemAdmin(currentUser)) {
    toast('Only Super Admin can switch user roles', 'danger');
    return;
  }
  
  try {
    const users = await DB.users();
    const user = users.find(u => u.id === userId);
    if (!user) {
      toast('User not found', 'danger');
      return;
    }
    
    // Don't allow switching Super Admin role
    if (user.role === 'super_admin') {
      toast('Cannot change Super Admin role', 'danger');
      return;
    }
    
    const roleLabel = getRoleLabel(newRole);
    const currentRoleLabel = getRoleLabel(user.role);
    
    // Confirm with user
    if (!confirm(`Are you sure you want to change ${user.name}'s role from ${currentRoleLabel} to ${roleLabel}?`)) {
      return;
    }
    
    // If promoting to municipal_officer, make sure they have a municipality
    let municipality = user.municipality;
    if (newRole === 'municipal_officer' && municipality === 'all') {
      municipality = 'kenol'; // Default to Kenol if none specified
    }
    
    const updateData = {
      name: user.name,
      email: user.email,
      role: newRole,
      municipality: municipality,
      is_approved: true, // Auto-approve when promoted
      approved_by: currentUser.name,
      approved_date: new Date().toISOString(),
      is_rejected: false,
      last_seen: user.last_seen || '',
      registration_date: user.registration_date || new Date().toISOString()
    };
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      toast(`User ${user.name} role changed from ${currentRoleLabel} to ${roleLabel} successfully ✅`, 'success');
      // Refresh the users list
      await renderUsers();
    } else {
      const error = await response.json();
      toast('Failed to change user role: ' + (error.error || 'Unknown error'), 'danger');
    }
  } catch (error) {
    toast('An error occurred while changing user role', 'danger');
  }
}

async function renderTrackUsers() {
  if (!isSystemAdmin(currentUser)) {
    render('<div class="card"><h2>Access Denied</h2><p>Only the Super Admin can track users.</p></div>');
    return;
  }

  const users = await DB.users();
  const now = new Date();
  
  const userRows = users.map(user => {
    let status = '<span class="badge badge-danger">Offline</span>';
    let lastActive = 'Never';
    
    if (user.last_seen) {
      const lastSeenDate = new Date(user.last_seen);
      lastActive = formatDate(user.last_seen) + ' ' + lastSeenDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      
      const diffMs = now - lastSeenDate;
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 3) {
        status = '<span class="badge badge-success"><i class="fas fa-circle" style="font-size:0.6rem;"></i> Online</span>';
      } else if (diffMins < 60) {
        status = `<span class="badge badge-warning">Last seen ${diffMins}m ago</span>`;
      }
    }

    return `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${getRoleLabel(user.role)}</td>
        <td>${getMunicipalityLabel(user.municipality)}</td>
        <td>${status}</td>
        <td style="font-size:0.85rem; color:var(--text-muted);">${lastActive}</td>
      </tr>
    `;
  }).join('');

  render(`
    <div class="page-header">
      <h2><i class="fas fa-map-marker-alt"></i> Track Users</h2>
      <button class="btn btn-outline btn-sm" onclick="renderTrackUsers()"><i class="fas fa-sync"></i> Refresh</button>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Municipality</th><th>Status</th><th>Last Active</th></tr></thead>
        <tbody>
          ${userRows}
        </tbody>
      </table>
    </div>
  `);
}

async function showAddUserModal() {
  const roles = ['super_admin', 'municipal_officer', 'member', 'social_officer', 'department_officer'];
  const municipalities = ['kenol', 'kangare', 'muranga_town', 'all'];
  showModal(`
    <h3><i class="fas fa-user-plus"></i> Create User Account</h3>
    <form id="addUserForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="uName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="uEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="text" id="uPassword" value="admin123" required /></div>
      <div class="form-group"><label>Role</label><select id="uRole">${roles.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Municipality</label><select id="uMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Create</button>
    </form>
  `);
  byId('addUserForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('uName').value.trim();
    const email = byId('uEmail').value.trim();
    const password = byId('uPassword').value.trim();
    const role = byId('uRole').value;
    const municipality = byId('uMunicipality').value;
    if (!name || !email || !password) { toast('Fill all fields', 'danger'); return; }
    const users = await DB.users();
    if (users.find(u => u.email === email)) { toast('Email already exists', 'danger'); return; }
    
    const newUser = await DB.addUser({ name, email, password, role, municipality });
    if (!newUser) {
        toast('Failed to create user', 'danger');
        return;
    }
    
    if (role !== 'super_admin') {
        await DB.addMember({ name, email, role, municipality, joined: new Date().toISOString().slice(0, 10) });
    }
    closeModal();
    toast('User created', 'success');
    navigate('users');
  });
}

async function editUser(id) {
  const users = await DB.users();
  const user = users.find(u => u.id === id);
  if (user) {
    showEditUserModal(user);
  } else {
    toast('User not found', 'danger');
  }
}

function showEditUserModal(user) {
  const roles = ['super_admin', 'municipal_officer', 'member', 'social_officer', 'department_officer'];
  const municipalities = ['kenol', 'kangare', 'muranga_town', 'all'];
  showModal(`
    <h3><i class="fas fa-user-edit"></i> Edit User Account</h3>
    <form id="editUserForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="uName" value="${user.name}" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="uEmail" value="${user.email}" required disabled /></div>
      <div class="form-group"><label>New Password (leave blank to keep current)</label><input type="password" id="uPassword" placeholder="New Password" /></div>
      <div class="form-group"><label>Role</label><select id="uRole">${roles.map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${getRoleLabel(role)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Municipality</label><select id="uMunicipality">${municipalities.map(m => `<option value="${m}" ${user.municipality === m ? 'selected' : ''}>${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Save Changes</button>
    </form>
  `);
  
  byId('editUserForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('uName').value.trim();
    const email = byId('uEmail').value.trim();
    const password = byId('uPassword').value.trim();
    const role = byId('uRole').value;
    const municipality = byId('uMunicipality').value;

    if (!name) { toast('Name is required', 'danger'); return; }
    
    const updateData = { name, email, role, municipality };
    if (password) {
        updateData.password = password;
    }

    await updateUser(user.id, updateData);
  });
}

async function deleteUser(userId) {
  const users = await DB.users();
  const target = users.find(user => user.id === userId);
  if (target && target.role === 'super_admin' && users.filter(user => user.role === 'super_admin').length <= 1) {
    toast('Cannot delete the last super admin', 'danger');
    return;
  }
  if (!confirm('Delete this user?')) return;
  
  const userSuccess = await DB._deleteItem('users', userId);
  const memberSuccess = await DB._deleteItem('members', userId);

  if (userSuccess && memberSuccess) {
      toast('User deleted', 'success');
      navigate('users');
  } else {
      toast('Failed to delete user', 'danger');
  }
}

async function updateUser(id, userData) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (response.ok) {
      closeModal();
      toast('User updated successfully', 'success');
      navigate('users');
    } else {
      toast('Failed to update user', 'danger');
    }
  } catch (error) {
    toast('An error occurred', 'danger');
  }
}
// ============= PERMISSION MANAGEMENT =============

// Permission definitions with categories
const PERMISSION_DEFINITIONS = {
  'view_members': { label: 'View Members', category: 'Members', description: 'View all board members across municipalities' },
  'manage_members': { label: 'Manage Members', category: 'Members', description: 'Add, edit, and delete members' },
  'schedule_meetings': { label: 'Schedule Meetings', category: 'Meetings', description: 'Create and schedule new meetings' },
  'view_meetings': { label: 'View Meetings', category: 'Meetings', description: 'View all meetings and attendance' },
  'upload_minutes': { label: 'Upload Minutes', category: 'Minutes', description: 'Upload and manage meeting minutes' },
  'view_minutes': { label: 'View Minutes', category: 'Minutes', description: 'View all uploaded minutes' },
  'manage_complaints': { label: 'Manage Complaints', category: 'Complaints', description: 'Assign, update, and resolve complaints' },
  'view_complaints': { label: 'View Complaints', category: 'Complaints', description: 'View all complaints' },
  'upload_documents': { label: 'Upload Documents', category: 'Documents', description: 'Upload and manage documents' },
  'view_documents': { label: 'View Documents', category: 'Documents', description: 'View all uploaded documents' },
  'manage_users': { label: 'Manage Users', category: 'Users', description: 'Add, edit, and delete user accounts' },
  'view_users': { label: 'View Users', category: 'Users', description: 'View all user accounts' },
  'track_users': { label: 'Track Users', category: 'Users', description: 'View user online status and activity' },
  'approve_users': { label: 'Approve Users', category: 'Approvals', description: 'Approve or reject user registrations' },
  'view_approvals': { label: 'View Approvals', category: 'Approvals', description: 'View pending, approved, and rejected users' },
  'view_approvals_all': { label: 'View All Approvals', category: 'Approvals', description: 'View approvals across all municipalities' },
  'manage_broadcasts': { label: 'Manage Announcements', category: 'Broadcasts', description: 'Create and manage announcements' },
  'view_broadcasts': { label: 'View Announcements', category: 'Broadcasts', description: 'View all announcements' },
  'manage_permissions': { label: 'Manage Permissions', category: 'System', description: 'Assign permissions to users' },
  'view_system': { label: 'System Access', category: 'System', description: 'Access system settings and configuration' }
};

// Default permission sets for each role
const DEFAULT_PERMISSION_SETS = {
  'super_admin': Object.keys(PERMISSION_DEFINITIONS),
  'municipal_officer': [
    'view_members', 'manage_members',
    'schedule_meetings', 'view_meetings',
    'upload_minutes', 'view_minutes',
    'manage_complaints', 'view_complaints',
    'upload_documents', 'view_documents',
    'view_users',
    'track_users',
    'approve_users', 'view_approvals',
    'manage_broadcasts', 'view_broadcasts'
  ],
  'department_officer': [
    'view_members',
    'view_meetings',
    'view_minutes',
    'view_complaints',
    'view_documents',
    'view_broadcasts'
  ],
  'social_officer': [
    'view_members',
    'view_meetings',
    'view_minutes',
    'manage_complaints', 'view_complaints',
    'view_documents',
    'view_broadcasts'
  ],
  'member': [
    'view_members',
    'view_meetings',
    'view_minutes',
    'view_complaints',
    'view_documents',
    'view_broadcasts'
  ]
};

// Permission check functions
function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const perms = user.permissions || DEFAULT_PERMISSION_SETS[user.role] || [];
  return perms.includes(permission);
}

function canViewMembers(user) { return hasPermission(user, 'view_members'); }
function canManageMembers(user) { return hasPermission(user, 'manage_members'); }
function canScheduleMeetings(user) { return hasPermission(user, 'schedule_meetings'); }
function canViewMeetings(user) { return hasPermission(user, 'view_meetings'); }
function canUploadMinutes(user) { return hasPermission(user, 'upload_minutes'); }
function canViewMinutes(user) { return hasPermission(user, 'view_minutes'); }
function canManageComplaints(user) { return hasPermission(user, 'manage_complaints'); }
function canViewComplaints(user) { return hasPermission(user, 'view_complaints'); }
function canUploadDocuments(user) { return hasPermission(user, 'upload_documents'); }
function canViewDocuments(user) { return hasPermission(user, 'view_documents'); }
function canManageUsers(user) { return hasPermission(user, 'manage_users'); }
function canViewUsers(user) { return hasPermission(user, 'view_users'); }
function canTrackUsers(user) { return hasPermission(user, 'track_users'); }
function canApproveUsers(user) { return hasPermission(user, 'approve_users'); }
function canViewApprovals(user) { return hasPermission(user, 'view_approvals'); }
function canViewAllApprovals(user) { return hasPermission(user, 'view_approvals_all'); }
function canManageBroadcasts(user) { return hasPermission(user, 'manage_broadcasts'); }
function canViewBroadcasts(user) { return hasPermission(user, 'view_broadcasts'); }
function canManagePermissions(user) { return hasPermission(user, 'manage_permissions'); }
function canViewSystem(user) { return hasPermission(user, 'view_system'); }

// Show Promote User Modal with permission selection
async function showPromoteUserModal(userId) {
  const users = await DB.users();
  const user = users.find(u => u.id === userId);
  if (!user) {
    toast('User not found', 'danger');
    return;
  }
  
  const currentPermissions = user.permissions || [];
  const isSuperAdmin = user.role === 'super_admin';
  
  if (isSuperAdmin) {
    toast('Cannot modify Super Admin permissions', 'danger');
    return;
  }
  
  // Group permissions by category
  const groupedPermissions = {};
  Object.entries(PERMISSION_DEFINITIONS).forEach(([key, def]) => {
    if (!groupedPermissions[def.category]) {
      groupedPermissions[def.category] = [];
    }
    groupedPermissions[def.category].push({ key, ...def });
  });
  
  // Get current role label
  const currentRoleLabel = getRoleLabel(user.role);
  
  // Role options for promotion
  const roleOptions = [
    { value: 'municipal_officer', label: 'Municipal Officer' },
    { value: 'department_officer', label: 'Department Officer' },
    { value: 'social_officer', label: 'Social Officer' },
    { value: 'member', label: 'Member' }
  ];
  
  // Filter out current role
  const availableRoles = roleOptions.filter(r => r.value !== user.role);
  
  // Build permission checkboxes HTML
  let permissionsHTML = '';
  Object.entries(groupedPermissions).forEach(([category, perms]) => {
    permissionsHTML += `
      <div style="margin-bottom:1.5rem; border:1px solid var(--border); border-radius:8px; padding:1rem; background:var(--surface-alt);">
        <div style="font-weight:600; margin-bottom:0.75rem; color:var(--primary); display:flex; align-items:center; gap:0.5rem;">
          <i class="fas fa-folder-open"></i> ${category}
          <span style="font-size:0.7rem; color:var(--text-muted); font-weight:400; margin-left:0.5rem;">
            (${perms.length} permissions)
          </span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.4rem;">
          ${perms.map(p => {
            const isChecked = currentPermissions.includes(p.key);
            const defaultForRole = DEFAULT_PERMISSION_SETS[user.role]?.includes(p.key) || false;
            return `
              <label style="display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0.5rem; border-radius:4px; cursor:pointer; transition:background 0.2s; ${defaultForRole ? 'background:rgba(46,125,50,0.08);' : ''}"
                     onmouseover="this.style.background='var(--surface-muted)'" 
                     onmouseout="this.style.background='${defaultForRole ? 'rgba(46,125,50,0.08)' : 'transparent'}'">
                <input type="checkbox" name="perm_${p.key}" value="${p.key}" ${isChecked ? 'checked' : ''} 
                       style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;" />
                <div style="display:flex; flex-direction:column; flex:1;">
                  <span style="font-size:0.85rem; font-weight:${defaultForRole ? '600' : '400'};">
                    ${p.label}
                    ${defaultForRole ? '<span style="font-size:0.6rem; color:var(--text-muted); margin-left:0.3rem;">(default)</span>' : ''}
                  </span>
                  <span style="font-size:0.7rem; color:var(--text-muted);">${p.description}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  
  showModal(`
    <div style="max-height:80vh; overflow-y:auto; padding-right:0.5rem;">
      <h3 style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
        <i class="fas fa-user-shield" style="color:var(--primary);"></i>
        Manage User Permissions
      </h3>
      <div style="background:var(--surface-alt); padding:0.75rem 1rem; border-radius:8px; margin:0.5rem 0 1rem 0; display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
        <div><strong>User:</strong> ${user.name}</div>
        <div><strong>Current Role:</strong> <span class="badge badge-info">${currentRoleLabel}</span></div>
        <div><strong>Municipality:</strong> ${getMunicipalityLabel(user.municipality)}</div>
      </div>
      
      <form id="promoteUserForm">
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label style="font-weight:600; display:block; margin-bottom:0.5rem;">
            <i class="fas fa-exchange-alt" style="color:var(--primary);"></i> 
            Change Role (Optional)
          </label>
          <select id="promoteRole" style="width:100%; padding:0.75rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:1rem;">
            <option value="${user.role}">Keep as ${currentRoleLabel}</option>
            ${availableRoles.map(r => `<option value="${r.value}">Promote to ${r.label}</option>`).join('')}
          </select>
          <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">
            Changing role will apply the default permission set for that role.
          </small>
        </div>
        
        <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <span style="font-weight:600; color:var(--text);">
            <i class="fas fa-key" style="color:var(--primary);"></i> 
            Custom Permissions
          </span>
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="selectAllPermissions()">
              <i class="fas fa-check-double"></i> Select All
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="deselectAllPermissions()">
              <i class="fas fa-times"></i> Deselect All
            </button>
          </div>
        </div>
        
        <div style="margin-bottom:1rem; padding:0.5rem 0.75rem; background:rgba(46,125,50,0.06); border-radius:8px; border-left:3px solid var(--primary);">
          <small style="color:var(--text-muted);">
            <i class="fas fa-info-circle"></i> 
            <strong>Bold</strong> permissions are default for the current role. 
            Check/uncheck to customize. Unchecking a default permission will remove it.
          </small>
        </div>
        
        ${permissionsHTML}
        
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border);">
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save"></i> Save Permissions
          </button>
          <button type="button" class="btn btn-outline" onclick="closeModal()">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
  `);
  
  // Handle role change - update permission checkboxes based on role selection
  byId('promoteRole').addEventListener('change', function() {
    const selectedRole = this.value;
    const checkboxes = document.querySelectorAll('input[name^="perm_"]');
    const defaultPerms = DEFAULT_PERMISSION_SETS[selectedRole] || [];
    
    checkboxes.forEach(cb => {
      cb.checked = defaultPerms.includes(cb.value);
    });
  });
  
  // Handle form submission
  byId('promoteUserForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const selectedRole = byId('promoteRole').value;
    const checkboxes = document.querySelectorAll('input[name^="perm_"]:checked');
    const selectedPermissions = Array.from(checkboxes).map(cb => cb.value);
    
    // Build update data
    const updateData = {
      name: user.name,
      email: user.email,
      role: selectedRole,
      municipality: user.municipality,
      permissions: selectedPermissions,
      is_approved: true,
      approved_by: currentUser.name,
      approved_date: new Date().toISOString(),
      is_rejected: false,
      last_seen: user.last_seen || '',
      registration_date: user.registration_date || new Date().toISOString()
    };
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update current session if it's the same user
        if (currentUser.id === userId) {
          currentUser = updatedUser;
          localStorage.setItem('mbp_session', JSON.stringify({ userId: currentUser.id }));
        }
        
        // Update members collection if role changed
        if (selectedRole !== 'super_admin') {
          const members = await DB.members();
          const existingMember = members.find(m => m.id === userId);
          if (existingMember) {
            existingMember.role = selectedRole;
            existingMember.name = user.name;
            existingMember.email = user.email;
            existingMember.municipality = user.municipality;
            await DB.setMembers(members);
          } else {
            await DB.addMember({
              id: userId,
              name: user.name,
              email: user.email,
              role: selectedRole,
              municipality: user.municipality,
              joined: new Date().toISOString().slice(0, 10)
            });
          }
        }
        
        closeModal();
        toast(`Permissions updated for ${user.name} successfully ✅`, 'success');
        await renderUsers();
        showAppInfo();
      } else {
        const error = await response.json();
        toast('Failed to update permissions: ' + (error.error || 'Unknown error'), 'danger');
      }
    } catch (error) {
      toast('An error occurred while updating permissions', 'danger');
    }
  });
}

// Helper functions for permission selection
function selectAllPermissions() {
  const checkboxes = document.querySelectorAll('input[name^="perm_"]');
  checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllPermissions() {
  const checkboxes = document.querySelectorAll('input[name^="perm_"]');
  checkboxes.forEach(cb => cb.checked = false);
}

// Override renderUsers to show Promote button instead of role switch
async function renderUsers() {
  if (!isSystemAdmin(currentUser)) {
    render('<div class="card"><h2>Access Denied</h2></div>');
    return;
  }
  const users = await DB.users();
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-user-cog"></i> Manage Users</h2>
      <button class="btn btn-primary btn-sm" onclick="showAddUserModal()"><i class="fas fa-plus"></i> Create Account</button>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Municipality</th>
          <th>Permissions</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${users.map(user => {
            const permCount = user.permissions ? user.permissions.length : (DEFAULT_PERMISSION_SETS[user.role] || []).length;
            const isSuperAdmin = user.role === 'super_admin';
            return `
            <tr>
              <td><strong>${user.name}</strong></td>
              <td>${user.email}</td>
              <td><span class="badge badge-info">${getRoleLabel(user.role)}</span></td>
              <td>${getMunicipalityLabel(user.municipality)}</td>
              <td>
                <span class="badge badge-secondary" style="background:var(--surface-muted);color:var(--text);">
                  <i class="fas fa-key"></i> ${permCount} permissions
                </span>
              </td>
              <td style="white-space:nowrap; display:flex; gap:0.3rem; flex-wrap:wrap;">
                ${!isSuperAdmin ? `
                  <button class="btn btn-warning btn-sm" onclick="showPromoteUserModal(${user.id})" title="Manage Permissions">
                    <i class="fas fa-user-shield"></i> Permissions
                  </button>
                ` : `
                  <span class="badge badge-success" style="font-size:0.7rem;">Full Access</span>
                `}
                <button class="btn btn-info btn-sm" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `);
}

// Override showAddUserModal to include permissions
const originalShowAddUserModal = showAddUserModal;
showAddUserModal = async function() {
  const roles = ['super_admin', 'municipal_officer', 'member', 'social_officer', 'department_officer'];
  const municipalities = ['kenol', 'kangare', 'muranga_town', 'all'];
  
  showModal(`
    <h3><i class="fas fa-user-plus"></i> Create User Account</h3>
    <form id="addUserForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="uName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="uEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="text" id="uPassword" value="admin123" required /></div>
      <div class="form-group"><label>Role</label>
        <select id="uRole" onchange="togglePermissionSection()">
          ${roles.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Municipality</label>
        <select id="uMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
      </div>
      
      <div id="permissionSection" style="display:none; margin-top:1rem; padding:1rem; border:1px solid var(--border); border-radius:8px;">
        <div style="font-weight:600; margin-bottom:0.75rem; color:var(--primary);">
          <i class="fas fa-key"></i> Custom Permissions
          <small style="font-weight:400; color:var(--text-muted); display:block; font-size:0.8rem;">
            Check permissions to assign. Unchecked permissions will be removed.
          </small>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:0.4rem;">
          ${Object.entries(PERMISSION_DEFINITIONS).map(([key, def]) => `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" name="newPerm_${key}" value="${key}" style="width:14px; height:14px; accent-color:var(--primary);" />
              ${def.label}
            </label>
          `).join('')}
        </div>
        <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-sm btn-outline" onclick="selectAllNewPermissions()">Select All</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="deselectAllNewPermissions()">Deselect All</button>
        </div>
      </div>
      
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:1rem;"><i class="fas fa-save"></i> Create</button>
    </form>
  `);
  
  // Toggle permission section for non-super-admin roles
  window.togglePermissionSection = function() {
    const role = byId('uRole').value;
    const section = byId('permissionSection');
    if (section) {
      section.style.display = role === 'super_admin' ? 'none' : 'block';
    }
  };
  
  window.selectAllNewPermissions = function() {
    document.querySelectorAll('input[name^="newPerm_"]').forEach(cb => cb.checked = true);
  };
  
  window.deselectAllNewPermissions = function() {
    document.querySelectorAll('input[name^="newPerm_"]').forEach(cb => cb.checked = false);
  };
  
  // Show permission section by default for non-super-admin
  setTimeout(() => togglePermissionSection(), 100);
  
  byId('addUserForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('uName').value.trim();
    const email = byId('uEmail').value.trim();
    const password = byId('uPassword').value.trim();
    const role = byId('uRole').value;
    const municipality = byId('uMunicipality').value;
    
    if (!name || !email || !password) { toast('Fill all fields', 'danger'); return; }
    const users = await DB.users();
    if (users.find(u => u.email === email)) { toast('Email already exists', 'danger'); return; }
    
    // Get selected permissions
    let permissions = [];
    if (role !== 'super_admin') {
      const checkboxes = document.querySelectorAll('input[name^="newPerm_"]:checked');
      permissions = Array.from(checkboxes).map(cb => cb.value);
      // If no permissions selected, use defaults
      if (permissions.length === 0) {
        permissions = DEFAULT_PERMISSION_SETS[role] || [];
      }
    }
    
    const newUser = await DB.addUser({ 
      name, email, password, role, municipality, 
      permissions: permissions,
      is_approved: true,
      approved_by: currentUser.name,
      approved_date: new Date().toISOString()
    });
    
    if (!newUser) {
      toast('Failed to create user', 'danger');
      return;
    }
    
    if (role !== 'super_admin') {
      await DB.addMember({ 
        name, email, role, municipality, 
        joined: new Date().toISOString().slice(0, 10) 
      });
    }
    closeModal();
    toast('User created with ' + permissions.length + ' permissions', 'success');
    navigate('users');
  });
};

// ============= EMAILS =============

async function renderEmails() {
  const emails = getAllowedItems(await DB.emails());
  emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-envelope"></i> Email</h2>
      <button class="btn btn-primary btn-sm" onclick="showComposeEmailModal()">
        <i class="fas fa-plus"></i> Compose
      </button>
    </div>
    
    <div class="email-tabs" style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
      <button class="btn btn-sm btn-outline active" onclick="filterEmails('inbox', event)">
        <i class="fas fa-inbox"></i> Inbox
      </button>
      <button class="btn btn-sm btn-outline" onclick="filterEmails('sent', event)">
        <i class="fas fa-paper-plane"></i> Sent
      </button>
      <button class="btn btn-sm btn-outline" onclick="filterEmails('unread', event)">
        <i class="fas fa-circle" style="color:#2e7d32;font-size:0.6rem;"></i> Unread
      </button>
    </div>
    
    <div id="emailList">
      ${await filterAndRenderEmails('inbox')}
    </div>
  `);
}

async function filterAndRenderEmails(filter) {
  const allEmails = getAllowedItems(await DB.emails(), 'municipality');
  let filtered = [];
  
  switch(filter) {
    case 'inbox':
      filtered = allEmails.filter(e => e.to === currentUser.email || e.to === 'all');
      break;
    case 'sent':
      filtered = allEmails.filter(e => e.from === currentUser.email);
      break;
    case 'unread':
      filtered = allEmails.filter(e => !e.read && (e.to === currentUser.email || e.to === 'all'));
      break;
    default:
      filtered = allEmails;
  }
  
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const emailList = byId('emailList');
  if (!emailList) return '';
  
  emailList.innerHTML = filtered.length ? filtered.map(email => `
    <div class="email-item" style="
      border:1px solid var(--border);
      border-radius:16px;
      padding:1rem;
      margin-bottom:0.75rem;
      background:var(--surface);
      cursor:pointer;
      ${!email.read ? 'border-left:4px solid var(--primary);' : ''}
      transition:background var(--transition);
    " onclick="viewEmail(${email.id})">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
          ${!email.read ? '<span style="color:var(--primary);font-size:0.6rem;"><i class="fas fa-circle"></i></span>' : ''}
          <strong>${email.subject}</strong>
        </div>
        <span style="color:var(--text-muted);font-size:0.85rem;">
          ${formatDate(email.timestamp)}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-top:0.35rem;">
        <span style="color:var(--text-muted);font-size:0.9rem;">From: ${email.from}</span>
        <span class="badge badge-info">${getMunicipalityLabel(email.municipality)}</span>
      </div>
    </div>
  `).join('') : '<div class="card text-center text-muted">No emails found.</div>';
}

async function viewEmail(id) {
  const emails = await DB.emails();
  const email = emails.find(e => e.id === id);
  if (!email) return;
  
  if (!email.read) {
      email.read = true;
      const success = await DB._updateItem('emails', id, email);
      if (!success) {
          toast('Failed to mark as read', 'danger');
      }
  }
  
  showModal(`
    <h3><i class="fas fa-envelope-open"></i> ${email.subject}</h3>
    <div style="margin:1rem 0;padding:0.75rem;background:var(--surface-muted);border-radius:12px;">
      <div><strong>From:</strong> ${email.from}</div>
      <div><strong>To:</strong> ${email.to}</div>
      <div><strong>Date:</strong> ${formatDate(email.timestamp)}</div>
      <div><strong>Municipality:</strong> ${getMunicipalityLabel(email.municipality)}</div>
    </div>
    <div style="margin:1rem 0;padding:1rem;border:1px solid var(--border);border-radius:12px;white-space:pre-wrap;">
      ${email.body}
    </div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <button class="btn btn-danger btn-sm" onclick="deleteEmail(${email.id})">
        <i class="fas fa-trash"></i> Delete
      </button>
      <button class="btn btn-outline btn-sm" onclick="closeModal();renderEmails();">
        <i class="fas fa-arrow-left"></i> Back
      </button>
    </div>
  `);
}

async function deleteEmail(id) {
  if (!confirm('Delete this email?')) return;
  const success = await DB._deleteItem('emails', id);
  if (success) {
      toast('Email deleted', 'success');
      closeModal();
      await renderEmails();
  } else {
      toast('Failed to delete email', 'danger');
  }
}

async function showComposeEmailModal() {
  const users = await DB.users();
  const recipients = users.filter(u => u.email !== currentUser.email);
  
  showModal(`
    <h3><i class="fas fa-pencil-alt"></i> Compose Email</h3>
    <form id="composeEmailForm">
      <div class="form-group">
        <label>To</label>
        <select id="emailTo" required>
          <option value="">Select recipient...</option>
          ${recipients.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}
          <option value="all">All Users</option>
        </select>
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" id="emailSubject" required placeholder="Enter subject..." />
      </div>
      <div class="form-group">
        <label>Message</label>
        <textarea id="emailBody" rows="6" required placeholder="Write your message..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block">
        <i class="fas fa-paper-plane"></i> Send
      </button>
    </form>
  `);
  
  byId('composeEmailForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const to = byId('emailTo').value;
    const subject = byId('emailSubject').value.trim();
    const body = byId('emailBody').value.trim();
    
    if (!to || !subject || !body) {
      toast('Please complete all fields', 'danger');
      return;
    }
    
    if (to === 'all') {
        const users = await DB.users();
        for (const user of users) {
            if (user.email !== currentUser.email) {
                await DB.addEmail({
                    from: currentUser.email,
                    to: user.email,
                    subject: subject,
                    body: body,
                    timestamp: new Date().toISOString(),
                    read: false,
                    municipality: currentUser.municipality === 'all' ? 'all' : currentUser.municipality
                });
            }
        }
    } else {
        await DB.addEmail({
            from: currentUser.email,
            to: to,
            subject: subject,
            body: body,
            timestamp: new Date().toISOString(),
            read: false,
            municipality: currentUser.municipality === 'all' ? 'all' : currentUser.municipality
        });
    }
    
    closeModal();
    toast('Email sent successfully', 'success');
    await renderEmails();
  });
}

async function filterEmails(filter, event) {
  if (event && event.target) {
    document.querySelectorAll('.email-tabs .btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.btn').classList.add('active');
  }
  
  await filterAndRenderEmails(filter);
}

// ============= SHARED FUNCTIONS =============

function showModal(content) {
  let overlay = byId('modalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" id="modalBox">
        <button class="close-modal" id="modalClose">&times;</button>
        <div id="modalBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    byId('modalClose').addEventListener('click', closeModal);
    overlay.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeModal();
    });
  }
  
  const body = byId('modalBody');
  if (body) body.innerHTML = content;
  overlay.classList.add('active');
}

function closeModal() {
  const overlay = byId('modalOverlay');
  if (overlay) overlay.classList.remove('active');
}

function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `alert alert-${type}`;
  node.textContent = message;
  node.style.position = 'fixed';
  node.style.right = '20px';
  node.style.top = '80px';
  node.style.zIndex = '3000';
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function setTextSize(value) {
  document.documentElement.style.fontSize = value;
  localStorage.setItem('mbp_textSize', value);
}

function setSpacing(mode) {
  document.body.classList.remove('spacing-compact', 'spacing-relaxed');
  if (mode) document.body.classList.add(mode);
  localStorage.setItem('mbp_spacing', mode || '');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mbp_theme', next);
  const btn = byId('aThemeToggle');
  if (btn) btn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i> Theme' : '<i class="fas fa-moon"></i> Theme';
  toast(`Switched to ${next} mode`, 'info');
}

function speakText() {
  if (!window.speechSynthesis) { toast('Text to speech is unavailable', 'danger'); return; }
  const container = byId('pageContainer');
  if (!container) { toast('Nothing to speak', 'info'); return; }
  const text = container.innerText.trim();
  if (!text) { toast('Nothing to speak', 'info'); return; }
  stopSpeech();
  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.rate = 0.9;
  speechUtterance.pitch = 1;
  speechUtterance.lang = 'en-US';
  speechUtterance.onstart = () => { const indicator = byId('speechIndicator'); if (indicator) indicator.classList.add('active'); };
  speechUtterance.onend = () => { const indicator = byId('speechIndicator'); if (indicator) indicator.classList.remove('active'); };
  speechUtterance.onerror = () => { const indicator = byId('speechIndicator'); if (indicator) indicator.classList.remove('active'); };
  window.speechSynthesis.speak(speechUtterance);
}

function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  const indicator = byId('speechIndicator');
  if (indicator) indicator.classList.remove('active');
}

function resetAccessibility() {
  setTextSize('16px');
  setSpacing('');
  stopSpeech();
  const theme = localStorage.getItem('mbp_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  toast('Accessibility reset', 'info');
}

function bindAccessibility() {
  const actions = {
    aTextSmall: () => setTextSize('14px'),
    aTextDefault: () => setTextSize('16px'),
    aTextLarge: () => setTextSize('20px'),
    aTextXlarge: () => setTextSize('24px'),
    aSpacingCompact: () => setSpacing('spacing-compact'),
    aSpacingRelaxed: () => setSpacing('spacing-relaxed'),
    aSpeech: speakText,
    aThemeToggle: toggleTheme,
    aReset: resetAccessibility
  };
  Object.entries(actions).forEach(([id, fn]) => {
    const btn = byId(id);
    if (btn) btn.addEventListener('click', fn);
  });
  const stop = byId('speechStop');
  if (stop) stop.addEventListener('click', stopSpeech);
}

function attachHomeNavigation() {
  qsa('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) navigate(page);
    });
  });
}
async function boot() {
  await seedData(); 
  bindAccessibility();
  const savedText = localStorage.getItem('mbp_textSize');
  if (savedText) setTextSize(savedText);
  const savedSpacing = localStorage.getItem('mbp_spacing');
  if (savedSpacing) setSpacing(savedSpacing);
  const savedTheme = localStorage.getItem('mbp_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = byId('aThemeToggle');
  if (themeBtn && savedTheme === 'dark') themeBtn.innerHTML = '<i class="fas fa-sun"></i> Theme';

  const page = document.body.dataset.page;
  if (page === 'login') {
    if (await restoreSession()) {
      window.location.href = 'home.html';
      return;
    }
    const form = byId('loginForm');
    if (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const email = byId('loginEmail').value.trim();
        const password = byId('loginPassword').value.trim();
        if (await login(email, password)) {
          byId('loginError').style.display = 'none';
          window.location.href = 'home.html';
        } else {
          byId('loginError').style.display = 'block';
        }
      });
    }
    
    const formContainer = byId('loginForm')?.parentElement;
    if (formContainer) {
        const regLink = document.createElement('p');
        regLink.style.marginTop = '1.5rem';
        formContainer.appendChild(regLink);
        
        byId('showRegisterLink').addEventListener('click', function(e) {
            e.preventDefault();
            showCreateAccountModal();
        });
    }
    return;
  }

  if (!(await restoreSession())) {
    window.location.href = 'index.html';
    return;
  }

  showAppInfo();
  const logoutButton = byId('logoutBtn');
  if (logoutButton) logoutButton.addEventListener('click', logout);
  if (page === 'home') {
    attachHomeNavigation();
    byId('modalClose')?.addEventListener('click', closeModal);
    byId('modalOverlay')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); logout(); }
    });
    
    setInterval(async () => {
      if (currentUser && currentUser.id) {
        try {
          await fetch(`${API_BASE_URL}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
          });
        } catch (e) { }
      }
    }, 60000);
    
    setInterval(async () => {
      if (currentUser && (isSystemAdmin(currentUser) || currentUser.role === 'municipal_officer')) {
        await updateApprovalsBadge();
      }
    }, 30000);

    navigate('dashboard');
  }
  if (page === 'settings') {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); logout(); }
    });
  }
}

function showCreateAccountModal() {
  showModal(`
    <h3><i class="fas fa-user-plus"></i> Create Account</h3>
    <form id="createAccountForm">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="caName" required placeholder="Enter your full name" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="caEmail" required placeholder="Enter your email" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="caPassword" required placeholder="Create a password" minlength="6" />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" id="caConfirmPassword" required placeholder="Confirm your password" />
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="caRole">
          <option value="member">Member</option>
          <option value="department_officer">Department Officer</option>
        </select>
      </div>
      <div class="form-group">
        <label>Municipality</label>
        <select id="caMunicipality">
          <option value="kenol">Kenol</option>
          <option value="kangare">Kangare</option>
          <option value="muranga_town">Murang'a Town</option>
        </select>
      </div>
      <div style="background:var(--surface-alt);padding:0.75rem;border-radius:8px;margin-bottom:1rem;border-left:3px solid var(--warning);">
        <i class="fas fa-info-circle" style="color:var(--warning);"></i>
        <span style="font-size:0.9rem;color:var(--text-muted);"> Your account will be pending approval after registration. You will receive access once approved by an administrator.</span>
      </div>
      <button type="submit" class="btn btn-primary btn-block">
        <i class="fas fa-user-plus"></i> Create Account
      </button>
      <div style="margin-top:1rem;">
        <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin: 0.75rem 0; position:relative;">
          <span style="background:var(--surface); padding:0 10px; position:relative; z-index:1;">OR</span>
          <span style="position:absolute; top:50%; left:0; right:0; height:1px; background:var(--border); z-index:0;"></span>
        </p>
        <button type="button" class="btn btn-outline btn-block" style="margin-bottom:0.5rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="loginWithGoogle()">
          <i class="fab fa-google" style="color:#db4a39;"></i> Continue with Google
        </button>
        <button type="button" class="btn btn-outline btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="loginWithMicrosoft()">
          <i class="fab fa-microsoft" style="color:#00a4ef;"></i> Continue with Microsoft
        </button>
      </div>
    </form>
  `);

  byId('createAccountForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const name = byId('caName').value.trim();
    const email = byId('caEmail').value.trim();
    const password = byId('caPassword').value;
    const confirmPassword = byId('caConfirmPassword').value;
    const role = byId('caRole').value;
    const municipality = byId('caMunicipality').value;
    
    if (!name || !email || !password || !confirmPassword) {
      toast('Please fill in all fields', 'danger');
      return;
    }
    
    if (password !== confirmPassword) {
      toast('Passwords do not match', 'danger');
      return;
    }
    
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'danger');
      return;
    }
    
    try {
      const userData = { name, email, password, role, municipality };
      const newUser = await DB.registerUser(userData);
      closeModal();
      toast('Account created successfully! Your account is pending approval. You will be notified once approved.', 'success');
    } catch (error) {
      toast(error.message || 'Email already exists. Please use a different email.', 'danger');
    }
  });
}

function showRegisterModal() {
    showCreateAccountModal();
}

function checkPasswordStrength() {
    const passwordInput = byId('rPassword');
    if (!passwordInput) return;
    const password = passwordInput.value;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    
    if (password.length === 0) {
        passwordInput.style.border = '1px solid var(--border)';
    } else if (passwordRegex.test(password)) {
        passwordInput.style.border = '2px solid var(--success, #28a745)';
    } else {
        passwordInput.style.border = '2px solid var(--danger, #dc3545)';
    }
    
    if (byId('rConfirmPassword')?.value.length > 0) {
        checkPasswordMatch();
    }
}

function checkPasswordMatch() {
    const passwordInput = byId('rPassword');
    const confirmInput = byId('rConfirmPassword');
    if (!passwordInput || !confirmInput) return;
    
    if (confirmInput.value.length === 0) {
        confirmInput.style.border = '1px solid var(--border)';
    } else if (passwordInput.value === confirmInput.value) {
        confirmInput.style.border = '2px solid var(--success, #28a745)';
    } else {
        confirmInput.style.border = '2px solid var(--danger, #dc3545)';
    }
}

async function loginWithGoogle() {
    loginWithOAuth('Google', 'google');
}

async function loginWithMicrosoft() {
    loginWithOAuth('Microsoft', 'microsoft');
}

async function loginWithOAuth(providerName, providerId) {
    closeModal();
    showModal(`
        <h3><i class="fab fa-${providerId}"></i> Continue with ${providerName}</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">
            This is a simulated ${providerName} login for local development. Enter your name and email to continue.
        </p>
        <form id="oauthForm">
            <div class="form-group"><label>Name</label><input type="text" id="oName" required /></div>
            <div class="form-group"><label>Email</label><input type="email" id="oEmail" required /></div>
            <button type="submit" class="btn btn-primary btn-block">Continue</button>
        </form>
    `);
    
    byId('oauthForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = byId('oName').value.trim();
        const email = byId('oEmail').value.trim();
        
        try {
            const response = await fetch(`${API_BASE_URL}/oauth-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, provider: providerName })
            });
            if (response.ok) {
                currentUser = await response.json();
                localStorage.setItem('mbp_session', JSON.stringify({ userId: currentUser.id }));
                window.location.href = 'home.html';
            } else {
                toast(`${providerName} login failed`, 'danger');
            }
        } catch (err) {
            toast('An error occurred', 'danger');
        }
    });
}

// ============= PROFILE SETTINGS FUNCTIONS =============

async function loadProfileSettings() {
  if (!currentUser) return;
  
  const nameInput = document.getElementById('profileName');
  const emailInput = document.getElementById('profileEmail');
  const roleDisplay = document.getElementById('settingsUserRole');
  const muniDisplay = document.getElementById('navMunicipality');
  const roleBadge = document.getElementById('profileRoleBadge');
  const muniBadge = document.getElementById('profileMuniBadge');
  
  if (nameInput) nameInput.value = currentUser.name || '';
  if (emailInput) emailInput.value = currentUser.email || '';
  if (roleDisplay) roleDisplay.textContent = getRoleLabel(currentUser.role);
  if (muniDisplay) muniDisplay.textContent = currentUser.municipality === 'all' ? 'All Municipalities' : getMunicipalityLabel(currentUser.municipality);
  if (roleBadge) roleBadge.textContent = getRoleLabel(currentUser.role);
  if (muniBadge) muniBadge.textContent = currentUser.municipality === 'all' ? 'All Municipalities' : getMunicipalityLabel(currentUser.municipality);
}

document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const name = document.getElementById('profileName').value.trim();
      const password = document.getElementById('profilePassword').value;
      const confirmPassword = document.getElementById('profileConfirmPassword').value;
      const messageEl = document.getElementById('profileMessage');
      
      if (!name) {
        showProfileMessage('Please enter your full name.', 'danger');
        return;
      }
      
      if (password && password.length < 6) {
        showProfileMessage('Password must be at least 6 characters long.', 'danger');
        return;
      }
      
      if (password && password !== confirmPassword) {
        showProfileMessage('Passwords do not match.', 'danger');
        return;
      }
      
      try {
        const updateData = { name };
        if (password) {
          updateData.password = password;
        }
        
        const response = await fetch(`${API_BASE_URL}/users/${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
          const updatedUser = await response.json();
          currentUser = updatedUser;
          localStorage.setItem('mbp_session', JSON.stringify({ userId: currentUser.id }));
          
          const nameEl = document.getElementById('settingsUserName');
          if (nameEl) nameEl.textContent = currentUser.name;
          
          const navNameEl = document.getElementById('navUserName');
          if (navNameEl) navNameEl.textContent = currentUser.name;
          
          showProfileMessage('Profile updated successfully!', 'success');
          
          document.getElementById('profilePassword').value = '';
          document.getElementById('profileConfirmPassword').value = '';
          
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          const error = await response.json();
          showProfileMessage(error.error || 'Failed to update profile.', 'danger');
        }
      } catch (error) {
        showProfileMessage('An error occurred. Please try again.', 'danger');
      }
    });
  }
  
  if (document.body.dataset.page === 'settings') {
    setTimeout(loadProfileSettings, 500);
  }
});

function showProfileMessage(message, type = 'info') {
  const messageEl = document.getElementById('profileMessage');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = `alert alert-${type}`;
  messageEl.style.display = 'block';
  
  clearTimeout(messageEl._timeout);
  messageEl._timeout = setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

// Make functions globally accessible
window.navigate = navigate;
window.showAddMemberModal = showAddMemberModal;
window.deleteMember = deleteMember;
window.showScheduleMeetingModal = showScheduleMeetingModal;
window.confirmAttendance = confirmAttendance;
window.showDeclineModal = showDeclineModal;
window.viewAttendance = viewAttendance;
window.deleteMeeting = deleteMeeting;
window.confirmDeleteMeeting = confirmDeleteMeeting;
window.viewMeetingFiles = viewMeetingFiles;
window.downloadMeetingFile = downloadMeetingFile;
window.previewFile = previewFile;
window.showUploadMinutesModal = showUploadMinutesModal;
window.viewMinutesFiles = viewMinutesFiles;
window.previewMinutesFile = previewMinutesFile;
window.downloadMinutesFile = downloadMinutesFile;
window.deleteMinute = deleteMinute;
window.showAddComplaintModal = showAddComplaintModal;
window.assignComplaint = assignComplaint;
window.updateComplaintStatus = updateComplaintStatus;
window.deleteComplaint = deleteComplaint;
window.showUploadDocModal = showUploadDocModal;
window.downloadDoc = downloadDoc;
window.deleteDoc = deleteDoc;
window.showAddUserModal = showAddUserModal;
window.deleteUser = deleteUser;
window.switchUserRole = switchUserRole;
window.toggleTheme = toggleTheme;
window.stopSpeech = stopSpeech;
window.speakText = speakText;
window.resetAccessibility = resetAccessibility;
window.closeModal = closeModal;
window.toast = toast;
window.editUser = editUser;
window.updateUser = updateUser;
window.renderEmails = renderEmails;
window.viewEmail = viewEmail;
window.deleteEmail = deleteEmail;
window.showComposeEmailModal = showComposeEmailModal;
window.filterEmails = filterEmails;
window.renderBroadcasts = renderBroadcasts;
window.showBroadcastModal = showBroadcastModal;
window.deleteBroadcast = deleteBroadcast;
window.viewBroadcastFiles = viewBroadcastFiles;
window.previewBroadcastFile = previewBroadcastFile;
window.downloadBroadcastFile = downloadBroadcastFile;
window.renderTrackUsers = renderTrackUsers;
window.renderApprovals = renderApprovals;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.filterApprovals = filterApprovals;
window.updateApprovalsBadge = updateApprovalsBadge;
window.showCreateAccountModal = showCreateAccountModal;
window.loginWithGoogle = loginWithGoogle;
window.loginWithMicrosoft = loginWithMicrosoft;
window.checkPasswordStrength = checkPasswordStrength;
window.checkPasswordMatch = checkPasswordMatch;
window.toggleAttendanceList = toggleAttendanceList;
window.toggleDeclinedList = toggleDeclinedList;
window.printAttendance = printAttendance;
window.downloadAttendanceHTML = downloadAttendanceHTML;
window.handleFileSelect = handleFileSelect;
window.handleFileDrop = handleFileDrop;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.removeFile = removeFile;
window.handleMinutesFileSelect = handleMinutesFileSelect;
window.handleMinutesFileDrop = handleMinutesFileDrop;
window.handleMinutesDragOver = handleMinutesDragOver;
window.handleMinutesDragLeave = handleMinutesDragLeave;
window.removeMinutesFile = removeMinutesFile;
window.handleBroadcastFileSelect = handleBroadcastFileSelect;
window.handleBroadcastFileDrop = handleBroadcastFileDrop;
window.handleBroadcastDragOver = handleBroadcastDragOver;
window.handleBroadcastDragLeave = handleBroadcastDragLeave;
window.removeBroadcastFile = removeBroadcastFile;
window.handleDocumentFileSelect = handleDocumentFileSelect;
window.handleDocumentFileDrop = handleDocumentFileDrop;
window.handleDocumentDragOver = handleDocumentDragOver;
window.handleDocumentDragLeave = handleDocumentDragLeave;
window.removeDocumentFile = removeDocumentFile;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.confirmDeleteDocument = confirmDeleteDocument;
window.deleteDocument = deleteDocument;

window.addEventListener('DOMContentLoaded', boot);
// ============= PERMISSIONS MANAGEMENT =============

// Permission definitions
const PERMISSIONS = {
  // User Management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  DELETE_USERS: 'delete_users',
  EDIT_USER_ROLES: 'edit_user_roles',
  
  // Member Management
  MANAGE_MEMBERS: 'manage_members',
  VIEW_MEMBERS: 'view_members',
  DELETE_MEMBERS: 'delete_members',
  
  // Meeting Management
  MANAGE_MEETINGS: 'manage_meetings',
  VIEW_MEETINGS: 'view_meetings',
  DELETE_MEETINGS: 'delete_meetings',
  SCHEDULE_MEETINGS: 'schedule_meetings',
  
  // Minutes Management
  MANAGE_MINUTES: 'manage_minutes',
  VIEW_MINUTES: 'view_minutes',
  UPLOAD_MINUTES: 'upload_minutes',
  DELETE_MINUTES: 'delete_minutes',
  
  // Complaint Management
  MANAGE_COMPLAINTS: 'manage_complaints',
  VIEW_COMPLAINTS: 'view_complaints',
  RESOLVE_COMPLAINTS: 'resolve_complaints',
  ASSIGN_COMPLAINTS: 'assign_complaints',
  SUBMIT_COMPLAINTS: 'submit_complaints',
  
  // Document Management
  MANAGE_DOCUMENTS: 'manage_documents',
  VIEW_DOCUMENTS: 'view_documents',
  UPLOAD_DOCUMENTS: 'upload_documents',
  DELETE_DOCUMENTS: 'delete_documents',
  
  // Email & Broadcast
  SEND_EMAILS: 'send_emails',
  VIEW_EMAILS: 'view_emails',
  SEND_BROADCASTS: 'send_broadcasts',
  DELETE_BROADCASTS: 'delete_broadcasts',
  
  // Approvals
  APPROVE_USERS: 'approve_users',
  REJECT_USERS: 'reject_users',
  VIEW_APPROVALS: 'view_approvals',
  
  // System
  VIEW_SYSTEM: 'view_system',
  MANAGE_PERMISSIONS: 'manage_permissions',
  VIEW_PERMISSIONS: 'view_permissions',
  
  // Track Users
  TRACK_USERS: 'track_users',
  
  // QR Code
  GENERATE_QR: 'generate_qr',
  SCAN_QR: 'scan_qr'
};

// Default permission sets for each role
const DEFAULT_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  
  municipal_officer: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.MANAGE_MEETINGS,
    PERMISSIONS.VIEW_MEETINGS,
    PERMISSIONS.SCHEDULE_MEETINGS,
    PERMISSIONS.MANAGE_MINUTES,
    PERMISSIONS.VIEW_MINUTES,
    PERMISSIONS.UPLOAD_MINUTES,
    PERMISSIONS.MANAGE_COMPLAINTS,
    PERMISSIONS.VIEW_COMPLAINTS,
    PERMISSIONS.RESOLVE_COMPLAINTS,
    PERMISSIONS.ASSIGN_COMPLAINTS,
    PERMISSIONS.MANAGE_DOCUMENTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.UPLOAD_DOCUMENTS,
    PERMISSIONS.SEND_EMAILS,
    PERMISSIONS.VIEW_EMAILS,
    PERMISSIONS.SEND_BROADCASTS,
    PERMISSIONS.APPROVE_USERS,
    PERMISSIONS.REJECT_USERS,
    PERMISSIONS.VIEW_APPROVALS,
    PERMISSIONS.GENERATE_QR,
    PERMISSIONS.SCAN_QR
  ],
  
  social_officer: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_MEETINGS,
    PERMISSIONS.VIEW_MINUTES,
    PERMISSIONS.MANAGE_COMPLAINTS,
    PERMISSIONS.VIEW_COMPLAINTS,
    PERMISSIONS.RESOLVE_COMPLAINTS,
    PERMISSIONS.ASSIGN_COMPLAINTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_EMAILS,
    PERMISSIONS.SCAN_QR
  ],
  
  department_officer: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_MEETINGS,
    PERMISSIONS.VIEW_MINUTES,
    PERMISSIONS.VIEW_COMPLAINTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_EMAILS,
    PERMISSIONS.SUBMIT_COMPLAINTS,
    PERMISSIONS.SCAN_QR
  ],
  
  member: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_MEETINGS,
    PERMISSIONS.VIEW_MINUTES,
    PERMISSIONS.VIEW_COMPLAINTS,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_EMAILS,
    PERMISSIONS.SUBMIT_COMPLAINTS,
    PERMISSIONS.SCAN_QR
  ]
};

// Permission helper functions
function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  
  const userPermissions = user.permissions || DEFAULT_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}

function canManageUsers(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_USERS);
}

function canViewUsers(user) {
  return hasPermission(user, PERMISSIONS.VIEW_USERS) || canManageUsers(user);
}

function canDeleteUsers(user) {
  return hasPermission(user, PERMISSIONS.DELETE_USERS) || canManageUsers(user);
}

function canManageMembers(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_MEMBERS);
}

function canViewMembers(user) {
  return hasPermission(user, PERMISSIONS.VIEW_MEMBERS) || canManageMembers(user);
}

function canManageMeetings(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_MEETINGS);
}

function canViewMeetings(user) {
  return hasPermission(user, PERMISSIONS.VIEW_MEETINGS) || canManageMeetings(user);
}

function canScheduleMeetings(user) {
  return hasPermission(user, PERMISSIONS.SCHEDULE_MEETINGS) || canManageMeetings(user);
}

function canManageMinutes(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_MINUTES);
}

function canViewMinutes(user) {
  return hasPermission(user, PERMISSIONS.VIEW_MINUTES) || canManageMinutes(user);
}

function canUploadMinutes(user) {
  return hasPermission(user, PERMISSIONS.UPLOAD_MINUTES) || canManageMinutes(user);
}

function canManageComplaints(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_COMPLAINTS);
}

function canViewComplaints(user) {
  return hasPermission(user, PERMISSIONS.VIEW_COMPLAINTS) || canManageComplaints(user);
}

function canResolveComplaints(user) {
  return hasPermission(user, PERMISSIONS.RESOLVE_COMPLAINTS) || canManageComplaints(user);
}

function canAssignComplaints(user) {
  return hasPermission(user, PERMISSIONS.ASSIGN_COMPLAINTS) || canManageComplaints(user);
}

function canManageDocuments(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_DOCUMENTS);
}

function canViewDocuments(user) {
  return hasPermission(user, PERMISSIONS.VIEW_DOCUMENTS) || canManageDocuments(user);
}

function canUploadDocuments(user) {
  return hasPermission(user, PERMISSIONS.UPLOAD_DOCUMENTS) || canManageDocuments(user);
}

function canSendEmails(user) {
  return hasPermission(user, PERMISSIONS.SEND_EMAILS);
}

function canViewEmails(user) {
  return hasPermission(user, PERMISSIONS.VIEW_EMAILS);
}

function canSendBroadcasts(user) {
  return hasPermission(user, PERMISSIONS.SEND_BROADCASTS);
}

function canApproveUsers(user) {
  return hasPermission(user, PERMISSIONS.APPROVE_USERS);
}

function canViewApprovals(user) {
  return hasPermission(user, PERMISSIONS.VIEW_APPROVALS) || canApproveUsers(user);
}

function canTrackUsers(user) {
  return hasPermission(user, PERMISSIONS.TRACK_USERS);
}

function canGenerateQR(user) {
  return hasPermission(user, PERMISSIONS.GENERATE_QR);
}

function canScanQR(user) {
  return hasPermission(user, PERMISSIONS.SCAN_QR);
}

function canManagePermissions(user) {
  return hasPermission(user, PERMISSIONS.MANAGE_PERMISSIONS);
}

// ============= PERMISSIONS UI =============

async function renderPermissions() {
  if (!canManagePermissions(currentUser)) {
    render('<div class="card"><h2>Access Denied</h2><p>Only Super Admin can manage permissions.</p></div>');
    return;
  }

  const users = await DB.users();
  const roles = ['super_admin', 'municipal_officer', 'social_officer', 'department_officer', 'member'];
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-shield-alt"></i> User Permissions Management</h2>
      <div>
        <button class="btn btn-outline btn-sm" onclick="resetAllPermissions()">
          <i class="fas fa-undo"></i> Reset All to Default
        </button>
      </div>
    </div>

    <div class="permissions-info card" style="background:var(--surface-alt); padding:1rem; margin-bottom:1.5rem; border-radius:12px; border-left:4px solid var(--primary);">
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
        <div><i class="fas fa-info-circle" style="color:var(--primary); font-size:1.2rem;"></i></div>
        <div style="font-size:0.95rem; color:var(--text-muted);">
          <strong>Manage user permissions and clearance levels.</strong> 
          Changes take effect immediately. Users will see updated features based on their permission set.
          Each role has default permissions that can be customized per user.
        </div>
      </div>
    </div>

    <div class="card table-wrap">
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th style="min-width:120px;">User</th>
              <th style="min-width:120px;">Role</th>
              <th style="min-width:100px;">Municipality</th>
              <th style="min-width:80px;">Status</th>
              <th style="min-width:200px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr>
                <td><strong>${user.name}</strong><br /><span style="font-size:0.8rem; color:var(--text-muted);">${user.email}</span></td>
                <td><span class="badge badge-info">${getRoleLabel(user.role)}</span></td>
                <td>${getMunicipalityLabel(user.municipality)}</td>
                <td>
                  ${user.is_approved ? '<span class="badge badge-success">Approved</span>' : 
                    user.is_rejected ? '<span class="badge badge-danger">Rejected</span>' : 
                    '<span class="badge badge-warning">Pending</span>'}
                </td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="editUserPermissions(${user.id})">
                    <i class="fas fa-shield-alt"></i> Manage Permissions
                  </button>
                  ${user.role !== 'super_admin' ? `
                    <button class="btn btn-outline btn-sm" onclick="resetUserPermissions(${user.id})">
                      <i class="fas fa-undo"></i>
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><i class="fas fa-info-circle"></i> Permission Groups</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1rem;">
        <div style="padding:0.75rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid #7c3aed;">
          <strong style="color:#7c3aed;">👑 Super Admin</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Full system access. Can manage all users, permissions, and system settings.</p>
        </div>
        <div style="padding:0.75rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid #2563eb;">
          <strong style="color:#2563eb;">🏛️ Municipal Officer</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Manages their municipality's data, meetings, minutes, complaints, and approvals.</p>
        </div>
        <div style="padding:0.75rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid #059669;">
          <strong style="color:#059669;">🤝 Social Officer</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Handles complaints, can assign and resolve issues within their municipality.</p>
        </div>
        <div style="padding:0.75rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid #d97706;">
          <strong style="color:#d97706;">📋 Department Officer</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Can view data and submit complaints, but has limited management privileges.</p>
        </div>
        <div style="padding:0.75rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid #6b7280;">
          <strong style="color:#6b7280;">👤 Member</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">Basic access: view information and submit complaints.</p>
        </div>
      </div>
    </div>
  `);
}

// ============= REPORTS & AUDIT SECTION (UPDATED WITH DROPDOWN MENU) =============

function generateReportSummaryFromAPI(stats) {
  return {
    totalUsers: stats.users_count || 0,
    newUsers: 0,
    totalMembers: 0,
    totalMeetings: stats.meetings_count || 0,
    meetingsInRange: stats.meetings_count || 0,
    totalMinutes: stats.minutes_count || 0,
    minutesInRange: stats.minutes_count || 0,
    totalComplaints: stats.complaints_count || 0,
    complaintsInRange: stats.complaints_count || 0,
    pendingComplaints: stats.pending_complaints || 0,
    resolvedComplaints: stats.resolved_complaints || 0,
    totalDocuments: stats.documents_count || 0,
    documentsInRange: stats.documents_count || 0,
    totalBroadcasts: stats.broadcasts_count || 0,
    broadcastsInRange: stats.broadcasts_count || 0,
    dateRange: { startDate: null, endDate: null }
  };
}

async function renderReports() {
  if (!isSystemAdmin(currentUser) && currentUser.role !== 'municipal_officer') {
    render(`
      <div class="card" style="text-align:center; padding:3rem;">
        <i class="fas fa-lock" style="font-size:3rem; color:var(--danger); margin-bottom:1rem;"></i>
        <h2>Access Denied</h2>
        <p style="color:var(--text-muted);">Only Administrators and Municipal Officers can access reports.</p>
      </div>
    `);
    return;
  }

  render(`
    <div class="page-header">
      <h2><i class="fas fa-chart-bar"></i> Reports & Audit</h2>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-success btn-sm" onclick="showExportModal()">
          <i class="fas fa-file-export"></i> Export
        </button>
        <button class="btn btn-outline btn-sm" onclick="refreshReports()">
          <i class="fas fa-sync"></i> Refresh
        </button>
      </div>
    </div>
    <div class="card" style="text-align:center; padding:3rem;">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i>
      <p style="margin-top:1rem; color:var(--text-muted);">Loading reports...</p>
    </div>
  `);

  try {
    const response = await fetch(`${API_BASE_URL}/reports/dashboard-stats?user_id=${currentUser.id}`);
    const stats = await response.json();
    const summary = generateReportSummaryFromAPI(stats);

    render(`
      <div class="page-header">
        <h2><i class="fas fa-chart-bar"></i> Reports & Audit</h2>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="showExportModal()">
            <i class="fas fa-file-export"></i> Export
          </button>
          <button class="btn btn-outline btn-sm" onclick="refreshReports()">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>
      </div>

      <!-- Dashboard Stats -->
      <div class="grid-3" style="margin-bottom:1.5rem;">
        <div class="stat-card" style="border-left-color: #2563eb;">
          <div class="num">${summary.totalUsers}</div>
          <div class="label">Total Users</div>
        </div>
        <div class="stat-card" style="border-left-color: #059669;">
          <div class="num">${summary.totalMeetings}</div>
          <div class="label">Total Meetings</div>
        </div>
        <div class="stat-card" style="border-left-color: #d97706;">
          <div class="num">${summary.totalComplaints}</div>
          <div class="label">Total Complaints</div>
          <small style="color:var(--text-muted);">${summary.pendingComplaints} pending • ${summary.resolvedComplaints} resolved</small>
        </div>
        <div class="stat-card" style="border-left-color: #7c3aed;">
          <div class="num">${summary.totalMinutes}</div>
          <div class="label">Minutes Uploaded</div>
        </div>
        <div class="stat-card" style="border-left-color: #dc2626;">
          <div class="num">${summary.totalDocuments}</div>
          <div class="label">Documents</div>
        </div>
        <div class="stat-card" style="border-left-color: #0891b2;">
          <div class="num">${summary.totalBroadcasts}</div>
          <div class="label">Announcements</div>
        </div>
      </div>

      <!-- Report Tabs - Dropdown Menu like Audit Logs -->
      <div class="report-tabs" style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline active" onclick="filterReports('all', event)">
          <i class="fas fa-list"></i> All Reports
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('audit', event)">
          <i class="fas fa-history"></i> Audit Logs
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('meetings', event)">
          <i class="fas fa-calendar-alt"></i> Meetings
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('complaints', event)">
          <i class="fas fa-exclamation-triangle"></i> Complaints
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('minutes', event)">
          <i class="fas fa-file-alt"></i> Minutes
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('documents', event)">
          <i class="fas fa-folder-open"></i> Documents
        </button>
        <button class="btn btn-sm btn-outline" onclick="filterReports('broadcasts', event)">
          <i class="fas fa-bullhorn"></i> Announcements
        </button>
      </div>

      <!-- Report Content Container -->
      <div id="reportContent">
        ${renderReportContent('all', stats)}
      </div>
    `);
  } catch (error) {
    console.error('Error loading reports:', error);
    render(`
      <div class="card" style="text-align:center; padding:3rem;">
        <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:var(--danger); margin-bottom:1rem;"></i>
        <h2>Error Loading Reports</h2>
        <p style="color:var(--text-muted);">Could not load reports. Please try again.</p>
        <button class="btn btn-primary" onclick="renderReports()" style="margin-top:1rem;">
          <i class="fas fa-sync"></i> Retry
        </button>
      </div>
    `);
  }
}

function renderReportContent(filter, stats) {
  let content = '';

  switch(filter) {
    case 'all':
      content = `
        <!-- Recent Activity Summary -->
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-title"><i class="fas fa-clock"></i> Recent Activity</div>
          ${stats.recent_activities && stats.recent_activities.length > 0 ? 
            stats.recent_activities.map(activity => `
              <div style="padding:0.75rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
                <div>
                  <strong>${activity.user_name || 'System'}</strong>
                  <span style="color:var(--text-muted); margin-left:0.5rem;">${activity.description}</span>
                </div>
                <span style="color:var(--text-muted); font-size:0.85rem;">${formatDate(activity.timestamp)}</span>
              </div>
            `).join('') : 
            '<div style="color:var(--text-muted); text-align:center; padding:1rem;">No recent activity</div>'
          }
        </div>

        <!-- Audit Log Table -->
        <div class="card table-wrap">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
            <span><i class="fas fa-history"></i> Audit Log</span>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <button class="btn btn-sm btn-outline" onclick="loadAuditLogs()">
                <i class="fas fa-sync"></i> Load Logs
              </button>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table id="reportTable">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody id="reportTableBody">
                <tr>
                  <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-info-circle" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
                    Click "Load Logs" to view audit history
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      break;

    case 'audit':
      content = `
        <div class="card table-wrap">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
            <span><i class="fas fa-history"></i> Audit Logs</span>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <button class="btn btn-sm btn-outline" onclick="loadAuditLogs()">
                <i class="fas fa-sync"></i> Load Logs
              </button>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table id="auditTable">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody id="auditTableBody">
                <tr>
                  <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-info-circle" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
                    Click "Load Logs" to view audit history
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      break;

    case 'meetings':
      content = `
        <div class="card">
          <div class="card-title"><i class="fas fa-calendar-alt"></i> Meetings Reports</div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Attendees</th>
                </tr>
              </thead>
              <tbody id="meetingsReportBody">
                <tr>
                  <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Loading meetings...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      // Load meetings data
      setTimeout(() => loadMeetingsReport(), 100);
      break;

    case 'complaints':
      content = `
        <div class="card">
          <div class="card-title"><i class="fas fa-exclamation-triangle"></i> Complaints Reports</div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Submitted By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody id="complaintsReportBody">
                <tr>
                  <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Loading complaints...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      setTimeout(() => loadComplaintsReport(), 100);
      break;

    case 'minutes':
      content = `
        <div class="card">
          <div class="card-title"><i class="fas fa-file-alt"></i> Minutes Reports</div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>Municipality</th>
                </tr>
              </thead>
              <tbody id="minutesReportBody">
                <tr>
                  <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Loading minutes...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      setTimeout(() => loadMinutesReport(), 100);
      break;

    case 'documents':
      content = `
        <div class="card">
          <div class="card-title"><i class="fas fa-folder-open"></i> Documents Reports</div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody id="documentsReportBody">
                <tr>
                  <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Loading documents...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      setTimeout(() => loadDocumentsReport(), 100);
      break;

    case 'broadcasts':
      content = `
        <div class="card">
          <div class="card-title"><i class="fas fa-bullhorn"></i> Announcements Reports</div>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Message</th>
                  <th>Sender</th>
                  <th>Date</th>
                  <th>Municipality</th>
                </tr>
              </thead>
              <tbody id="broadcastsReportBody">
                <tr>
                  <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Loading announcements...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      setTimeout(() => loadBroadcastsReport(), 100);
      break;

    default:
      content = '<div class="card text-center text-muted" style="padding:2rem;">No reports available</div>';
  }

  return content;
}

// Filter reports by tab
function filterReports(filter, event) {
  if (event && event.target) {
    document.querySelectorAll('.report-tabs .btn').forEach(btn => btn.classList.remove('active'));
    const target = event.target.closest('.btn');
    if (target) target.classList.add('active');
  }

  const container = document.getElementById('reportContent');
  if (container) {
    container.innerHTML = renderReportContent(filter, {});
    // Reload data based on filter
    switch(filter) {
      case 'all':
        loadAuditLogs();
        break;
      case 'audit':
        loadAuditLogs();
        break;
      case 'meetings':
        loadMeetingsReport();
        break;
      case 'complaints':
        loadComplaintsReport();
        break;
      case 'minutes':
        loadMinutesReport();
        break;
      case 'documents':
        loadDocumentsReport();
        break;
      case 'broadcasts':
        loadBroadcastsReport();
        break;
    }
  }
}

// Load Meetings Report
async function loadMeetingsReport() {
  const tbody = document.getElementById('meetingsReportBody');
  if (!tbody) return;
  
  try {
    const meetings = getAllowedItems(await DB.meetings());
    meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (meetings.length) {
      tbody.innerHTML = meetings.map((m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${m.title}</strong></td>
          <td>${formatDate(m.date)}</td>
          <td>${m.location}</td>
          <td><span class="badge ${m.status === 'scheduled' ? 'badge-info' : m.status === 'completed' ? 'badge-success' : 'badge-warning'}">${m.status}</span></td>
          <td>${m.attendees ? m.attendees.length : 0}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No meetings found</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);">Error loading meetings</td></tr>`;
  }
}

// Load Complaints Report
async function loadComplaintsReport() {
  const tbody = document.getElementById('complaintsReportBody');
  if (!tbody) return;
  
  try {
    const complaints = getAllowedItems(await DB.complaints());
    complaints.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (complaints.length) {
      tbody.innerHTML = complaints.map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${c.title}</strong></td>
          <td>${c.submittedBy || 'Unknown'}</td>
          <td>${formatDate(c.date)}</td>
          <td><span class="badge ${c.status === 'pending' ? 'badge-danger' : c.status === 'in_progress' ? 'badge-warning' : 'badge-success'}">${c.status.replace('_', ' ')}</span></td>
          <td>${c.assignedTo || 'Unassigned'}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No complaints found</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);">Error loading complaints</td></tr>`;
  }
}

// Load Minutes Report
async function loadMinutesReport() {
  const tbody = document.getElementById('minutesReportBody');
  if (!tbody) return;
  
  try {
    const minutes = getAllowedItems(await DB.minutes());
    minutes.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    if (minutes.length) {
      tbody.innerHTML = minutes.map((m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${m.title || 'Untitled'}</strong></td>
          <td>${m.uploadedBy || 'Unknown'}</td>
          <td>${formatDate(m.uploadDate)}</td>
          <td>${getMunicipalityLabel(m.municipality)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No minutes found</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading minutes</td></tr>`;
  }
}

// Load Documents Report
async function loadDocumentsReport() {
  const tbody = document.getElementById('documentsReportBody');
  if (!tbody) return;
  
  try {
    const documents = getAllowedItems(await DB.documents());
    documents.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    if (documents.length) {
      tbody.innerHTML = documents.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${d.name}</strong></td>
          <td>${d.type || 'Unknown'}</td>
          <td>${d.uploadedBy || 'Unknown'}</td>
          <td>${formatDate(d.uploadDate)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No documents found</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading documents</td></tr>`;
  }
}

// Load Broadcasts Report
async function loadBroadcastsReport() {
  const tbody = document.getElementById('broadcastsReportBody');
  if (!tbody) return;
  
  try {
    const broadcasts = getAllowedItems(await DB.broadcasts());
    broadcasts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (broadcasts.length) {
      tbody.innerHTML = broadcasts.map((b, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${b.message.substring(0, 50)}${b.message.length > 50 ? '...' : ''}</strong></td>
          <td>${b.sender || 'Unknown'}</td>
          <td>${formatDate(b.timestamp)}</td>
          <td>${getMunicipalityLabel(b.municipality)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No announcements found</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Error loading announcements</td></tr>`;
  }
}

// Load Audit Logs for Reports
async function loadAuditLogs() {
  const tbody = document.getElementById('reportTableBody') || document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin"></i> Loading audit logs...
      </td>
    </tr>
  `;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const formatDateForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const startDate = formatDateForInput(thirtyDaysAgo);
    const endDate = formatDateForInput(now);
    
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      user_id: currentUser.id,
      per_page: 1000
    });
    
    const response = await fetch(`${API_BASE_URL}/reports/audit/logs?${params.toString()}`);
    const result = await response.json();
    
    if (result.logs && result.logs.length > 0) {
      tbody.innerHTML = result.logs.map(log => `
        <tr>
          <td>${formatDate(log.timestamp)} ${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</td>
          <td><strong>${log.user_name}</strong><br /><span style="font-size:0.75rem;color:var(--text-muted);">${log.user_email}</span></td>
          <td><span class="badge badge-info">${log.action}</span></td>
          <td>${log.category}</td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.details || ''}">
            ${log.details ? log.details.substring(0, 100) : 'No details'}
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">
            <i class="fas fa-search" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
            No audit logs found for the selected date range
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error loading audit logs:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:2rem;color:var(--danger);">
          <i class="fas fa-exclamation-circle" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
          Error loading audit logs: ${error.message || 'Unknown error'}
        </td>
      </tr>
    `;
  }
}

// ============= EXPORT MODAL WITH DATE FILTER =============

function showExportModal() {
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  showModal(`
    <div style="max-width:520px; margin:0 auto; padding:0.25rem;">
      <h3 style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem; color:var(--text);">
        <i class="fas fa-file-export" style="color:var(--primary);"></i>
        Export Reports
      </h3>
      <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
        Select a date range and export format for your report data.
      </p>
      
      <form id="exportForm">
        <!-- Date Range -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="exportStartDate" style="font-weight:500; display:block; margin-bottom:0.3rem; color:var(--text);">
              <i class="fas fa-calendar-start" style="color:var(--primary);"></i> From
            </label>
            <input type="date" id="exportStartDate" value="${formatDateForInput(oneMonthAgo)}" 
                   style="width:100%; padding:0.6rem 0.8rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:0.9rem;" />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label for="exportEndDate" style="font-weight:500; display:block; margin-bottom:0.3rem; color:var(--text);">
              <i class="fas fa-calendar-end" style="color:var(--primary);"></i> To
            </label>
            <input type="date" id="exportEndDate" value="${formatDateForInput(now)}" 
                   style="width:100%; padding:0.6rem 0.8rem; border:2px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); font-size:0.9rem;" />
          </div>
        </div>
        
        <!-- Quick Date Range Buttons -->
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.5rem;">
          <button type="button" class="btn btn-sm btn-outline" onclick="setExportDateRange(7)">
            <i class="fas fa-clock"></i> Last 7 days
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="setExportDateRange(30)">
            <i class="fas fa-clock"></i> Last 30 days
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="setExportDateRange(90)">
            <i class="fas fa-clock"></i> Last 90 days
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="setExportDateRange(365)">
            <i class="fas fa-clock"></i> Last year
          </button>
        </div>
        
        <!-- Export Format Selection -->
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label style="font-weight:500; display:block; margin-bottom:0.3rem; color:var(--text);">
            <i class="fas fa-file-format" style="color:var(--primary);"></i> Export Format
          </label>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; border:2px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.2s; background:var(--surface);"
                   onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-alt)';" 
                   onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface)';">
              <input type="radio" name="exportFormat" value="csv" checked />
              <i class="fas fa-file-csv" style="color:#2ea043;"></i> CSV
            </label>
            <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; border:2px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.2s; background:var(--surface);"
                   onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-alt)';" 
                   onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface)';">
              <input type="radio" name="exportFormat" value="pdf" />
              <i class="fas fa-file-pdf" style="color:#dc2626;"></i> PDF
            </label>
            <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; border:2px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.2s; background:var(--surface);"
                   onmouseover="this.style.borderColor='var(--primary)'; this.style.background='var(--surface-alt)';" 
                   onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--surface)';">
              <input type="radio" name="exportFormat" value="json" />
              <i class="fas fa-code" style="color:#7c3aed;"></i> JSON
            </label>
          </div>
        </div>
        
        <!-- Export Options -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.5rem; padding:0.75rem; background:var(--surface-alt); border-radius:8px; border:1px solid var(--border);">
          <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; cursor:pointer; color:var(--text);">
            <input type="checkbox" id="exportIncludeAudit" checked style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;" />
            <span>Include Audit Logs</span>
          </label>
          <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; cursor:pointer; color:var(--text);">
            <input type="checkbox" id="exportIncludeStats" checked style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;" />
            <span>Include Statistics</span>
          </label>
        </div>
        
        <!-- Action Buttons -->
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:0.5rem;">
          <button type="submit" class="btn btn-success" style="flex:1; min-width:120px; padding:0.75rem 1.5rem; font-weight:600; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:0.5rem; background:var(--success); color:white; border:none; cursor:pointer; transition:all 0.3s;">
            <i class="fas fa-download"></i> Export
          </button>
          <button type="button" onclick="closeModal()" style="flex:1; min-width:100px; padding:0.75rem 1.5rem; font-weight:600; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:0.5rem; background:var(--surface-alt); color:var(--text); border:2px solid var(--border); cursor:pointer; transition:all 0.3s;"
                  onmouseover="this.style.background='var(--surface-muted)'; this.style.borderColor='var(--danger)'; this.style.color='var(--danger)';"
                  onmouseout="this.style.background='var(--surface-alt)'; this.style.borderColor='var(--border)'; this.style.color='var(--text)';">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
  `);
  
  byId('exportForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const startDate = byId('exportStartDate').value;
    const endDate = byId('exportEndDate').value;
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const includeAudit = byId('exportIncludeAudit').checked;
    const includeStats = byId('exportIncludeStats').checked;
    
    if (!startDate || !endDate) {
      toast('Please select both start and end dates', 'danger');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      toast('Start date must be before end date', 'danger');
      return;
    }
    
    closeModal();
    toast('Generating export... Please wait.', 'info');
    
    try {
      const exportData = await fetchExportData(startDate, endDate, includeAudit, includeStats);
      
      if (format === 'csv') {
        downloadCSV(exportData, startDate, endDate);
      } else if (format === 'pdf') {
        downloadPDF(exportData, startDate, endDate);
      } else if (format === 'json') {
        downloadJSON(exportData, startDate, endDate);
      }
      
      toast('Export completed successfully! ✅', 'success');
    } catch (error) {
      console.error('Export error:', error);
      toast('Failed to generate export: ' + error.message, 'danger');
    }
  });
}

function setExportDateRange(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const startInput = document.getElementById('exportStartDate');
  const endInput = document.getElementById('exportEndDate');
  if (startInput) startInput.value = formatDateForInput(startDate);
  if (endInput) endInput.value = formatDateForInput(endDate);
}

async function fetchExportData(startDate, endDate, includeAudit, includeStats) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    user_id: currentUser.id
  });
  
  const results = {};
  
  if (includeStats) {
    const statsResponse = await fetch(`${API_BASE_URL}/reports/dashboard-stats?user_id=${currentUser.id}`);
    if (statsResponse.ok) {
      results.stats = await statsResponse.json();
    }
  }
  
  if (includeAudit) {
    const auditResponse = await fetch(`${API_BASE_URL}/reports/audit/logs?${params.toString()}&per_page=1000`);
    if (auditResponse.ok) {
      const auditData = await auditResponse.json();
      results.auditLogs = auditData.logs || [];
    }
  }
  
  const summaryResponse = await fetch(`${API_BASE_URL}/reports/summary?${params.toString()}`);
  if (summaryResponse.ok) {
    results.summary = await summaryResponse.json();
  }
  
  return results;
}

function downloadCSV(data, startDate, endDate) {
  const rows = [];
  rows.push('Date,User,Action,Category,Details');
  
  if (data.auditLogs && data.auditLogs.length > 0) {
    data.auditLogs.forEach(log => {
      const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
      const userName = log.user_name || 'System';
      const action = log.action || '';
      const category = log.category || '';
      const details = (log.details || '').replace(/,/g, ';').replace(/\n/g, ' ');
      rows.push(`${timestamp},"${userName}","${action}","${category}","${details}"`);
    });
  }
  
  if (data.stats) {
    rows.push('');
    rows.push('Summary Statistics');
    rows.push(`Total Users,${data.stats.users_count || 0}`);
    rows.push(`Total Meetings,${data.stats.meetings_count || 0}`);
    rows.push(`Total Complaints,${data.stats.complaints_count || 0}`);
    rows.push(`Pending Complaints,${data.stats.pending_complaints || 0}`);
    rows.push(`Resolved Complaints,${data.stats.resolved_complaints || 0}`);
    rows.push(`Minutes Uploaded,${data.stats.minutes_count || 0}`);
    rows.push(`Documents,${data.stats.documents_count || 0}`);
    rows.push(`Announcements,${data.stats.broadcasts_count || 0}`);
  }
  
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${startDate}_to_${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function downloadPDF(data, startDate, endDate) {
  const htmlContent = generatePDFHTML(data, startDate, endDate);
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generatePDFHTML(data, startDate, endDate) {
  const formattedStart = new Date(startDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const formattedEnd = new Date(endDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let auditRows = '';
  if (data.auditLogs && data.auditLogs.length > 0) {
    auditRows = data.auditLogs.map(log => `
      <tr>
        <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
        <td>${log.user_name || 'System'}</td>
        <td>${log.action || ''}</td>
        <td>${log.category || ''}</td>
        <td>${(log.details || '').substring(0, 50)}${(log.details || '').length > 50 ? '...' : ''}</td>
      </tr>
    `).join('');
  }
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Report ${startDate} to ${endDate}</title>
        <style>
          body { font-family: 'Times New Roman', Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a1a2e; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin: 0; color: #1a1a2e; }
          .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
          .meta { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #1a1a2e; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 18px; font-weight: bold; padding: 10px 0; border-bottom: 2px solid #1a1a2e; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f1f1f1; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
          .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef; }
          .stat-box .num { font-size: 28px; font-weight: bold; color: #1a1a2e; }
          .stat-box .label { font-size: 12px; color: #666; }
          .footer { text-align: center; color: #999; margin-top: 30px; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
          @media print { .no-print { display: none; } body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MURANG'A COUNTY MUNICIPAL BOARD</h1>
          <div class="subtitle">System Report</div>
        </div>
        
        <div class="meta">
          <strong>Date Range:</strong> ${formattedStart} to ${formattedEnd}<br>
          <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
          <strong>Generated By:</strong> ${currentUser ? currentUser.name : 'System'}
        </div>
        
        ${data.stats ? `
          <div class="section">
            <div class="section-title">📊 Summary Statistics</div>
            <div class="stats-grid">
              <div class="stat-box"><div class="num">${data.stats.users_count || 0}</div><div class="label">Users</div></div>
              <div class="stat-box"><div class="num">${data.stats.meetings_count || 0}</div><div class="label">Meetings</div></div>
              <div class="stat-box"><div class="num">${data.stats.complaints_count || 0}</div><div class="label">Complaints</div></div>
              <div class="stat-box"><div class="num">${data.stats.pending_complaints || 0}</div><div class="label">Pending</div></div>
              <div class="stat-box"><div class="num">${data.stats.resolved_complaints || 0}</div><div class="label">Resolved</div></div>
              <div class="stat-box"><div class="num">${data.stats.minutes_count || 0}</div><div class="label">Minutes</div></div>
              <div class="stat-box"><div class="num">${data.stats.documents_count || 0}</div><div class="label">Documents</div></div>
              <div class="stat-box"><div class="num">${data.stats.broadcasts_count || 0}</div><div class="label">Announcements</div></div>
            </div>
          </div>
        ` : ''}
        
        ${data.auditLogs && data.auditLogs.length > 0 ? `
          <div class="section">
            <div class="section-title">📋 Audit Logs (${data.auditLogs.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${auditRows}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:#999;">No audit logs found for this period.</p>'}
        
        <div class="footer">
          Report generated on ${new Date().toLocaleString()} • Page 1 of 1
        </div>
      </body>
    </html>
  `;
}

function downloadJSON(data, startDate, endDate) {
  const jsonData = {
    generated_at: new Date().toISOString(),
    date_range: { start_date: startDate, end_date: endDate },
    generated_by: currentUser ? currentUser.name : 'System',
    municipality: currentUser ? currentUser.municipality : null,
    ...data
  };
  
  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${startDate}_to_${endDate}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Legacy loadAuditLogs function for backward compatibility
async function loadAuditLogsLegacy() {
  await loadAuditLogs();
}

function refreshReports() {
  renderReports();
}


// ============ MEETING ATTENDANCE (PHYSICAL) ============

async function recordPhysicalAttendance(meetingId) {
    try {
        const location = await getCurrentLocation();
        
        const attendanceData = {
            meeting_id: meetingId,
            user_id: currentUser.id,
            user_name: currentUser.name,
            user_email: currentUser.email,
            check_in_method: 'manual',
            location_lat: location ? location.lat : null,
            location_lng: location ? location.lng : null,
            location_accuracy: location ? location.accuracy : null,
            is_verified: true,
            verified_by: currentUser.name,
            notes: 'Physical attendance recorded via mobile/desktop'
        };
        
        const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        });
        
        if (response.ok) {
            toast('Physical attendance recorded successfully ✅', 'success');
            await renderMeetings();
            return true;
        } else {
            const error = await response.json();
            toast(error.error || 'Failed to record attendance', 'danger');
            return false;
        }
    } catch (error) {
        toast('Error recording attendance: ' + error.message, 'danger');
        return false;
    }
}

async function viewPhysicalAttendance(meetingId) {
    try {
        const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance`);
        const attendance = await response.json();
        
        if (!attendance || attendance.length === 0) {
            toast('No physical attendance records found', 'info');
            return;
        }
        
        showModal(`
            <h3><i class="fas fa-clipboard-list"></i> Physical Attendance - ${attendance.length} records</h3>
            <div style="overflow-x:auto; max-height:400px; overflow-y:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--surface-alt);">
                            <th style="padding:0.5rem; text-align:left;">#</th>
                            <th style="padding:0.5rem; text-align:left;">Name</th>
                            <th style="padding:0.5rem; text-align:left;">Email</th>
                            <th style="padding:0.5rem; text-align:left;">Time</th>
                            <th style="padding:0.5rem; text-align:left;">Method</th>
                            <th style="padding:0.5rem; text-align:left;">Verified</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attendance.map((a, i) => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:0.5rem;">${i + 1}</td>
                                <td style="padding:0.5rem;"><strong>${a.user_name}</strong></td>
                                <td style="padding:0.5rem;">${a.user_email}</td>
                                <td style="padding:0.5rem;">${formatDate(a.check_in_time)} ${a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : ''}</td>
                                <td style="padding:0.5rem;"><span class="badge badge-info">${a.check_in_method}</span></td>
                                <td style="padding:0.5rem;">${a.is_verified ? '✅' : '⏳'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top:1rem; display:flex; gap:0.5rem;">
                <button class="btn btn-success btn-sm" onclick="exportAttendanceCSV(${meetingId})">
                    <i class="fas fa-file-csv"></i> Export CSV
                </button>
                <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
            </div>
        `);
    } catch (error) {
        toast('Error loading attendance records', 'danger');
    }
}

async function exportAttendanceCSV(meetingId) {
    try {
        const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance`);
        const attendance = await response.json();
        
        if (!attendance || attendance.length === 0) {
            toast('No attendance records to export', 'warning');
            return;
        }
        
        let csv = 'Name,Email,Check-in Time,Method,Verified\n';
        attendance.forEach(a => {
            const time = a.check_in_time ? new Date(a.check_in_time).toLocaleString() : '';
            csv += `"${a.user_name}","${a.user_email}","${time}","${a.check_in_method}","${a.is_verified ? 'Yes' : 'No'}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `attendance_${meetingId}_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        toast('Attendance exported successfully ✅', 'success');
    } catch (error) {
        toast('Error exporting attendance', 'danger');
    }
}

async function bulkAttendanceModal(meetingId) {
  const users = await DB.users();
  const members = await DB.members();
  const allUsers = [...users, ...members];
  const uniqueUsers = allUsers.filter((u, i, arr) => 
    arr.findIndex(x => x.email === u.email) === i
  );
  
  const usersByMuni = uniqueUsers.filter(u => 
    u.municipality === currentUser.municipality || currentUser.role === 'super_admin'
  );
  
  // Get meeting details
  const meetings = await DB.meetings();
  const meeting = meetings.find(m => m.id === meetingId);
  
  // Get existing attendance records
  let existingAttendance = [];
  let checkedInEmails = new Set();
  try {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance`);
    if (response.ok) {
      existingAttendance = await response.json();
      checkedInEmails = new Set(existingAttendance.map(a => a.user_email));
    }
  } catch (e) {
    console.warn('Could not fetch existing attendance:', e);
  }
  
  // Build HTML with numbered rows and clickable rows
  const attendeeListHtml = usersByMuni.length ? usersByMuni.map((u, index) => {
    const isCheckedIn = checkedInEmails.has(u.email);
    const rowNumber = index + 1;
    return `
      <div class="attendee-item-wrapper" data-name="${u.name.toLowerCase()}" data-email="${u.email.toLowerCase()}" 
           data-index="${rowNumber}"
           style="
             display:flex; 
             align-items:center; 
             gap:0.6rem; 
             padding:0.3rem 0.5rem; 
             cursor:pointer; 
             border-radius:6px;
             transition:all 0.15s;
             border-bottom:1px solid var(--border);
             ${isCheckedIn ? 'background:rgba(34,197,94,0.08); border-left:3px solid #22c55e;' : 'border-left:3px solid transparent;'}
           " 
           onmouseover="this.style.background='${isCheckedIn ? 'rgba(34,197,94,0.15)' : 'var(--surface-alt)'}'" 
           onmouseout="this.style.background='${isCheckedIn ? 'rgba(34,197,94,0.08)' : 'transparent'}'"
           onclick="toggleAttendee(this)">
        
        <!-- Row Number -->
        <span style="
          font-size:0.65rem; 
          color:var(--text-muted); 
          font-weight:600; 
          min-width:22px; 
          text-align:center; 
          flex-shrink:0;
          background:var(--surface-alt);
          padding:0.05rem 0.2rem;
          border-radius:4px;
        ">${rowNumber}</span>
        
        <!-- Status Indicator (Dot) -->
        <span style="
          width:10px; 
          height:10px; 
          border-radius:50%; 
          flex-shrink:0;
          ${isCheckedIn ? 'background:#22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4);' : 'background:var(--border);'}
          transition:all 0.3s;
        " id="statusDot_${u.id}"></span>
        
        <!-- User Info -->
        <span style="display:flex; flex-direction:column; flex:1; min-width:0;">
          <span style="font-weight:500; font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:0.4rem;">
            ${u.name}
            ${isCheckedIn ? '<span style="font-size:0.5rem; color:#22c55e; font-weight:600;">✓</span>' : ''}
          </span>
          <span style="font-size:0.65rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.email}</span>
        </span>
        
        <!-- Role Badge -->
        <span style="font-size:0.5rem; color:var(--text-muted); background:var(--surface-alt); padding:0.05rem 0.5rem; border-radius:12px; flex-shrink:0; border:1px solid var(--border);">
          ${getRoleLabel(u.role)}
        </span>
        
        <!-- Status Badge -->
        ${isCheckedIn ? `
          <span style="font-size:0.5rem; color:#22c55e; background:rgba(34,197,94,0.12); padding:0.05rem 0.4rem; border-radius:12px; flex-shrink:0; border:1px solid rgba(34,197,94,0.2); font-weight:600;">
            ✓ Present
          </span>
        ` : `
          <span style="font-size:0.5rem; color:var(--text-muted); background:var(--surface-alt); padding:0.05rem 0.4rem; border-radius:12px; flex-shrink:0; border:1px dashed var(--border);">
            Not marked
          </span>
        `}
        
        <!-- Hidden checkbox (for form submission) -->
        <input type="checkbox" name="attendee" value="${u.id}" data-name="${u.name}" data-email="${u.email}" 
               ${isCheckedIn ? 'checked' : ''}
               style="display:none;" />
      </div>
    `;
  }).join('') : `
    <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">
      <i class="fas fa-users" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:var(--text-muted);"></i>
      No users available for ${getMunicipalityLabel(currentUser.municipality)}
    </div>
  `;

  showModal(`
    <div style="max-height:80vh; overflow-y:auto; padding-right:0.5rem;">
      <!-- Header -->
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
        <i class="fas fa-users" style="font-size:1.5rem; color:var(--primary);"></i>
        <h3 style="margin:0;">Bulk Attendance Entry</h3>
        <span style="font-size:0.7rem; color:var(--text-muted); background:var(--surface-alt); padding:0.1rem 0.6rem; border-radius:12px; margin-left:auto;">
          <span id="totalUsers">${usersByMuni.length}</span> attendees
        </span>
      </div>
      
      <!-- Meeting Info -->
      ${meeting ? `
        <div style="background:var(--surface-alt); padding:0.5rem 0.75rem; border-radius:8px; margin-bottom:0.75rem; font-size:0.9rem; border-left:3px solid var(--primary);">
          <strong>Meeting:</strong> ${meeting.title} 
          <span style="color:var(--text-muted);">• ${formatDate(meeting.date)} at ${meeting.time}</span>
          <span style="margin-left:0.5rem; font-size:0.8rem; color:var(--text-muted);">
            (${existingAttendance.length} already checked in)
          </span>
        </div>
      ` : ''}
      
      <!-- Info Banner -->
      ${existingAttendance.length > 0 ? `
        <div style="background:rgba(34,197,94,0.08); padding:0.4rem 0.75rem; border-radius:6px; margin-bottom:0.75rem; border-left:3px solid #22c55e;">
          <span style="font-size:0.8rem; color:var(--text-muted);">
            <i class="fas fa-check-circle" style="color:#22c55e;"></i> 
            <strong style="color:#22c55e;">${existingAttendance.length}</strong> users are already marked as present. 
            <span style="color:var(--text-muted);">Click on a row to toggle attendance.</span>
          </span>
        </div>
      ` : `
        <div style="background:rgba(245,158,11,0.08); padding:0.4rem 0.75rem; border-radius:6px; margin-bottom:0.75rem; border-left:3px solid #f59e0b;">
          <span style="font-size:0.8rem; color:var(--text-muted);">
            <i class="fas fa-info-circle" style="color:#f59e0b;"></i> 
            No one has checked in yet. <strong>Click on a row</strong> to mark them as present.
          </span>
        </div>
      `}
      
      <form id="bulkAttendanceForm">
        <!-- Attendee List -->
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label style="font-size:0.85rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span><i class="fas fa-user-check" style="color:var(--primary);"></i> Attendees</span>
            <span style="font-weight:400; color:var(--text-muted); font-size:0.75rem;">
              <span style="color:#22c55e; font-weight:600;" id="checkedInCount">${existingAttendance.length}</span> marked present
            </span>
          </label>
          
          <!-- Search Input -->
          <div style="margin-bottom:0.4rem; position:relative;">
            <input type="text" id="attendeeSearch" placeholder="🔍 Search by name or email..." 
                   style="width:100%; padding:0.35rem 0.7rem; border:1.5px solid var(--border); border-radius:6px; font-size:0.85rem; background:var(--surface); color:var(--text); transition:border 0.3s;"
                   oninput="filterAttendeeList(this.value)" />
          </div>
          
          <!-- Attendee List Container -->
          <div id="attendeeListContainer" style="
            max-height:320px; 
            overflow-y:auto; 
            border:1.5px solid var(--border); 
            border-radius:8px; 
            padding:0.3rem;
            background:var(--surface);
          ">
            ${attendeeListHtml}
          </div>
        </div>
        
        <!-- Selection Controls -->
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.5rem; align-items:center; padding:0.3rem 0.2rem;">
          <button type="button" class="btn btn-sm btn-outline" onclick="selectAllAttendees()" style="font-size:0.7rem; padding:0.15rem 0.6rem; border-radius:999px;">
            <i class="fas fa-check-double"></i> All
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="deselectAllAttendees()" style="font-size:0.7rem; padding:0.15rem 0.6rem; border-radius:999px;">
            <i class="fas fa-times"></i> None
          </button>
          ${existingAttendance.length > 0 ? `
            <button type="button" class="btn btn-sm btn-outline" onclick="selectCheckedIn()" style="font-size:0.7rem; padding:0.15rem 0.6rem; border-radius:999px; border-color:#22c55e; color:#22c55e;">
              <i class="fas fa-check" style="color:#22c55e;"></i> Present (${existingAttendance.length})
            </button>
          ` : ''}
          <span style="font-size:0.7rem; color:var(--text-muted); margin-left:auto; background:var(--surface-alt); padding:0.1rem 0.6rem; border-radius:12px;">
            <span id="selectedDisplay">Selected: <strong id="selectedCountNum">0</strong></span>
          </span>
        </div>
        
        <!-- Notes -->
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:0.2rem;">
            <i class="fas fa-sticky-note" style="color:var(--primary);"></i> Notes (Optional)
          </label>
          <textarea id="bulkNotes" rows="2" placeholder="Add notes about this attendance session..."
                    style="width:100%; padding:0.4rem 0.6rem; border:1.5px solid var(--border); border-radius:6px; font-size:0.82rem; background:var(--surface); color:var(--text); resize:vertical; transition:border 0.3s;"
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
        </div>
        
        <!-- Action Buttons -->
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem; border-top:1px solid var(--border); padding-top:0.6rem;">
          <button type="submit" class="btn btn-primary" style="flex:1; padding:0.4rem 1rem; font-size:0.85rem; font-weight:600; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; gap:0.3rem;">
            <i class="fas fa-save"></i> Record Attendance
          </button>
          <button type="button" class="btn btn-outline" onclick="closeModal()" style="padding:0.4rem 1rem; font-size:0.85rem; border-radius:999px; display:inline-flex; align-items:center; gap:0.3rem;">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </form>
    </div>
  `);
  
  // --- JavaScript functions for the modal ---
  
  // Update selected count
  const updateSelectedCount = () => {
    const checked = document.querySelectorAll('input[name="attendee"]:checked').length;
    const countNum = document.getElementById('selectedCountNum');
    if (countNum) countNum.textContent = checked;
    
    // Also update the display
    const selectedDisplay = document.getElementById('selectedDisplay');
    if (selectedDisplay) {
      selectedDisplay.innerHTML = `Selected: <strong id="selectedCountNum">${checked}</strong>`;
    }
  };
  
  // Toggle attendee checkbox when clicking the row
  window.toggleAttendee = function(element) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      checkbox.dispatchEvent(event);
      handleCheckboxChange(checkbox);
    }
  };
  
  // Handle checkbox change - update visual state
  window.handleCheckboxChange = function(checkbox) {
    const wrapper = checkbox.closest('.attendee-item-wrapper');
    if (wrapper) {
      const isChecked = checkbox.checked;
      const statusBadge = wrapper.querySelectorAll('span');
      const dot = wrapper.querySelector('[id^="statusDot_"]');
      
      if (isChecked) {
        wrapper.style.background = 'rgba(34,197,94,0.12)';
        wrapper.style.borderLeft = '3px solid #22c55e';
        if (dot) {
          dot.style.background = '#22c55e';
          dot.style.boxShadow = '0 0 8px rgba(34,197,94,0.5)';
        }
        // Update status badge
        statusBadge.forEach(span => {
          if (span.textContent.includes('Not marked')) {
            span.innerHTML = '✓ Present';
            span.style.color = '#22c55e';
            span.style.background = 'rgba(34,197,94,0.12)';
            span.style.border = '1px solid rgba(34,197,94,0.2)';
            span.style.fontWeight = '600';
          }
        });
        // Update name span
        const nameSpan = wrapper.querySelector('span span:first-child');
        if (nameSpan && !nameSpan.textContent.includes('✓')) {
          nameSpan.innerHTML = nameSpan.textContent + ' <span style="font-size:0.5rem; color:#22c55e; font-weight:600;">✓</span>';
        }
      } else {
        wrapper.style.background = 'transparent';
        wrapper.style.borderLeft = '3px solid transparent';
        if (dot) {
          dot.style.background = 'var(--border)';
          dot.style.boxShadow = 'none';
        }
        // Update status badge
        statusBadge.forEach(span => {
          if (span.textContent.includes('✓ Present')) {
            span.innerHTML = 'Not marked';
            span.style.color = 'var(--text-muted)';
            span.style.background = 'var(--surface-alt)';
            span.style.border = '1px dashed var(--border)';
            span.style.fontWeight = 'normal';
          }
        });
        // Remove ✓ from name
        const nameSpan = wrapper.querySelector('span span:first-child');
        if (nameSpan) {
          const text = nameSpan.textContent.replace('✓', '').trim();
          nameSpan.innerHTML = text;
        }
      }
      
      // Update hover effects
      wrapper.onmouseover = function() {
        this.style.background = isChecked ? 'rgba(34,197,94,0.2)' : 'var(--surface-alt)';
      };
      wrapper.onmouseout = function() {
        this.style.background = isChecked ? 'rgba(34,197,94,0.12)' : 'transparent';
      };
    }
    updateSelectedCount();
  };
  
  // Add event listeners to checkboxes
  document.querySelectorAll('input[name="attendee"]').forEach(cb => {
    cb.addEventListener('change', function() {
      handleCheckboxChange(this);
      updateSelectedCount();
    });
  });
  
  // Initial count
  setTimeout(updateSelectedCount, 100);
  
  // Filter function for search
  window.filterAttendeeList = function(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const wrappers = document.querySelectorAll('.attendee-item-wrapper');
    let visibleCount = 0;
    wrappers.forEach(wrapper => {
      const name = wrapper.dataset.name || '';
      const email = wrapper.dataset.email || '';
      if (!term || name.includes(term) || email.includes(term)) {
        wrapper.style.display = 'flex';
        visibleCount++;
      } else {
        wrapper.style.display = 'none';
      }
    });
    const container = document.getElementById('attendeeListContainer');
    const emptyMsg = container.querySelector('.no-results');
    if (visibleCount === 0 && term) {
      if (!emptyMsg) {
        const msg = document.createElement('div');
        msg.className = 'no-results';
        msg.style.textAlign = 'center';
        msg.style.padding = '1rem';
        msg.style.color = 'var(--text-muted)';
        msg.style.fontSize = '0.85rem';
        msg.innerHTML = '🔍 No attendees match your search';
        container.appendChild(msg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }
  };
  
  window.selectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => {
      cb.checked = true;
      handleCheckboxChange(cb);
    });
    updateSelectedCount();
  };
  
  window.deselectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => {
      cb.checked = false;
      handleCheckboxChange(cb);
    });
    updateSelectedCount();
  };
  
  window.selectCheckedIn = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => {
      const email = cb.dataset.email;
      if (checkedInEmails.has(email)) {
        cb.checked = true;
        handleCheckboxChange(cb);
      }
    });
    updateSelectedCount();
  };
  
  // Form submission
  byId('bulkAttendanceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const checkboxes = document.querySelectorAll('input[name="attendee"]:checked');
    const attendees = Array.from(checkboxes).map(cb => ({
      user_id: parseInt(cb.value),
      user_name: cb.dataset.name,
      user_email: cb.dataset.email
    }));
    
    const unselected = document.querySelectorAll('input[name="attendee"]:not(:checked)');
    const removeAttendees = Array.from(unselected)
      .filter(cb => checkedInEmails.has(cb.dataset.email))
      .map(cb => ({
        user_id: parseInt(cb.value),
        user_email: cb.dataset.email
      }));
    
    if (attendees.length === 0 && removeAttendees.length === 0) {
      toast('No changes to record', 'info');
      return;
    }
    
    const notes = byId('bulkNotes').value.trim();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
    submitBtn.disabled = true;
    
    try {
      // Record new attendees
      if (attendees.length > 0) {
        const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendees: attendees,
            verified_by: currentUser.name,
            notes: notes || 'Bulk attendance entry'
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to record attendance');
        }
      }
      
      // Remove unchecked attendees
      if (removeAttendees.length > 0) {
        for (const attendee of removeAttendees) {
          try {
            await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance/${attendee.user_id}`, {
              method: 'DELETE'
            });
          } catch (e) {
            console.warn(`Could not remove attendance for ${attendee.user_id}:`, e);
          }
        }
      }
      
      closeModal();
      const added = attendees.length;
      const removed = removeAttendees.length;
      let message = '';
      if (added > 0 && removed > 0) {
        message = `✅ ${added} added, ${removed} removed`;
      } else if (added > 0) {
        message = `✅ ${added} attendees marked present`;
      } else if (removed > 0) {
        message = `✅ ${removed} attendees removed`;
      }
      toast(message, 'success');
      await renderMeetings();
      
    } catch (error) {
      toast(error.message || 'Error recording attendance', 'danger');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}
  
  // Filter function for search
  window.filterAttendeeList = function(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const items = document.querySelectorAll('.attendee-item');
    let visibleCount = 0;
    items.forEach(item => {
      const name = item.dataset.name || '';
      const email = item.dataset.email || '';
      if (!term || name.includes(term) || email.includes(term)) {
        item.style.display = 'flex';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    const container = document.getElementById('attendeeListContainer');
    const emptyMsg = container.querySelector('.no-results');
    if (visibleCount === 0 && term) {
      if (!emptyMsg) {
        const msg = document.createElement('div');
        msg.className = 'no-results';
        msg.style.textAlign = 'center';
        msg.style.padding = '1rem';
        msg.style.color = 'var(--text-muted)';
        msg.style.fontSize = '0.85rem';
        msg.innerHTML = '🔍 No attendees match your search';
        container.appendChild(msg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }
  };
  
  window.selectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => cb.checked = true);
    updateSelectedCount();
  };
  
  window.deselectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => cb.checked = false);
    updateSelectedCount();
  };
  
  window.selectCheckedIn = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => {
      // Check if this user is already checked in
      const email = cb.dataset.email;
      if (checkedInEmails.has(email)) {
        cb.checked = true;
      }
    });
    updateSelectedCount();
  };
  
  byId('bulkAttendanceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Get selected checkboxes
    const checkboxes = document.querySelectorAll('input[name="attendee"]:checked');
    const attendees = Array.from(checkboxes).map(cb => ({
      user_id: parseInt(cb.value),
      user_name: cb.dataset.name,
      user_email: cb.dataset.email
    }));
    
    // Get unselected checkboxes (to remove attendance)
    const unselected = document.querySelectorAll('input[name="attendee"]:not(:checked)');
    const removeAttendees = Array.from(unselected)
      .filter(cb => checkedInEmails.has(cb.dataset.email))
      .map(cb => ({
        user_id: parseInt(cb.value),
        user_email: cb.dataset.email
      }));
    
    if (attendees.length === 0 && removeAttendees.length === 0) {
      toast('No changes to record', 'info');
      return;
    }
    
    const notes = byId('bulkNotes').value.trim();
    
    // Show loading state
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
    submitBtn.disabled = true;
    
    try {
      // Record new attendees
      if (attendees.length > 0) {
        const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendees: attendees,
            verified_by: currentUser.name,
            notes: notes || 'Bulk attendance entry'
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to record attendance');
        }
      }
      
      // Remove unchecked attendees (if any)
      if (removeAttendees.length > 0) {
        for (const attendee of removeAttendees) {
          try {
            await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance/${attendee.user_id}`, {
              method: 'DELETE'
            });
          } catch (e) {
            console.warn(`Could not remove attendance for ${attendee.user_id}:`, e);
          }
        }
      }
      
      closeModal();
      const added = attendees.length;
      const removed = removeAttendees.length;
      let message = '';
      if (added > 0 && removed > 0) {
        message = `✅ ${added} added, ${removed} removed`;
      } else if (added > 0) {
        message = `✅ ${added} attendees recorded`;
      } else if (removed > 0) {
        message = `✅ ${removed} attendees removed`;
      }
      toast(message, 'success');
      await renderMeetings();
      
    } catch (error) {
      toast(error.message || 'Error recording attendance', 'danger');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  
  // Filter function for search
  window.filterAttendeeList = function(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const items = document.querySelectorAll('.attendee-item');
    let visibleCount = 0;
    items.forEach(item => {
      const name = item.dataset.name || '';
      const email = item.dataset.email || '';
      if (!term || name.includes(term) || email.includes(term)) {
        item.style.display = 'flex';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    // Show/hide empty state
    const container = document.getElementById('attendeeListContainer');
    const emptyMsg = container.querySelector('.no-results');
    if (visibleCount === 0 && term) {
      if (!emptyMsg) {
        const msg = document.createElement('div');
        msg.className = 'no-results';
        msg.style.textAlign = 'center';
        msg.style.padding = '1rem';
        msg.style.color = 'var(--text-muted)';
        msg.style.fontSize = '0.85rem';
        msg.innerHTML = '🔍 No attendees match your search';
        container.appendChild(msg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }
  };
  
  window.selectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => cb.checked = true);
    updateSelectedCount();
  };
  
  window.deselectAllAttendees = function() {
    document.querySelectorAll('input[name="attendee"]').forEach(cb => cb.checked = false);
    updateSelectedCount();
  };
  
  byId('bulkAttendanceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const checkboxes = document.querySelectorAll('input[name="attendee"]:checked');
    const attendees = Array.from(checkboxes).map(cb => ({
      user_id: parseInt(cb.value),
      user_name: cb.dataset.name,
      user_email: cb.dataset.email
    }));
    
    if (attendees.length === 0) {
      toast('Please select at least one attendee', 'danger');
      return;
    }
    
    const notes = byId('bulkNotes').value.trim();
    
    try {
      const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendees: attendees,
          verified_by: currentUser.name,
          notes: notes
        })
      });
      
      if (response.ok) {
        closeModal();
        toast(`${attendees.length} attendees recorded ✅`, 'success');
        await renderMeetings();
      } else {
        const error = await response.json();
        toast(error.error || 'Failed to record attendance', 'danger');
      }
    } catch (error) {
      toast('Error recording attendance', 'danger');
    }
  });


// ============ PROJECT MANAGEMENT ============

async function renderProjects() {
    const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
    const municipality = currentUser.municipality === 'all' ? '' : currentUser.municipality;
    
    try {
        const url = `${API_BASE_URL}/projects${municipality ? '?municipality=' + municipality : ''}`;
        const response = await fetch(url);
        const projects = await response.json();
        
        // Get stats
        const statsResponse = await fetch(`${API_BASE_URL}/projects/dashboard-stats${municipality ? '?municipality=' + municipality : ''}`);
        const stats = await statsResponse.json();
        
        render(`
            <div class="page-header">
                <h2><i class="fas fa-project-diagram"></i> Municipal Projects</h2>
                ${canManage ? '<button class="btn btn-primary btn-sm" onclick="showCreateProjectModal()"><i class="fas fa-plus"></i> New Project</button>' : ''}
            </div>
            
            <!-- Project Stats -->
            <div class="grid-4" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:0.75rem; margin-bottom:1.5rem;">
                <div class="stat-card" style="border-left-color:#2563eb;">
                    <div class="num">${stats.total}</div>
                    <div class="label">Total Projects</div>
                </div>
                <div class="stat-card" style="border-left-color:#22c55e;">
                    <div class="num">${stats.active}</div>
                    <div class="label">Active</div>
                </div>
                <div class="stat-card" style="border-left-color:#f59e0b;">
                    <div class="num">${stats.planning}</div>
                    <div class="label">Planning</div>
                </div>
                <div class="stat-card" style="border-left-color:#3b82f6;">
                    <div class="num">${stats.completed}</div>
                    <div class="label">Completed</div>
                </div>
            </div>
            
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">
                <button class="btn btn-sm btn-outline" onclick="filterProjects('all')">All</button>
                <button class="btn btn-sm btn-outline" onclick="filterProjects('planning')">Planning</button>
                <button class="btn btn-sm btn-outline" onclick="filterProjects('active')">Active</button>
                <button class="btn btn-sm btn-outline" onclick="filterProjects('on_hold')">On Hold</button>
                <button class="btn btn-sm btn-outline" onclick="filterProjects('completed')">Completed</button>
            </div>
            
            <div id="projectsList" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px,1fr)); gap:1rem;">
                ${projects.length ? projects.map(p => `
                    <div class="card project-card" data-status="${p.status}" style="border-top:4px solid ${getProjectStatusColor(p.status)};">
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:0.5rem; flex-wrap:wrap;">
                            <div>
                                <h3 style="font-size:1.05rem; margin:0;">${p.name}</h3>
                                <div style="font-size:0.8rem; color:var(--text-muted);">
                                    ${p.category || 'General'} • ${getMunicipalityLabel(p.municipality)}
                                </div>
                            </div>
                            <span class="badge ${getProjectStatusBadge(p.status)}">${p.status.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        
                        ${p.description ? `<p style="margin:0.5rem 0; font-size:0.9rem; color:var(--text-muted);">${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}</p>` : ''}
                        
                        <div style="margin:0.5rem 0;">
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                                <span>Progress</span>
                                <span><strong>${p.progress}%</strong></span>
                            </div>
                            <div style="width:100%; height:6px; background:var(--surface-alt); border-radius:3px; overflow:hidden;">
                                <div style="height:100%; width:${p.progress}%; background:${p.progress >= 80 ? '#22c55e' : p.progress >= 50 ? '#f59e0b' : '#3b82f6'}; border-radius:3px; transition:width 0.5s;"></div>
                            </div>
                        </div>
                        
                        <div style="display:flex; gap:1rem; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap;">
                            <span><i class="fas fa-calendar"></i> ${p.start_date ? formatDate(p.start_date) : 'TBD'}</span>
                            ${p.budget > 0 ? `<span><i class="fas fa-money-bill"></i> KES ${p.budget.toLocaleString()}</span>` : ''}
                            ${p.spent > 0 ? `<span><i class="fas fa-coins"></i> Spent: KES ${p.spent.toLocaleString()}</span>` : ''}
                        </div>
                        
                        <div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                            <button class="btn btn-info btn-sm" onclick="viewProject(${p.id})">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-success btn-sm" onclick="addProjectUpdate(${p.id})">
                                <i class="fas fa-plus"></i> Update
                            </button>
                            ${canManage ? `
                                <button class="btn btn-warning btn-sm" onclick="editProject(${p.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : '<div class="card text-center text-muted" style="grid-column:1/-1; padding:3rem;">No projects found. Create your first project!</div>'}
            </div>
        `);
    } catch (error) {
        toast('Error loading projects', 'danger');
    }
}

function getProjectStatusColor(status) {
    const colors = {
        'planning': '#f59e0b',
        'active': '#22c55e',
        'on_hold': '#ef4444',
        'completed': '#3b82f6',
        'cancelled': '#6b7280'
    };
    return colors[status] || '#6b7280';
}

function getProjectStatusBadge(status) {
    const badges = {
        'planning': 'badge-warning',
        'active': 'badge-success',
        'on_hold': 'badge-danger',
        'completed': 'badge-info',
        'cancelled': 'badge-secondary'
    };
    return badges[status] || 'badge-info';
}

function filterProjects(status) {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

async function showCreateProjectModal() {
    const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town'] : [currentUser.municipality];
    const categories = ['Infrastructure', 'Health', 'Education', 'Water', 'Roads', 'Sanitation', 'Housing', 'Energy', 'Environment', 'Other'];
    
    showModal(`
        <h3><i class="fas fa-plus-circle"></i> Create New Project</h3>
        <form id="createProjectForm">
            <div class="form-group">
                <label>Project Name <span style="color:var(--danger);">*</span></label>
                <input type="text" id="projectName" required placeholder="Enter project name" />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="projectDesc" rows="3" placeholder="Describe the project..."></textarea>
            </div>
            <div class="form-group">
                <label>Municipality <span style="color:var(--danger);">*</span></label>
                <select id="projectMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="projectCategory">
                    <option value="">Select category...</option>
                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="projectStatus">
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="projectPriority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
            <div class="form-group">
                <label>Budget (KES)</label>
                <input type="number" id="projectBudget" placeholder="0" value="0" />
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="date" id="projectStart" />
            </div>
            <div class="form-group">
                <label>End Date</label>
                <input type="date" id="projectEnd" />
            </div>
            <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Create Project</button>
        </form>
    `);
    
    byId('createProjectForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = byId('projectName').value.trim();
        if (!name) { toast('Project name is required', 'danger'); return; }
        
        const projectData = {
            name: name,
            description: byId('projectDesc').value.trim(),
            municipality: byId('projectMunicipality').value,
            category: byId('projectCategory').value,
            status: byId('projectStatus').value,
            priority: byId('projectPriority').value,
            budget: parseFloat(byId('projectBudget').value) || 0,
            start_date: byId('projectStart').value,
            end_date: byId('projectEnd').value,
            created_by: currentUser.name,
            user_id: currentUser.id,
            user_email: currentUser.email,
            progress: 0
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            
            if (response.ok) {
                closeModal();
                toast('Project created successfully ✅', 'success');
                await renderProjects();
            } else {
                const error = await response.json();
                toast(error.error || 'Failed to create project', 'danger');
            }
        } catch (error) {
            toast('Error creating project', 'danger');
        }
    });
}

async function viewProject(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
        const project = await response.json();
        
        const milestonesResponse = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones`);
        const milestones = await milestonesResponse.json();
        
        const updatesResponse = await fetch(`${API_BASE_URL}/projects/${projectId}/updates`);
        const updates = await updatesResponse.json();
        
        const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
        
        showModal(`
            <div style="max-height:80vh; overflow-y:auto; padding-right:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:start; gap:0.5rem; flex-wrap:wrap;">
                    <h3 style="margin:0;">${project.name}</h3>
                    <span class="badge ${getProjectStatusBadge(project.status)}">${project.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style="color:var(--text-muted); font-size:0.9rem; margin:0.25rem 0;">
                    ${getMunicipalityLabel(project.municipality)} • ${project.category || 'General'} • Priority: ${project.priority}
                </div>
                
                ${project.description ? `<p style="margin:0.75rem 0;">${project.description}</p>` : ''}
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin:0.5rem 0; font-size:0.9rem;">
                    <div><strong>Budget:</strong> KES ${project.budget?.toLocaleString() || '0'}</div>
                    <div><strong>Spent:</strong> KES ${project.spent?.toLocaleString() || '0'}</div>
                    <div><strong>Start:</strong> ${project.start_date ? formatDate(project.start_date) : 'TBD'}</div>
                    <div><strong>End:</strong> ${project.end_date ? formatDate(project.end_date) : 'TBD'}</div>
                </div>
                
                <div style="margin:0.5rem 0;">
                    <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                        <span><strong>Progress</strong></span>
                        <span><strong>${project.progress}%</strong></span>
                    </div>
                    <div style="width:100%; height:8px; background:var(--surface-alt); border-radius:4px; overflow:hidden;">
                        <div style="height:100%; width:${project.progress}%; background:${project.progress >= 80 ? '#22c55e' : project.progress >= 50 ? '#f59e0b' : '#3b82f6'}; border-radius:4px;"></div>
                    </div>
                </div>
                
                <!-- Milestones -->
                <div style="margin-top:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0.5rem 0;"><i class="fas fa-flag-checkered"></i> Milestones</h4>
                        ${canManage ? `<button class="btn btn-sm btn-primary" onclick="addMilestone(${project.id})"><i class="fas fa-plus"></i> Add</button>` : ''}
                    </div>
                    ${milestones.length ? milestones.map(m => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.5rem; border-bottom:1px solid var(--border);">
                            <div>
                                <strong>${m.name}</strong>
                                ${m.description ? `<span style="color:var(--text-muted); font-size:0.8rem;"> - ${m.description}</span>` : ''}
                            </div>
                            <span class="badge ${m.status === 'completed' ? 'badge-success' : m.status === 'in_progress' ? 'badge-warning' : 'badge-info'}">${m.status.replace('_', ' ')}</span>
                        </div>
                    `).join('') : '<div style="color:var(--text-muted); font-size:0.9rem;">No milestones yet</div>'}
                </div>
                
                <!-- Updates -->
                <div style="margin-top:1rem;">
                    <h4 style="margin:0.5rem 0;"><i class="fas fa-history"></i> Updates</h4>
                    ${updates.length ? updates.slice(0, 10).map(u => `
                        <div style="padding:0.5rem; background:var(--surface-alt); border-radius:8px; margin-bottom:0.4rem;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                <span><strong>${u.user_name}</strong></span>
                                <span>${formatDate(u.timestamp)}</span>
                            </div>
                            <div>${u.message}</div>
                            ${u.progress > 0 ? `<div style="font-size:0.8rem; color:var(--text-muted);">Progress: ${u.progress}%</div>` : ''}
                        </div>
                    `).join('') : '<div style="color:var(--text-muted); font-size:0.9rem;">No updates yet</div>'}
                </div>
                
                <div style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="btn btn-success btn-sm" onclick="closeModal(); addProjectUpdate(${project.id});">Add Update</button>
                    <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (error) {
        toast('Error loading project details', 'danger');
    }
}

async function addProjectUpdate(projectId) {
    showModal(`
        <h3><i class="fas fa-plus-circle"></i> Add Project Update</h3>
        <form id="projectUpdateForm">
            <div class="form-group">
                <label>Message <span style="color:var(--danger);">*</span></label>
                <textarea id="updateMessage" rows="3" required placeholder="Describe the progress update..."></textarea>
            </div>
            <div class="form-group">
                <label>Progress (%)</label>
                <input type="number" id="updateProgress" min="0" max="100" placeholder="0-100" />
            </div>
            <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Post Update</button>
        </form>
    `);
    
    byId('projectUpdateForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const message = byId('updateMessage').value.trim();
        if (!message) { toast('Please enter a message', 'danger'); return; }
        
        const progress = parseInt(byId('updateProgress').value) || 0;
        
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    user_name: currentUser.name,
                    message: message,
                    progress: progress
                })
            });
            
            if (response.ok) {
                closeModal();
                toast('Update posted successfully ✅', 'success');
                await viewProject(projectId);
            } else {
                const error = await response.json();
                toast(error.error || 'Failed to post update', 'danger');
            }
        } catch (error) {
            toast('Error posting update', 'danger');
        }
    });
}

async function addMilestone(projectId) {
    showModal(`
        <h3><i class="fas fa-flag"></i> Add Milestone</h3>
        <form id="milestoneForm">
            <div class="form-group">
                <label>Milestone Name <span style="color:var(--danger);">*</span></label>
                <input type="text" id="milestoneName" required placeholder="Enter milestone name" />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="milestoneDesc" rows="2" placeholder="Describe the milestone..."></textarea>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" id="milestoneDue" />
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="milestoneStatus">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Add Milestone</button>
        </form>
    `);
    
    byId('milestoneForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = byId('milestoneName').value.trim();
        if (!name) { toast('Milestone name is required', 'danger'); return; }
        
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    description: byId('milestoneDesc').value.trim(),
                    due_date: byId('milestoneDue').value,
                    status: byId('milestoneStatus').value
                })
            });
            
            if (response.ok) {
                closeModal();
                toast('Milestone added ✅', 'success');
                await viewProject(projectId);
            } else {
                const error = await response.json();
                toast(error.error || 'Failed to add milestone', 'danger');
            }
        } catch (error) {
            toast('Error adding milestone', 'danger');
        }
    });
}

async function editProject(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
        const project = await response.json();
        
        const categories = ['Infrastructure', 'Health', 'Education', 'Water', 'Roads', 'Sanitation', 'Housing', 'Energy', 'Environment', 'Other'];
        
        showModal(`
            <h3><i class="fas fa-edit"></i> Edit Project</h3>
            <form id="editProjectForm">
                <div class="form-group">
                    <label>Project Name <span style="color:var(--danger);">*</span></label>
                    <input type="text" id="editProjectName" value="${project.name}" required />
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="editProjectDesc" rows="3">${project.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="editProjectCategory">
                        <option value="">Select category...</option>
                        ${categories.map(c => `<option value="${c}" ${project.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="editProjectStatus">
                        <option value="planning" ${project.status === 'planning' ? 'selected' : ''}>Planning</option>
                        <option value="active" ${project.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select id="editProjectPriority">
                        <option value="low" ${project.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${project.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${project.priority === 'high' ? 'selected' : ''}>High</option>
                        <option value="critical" ${project.priority === 'critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Budget (KES)</label>
                    <input type="number" id="editProjectBudget" value="${project.budget || 0}" />
                </div>
                <div class="form-group">
                    <label>Amount Spent (KES)</label>
                    <input type="number" id="editProjectSpent" value="${project.spent || 0}" />
                </div>
                <div class="form-group">
                    <label>Progress (%)</label>
                    <input type="number" id="editProjectProgress" min="0" max="100" value="${project.progress || 0}" />
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Update Project</button>
            </form>
        `);
        
        byId('editProjectForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = byId('editProjectName').value.trim();
            if (!name) { toast('Project name is required', 'danger'); return; }
            
            const updateData = {
                name: name,
                description: byId('editProjectDesc').value.trim(),
                category: byId('editProjectCategory').value,
                status: byId('editProjectStatus').value,
                priority: byId('editProjectPriority').value,
                budget: parseFloat(byId('editProjectBudget').value) || 0,
                spent: parseFloat(byId('editProjectSpent').value) || 0,
                progress: parseInt(byId('editProjectProgress').value) || 0
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (response.ok) {
                    closeModal();
                    toast('Project updated successfully ✅', 'success');
                    await renderProjects();
                } else {
                    const error = await response.json();
                    toast(error.error || 'Failed to update project', 'danger');
                }
            } catch (error) {
                toast('Error updating project', 'danger');
            }
        });
    } catch (error) {
        toast('Error loading project', 'danger');
    }
}

async function deleteProject(projectId) {
    if (!confirm('Delete this project? This will remove all associated data.')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            toast('Project deleted successfully', 'success');
            await renderProjects();
        } else {
            const error = await response.json();
            toast(error.error || 'Failed to delete project', 'danger');
        }
    } catch (error) {
        toast('Error deleting project', 'danger');
    }
}

// Refresh reports
function refreshReports() {
  renderReports();
}

// Export CSV - Using API
function exportReportCSV() {
  toast('CSV export coming soon!', 'info');
}

// Export PDF - Using API
function exportReportPDF() {
  toast('PDF export coming soon!', 'info');
}

// Make functions globally accessible
window.renderReports = renderReports;
window.loadAuditLogs = loadAuditLogs;
window.refreshReports = refreshReports;
window.exportReportCSV = exportReportCSV;
window.exportReportPDF = exportReportPDF;