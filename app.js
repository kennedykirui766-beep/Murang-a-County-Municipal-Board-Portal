const DB = {
  prefix: 'mbp_',
  get(key, def) {
    try {
      const data = localStorage.getItem(this.prefix + key);
      return data ? JSON.parse(data) : def;
    } catch (err) {
      return def;
    }
  },
  set(key, value) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  },
  users() { return this.get('users', []); },
  setUsers(users) { this.set('users', users); },
  members() { return this.get('members', []); },
  setMembers(members) { this.set('members', members); },
  meetings() { return this.get('meetings', []); },
  setMeetings(meetings) { this.set('meetings', meetings); },
  minutes() { return this.get('minutes', []); },
  setMinutes(minutes) { this.set('minutes', minutes); },
  complaints() { return this.get('complaints', []); },
  setComplaints(complaints) { this.set('complaints', complaints); },
  documents() { return this.get('documents', []); },
  setDocuments(documents) { this.set('documents', documents); },
  getNextId(array) { return array.length ? Math.max(...array.map(item => item.id || 0)) + 1 : 1; }
};

function seedData() {
  if (DB.get('seeded', false)) return;
  const today = new Date().toISOString().slice(0, 10);
  const users = [
    { id: 1, name: 'System Admin', email: 'admin@muranga.go.ke', password: 'admin123', role: 'system_admin', municipality: 'all' },
    { id: 2, name: 'Kenol Admin', email: 'kenol@muranga.go.ke', password: 'admin123', role: 'municipal_admin', municipality: 'kenol' },
    { id: 3, name: 'Kangare Admin', email: 'kangare@muranga.go.ke', password: 'admin123', role: 'municipal_admin', municipality: 'kangare' },
    { id: 4, name: "Murang'a Town Admin", email: 'muranga@muranga.go.ke', password: 'admin123', role: 'municipal_admin', municipality: 'muranga_town' },
    { id: 5, name: 'John Board Member', email: 'john@kenol.go.ke', password: 'member123', role: 'board_member', municipality: 'kenol' },
    { id: 6, name: 'Mary Board Member', email: 'mary@kangare.go.ke', password: 'member123', role: 'board_member', municipality: 'kangare' },
    { id: 7, name: 'Peter Board Member', email: 'peter@muranga.go.ke', password: 'member123', role: 'board_member', municipality: 'muranga_town' },
    { id: 8, name: 'Dept Officer Kenol', email: 'officer@kenol.go.ke', password: 'officer123', role: 'department_officer', municipality: 'kenol' },
    { id: 9, name: 'Social Officer', email: 'social@muranga.go.ke', password: 'social123', role: 'social_officer', municipality: 'all' }
  ];
  DB.setUsers(users);
  DB.setMembers([
    { id: 1, name: 'John Board Member', email: 'john@kenol.go.ke', role: 'board_member', municipality: 'kenol', joined: today },
    { id: 2, name: 'Mary Board Member', email: 'mary@kangare.go.ke', role: 'board_member', municipality: 'kangare', joined: today },
    { id: 3, name: 'Peter Board Member', email: 'peter@muranga.go.ke', role: 'board_member', municipality: 'muranga_town', joined: today },
    { id: 4, name: 'Dept Officer Kenol', email: 'officer@kenol.go.ke', role: 'department_officer', municipality: 'kenol', joined: today }
  ]);
  DB.setMeetings([
    { id: 1, title: 'Kenol Budget Meeting', date: '2026-06-20', time: '10:00', location: 'Kenol Hall', municipality: 'kenol', status: 'scheduled', attendees: [] },
    { id: 2, title: 'Kangare Development Forum', date: '2026-06-22', time: '14:00', location: 'Kangare Centre', municipality: 'kangare', status: 'scheduled', attendees: [] },
    { id: 3, title: "Murang'a Town Council", date: '2026-06-25', time: '09:30', location: 'Town Hall', municipality: 'muranga_town', status: 'scheduled', attendees: [] }
  ]);
  DB.setComplaints([
    { id: 1, title: 'Road damage in Kenol', description: 'Potholes on main road near Kenol market.', municipality: 'kenol', status: 'pending', assignedTo: '', date: today },
    { id: 2, title: 'Water shortage Kangare', description: 'Irregular water supply in Kangare estate.', municipality: 'kangare', status: 'in_progress', assignedTo: 'Dept Officer Kenol', date: today },
    { id: 3, title: "Street lighting Murang'a Town", description: 'Several street lights are not working.', municipality: 'muranga_town', status: 'resolved', assignedTo: 'Social Officer', date: today }
  ]);
  DB.setMinutes([
    { id: 1, meetingId: 1, content: 'Kenol budget approved and upcoming maintenance projects were discussed.', uploadedBy: 'Kenol Admin', municipality: 'kenol', uploadDate: today }
  ]);
  DB.setDocuments([]);
  DB.set('seeded', true);
}

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
    system_admin: 'System Admin',
    municipal_admin: 'Municipal Admin',
    board_member: 'Board Member',
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
  return user && user.role === 'system_admin';
}

function canManageAll(user) {
  return user && (user.role === 'system_admin' || user.role === 'social_officer');
}

function getAllowedItems(items, key = 'municipality') {
  if (canManageAll(currentUser)) return items;
  return items.filter(item => item[key] === currentUser.municipality || item[key] === 'all');
}

function login(email, password) {
  const users = DB.users();
  const found = users.find(user => user.email === email && user.password === password);
  if (!found) return false;
  currentUser = found;
  localStorage.setItem('mbp_session', JSON.stringify({ userId: found.id }));
  return true;
}

function logout() {
  localStorage.removeItem('mbp_session');
  window.location.href = 'index.html';
}

function restoreSession() {
  const session = localStorage.getItem('mbp_session');
  if (!session) return false;
  try {
    const data = JSON.parse(session);
    const users = DB.users();
    const user = users.find(u => u.id === data.userId);
    if (user) {
      currentUser = user;
      return true;
    }
  } catch (err) {
    return false;
  }
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
  if (usersNav) {
    usersNav.style.display = isSystemAdmin(currentUser) ? 'flex' : 'none';
  }
}

function render(html) {
  const container = byId('pageContainer');
  if (container) container.innerHTML = html;
}

function navigate(page) {
  const items = qsa('.sidebar .nav-item');
  items.forEach(item => item.classList.toggle('active', item.dataset.page === page));
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'members': renderMembers(); break;
    case 'meetings': renderMeetings(); break;
    case 'minutes': renderMinutes(); break;
    case 'complaints': renderComplaints(); break;
    case 'documents': renderDocuments(); break;
    case 'users': renderUsers(); break;
    default: render('<div class="card"><h2>Page not found</h2></div>');
  }
}

function renderDashboard() {
  const members = getAllowedItems(DB.members());
  const meetings = getAllowedItems(DB.meetings());
  const complaints = getAllowedItems(DB.complaints());
  const minutes = getAllowedItems(DB.minutes());
  const pending = complaints.filter(c => c.status === 'pending').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  render(`
    <div class="page-header">
      <h2><i class="fas fa-chart-pie"></i> Dashboard</h2>
      <span>${getMunicipalityLabel(currentUser.municipality === 'all' ? 'all' : currentUser.municipality)}</span>
    </div>
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

function renderMembers() {
  const members = getAllowedItems(DB.members());
  const canAdd = currentUser.role === 'municipal_admin' || currentUser.role === 'system_admin';
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

function showAddMemberModal() {
  const municipalities = canManageAll(currentUser) ? ['kenol', 'kangare', 'muranga_town', 'all'] : [currentUser.municipality];
  const roleOptions = currentUser.role === 'system_admin' ? ['municipal_admin', 'board_member', 'department_officer', 'social_officer'] : ['board_member', 'department_officer'];
  showModal(`
    <h3><i class="fas fa-user-plus"></i> Add Member</h3>
    <form id="addMemberForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="mName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="mEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="text" id="mPassword" value="member123" required /></div>
      <div class="form-group"><label>Role</label><select id="mRole">${roleOptions.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Municipality</label><select id="mMunicipality">${municipalities.map(m => `<option value="${m}">${getMunicipalityLabel(m)}</option>`).join('')}</select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Add Member</button>
    </form>
  `);
  byId('addMemberForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const name = byId('mName').value.trim();
    const email = byId('mEmail').value.trim();
    const password = byId('mPassword').value.trim();
    const role = byId('mRole').value;
    const municipality = byId('mMunicipality').value;
    if (!name || !email || !password) { toast('Complete all fields', 'danger'); return; }
    const users = DB.users();
    if (users.find(u => u.email === email)) { toast('Email already exists', 'danger'); return; }
    const user = { id: DB.getNextId(users), name, email, password, role, municipality };
    users.push(user);
    DB.setUsers(users);
    const members = DB.members();
    members.push({ id: DB.getNextId(members), name, email, role, municipality, joined: new Date().toISOString().slice(0, 10) });
    DB.setMembers(members);
    closeModal();
    toast('Member added', 'success');
    navigate('members');
  });
}

function deleteMember(id) {
  if (!confirm('Delete this member?')) return;
  DB.setMembers(DB.members().filter(member => member.id !== id));
  DB.setUsers(DB.users().filter(user => user.id !== id));
  toast('Member deleted', 'success');
  navigate('members');
}

function renderMeetings() {
  const meetings = getAllowedItems(DB.meetings());
  render(`
    <div class="page-header">
      <h2><i class="fas fa-calendar-alt"></i> Meetings</h2>
      <button class="btn btn-primary btn-sm" onclick="showScheduleMeetingModal()"><i class="fas fa-plus"></i> Schedule</button>
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
          <div style="margin-top:0.85rem;color:var(--text-muted);font-size:0.9rem;"><i class="fas fa-users"></i> ${meeting.attendees.length} attending</div>
          <div class="actions" style="margin-top:0.85rem;">
            <button class="btn btn-success btn-sm" onclick="confirmAttendance(${meeting.id})"><i class="fas fa-check"></i> Attend</button>
            <button class="btn btn-warning btn-sm" onclick="declineAttendance(${meeting.id})"><i class="fas fa-times"></i> Decline</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMeeting(${meeting.id})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('') : '<div class="card text-center text-muted">No meetings scheduled yet.</div>'}
    </div>
  `);
}

function showScheduleMeetingModal() {
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
  byId('scheduleMeetingForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const title = byId('mtTitle').value.trim();
    const date = byId('mtDate').value;
    const time = byId('mtTime').value;
    const location = byId('mtLocation').value.trim();
    const municipality = byId('mtMunicipality').value;
    if (!title || !date || !time || !location) { toast('Complete all fields', 'danger'); return; }
    const meetings = DB.meetings();
    meetings.push({ id: DB.getNextId(meetings), title, date, time, location, municipality, status: 'scheduled', attendees: [] });
    DB.setMeetings(meetings);
    closeModal();
    toast('Meeting scheduled', 'success');
    navigate('meetings');
  });
}

function confirmAttendance(id) {
  const meetings = DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) return;
  if (!meeting.attendees.includes(currentUser.email)) {
    meeting.attendees.push(currentUser.email);
    DB.setMeetings(meetings);
    toast('Attendance confirmed', 'success');
  } else {
    toast('Already attending', 'info');
  }
  navigate('meetings');
}

function declineAttendance(id) {
  const meetings = DB.meetings();
  const meeting = meetings.find(item => item.id === id);
  if (!meeting) return;
  meeting.attendees = meeting.attendees.filter(email => email !== currentUser.email);
  DB.setMeetings(meetings);
  toast('Attendance declined', 'info');
  navigate('meetings');
}

function deleteMeeting(id) {
  if (!confirm('Delete this meeting?')) return;
  DB.setMeetings(DB.meetings().filter(item => item.id !== id));
  toast('Meeting deleted', 'success');
  navigate('meetings');
}

function renderMinutes() {
  const minutes = getAllowedItems(DB.minutes());
  render(`
    <div class="page-header">
      <h2><i class="fas fa-file-alt"></i> Meeting Minutes</h2>
      <button class="btn btn-primary btn-sm" onclick="showUploadMinutesModal()"><i class="fas fa-upload"></i> Upload Minutes</button>
    </div>
    ${minutes.length ? minutes.map(item => `
      <div class="card">
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

function showUploadMinutesModal() {
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
  byId('uploadMinutesForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const content = byId('minContent').value.trim();
    const municipality = byId('minMunicipality').value;
    const meetingId = parseInt(byId('minMeetingId').value) || null;
    if (!content) { toast('Please add content', 'danger'); return; }
    const minutes = DB.minutes();
    minutes.push({ id: DB.getNextId(minutes), meetingId, content, uploadedBy: currentUser.name, municipality, uploadDate: new Date().toISOString().slice(0, 10) });
    DB.setMinutes(minutes);
    closeModal();
    toast('Minutes uploaded', 'success');
    navigate('minutes');
  });
}

function renderComplaints() {
  const complaints = getAllowedItems(DB.complaints());
  const officers = DB.members().filter(member => member.role === 'department_officer' || member.role === 'social_officer');
  render(`
    <div class="page-header">
      <h2><i class="fas fa-exclamation-triangle"></i> Complaints</h2>
      <button class="btn btn-primary btn-sm" onclick="showAddComplaintModal()"><i class="fas fa-plus"></i> Report Complaint</button>
    </div>
    ${complaints.length ? complaints.map(c => `
      <div class="complaint-item">
        <div class="head">
          <strong>${c.title}</strong>
          <span class="badge ${c.status === 'pending' ? 'badge-danger' : c.status === 'resolved' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
        </div>
        <p style="margin:0.75rem 0;">${c.description}</p>
        <div class="meta">${getMunicipalityLabel(c.municipality)} • ${formatDate(c.date)} • ${c.assignedTo || 'Unassigned'}</div>
        ${isSystemAdmin(currentUser) || currentUser.role === 'municipal_admin' ? `
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

function showAddComplaintModal() {
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
  byId('addComplaintForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const title = byId('cTitle').value.trim();
    const description = byId('cDesc').value.trim();
    const municipality = byId('cMunicipality').value;
    if (!title || !description) { toast('Complete all fields', 'danger'); return; }
    const complaints = DB.complaints();
    complaints.push({ id: DB.getNextId(complaints), title, description, municipality, status: 'pending', assignedTo: '', date: new Date().toISOString().slice(0, 10) });
    DB.setComplaints(complaints);
    closeModal();
    toast('Complaint submitted', 'success');
    navigate('complaints');
  });
}

function assignComplaint(id) {
  const select = byId(`assignSelect_${id}`);
  if (!select) return;
  const assignee = select.value;
  if (!assignee) { toast('Select an assignee', 'danger'); return; }
  const complaints = DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (complaint) {
    complaint.assignedTo = assignee;
    complaint.status = 'in_progress';
    DB.setComplaints(complaints);
    toast(`Assigned to ${assignee}`, 'success');
    navigate('complaints');
  }
}

function updateComplaintStatus(id, status) {
  const complaints = DB.complaints();
  const complaint = complaints.find(item => item.id === id);
  if (!complaint) return;
  complaint.status = status;
  DB.setComplaints(complaints);
  toast('Complaint updated', 'success');
  navigate('complaints');
}

function deleteComplaint(id) {
  if (!confirm('Delete this complaint?')) return;
  DB.setComplaints(DB.complaints().filter(item => item.id !== id));
  toast('Complaint deleted', 'success');
  navigate('complaints');
}

function renderDocuments() {
  const documents = getAllowedItems(DB.documents());
  render(`
    <div class="page-header">
      <h2><i class="fas fa-folder-open"></i> Documents</h2>
      <button class="btn btn-primary btn-sm" onclick="showUploadDocModal()"><i class="fas fa-upload"></i> Upload Document</button>
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
                <button class="btn btn-danger btn-sm" onclick="deleteDoc(${doc.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center text-muted">No documents uploaded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

function showUploadDocModal() {
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
  byId('uploadDocForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const name = byId('docName').value.trim();
    const type = byId('docType').value;
    const municipality = byId('docMunicipality').value;
    const fileName = byId('docFileName').value.trim();
    if (!name || !fileName) { toast('Complete all fields', 'danger'); return; }
    const documents = DB.documents();
    documents.push({ id: DB.getNextId(documents), name, type, municipality, uploadedBy: currentUser.name, uploadDate: new Date().toISOString().slice(0, 10), fileName });
    DB.setDocuments(documents);
    closeModal();
    toast('Document uploaded', 'success');
    navigate('documents');
  });
}

function downloadDoc(id) {
  const doc = DB.documents().find(item => item.id === id);
  if (!doc) return;
  const link = document.createElement('a');
  link.href = '#';
  link.download = doc.fileName || doc.name;
  link.click();
  toast(`Download started: ${doc.fileName || doc.name}`, 'success');
}

function deleteDoc(id) {
  if (!confirm('Delete this document?')) return;
  DB.setDocuments(DB.documents().filter(item => item.id !== id));
  toast('Document deleted', 'success');
  navigate('documents');
}

function renderUsers() {
  if (!isSystemAdmin(currentUser)) {
    render('<div class="card"><h2>Access Denied</h2></div>');
    return;
  }
  const users = DB.users();
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
              <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `);
}

function showAddUserModal() {
  showModal(`
    <h3><i class="fas fa-user-plus"></i> Create User Account</h3>
    <form id="addUserForm">
      <div class="form-group"><label>Full Name</label><input type="text" id="uName" required /></div>
      <div class="form-group"><label>Email</label><input type="email" id="uEmail" required /></div>
      <div class="form-group"><label>Password</label><input type="text" id="uPassword" value="admin123" required /></div>
      <div class="form-group"><label>Role</label><select id="uRole"><option value="system_admin">System Admin</option><option value="municipal_admin">Municipal Admin</option><option value="board_member">Board Member</option><option value="department_officer">Department Officer</option><option value="social_officer">Social Officer</option></select></div>
      <div class="form-group"><label>Municipality</label><select id="uMunicipality"><option value="kenol">Kenol</option><option value="kangare">Kangare</option><option value="muranga_town">Murang'a Town</option><option value="all">All</option></select></div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Create</button>
    </form>
  `);
  byId('addUserForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const name = byId('uName').value.trim();
    const email = byId('uEmail').value.trim();
    const password = byId('uPassword').value.trim();
    const role = byId('uRole').value;
    const municipality = byId('uMunicipality').value;
    if (!name || !email || !password) { toast('Fill all fields', 'danger'); return; }
    const users = DB.users();
    if (users.find(u => u.email === email)) { toast('Email already exists', 'danger'); return; }
    const user = { id: DB.getNextId(users), name, email, password, role, municipality };
    users.push(user);
    DB.setUsers(users);
    if (role !== 'system_admin') {
      const members = DB.members();
      members.push({ id: DB.getNextId(members), name, email, role, municipality, joined: new Date().toISOString().slice(0, 10) });
      DB.setMembers(members);
    }
    closeModal();
    toast('User created', 'success');
    navigate('users');
  });
}

function deleteUser(id) {
  const users = DB.users();
  const target = users.find(user => user.id === id);
  if (target && target.role === 'system_admin' && users.filter(user => user.role === 'system_admin').length <= 1) {
    toast('Cannot delete the last system admin', 'danger');
    return;
  }
  if (!confirm('Delete this user?')) return;
  DB.setUsers(users.filter(user => user.id !== id));
  DB.setMembers(DB.members().filter(member => member.id !== id));
  toast('User deleted', 'success');
  navigate('users');
}

function showModal(content) {
  const body = byId('modalBody');
  if (body) body.innerHTML = content;
  const overlay = byId('modalOverlay');
  if (overlay) overlay.classList.add('active');
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

function boot() {
  seedData();
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
    if (restoreSession()) {
      window.location.href = 'home.html';
      return;
    }
    const form = byId('loginForm');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const email = byId('loginEmail').value.trim();
        const password = byId('loginPassword').value.trim();
        if (login(email, password)) {
          byId('loginError').style.display = 'none';
          window.location.href = 'home.html';
        } else {
          byId('loginError').style.display = 'block';
        }
      });
    }
    return;
  }

  if (!restoreSession()) {
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
    navigate('dashboard');
  }
  if (page === 'settings') {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal();
      if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); logout(); }
    });
  }
}

window.navigate = navigate;
window.showAddMemberModal = showAddMemberModal;
window.deleteMember = deleteMember;
window.showScheduleMeetingModal = showScheduleMeetingModal;
window.confirmAttendance = confirmAttendance;
window.declineAttendance = declineAttendance;
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
window.addEventListener('DOMContentLoaded', boot);
