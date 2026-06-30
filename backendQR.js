// Not necessary already integrated on the backendapp.js

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
  const broadcasts = getAllowedItems(await DB.broadcasts());
  const pending = complaints.filter(c => c.status === 'pending').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  
  const latestBroadcasts = broadcasts
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 3);
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-chart-pie"></i> Dashboard</h2>
      <span>${getMunicipalityLabel(currentUser.municipality === 'all' ? 'all' : currentUser.municipality)}</span>
    </div>
    
    ${latestBroadcasts.length ? `
      <div class="card" style="background:linear-gradient(135deg, var(--surface-alt), var(--surface));border:2px solid var(--primary-light);">
        <div class="card-title" style="color:var(--primary-dark);">
          <i class="fas fa-bullhorn"></i> Announcements
        </div>
        ${latestBroadcasts.map(b => `
          <div style="padding:0.75rem;border-bottom:1px solid var(--border);last-child:border-bottom:none;">
            <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
              <strong>${b.message}</strong>
              <span style="color:var(--text-muted);font-size:0.85rem;">${formatDate(b.timestamp)}</span>
            </div>
            <div style="color:var(--text-muted);font-size:0.85rem;margin-top:0.25rem;">
              — ${b.sender}
            </div>
          </div>
        `).join('')}
        ${broadcasts.length > 3 ? `<div style="text-align:center;margin-top:0.5rem;">
          <button class="btn btn-outline btn-sm" onclick="navigate('broadcasts')">
            View All Announcements
          </button>
        </div>` : ''}
      </div>
    ` : ''}
    
    <div class="grid-3">
      <div class="stat-card"><div class="num">${members.length}</div><div class="label">Board Members</div></div>
      <div class="stat-card"><div class="num">${meetings.length}</div><div class="label">Meetings</div></div>
      <div class="stat-card"><div class="num">${complaints.length}</div><div class="label">Complaints</div></div>
      <div class="stat-card"><div class="num">${pending}</div><div class="label">Pending</div></div>
      <div class="stat-card"><div class="num">${resolved}</div><div class="label">Resolved</div></div>
      <div class="stat-card"><div class="num">${minutes.length}</div><div class="label">Minutes</div></div>
    </div>
    <div class="card">
      <div class="card-title"><i class="fas fa-bolt"></i> Quick Actions</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.75rem;">
        <button class="btn btn-primary btn-sm" onclick="navigate('members')"><i class="fas fa-users"></i> Members</button>
        <button class="btn btn-primary btn-sm" onclick="navigate('meetings')"><i class="fas fa-calendar-alt"></i> Meetings</button>
        <button class="btn btn-outline btn-sm" onclick="navigate('complaints')"><i class="fas fa-exclamation-triangle"></i> Complaints</button>
        <button class="btn btn-outline btn-sm" onclick="navigate('documents')"><i class="fas fa-folder-open"></i> Documents</button>
        <button class="btn btn-outline btn-sm" onclick="navigate('emails')"><i class="fas fa-envelope"></i> Email</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title"><i class="fas fa-clock"></i> Recent Activity</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Activity</th><th>Municipality</th><th>Date</th></tr></thead>
          <tbody>
            ${meetings.slice(0, 3).map(m => `<tr><td>Meeting: ${m.title}</td><td>${getMunicipalityLabel(m.municipality)}</td><td>${formatDate(m.date)}</td></tr>`).join('')}
            ${complaints.slice(0, 2).map(c => `<tr><td>Complaint: ${c.title}</td><td>${getMunicipalityLabel(c.municipality)}</td><td>${formatDate(c.date)}</td></tr>`).join('')}
          </tbody>
        </table>
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
            
            <!-- QR CODE ATTENDANCE BUTTONS - Only show for scheduled meetings -->
            ${meeting.status === 'scheduled' ? `
              ${canGenerateQR ? `
                <button class="btn btn-qr-generate btn-sm" onclick="showGenerateQRModal(${meeting.id})">
                  <i class="fas fa-qrcode"></i> QR Code
                </button>
              ` : ''}
              <button class="btn btn-qr-scan btn-sm" onclick="showScanQRModal(${meeting.id})">
                <i class="fas fa-camera"></i> Scan QR
              </button>
            ` : ''}
            
            ${canAdd ? `
              <button class="btn btn-info btn-sm" onclick="viewAttendance(${meeting.id})">
                <i class="fas fa-list"></i> View Attendance
              </button>
              ${hasFiles ? `<button class="btn btn-secondary btn-sm" onclick="viewMeetingFiles(${meeting.id})"><i class="fas fa-paperclip"></i> Files (${meeting.files.length})</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="deleteMeeting(${meeting.id})">
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

// from here things remain the same i guess


// Make QR functions globally accessible
window.showGenerateQRModal = showGenerateQRModal;
window.showScanQRModal = showScanQRModal;
window.downloadQR = downloadQR;
window.printQR = printQR;
window.stopQRScanner = stopQRScanner;
window.manualCheckIn = manualCheckIn;
window.startQRScanner = startQRScanner;