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
        } catch (error) { console.error(`Error fetching ${entity}:`, error); return []; }
    },
    async _replaceData(entity, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) console.error(`Error updating ${entity}`);
        } catch (error) { console.error(`Error updating ${entity}:`, error); }
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
        } catch (error) { console.error(`Error adding item:`, error); return null; }
    },
    async _deleteItem(entity, id) {
        try {
            const response = await fetch(`${API_BASE_URL}/${entity}/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                console.error(`Error deleting item from ${entity}:`, response.statusText);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`Error deleting item:`, error);
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
                console.error(`Error updating item from ${entity}:`, response.statusText);
                return false;
            }
            return true;
        } catch (error) {
            console.error(`Error updating item:`, error);
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
                body: JSON.stringify(user)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },
    
    getNextId(array) { return array.length ? Math.max(...array.map(item => item.id || 0)) + 1 : 1; }
};

async function seedData() { }

let currentUser = null;
let speechUtterance = null;

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
    if (response.ok) {
      currentUser = await response.json();
      localStorage.setItem('mbp_session', JSON.stringify({ userId: currentUser.id }));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Login error:', error);
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
  
  // Show Track Users link only for Super Admin
  const trackNav = byId('navTrack');
  if (trackNav) trackNav.style.display = isSystemAdmin(currentUser) ? 'flex' : 'none';
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
    case 'track': await renderTrackUsers(); break; // Tracking feature
    case 'emails': await renderEmails(); break;
    case 'broadcasts': await renderBroadcasts(); break;
    default: render('<div class="card"><h2>Page not found</h2></div>');
  }
}

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
    roleOptions = ['super_admin', 'municipal_officer', 'member'];
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
    if (!name || !email || !password) { toast('Complete all fields', 'danger'); return; }
    const users = await DB.users();
    if (users.find(u => u.email === email)) { toast('Email already exists', 'danger'); return; }
    
    const newUser = await DB.addUser({ name, email, password, role, municipality });
    if (!newUser) {
        toast('Failed to add user', 'danger');
        return;
    }

    if (role !== 'super_admin') {
        const newMember = await DB.addMember({ name, email, role, municipality, joined: new Date().toISOString().slice(0, 10) });
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

async function renderMeetings() {
  const meetings = getAllowedItems(await DB.meetings());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-calendar-alt"></i> Meetings</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showScheduleMeetingModal()"><i class="fas fa-plus"></i> Schedule</button>' : ''}
    </div>
    <div class="grid-2">
      ${meetings.length ? meetings.map(meeting => `
        <div class="card">
          <div class="flex-between" style="display:flex;justify-content:space-between;align-items:start;gap:0.75rem;flex-wrap:wrap;">
            <strong>${meeting.title}</strong>
            <span class="badge ${meeting.status === 'scheduled' ? 'badge-info' : meeting.status === 'resolved' ? 'badge-success' : 'badge-warning'}">${meeting.status}</span>
          </div>
          <div style="margin:0.65rem 0;color:var(--text-muted);font-size:0.95rem;"><i class="fas fa-calendar-day"></i> ${formatDate(meeting.date)} at ${meeting.time}</div>
          <div style="color:var(--text-muted);font-size:0.95rem;"><i class="fas fa-map-marker-alt"></i> ${meeting.location}</div>
          
          <div style="margin-top:0.85rem;color:var(--text-muted);font-size:0.9rem;">
            <i class="fas fa-users"></i> ${meeting.attendees.length} attending | 
            <i class="fas fa-user-times"></i> ${(meeting.declined || []).length} declined
          </div>
          
          <div class="actions" style="margin-top:0.85rem; display:flex; flex-wrap:wrap; gap:0.5rem;">
            <button class="btn btn-success btn-sm" onclick="confirmAttendance(${meeting.id})"><i class="fas fa-check"></i> Attend</button>
            <button class="btn btn-warning btn-sm" onclick="showDeclineModal(${meeting.id})"><i class="fas fa-times"></i> Decline</button>
            ${canAdd ? `<button class="btn btn-info btn-sm" onclick="viewAttendance(${meeting.id})"><i class="fas fa-list"></i> View Attendance</button>` : ''}
            ${canAdd ? `<button class="btn btn-danger btn-sm" onclick="deleteMeeting(${meeting.id})"><i class="fas fa-trash"></i></button>` : ''}
          </div>
        </div>
      `).join('') : '<div class="card text-center text-muted">No meetings scheduled yet.</div>'}
    </div>
  `);
}

async function showScheduleMeetingModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  showModal(`
    <h3><i class="fas fa-calendar-plus"></i> Schedule Meeting</h3>
    <form id="scheduleMeetingForm">
      <div class="form-group"><label>Title</label><input type="text" id="mtTitle" required /></div>
      <div class="form-group"><label>Date</label><input type="date" id="mtDate" required /></div>
      <div class="form-group"><label>Time</label><input type="time" id="mtTime" required /></div>
      <div class="form-group"><label>Location</label><input type="text" id="mtLocation" required /></div>
      <div class="form-group"><label>Municipality</label><select id="mtMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Schedule</button>
    </form>
  `);
  byId('scheduleMeetingForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = byId('mtTitle').value.trim();
    const date = byId('mtDate').value;
    const time = byId('mtTime').value;
    const location = byId('mtLocation').value.trim();
    const municipality = byId('mtMunicipality').value;
    if (!title || !date || !time || !location) { toast('Complete all fields', 'danger'); return; }
    const newMeeting = await DB.addMeeting({ title, date, time, location, municipality, status: 'scheduled', attendees: [], declined: [] });
    if (newMeeting) {
        closeModal();
        toast('Meeting scheduled', 'success');
        navigate('meetings');
    } else {
        toast('Failed to schedule meeting', 'danger');
    }
  });
}

async function confirmAttendance(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) return;

  if (!meeting.attendees.includes(currentUser.email)) {
    meeting.attendees.push(currentUser.email);
  }
  
  // Remove from declined list if they were previously declined
  if (meeting.declined && meeting.declined.some(d => d.email === currentUser.email)) {
    meeting.declined = meeting.declined.filter(d => d.email !== currentUser.email);
  }

  const success = await DB._updateItem('meetings', id, meeting);
  if (success) {
    toast('Attendance confirmed', 'success');
  } else {
    toast('Failed to confirm attendance', 'danger');
  }
  await renderMeetings();
}

async function showDeclineModal(id) {
  showModal(`
    <h3><i class="fas fa-times-circle"></i> Decline Meeting</h3>
    <form id="declineMeetingForm">
      <div class="form-group">
        <label>Please provide a reason for not attending:</label>
        <textarea id="declineReason" rows="4" required placeholder="E.g., Out of office, sick leave, scheduling conflict..."></textarea>
      </div>
      <button type="submit" class="btn btn-warning btn-block"><i class="fas fa-paper-plane"></i> Submit Decline</button>
    </form>
  `);
  
  byId('declineMeetingForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const reason = byId('declineReason').value.trim();
    if (!reason) { toast('Please enter a reason', 'danger'); return; }
    
    const meetings = await DB.meetings();
    const meeting = meetings.find(item => item.id === id);
    if (!meeting) return;

    // Initialize declined array if it doesn't exist
    if (!meeting.declined) meeting.declined = [];

    // Remove from attendees if they were previously attending
    meeting.attendees = meeting.attendees.filter(email => email !== currentUser.email);

    // Check if they already declined, if so update reason, else add new record
    const existingDecline = meeting.declined.find(d => d.email === currentUser.email);
    if (existingDecline) {
      existingDecline.reason = reason;
    } else {
      meeting.declined.push({
        email: currentUser.email,
        name: currentUser.name,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    }

    const success = await DB._updateItem('meetings', id, meeting);
    if (success) {
      closeModal();
      toast('Decline submitted successfully', 'success');
      await renderMeetings();
    } else {
      toast('Failed to submit decline', 'danger');
    }
  });
}

async function viewAttendance(id) {
  const meetings = await DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) return;

  const attendees = meeting.attendees || [];
  const declined = meeting.declined || [];
  
  // Fetch all users so we can show names instead of just emails for attendees
  const users = await DB.users();
  
  const attendeeList = attendees.map(email => {
    const user = users.find(u => u.email === email);
    return `<li style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
      <i class="fas fa-check" style="color:var(--success);"></i> 
      ${user ? user.name : email} 
      <span style="color:var(--text-muted); font-size:0.85rem;">(${email})</span>
    </li>`;
  }).join('') || '<li style="padding:0.5rem 0; color:var(--text-muted);">No one has confirmed attendance yet.</li>';

  const declinedList = declined.map(d => `
    <li style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <strong><i class="fas fa-times" style="color:var(--danger);"></i> ${d.name}</strong>
        <span style="color:var(--text-muted); font-size:0.85rem;">${formatDate(d.timestamp)}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.85rem;">${d.email}</div>
      <div style="margin-top:0.35rem; padding:0.5rem; background:var(--surface-muted); border-radius:8px; font-style:italic;">
        "${d.reason}"
      </div>
    </li>
  `).join('') || '<li style="padding:0.5rem 0; color:var(--text-muted);">No one has declined.</li>';

  showModal(`
    <h3><i class="fas fa-list"></i> Attendance: ${meeting.title}</h3>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
      <div class="card" style="background:var(--surface-alt);">
        <div class="card-title" style="color:var(--success);">
          <i class="fas fa-check-circle"></i> Attending (${attendees.length})
        </div>
        <ul style="list-style:none; padding:0; margin:0;">${attendeeList}</ul>
      </div>
      <div class="card" style="background:var(--surface-alt);">
        <div class="card-title" style="color:var(--danger);">
          <i class="fas fa-times-circle"></i> Declined (${declined.length})
        </div>
        <ul style="list-style:none; padding:0; margin:0;">${declinedList}</ul>
      </div>
    </div>
    <button class="btn btn-outline btn-block" style="margin-top:1rem;" onclick="closeModal()">Close</button>
  `);
}

async function deleteMeeting(id) {
  if (!confirm('Delete this meeting?')) return;
  const success = await DB._deleteItem('meetings', id);
  if (success) {
      toast('Meeting deleted', 'success');
      navigate('meetings');
  } else {
      toast('Failed to delete meeting', 'danger');
  }
}

async function renderMinutes() {
  const minutes = getAllowedItems(await DB.minutes());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  render(`
    <div class="page-header">
      <h2><i class="fas fa-file-alt"></i> Meeting Minutes</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showUploadMinutesModal()"><i class="fas fa-upload"></i> Upload Minutes</button>' : ''}
    </div>
    ${minutes.length ? minutes.map(item => `      <div class="card">
        <div class="flex-between" style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
          <strong>${item.uploadedBy}</strong>
          <span style="color:var(--text-muted);">${formatDate(item.uploadDate)}</span>
        </div>
        <p style="margin-top:0.85rem;">${item.content}</p>
        <p style="color:var(--text-muted);font-size:0.95rem;">${getMunicipalityLabel(item.municipality)}${item.meetingId ? ` • Meeting #${item.meetingId}` : ''}</p>
      </div>
    `).join('') : '<div class="card text-center text-muted">No minutes uploaded yet.</div>'}
  `);
}

async function showUploadMinutesModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  showModal(`
    <h3><i class="fas fa-upload"></i> Upload Meeting Minutes</h3>
    <form id="uploadMinutesForm">
      <div class="form-group"><label>Content</label><textarea id="minContent" rows="5" required></textarea></div>
      <div class="form-group"><label>Municipality</label><select id="minMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Meeting ID (optional)</label><input type="number" id="minMeetingId" placeholder="Meeting ID" /></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-upload"></i> Upload</button>
    </form>
  `);
  byId('uploadMinutesForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const content = byId('minContent').value.trim();
    const municipality = byId('minMunicipality').value;
    const meetingId = parseInt(byId('minMeetingId').value) || null;
    if (!content) { toast('Please add content', 'danger'); return; }
    const newMinute = await DB.addMinute({ meetingId, content, uploadedBy: currentUser.name, municipality, uploadDate: new Date().toISOString().slice(0, 10) });
    if (newMinute) {
        closeModal();
        toast('Minutes uploaded', 'success');
        navigate('minutes');
    } else {
        toast('Failed to upload minutes', 'danger');
    }
  });
}

async function renderComplaints() {
  const complaints = getAllowedItems(await DB.complaints());
  const officers = (await DB.members()).filter(member => member.role === 'municipal_officer' || member.role === 'social_officer');
  const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  render(`
    <div class="page-header">
      <h2><i class="fas fa-exclamation-triangle"></i> Complaints</h2>
      ${canManage ? '<button class="btn btn-primary btn-sm" onclick="showAddComplaintModal()"><i class="fas fa-plus"></i> Report Complaint</button>' : ''}
    </div>
    ${complaints.length ? complaints.map(c => `      <div class="complaint-item">
        <div class="head">
          <strong>${c.title}</strong>
          <span class="badge ${c.status === 'pending' ? 'badge-danger' : c.status === 'resolved' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
        </div>
        <p style="margin:0.75rem 0;">${c.description}</p>
        <div class="meta">${getMunicipalityLabel(c.municipality)} • ${formatDate(c.date)} • ${c.assignedTo || 'Unassigned'}</div>
        ${canManage ? `
          <div class="actions">
            <select id="assignSelect_${c.id}" style="padding:0.55rem 0.8rem;border:1px solid var(--border);border-radius:14px;min-width:180px;">
              <option value="">Assign to...</option>
              ${officers.filter(o => o.municipality === c.municipality || o.municipality === 'all').map(o => `<option value="${o.name}">${o.name}</option>`).join('')}
            </select>
            <button class="btn btn-success btn-sm" onclick="assignComplaint(${c.id})"><i class="fas fa-user-check"></i> Assign</button>
            <button class="btn btn-warning btn-sm" onclick="updateComplaintStatus(${c.id}, 'in_progress')"><i class="fas fa-spinner"></i> In Progress</button>
            <button class="btn btn-success btn-sm" onclick="updateComplaintStatus(${c.id}, 'resolved')"><i class="fas fa-check"></i> Resolve</button>
            <button class="btn btn-danger btn-sm" onclick="deleteComplaint(${c.id})"><i class="fas fa-trash"></i></button>
          </div>
        ` : ''}
      </div>
    `).join('') : '<div class="card text-center text-muted">No complaints have been reported yet.</div>'}
  `);
}

async function showAddComplaintModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  showModal(`
    <h3><i class="fas fa-plus"></i> Report Complaint</h3>
    <form id="addComplaintForm">
      <div class="form-group"><label>Title</label><input type="text" id="cTitle" required /></div>
      <div class="form-group"><label>Description</label><textarea id="cDesc" rows="4" required></textarea></div>
      <div class="form-group"><label>Municipality</label><select id="cMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-paper-plane"></i> Submit Complaint</button>
    </form>
  `);
  byId('addComplaintForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = byId('cTitle').value.trim();
    const description = byId('cDesc').value.trim();
    const municipality = byId('cMunicipality').value;
    if (!title || !description) { toast('Complete all fields', 'danger'); return; }
    const newComplaint = await DB.addComplaint({ title, description, municipality, status: 'pending', assignedTo: '', date: new Date().toISOString().slice(0, 10) });
    if (newComplaint) {
        closeModal();
        toast('Complaint submitted', 'success');
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
  if (!assignee) { toast('Select an assignee', 'danger'); return; }
  const complaints = await DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (complaint) {
    complaint.assignedTo = assignee;
    complaint.status = 'in_progress';
    await DB.setComplaints(complaints);
    toast(`Assigned to ${assignee}`, 'success');
    navigate('complaints');
  }
}

async function updateComplaintStatus(id, status) {
  const complaints = await DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (!complaint) return;
  complaint.status = status;
  await DB.setComplaints(complaints);
  toast('Complaint updated', 'success');
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

async function renderDocuments() {
  const documents = getAllowedItems(await DB.documents());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  render(`
    <div class="page-header">
      <h2><i class="fas fa-folder-open"></i> Documents</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showUploadDocModal()"><i class="fas fa-upload"></i> Upload Document</button>' : ''}
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Uploaded By</th><th>Municipality</th><th>Date</th><th>Action</th></tr></thead>
        <tbody>
          ${documents.length ? documents.map(doc => `
            <tr>
              <td>${doc.name}</td>
              <td>${doc.type}</td>
              <td>${doc.uploadedBy}</td>
              <td>${getMunicipalityLabel(doc.municipality)}</td>
              <td>${formatDate(doc.uploadDate)}</td>
              <td style="white-space:nowrap;">
                <button class="btn btn-success btn-sm" onclick="downloadDoc(${doc.id})"><i class="fas fa-download"></i></button>
                ${canAdd ? `<button class="btn btn-danger btn-sm" onclick="deleteDoc(${doc.id})"><i class="fas fa-trash"></i></button>` : ''}
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center text-muted">No documents uploaded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

async function showUploadDocModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  showModal(`
    <h3><i class="fas fa-upload"></i> Upload Document</h3>
    <form id="uploadDocForm">
      <div class="form-group"><label>Document Name</label><input type="text" id="docName" required /></div>
      <div class="form-group"><label>Type</label><select id="docType"><option value="PDF">PDF</option><option value="Image">Image</option><option value="Word">Word</option><option value="Excel">Excel</option><option value="Other">Other</option></select></div>
      <div class="form-group"><label>Municipality</label><select id="docMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <div class="form-group"><label>File Name</label><input type="text" id="docFileName" required placeholder="Example: Annual Report 2026.pdf" /></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-upload"></i> Upload</button>
    </form>
  `);
  byId('uploadDocForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = byId('docName').value.trim();
    const type = byId('docType').value;
    const municipality = byId('docMunicipality').value;
    const fileName = byId('docFileName').value.trim();
    if (!name || !fileName) { toast('Complete all fields', 'danger'); return; }
    const newDoc = await DB.addDocument({ name, type, municipality, uploadedBy: currentUser.name, uploadDate: new Date().toISOString().slice(0, 10), fileName });
    if (newDoc) {
        closeModal();
        toast('Document uploaded', 'success');
        navigate('documents');
    } else {
        toast('Failed to upload document', 'danger');
    }
  });
}

function downloadDoc(id) {
    const doc = (async () => { return (await DB.documents()).find(item => item.id === id); })();
    doc.then(d => {
        if (!d) return;
        const link = document.createElement('a');
        link.href = '#';
        link.download = d.fileName || d.name;
        link.click();
        toast(`Download started: ${d.fileName || d.name}`, 'success');
    });
}

async function deleteDoc(id) {
  if (!confirm('Delete this document?')) return;
  const success = await DB._deleteItem('documents', id);
  if (success) {
      toast('Document deleted', 'success');
      navigate('documents');
  } else {
      toast('Failed to delete document', 'danger');
  }
}

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
                <button class="btn btn-warning btn-sm" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);
}

// ============= TRACK USERS MODULE =============
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
      
      // If seen in the last 3 minutes, they are Online
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
  const roles = ['super_admin', 'municipal_officer', 'member'];
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
  const roles = ['super_admin', 'municipal_officer', 'member'];
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

async function deleteUser(id) {
  const users = await DB.users();
  const target = users.find(user => user.id === id);
  if (target && target.role === 'super_admin' && users.filter(user => user.role === 'super_admin').length <= 1) {
    toast('Cannot delete the last super admin', 'danger');
    return;
  }
  if (!confirm('Delete this user?')) return;
  
  const userSuccess = await DB._deleteItem('users', id);
  const memberSuccess = await DB._deleteItem('members', id);

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
    console.error('Update error:', error);
    toast('An error occurred', 'danger');
  }
}

// ============= EMAIL MODULE =============
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
  
  // Update read status in the database
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
    
    // Logic for sending to 'all'
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
        // Send to a single recipient
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

// ============= BROADCAST MODULE =============
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
    
    ${isAdmin ? `
      <div class="card" style="background:var(--surface-alt);border:2px dashed var(--border);">
        <div class="card-title"><i class="fas fa-bullhorn"></i> Admin Broadcast</div>
        <p style="color:var(--text-muted);margin-bottom:1rem;">
          Send a message that will be visible to all users on their dashboard.
        </p>
        <button class="btn btn-primary btn-sm" onclick="showBroadcastModal()">
          <i class="fas fa-bullhorn"></i> Create Broadcast
        </button>
      </div>
    ` : ''}
    
    <div class="broadcast-list">
      ${broadcasts.length ? broadcasts.map(b => `
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
      `).join('') : '<div class="card text-center text-muted">No announcements available.</div>'}
    </div>
  `);
}

async function showBroadcastModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  
  showModal(`
    <h3><i class="fas fa-bullhorn"></i> Create Broadcast</h3>
    <form id="broadcastForm">
      <div class="form-group">
        <label>Message</label>
        <textarea id="broadcastMessage" rows="5" required 
          placeholder="Type your announcement here. This will be visible to all users in the selected municipality..."></textarea>
      </div>
      <div class="form-group">
        <label>Municipality</label>
        <select id="broadcastMunicipality">
            ${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}
        </select>
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
    
    const newBroadcast = await DB.addBroadcast({
        message: message,
        sender: currentUser.name,
        timestamp: new Date().toISOString(),
        municipality: municipality
    });
    
    if (newBroadcast) {
        closeModal();
        toast('Broadcast created successfully', 'success');
        await renderBroadcasts();
    } else {
        toast('Failed to create broadcast', 'danger');
    }
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

// ============= SHARED FUNCTIONS =============
function showModal(content) {
  let overlay = byId('modalOverlay');
  // If the overlay doesn't exist on the page (e.g. login page), create it dynamically
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
    
    // Attach listeners for the dynamically created modal
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
        regLink.innerHTML = '<a href="#" id="showRegisterLink" style="color:var(--primary); font-weight:500;">Not a member? Create an account</a>';
        regLink.style.textAlign = 'center';
        regLink.style.marginTop = '1.5rem';
        formContainer.appendChild(regLink);
        
        byId('showRegisterLink').addEventListener('click', function(e) {
            e.preventDefault();
            showRegisterModal();
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
    
    // --- HEARTBEAT TIMER ---
    // Tell the backend this user is still active every 60 seconds
    setInterval(async () => {
      if (currentUser && currentUser.id) {
        try {
          await fetch(`${API_BASE_URL}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
          });
        } catch (e) { console.error('Heartbeat failed'); }
      }
    }, 60000); // 60,000 ms = 1 minute

    navigate('dashboard');
  }
  if (page === 'settings') {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); logout(); }
    });
  }
}

// ============= REGISTRATION & OAUTH MODULE =============
function showRegisterModal() {
    closeModal();
    showModal(`
    <h3><i class="fas fa-user-plus"></i> Create Account</h3>
    
    <div style="margin-bottom: 1.5rem;">
        <button class="btn btn-outline btn-block" style="margin-bottom:0.5rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="loginWithGoogle()">
            <i class="fab fa-google" style="color:#db4a39;"></i> Continue with Google
        </button>
        <button class="btn btn-outline btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="loginWithMicrosoft()">
            <i class="fab fa-microsoft" style="color:#00a4ef;"></i> Continue with Microsoft
        </button>
        <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin: 1rem 0; position:relative;">
            <span style="background:var(--surface); padding:0 10px; position:relative; z-index:1;">OR</span>
            <span style="position:absolute; top:50%; left:0; right:0; height:1px; background:var(--border); z-index:0;"></span>
        </p>
    </div>

    <form id="registerForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="rName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="rEmail" required /></div>
      <div class="form-group"><label>Municipality</label><select id="rMunicipality">
          <option value="kenol">Kenol</option>
          <option value="kangare">Kangare</option>
          <option value="muranga_town">Murang'a Town</option>
      </select></div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="rPassword" required oninput="checkPasswordStrength()" style="border-radius: 14px; border: 1px solid var(--border);" />
        <div id="passwordFeedback" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; padding: 0.75rem; background: var(--surface-alt); border-radius: 8px; line-height: 1.4;">
          <strong style="display:block; margin-bottom:0.25rem;">Password Requirements:</strong>
          • At least 8 characters<br>
          • At least 1 uppercase letter (A-Z)<br>
          • At least 1 lowercase letter (a-z)<br>
          • At least 1 number (0-9)<br>
          • At least 1 special character (!@#$%^&*)
        </div>
      </div>
      <div class="form-group"><label>Confirm Password</label><input type="password" id="rConfirmPassword" required oninput="checkPasswordMatch()" style="border-radius: 14px; border: 1px solid var(--border);" /></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-paper-plane"></i> Register</button>
    </form>
    `);
    
    byId('registerForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const name = byId('rName').value.trim();
        const email = byId('rEmail').value.trim();
        const password = byId('rPassword').value.trim();
        const confirmPassword = byId('rConfirmPassword').value.trim();
        const municipality = byId('rMunicipality').value;
        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
        if (!passwordRegex.test(password)) {
            toast('Password does not meet security requirements', 'danger');
            return;
        }
        
        if (password !== confirmPassword) {
            toast('Passwords do not match', 'danger');
            return;
        }
        
        try {
            const newUser = await DB.registerUser({ name, email, password, municipality });
            closeModal();
            toast('Registration successful! Please login.', 'success');
        } catch (error) {
            toast(error.message, 'danger');
        }
    });
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
    
    // Also check match if confirm has value
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

window.navigate = navigate;
window.showAddMemberModal = showAddMemberModal;
window.deleteMember = deleteMember;
window.showScheduleMeetingModal = showScheduleMeetingModal;
window.confirmAttendance = confirmAttendance;
window.showDeclineModal = showDeclineModal;
window.viewAttendance = viewAttendance;
window.deleteMeeting = deleteMeeting;
window.showUploadMinutesModal = showUploadMinutesModal;
window.showAddComplaintModal = showAddComplaintModal;
window.assignComplaint = assignComplaint;
window.updateComplaintStatus = updateComplaintStatus;
window.deleteComplaint = deleteComplaint;
window.showUploadDocModal = showUploadDocModal;
window.downloadDoc = downloadDoc;
window.deleteDoc = deleteDoc;
window.showAddUserModal = showAddUserModal;
window.deleteUser = deleteUser;
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
window.renderTrackUsers = renderTrackUsers;
window.loginWithGoogle = loginWithGoogle;
window.loginWithMicrosoft = loginWithMicrosoft;
window.checkPasswordStrength = checkPasswordStrength;
window.checkPasswordMatch = checkPasswordMatch;
window.addEventListener('DOMContentLoaded', boot);