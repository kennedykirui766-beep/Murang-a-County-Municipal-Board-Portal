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