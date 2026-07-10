# Murang'a County Municipal Board Portal

A comprehensive web-based management system for the Murang'a County Municipal Board. This application provides role-based access control for managing board members, meetings, minutes, complaints, documents, projects, and user administration.

---

## 🚀 Features

### Core Modules
- **Dashboard** - Overview with statistics, recent meetings, upcoming events, and budget utilization
- **Board Members** - Manage member profiles with role-based permissions
- **Meetings** - Schedule, manage attendance, QR code check-in, and file attachments
- **Meeting Minutes** - Upload and link minutes to meetings with supporting documents
- **Complaints Management** - Submit, assign, track, and resolve complaints
- **Documents** - Upload, view, download, and manage documents
- **Email System** - Compose and send emails to users
- **Announcements** - Create and manage broadcasts/announcements
- **Projects** - Track municipal projects with milestones, progress, and updates
- **User Management** - Create, edit, delete users with permission control
- **Approvals** - Approve or reject new user registrations
- **Reports & Audit** - View system reports and audit logs with export capabilities

### Role-Based Access Control
The system supports multiple user roles with distinct permissions:

| Role | Description |
|------|-------------|
| **Super Admin** | Full system access, manages all users and permissions |
| **Municipal Officer** | Manages municipality data, meetings, minutes, complaints, approvals |
| **Secretary** | Manages meetings, minutes, documents, announcements, complaint assignments |
| **Social Officer** | Handles complaints, assigns and resolves issues |
| **Department Officer** | Views data and submits complaints |
| **Member** | Basic access: views information and submits complaints |

### Key Functionalities
- ✅ **QR Code Attendance** - Generate and scan QR codes for meeting attendance with location verification
- ✅ **Bulk Attendance Entry** - Quickly mark multiple attendees for a meeting
- ✅ **Physical Attendance Recording** - Record attendance manually with location tracking
- ✅ **File Upload Support** - Upload PDFs, Word, Excel, PowerPoint, and images (max 10MB)
- ✅ **File Preview & Download** - View and download attached files
- ✅ **Audit Logging** - Track user actions and system activities
- ✅ **Export Reports** - Export data in CSV, PDF, or JSON formats
- ✅ **Accessibility Tools** - Text size, spacing, dark/light theme, text-to-speech

---

## 📁 Project Structure

---

## 🛠️ Technology Stack

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with dark/light theme support
- **JavaScript (Vanilla)** - Application logic
- **Font Awesome** - Icons
- **LocalStorage** - Session management

### Backend
- **Python 3.8+** - Server-side logic
- **Flask** - Web framework
- **SQLAlchemy** - ORM
- **SQLite** - Database (can be upgraded to PostgreSQL/MySQL)
- **Flask-CORS** - Cross-origin resource sharing
- **Werkzeug** - Password hashing and utilities

---

## 🔐 Demo Credentials

Use these pre-seeded accounts for testing:

| Role | Email | Password |
|------|-------|----------|
| System Admin | `dev@muranga.go.ke` | `dev123` |
| Municipal Officer (Kenol) | `kenol@muranga.go.ke` | `admin123` |
| Municipal Officer (Kangare) | `kangare@kangare.go.ke` | `admin123` |
| Municipal Officer (Murang'a Town) | `muranga@muranga.go.ke` | `admin123` |
| Member | `member@muranga.go.ke` | `member123` |
| Social Officer | `social@muranga.go.ke` | `social123` |
| Secretary | `secretary@muranga.go.ke` | `secretary123` |

---

## 🚦 Setup & Installation

### Prerequisites
- Python 3.8 or higher
- Web browser (Chrome, Firefox, Edge recommended)
- Git (optional, for cloning)

### Option 1: Quick Start with Flask Backend (Recommended)

1. **Clone or download** the project to `c:\projo`

2. **Install Python dependencies**:
```bash
pip install flask flask-cors flask-sqlalchemy flask-migrate werkzeug

start the Flask server:

bash
cd c:\projo
python app.py
Open your browser and navigate to:

text
http://127.0.0.1:5000
Login using the demo credentials above.

Option 2: Static Mode (No Backend)
Open index.html directly in your browser

Data is stored in LocalStorage (demo mode with seeded data)

Use demo credentials to login (same as above)

📊 Database Schema
The system uses the following main models:

User Model
id - Primary key

name - Full name

email - Unique email address

password - Hashed password

role - User role (super_admin, municipal_officer, secretary, social_officer, department_officer, member)

municipality - Assigned municipality (kenol, kangare, muranga_town, all)

is_approved - Approval status

is_rejected - Rejection status

permissions - Custom permission set (JSON)

last_seen - Last activity timestamp

registration_date - Account creation date

Member Model
id - Primary key

name - Full name

email - Email address

role - Member role

municipality - Assigned municipality

joined - Join date

Meeting Model
id - Primary key

title - Meeting title

description - Meeting description/agenda

date - Meeting date

time - Meeting time

location - Meeting venue

municipality - Municipality

status - scheduled, in_progress, completed, cancelled

attendees - List of attending emails (JSON)

declined - List of declined attendees with reasons (JSON)

files - Attached files (JSON)

Minute Model
id - Primary key

title - Minutes title

summary - Key points summary

content - Full minutes content

meetingId - Related meeting ID

uploadedBy - Uploader name

municipality - Municipality

uploadDate - Upload date

files - Attached files (JSON)

Complaint Model
id - Primary key

title - Complaint title

description - Complaint details

municipality - Municipality

status - pending, in_progress, resolved

assignedTo - Assigned person name

assignedToRole - Role of assigned person

submittedBy - Submitter name

date - Submission date

Document Model
id - Primary key

name - Document name

type - Document type

municipality - Municipality

uploadedBy - Uploader name

uploadDate - Upload date

fileName - Original filename

fileData - Base64 encoded file content

fileSize - File size in bytes

fileType - MIME type

Project Model
id - Primary key

name - Project name

description - Project description

municipality - Municipality

category - Project category

status - planning, active, on_hold, completed

priority - low, medium, high, critical

budget - Total budget

spent - Amount spent

start_date - Start date

end_date - End date

progress - Progress percentage (0-100)

created_by - Creator name

created_date - Creation date

last_updated - Last update timestamp

files - Attached files (JSON)

Email Model
id - Primary key

from_email - Sender email

to_email - Recipient email

subject - Email subject

body - Email body

timestamp - Sent timestamp

read - Read status

municipality - Municipality

Broadcast Model
id - Primary key

message - Announcement message

sender - Sender name

timestamp - Sent timestamp

municipality - Municipality

files - Attached files (JSON)

ProjectMilestone Model
id - Primary key

project_id - Related project ID

name - Milestone name

description - Description

due_date - Due date

completed_date - Completion date

status - pending, in_progress, completed

progress - Progress percentage

ProjectUpdate Model
id - Primary key

project_id - Related project ID

user_id - User ID

user_name - User name

message - Update message

progress - Progress percentage

timestamp - Update timestamp

files - Attached files (JSON)

MeetingAttendance Model
id - Primary key

meeting_id - Related meeting ID

user_id - User ID

user_name - User name

user_email - User email

check_in_time - Check-in timestamp

check_in_method - manual, qr, bulk

location_lat - Latitude

location_lng - Longitude

location_accuracy - Location accuracy

is_verified - Verification status

verified_by - Verifier name

notes - Additional notes

🔄 API Endpoints
Authentication
Method	Endpoint	Description
POST	/api/login	User login
POST	/api/register	User registration
POST	/api/oauth-login	OAuth login (Google/Microsoft)
POST	/api/heartbeat	Update user online status
POST	/api/reset-password/{id}	Reset user password
CRUD Operations
Method	Endpoint	Description
GET	/api/{entity}	Get all items
POST	/api/{entity}	Create new item
GET	/api/{entity}/{id}	Get specific item
PUT	/api/{entity}/{id}	Update specific item
DELETE	/api/{entity}/{id}	Delete specific item
PUT	/api/{entity}	Replace entire collection
Supported entities: users, members, meetings, minutes, complaints, documents, emails, broadcasts

Projects API
Method	Endpoint	Description
GET	/api/projects	Get all projects
POST	/api/projects	Create project
GET	/api/projects/{id}	Get project details
PUT	/api/projects/{id}	Update project
DELETE	/api/projects/{id}	Delete project
GET	/api/projects/dashboard-stats	Get project statistics
GET	/api/projects/{id}/milestones	Get project milestones
POST	/api/projects/{id}/milestones	Add milestone
GET	/api/projects/{id}/updates	Get project updates
POST	/api/projects/{id}/updates	Add project update
Attendance API
Method	Endpoint	Description
GET	/api/meetings/{id}/attendance	Get attendance records
POST	/api/meetings/{id}/attendance	Record attendance
POST	/api/meetings/{id}/attendance/bulk	Bulk attendance entry
DELETE	/api/meetings/{id}/attendance/{user_id}	Remove attendance
Reports API
Method	Endpoint	Description
GET	/api/reports/dashboard-stats	Get dashboard statistics
GET	/api/reports/audit/logs	Get audit logs
GET	/api/reports/summary	Get report summary
🎨 Customization Guide
Adding a New Role
Add role to getRoleLabel() in app_backend.js:

javascript
function getRoleLabel(role) {
  return {
    // ... existing roles
    'new_role': 'New Role Label'
  }[role] || role;
}
Add permissions to DEFAULT_PERMISSION_SETS and DEFAULT_PERMISSIONS:

javascript
const DEFAULT_PERMISSION_SETS = {
  // ... existing roles
  'new_role': [
    'view_members',
    'view_meetings',
    // ... other permissions
  ]
};
Update role options in user management forms:

javascript
// In showAddUserModal, showEditUserModal, showPromoteUserModal
const roles = ['super_admin', 'municipal_officer', 'member', 'social_officer', 'department_officer', 'secretary', 'new_role'];
Add role checks in render functions:

javascript
const canManage = currentUser.role === 'municipal_officer' || currentUser.role === 'super_admin' || currentUser.role === 'secretary' || currentUser.role === 'new_role';
Adding a New Entity
Create model class in models.py:

python
class NewEntity(db.Model):
    __tablename__ = 'new_entities'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    # ... other fields
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            # ... other fields
        }
Add entity name to get_model() in app.py:

python
def get_model(entity_name):
    return {
        # ... existing entities
        'new_entities': NewEntity
    }.get(entity_name)
Add entity to frontend DB object in app_backend.js:

javascript
const DB = {
    // ... existing methods
    async newEntities() { return await this._fetchData('new_entities'); },
    async setNewEntities(data) { await this._replaceData('new_entities', data); },
    async addNewEntity(item) { return await this._addItem('new_entities', item); },
}
Create render and CRUD functions:

javascript
async function renderNewEntities() {
    const items = getAllowedItems(await DB.newEntities());
    // ... render logic
}

async function showAddNewEntityModal() {
    // ... modal logic
}

async function deleteNewEntity(id) {
    // ... delete logic
}
Customizing Theme
The application supports light and dark themes. Colors are defined in CSS variables:

css
:root {
  --primary: #2e7d32;
  --secondary: #1b5e20;
  --background: #f5f7fa;
  --surface: #ffffff;
  --surface-alt: #f0f2f5;
  --text: #1a1a2e;
  --text-muted: #666;
  --border: #e2e8f0;
  --shadow: 0 2px 12px rgba(0,0,0,0.08);
  --gold: #b8860b;
}
To customize the theme, modify these variables in styles.css.

🧪 Testing
Manual Testing Checklist
Login with different roles

Dashboard statistics display correctly

CRUD operations for all entities

File uploads (PDF, Word, Excel, PowerPoint, Images)

File preview and download

QR code generation and scanning

Meeting attendance recording

Bulk attendance entry

Email composition and sending

Announcement creation

User approvals

Report generation and export

Audit log viewing

Accessibility features (text size, spacing, theme, TTS)

Session persistence

Logout functionality

Browser Developer Tools
Console: Inspect data with localStorage.getItem('mbp_session')

Application: View stored data in LocalStorage

Network: Debug API calls and responses

Elements: Inspect and modify DOM

📝 Development Notes
Data Storage
LocalStorage - Session data and demo mode

SQLite - Persistent data storage when using Flask backend

Session key: mbp_session stores { userId: number }

Session Management
Session stored in localStorage with key mbp_session

Automatic logout on inactivity (60 minutes)

Session persists across page reloads

Heartbeat API updates user online status every 60 seconds

Security Notes
Passwords are hashed using werkzeug.security.generate_password_hash

SQLite database is file-based; for production use PostgreSQL/MySQL

CORS is configured for development; restrict in production

All API endpoints validate input data

Role-based access control on both frontend and backend

Performance Tips
Use pagination for large datasets (coming soon)

Implement caching for frequently accessed data

Optimize file uploads (max 10MB per file)

Use database indexes for faster queries

🐛 Troubleshooting
Common Issues and Solutions
"Database is locked" error

Close other connections to the database

Restart the Flask server

Delete municipal_board.db and restart (data will be re-created)

Login fails

Check that Flask server is running (python app.py)

Verify credentials match seeded data

Clear browser cache and localStorage

Check console for errors

QR Code not working

Ensure camera permissions are granted

Check that meeting has location data

Try the "Manual Check-In" option

Check browser console for errors

File upload fails

Check file size (max 10MB)

Verify file type is supported

Check server logs for errors

Ensure server has write permissions

Data not persisting

Verify Flask server is running

Check SQLite file permissions

Ensure commits are successful

Check for database locks

Theme not applying

Clear browser cache

Check data-theme attribute on html element

Verify localStorage has mbp_theme value

Debug Commands
javascript
// Check session
localStorage.getItem('mbp_session')

// Clear all data
localStorage.clear()

// Check current user
console.log(currentUser)

// Test API call
fetch('http://127.0.0.1:5000/api/users')
  .then(r => r.json())
  .then(console.log)
📞 Support
Getting Help
Check the troubleshooting section above

Review browser console for errors (F12)

Check Flask server logs for backend errors

Verify database integrity:

bash
sqlite3 municipal_board.db .tables
sqlite3 municipal_board.db "SELECT * FROM users;"
Reporting Issues
When reporting issues, include:

Error messages (from console and server)

Steps to reproduce

Browser and version

Operating system

User role and permissions

🔄 Migration Guide
Upgrading from v1.x to v2.x
Backup your database:

bash
cp municipal_board.db municipal_board.db.backup
Pull latest code:

bash
git pull origin main
Install new dependencies:

bash
pip install -r requirements.txt
Run database migrations:

bash
flask db upgrade
Restart server:

bash
python app.py
Moving to Production
Change database to PostgreSQL/MySQL:

python
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/dbname'
Disable debug mode:

python
app.run(debug=False)
Set up proper CORS restrictions:

python
CORS(app, origins=['https://yourdomain.com'])
Use environment variables for sensitive data:

python
import os
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
Implement HTTPS (use a reverse proxy like nginx)

Set up proper logging:

python
import logging
logging.basicConfig(filename='app.log', level=logging.INFO)
📄 License
This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

🤝 Contributing
Fork the repository

Create a feature branch

Make your changes

Test thoroughly

Submit a pull request

Coding Standards
Use 2-space indentation for JavaScript

Use 4-space indentation for Python

Follow PEP 8 guidelines for Python

Use camelCase for JavaScript variables

Use snake_case for Python variables

📋 Changelog
v2.0.0 (Current)
Added Secretary role with full permissions

Added Project Management module

Added Meeting Attendance tracking

Added QR Code check-in system

Added Bulk attendance entry

Added Export to CSV/PDF/JSON

Added Audit logging system

Improved UI/UX design

Enhanced file handling

v1.0.0
Initial release

Core CRUD operations

Role-based access control

Basic dashboard

File upload support

📚 Additional Resources
Flask Documentation: https://flask.palletsprojects.com/

SQLAlchemy Documentation: https://www.sqlalchemy.org/

Font Awesome Icons: https://fontawesome.com/icons

QR Code API: https://api.qrserver.com/

Generated and maintained in workspace root c:\projo

Last Updated: July 2026

text
