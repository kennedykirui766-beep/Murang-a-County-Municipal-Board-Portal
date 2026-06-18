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
let uploadedMeetingFiles = [];
let uploadedMinutesFiles = [];
let uploadedBroadcastFiles = [];

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
    case 'track': await renderTrackUsers(); break;
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

// ============= UPDATED MEETING FUNCTIONS WITH FILE PREVIEW =============

// File upload handlers for meetings
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

// Enhanced Schedule Meeting Modal
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

// Enhanced View Meeting Files with Preview
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

// ============= ENHANCED VIEW ATTENDANCE =============

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

// ============= ENHANCED MINUTES FUNCTIONS =============

// Minutes file upload handlers
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

// Enhanced Show Upload Minutes Modal with Title, Summary, and File Upload
async function showUploadMinutesModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  uploadedMinutesFiles = [];
  
  // Get meetings for the dropdown
  const meetings = await DB.meetings();
  const allowedMeetings = getAllowedItems(meetings);
  
  // Generate meeting ID options
  let meetingOptions = '<option value="">None (General Minutes)</option>';
  allowedMeetings.forEach(meeting => {
    meetingOptions += `<option value="${meeting.id}">${meeting.id} - ${meeting.title} (${formatDate(meeting.date)})</option>`;
  });

  showModal(`
    <h3><i class="fas fa-file-alt"></i> Upload Meeting Minutes</h3>
    <form id="uploadMinutesForm" enctype="multipart/form-data">
      <div class="form-group">
        <label>Minutes Title <span style="color:var(--danger);">*</span></label>
        <input type="text" id="minTitle" required placeholder="Enter minutes title (e.g., Kenol Budget Meeting Minutes)" />
      </div>
      
      <div class="form-group">
        <label>Summary / Key Points</label>
        <textarea id="minSummary" rows="3" placeholder="Enter a brief summary of key decisions and outcomes..."></textarea>
      </div>
      
      <div class="form-group">
        <label>Content / Description <span style="color:var(--danger);">*</span></label>
        <textarea id="minContent" rows="5" required placeholder="Enter detailed minutes content..."></textarea>
      </div>
      
      <div class="form-group">
        <label>Related Meeting (Optional)</label>
        <select id="minMeetingId">
          ${meetingOptions}
        </select>
        <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">
          Select a meeting to associate these minutes with, or leave as "None" for general minutes.
        </small>
      </div>
      
      <div class="form-group">
        <label>Municipality <span style="color:var(--danger);">*</span></label>
        <select id="minMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select>
      </div>
      
      <div class="form-group">
        <label>Upload Supporting Documents</label>
        <div style="border:2px dashed var(--border); border-radius:12px; padding:1.5rem; text-align:center; cursor:pointer; transition:all 0.3s;" 
             id="minutesUploadDropZone" 
             ondrop="handleMinutesFileDrop(event)" 
             ondragover="handleMinutesDragOver(event)"
             ondragleave="handleMinutesDragLeave(event)"
             onclick="document.getElementById('minutesFileInput').click()">
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
      
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-upload"></i> Upload Minutes</button>
    </form>
  `);
  
  byId('uploadMinutesForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const title = byId('minTitle').value.trim();
    const summary = byId('minSummary').value.trim();
    const content = byId('minContent').value.trim();
    const meetingId = byId('minMeetingId').value ? parseInt(byId('minMeetingId').value) : null;
    const municipality = byId('minMunicipality').value;
    
    if (!title || !content) { 
      toast('Please fill in title and content', 'danger'); 
      return; 
    }
    
    const minuteData = { 
      title,
      summary,
      content,
      meetingId,
      uploadedBy: currentUser.name,
      municipality,
      uploadDate: new Date().toISOString().slice(0, 10),
      files: uploadedMinutesFiles
    };
    
    const newMinute = await DB.addMinute(minuteData);
    if (newMinute) {
        closeModal();
        toast('Minutes uploaded successfully with ' + uploadedMinutesFiles.length + ' file(s) attached ✅', 'success');
        navigate('minutes');
    } else {
        toast('Failed to upload minutes', 'danger');
    }
  });
}

// Enhanced renderMinutes with title, summary, and files
async function renderMinutes() {
  const minutes = getAllowedItems(await DB.minutes());
  const canAdd = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  // Sort by upload date (newest first)
  minutes.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  
  render(`
    <div class="page-header">
      <h2><i class="fas fa-file-alt"></i> Meeting Minutes</h2>
      ${canAdd ? '<button class="btn btn-primary btn-sm" onclick="showUploadMinutesModal()"><i class="fas fa-upload"></i> Upload Minutes</button>' : ''}
    </div>
    ${minutes.length ? minutes.map(item => {
      const hasFiles = item.files && item.files.length > 0;
      const images = hasFiles ? item.files.filter(f => f.type && f.type.startsWith('image/')) : [];
      
      return `
      <div class="card">
        <div class="flex-between" style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
          <strong style="font-size:1.05rem;">${item.title || 'Untitled Minutes'}</strong>
          <span style="color:var(--text-muted); font-size:0.85rem;">
            <i class="fas fa-calendar-day"></i> ${formatDate(item.uploadDate)}
          </span>
        </div>
        ${item.meetingId ? `
          <div style="font-size:0.85rem; color:var(--text-muted); margin:0.25rem 0;">
            <i class="fas fa-link"></i> Meeting #${item.meetingId}
          </div>
        ` : ''}
        ${item.summary ? `
          <div style="margin:0.5rem 0; padding:0.5rem; background:var(--surface-alt); border-radius:8px; border-left:3px solid var(--primary); font-size:0.95rem;">
            <strong>Summary:</strong> ${item.summary}
          </div>
        ` : ''}
        <p style="margin-top:0.85rem;">${item.content}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
          <div style="color:var(--text-muted);font-size:0.95rem;">
            <i class="fas fa-user"></i> ${item.uploadedBy} • 
            <i class="fas fa-map-marker-alt"></i> ${getMunicipalityLabel(item.municipality)}
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
            <button class="btn btn-danger btn-sm" onclick="deleteMinute(${item.id})">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        ` : ''}
      </div>
    `}).join('') : '<div class="card text-center text-muted">No minutes uploaded yet.</div>'}
  `);
}

// View minutes files
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

// Preview minutes file
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

// Download minutes file
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

// Delete minute
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

// ============= ENHANCED COMPLAINTS FUNCTIONS =============

// Updated renderComplaints with new fields and assignment options
async function renderComplaints() {
  const complaints = getAllowedItems(await DB.complaints());
  const users = await DB.users();
  
  // Get all social officers and department officers for assignment
  const socialOfficers = users.filter(u => u.role === 'social_officer');
  const departmentOfficers = users.filter(u => u.role === 'department_officer');
  const allAssignable = [...socialOfficers, ...departmentOfficers];
  
  const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  const canSubmit = currentUser.role === 'member' || currentUser.role === 'department_officer' || currentUser.role === 'social_officer' || currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin';
  
  // Group assignable officers by municipality
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
      
      // Get officers for this complaint's municipality
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

// Enhanced Add Complaint Modal - now accessible to members
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

// Enhanced Assign Complaint - now includes role
async function assignComplaint(id) {
  const select = byId(`assignSelect_${id}`);
  if (!select) return;
  const assignee = select.value;
  if (!assignee) { toast('Please select an assignee', 'danger'); return; }
  
  // Get the role from the selected option
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

// Update complaint status
async function updateComplaintStatus(id, status) {
  const complaints = await DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (!complaint) return;
  complaint.status = status;
  await DB.setComplaints(complaints);
  toast(`Complaint ${status.replace('_', ' ')}`, 'success');
  navigate('complaints');
}

// Delete complaint
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

// ============= ENHANCED BROADCAST FUNCTIONS WITH FILE UPLOAD =============

// Broadcast file upload handlers
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

// Enhanced Show Broadcast Modal with File Upload
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

// Enhanced renderBroadcasts - removed Create Broadcast button from Admin Broadcast card
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

// View broadcast files
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

// Preview broadcast file
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

// Download broadcast file
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

// Delete broadcast
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

// ============= REST OF THE CODE (Documents, Users, Track Users, Emails, Shared Functions) =============

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
        } catch (e) { console.error('Heartbeat failed'); }
      }
    }, 60000);

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
      const newUser = await DB.registerUser({ name, email, password, role, municipality });
      closeModal();
      toast('Account created successfully! You can now login.', 'success');
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

// Handle profile form submission
document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const name = document.getElementById('profileName').value.trim();
      const password = document.getElementById('profilePassword').value;
      const confirmPassword = document.getElementById('profileConfirmPassword').value;
      const messageEl = document.getElementById('profileMessage');
      
      // Validate name
      if (!name) {
        showProfileMessage('Please enter your full name.', 'danger');
        return;
      }
      
      // Validate passwords if provided
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
          
          // Update display
          const nameEl = document.getElementById('settingsUserName');
          if (nameEl) nameEl.textContent = currentUser.name;
          
          const navNameEl = document.getElementById('navUserName');
          if (navNameEl) navNameEl.textContent = currentUser.name;
          
          showProfileMessage('Profile updated successfully!', 'success');
          
          // Clear password fields
          document.getElementById('profilePassword').value = '';
          document.getElementById('profileConfirmPassword').value = '';
          
          // Refresh after 2 seconds
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          const error = await response.json();
          showProfileMessage(error.error || 'Failed to update profile.', 'danger');
        }
      } catch (error) {
        console.error('Update error:', error);
        showProfileMessage('An error occurred. Please try again.', 'danger');
      }
    });
  }
  
  // Load profile data if on settings page
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
  
  // Auto-hide after 5 seconds
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

window.addEventListener('DOMContentLoaded', boot);