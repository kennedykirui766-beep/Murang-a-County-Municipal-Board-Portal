# c:\projo\app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import os
import json
import time
from sqlalchemy.exc import OperationalError

# --- Import Reports & Audit Modules ---
from report_routes import reports_bp
from audit import AuditLogger, get_client_ip

# --- App Configuration ---
app = Flask(__name__, static_folder='.')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///municipal_board.db?check_same_thread=False'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file upload
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
    'pool_timeout': 30,
    'max_overflow': 20
}

CORS(app)

# --- Initialize Database ---
from models import db
db.init_app(app)

# --- Initialize Migrations ---
migrate = Migrate(app, db)

# --- Register Reports Blueprint ---
app.register_blueprint(reports_bp)

# --- Database commit with retry logic ---
def commit_with_retry(max_retries=3, delay=0.5):
    """Commit with retry logic for SQLite lock errors"""
    for attempt in range(max_retries):
        try:
            db.session.commit()
            return True
        except OperationalError as e:
            if 'database is locked' in str(e) and attempt < max_retries - 1:
                time.sleep(delay * (attempt + 1))
                db.session.rollback()
                continue
            raise
    return False

def safe_commit():
    """Wrapper for commit_with_retry with error handling"""
    try:
        commit_with_retry()
        return True, None
    except Exception as e:
        db.session.rollback()
        return False, str(e)

# --- Create tables if they don't exist ---
with app.app_context():
    try:
        db.create_all()
        print("Database tables verified/created")
    except Exception as e:
        print(f"Database initialization warning: {e}")

# --- Routes to Serve the Frontend HTML Pages ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/home.html')
def home():
    return send_from_directory('.', 'home.html')

@app.route('/settings.html')
def settings():
    return send_from_directory('.', 'settings.html')

# ============================================================
# API ENDPOINTS - SPECIFIC ROUTES FIRST (BEFORE GENERIC ONES)
# ============================================================

@app.route('/api/login', methods=['POST'])
def login():
    from models import User
    
    credentials = request.json
    email = credentials.get('email')
    password = credentials.get('password')
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        AuditLogger.log_action(
            user_id=None,
            user_name='Unknown',
            user_email=email,
            action='LOGIN_FAILED',
            category='Auth',
            entity_type='user',
            details={'ip': get_client_ip(), 'reason': 'User not found'},
            municipality=None
        )
        return jsonify({'error': 'Invalid email or password'}), 401
    
    try:
        is_valid = check_password_hash(user.password, password)
    except Exception as e:
        return jsonify({'error': 'Login error. Please try again.'}), 500
    
    if not is_valid:
        AuditLogger.log_action(
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            action='LOGIN_FAILED',
            category='Auth',
            entity_type='user',
            entity_id=user.id,
            details={'ip': get_client_ip(), 'reason': 'Invalid password'},
            municipality=user.municipality
        )
        return jsonify({'error': 'Invalid email or password'}), 401
    
    if user.role == 'member' and not user.is_approved:
        return jsonify({'error': 'Account pending approval. Please wait for admin approval.'}), 403
    
    if user.role == 'member' and user.is_rejected:
        return jsonify({'error': 'Account has been rejected. Please contact administrator.'}), 403
    
    user.last_seen = datetime.utcnow().isoformat()
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    
    AuditLogger.log_action(
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        action='LOGIN',
        category='Auth',
        entity_type='user',
        entity_id=user.id,
        details={'ip': get_client_ip()},
        municipality=user.municipality
    )
    
    AuditLogger.log_system_activity(
        user_id=user.id,
        user_name=user.name,
        activity_type='user_login',
        description=f'User {user.name} logged in',
        entity_type='user',
        entity_id=user.id,
        municipality=user.municipality
    )
    
    return jsonify(user.to_dict()), 200


@app.route('/api/oauth-login', methods=['POST'])
def oauth_login():
    from models import User, Member
    import secrets
    
    data = request.json
    email = data.get('email')
    name = data.get('name')
    provider = data.get('provider', 'google')
    
    if not email or not name:
        return jsonify({'error': 'Name and email are required'}), 400
        
    user = User.query.filter_by(email=email).first()
    
    if not user:
        random_pass = secrets.token_urlsafe(16)
        user = User(
            name=name,
            email=email,
            password=generate_password_hash(random_pass),
            role='member',
            municipality='all',
            last_seen=datetime.utcnow().isoformat(),
            is_approved=False,
            approved_by='',
            approved_date='',
            registration_date=datetime.utcnow().isoformat(),
            is_rejected=False,
            rejected_by='',
            rejected_date=''
        )
        db.session.add(user)
        
        new_member = Member(
            name=name,
            email=email,
            role='member',
            municipality='all',
            joined=str(date.today())
        )
        db.session.add(new_member)
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        
        AuditLogger.log_action(
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            action='CREATE',
            category='Auth',
            entity_type='user',
            entity_id=user.id,
            details={'provider': provider, 'ip': get_client_ip()},
            municipality=user.municipality
        )
    else:
        if user.role == 'member' and not user.is_approved:
            return jsonify({'error': 'Account pending approval. Please wait for admin approval.'}), 403
        if user.role == 'member' and user.is_rejected:
            return jsonify({'error': 'Account has been rejected. Please contact administrator.'}), 403
        user.last_seen = datetime.utcnow().isoformat()
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        
        AuditLogger.log_action(
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            action='LOGIN',
            category='Auth',
            entity_type='user',
            entity_id=user.id,
            details={'provider': provider, 'ip': get_client_ip()},
            municipality=user.municipality
        )
        
    return jsonify(user.to_dict()), 200


@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    from models import User
    
    data = request.json
    user_id = data.get('user_id')
    
    user = User.query.get(user_id)
    if user:
        user.last_seen = datetime.utcnow().isoformat()
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        return jsonify({'status': 'success'}), 200
    return jsonify({'error': 'User not found'}), 404


@app.route('/api/register', methods=['POST'])
def register():
    from models import User, Member
    
    data = request.json
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')
    role = data.get('role', 'member')
    municipality = data.get('municipality')
    
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Email already exists'}), 400
        
    hashed_password = generate_password_hash(password)
    
    new_user = User(
        name=name,
        email=email,
        password=hashed_password,
        role=role,
        municipality=municipality,
        last_seen='',
        is_approved=False,
        approved_by='',
        approved_date='',
        registration_date=datetime.utcnow().isoformat(),
        is_rejected=False,
        rejected_by='',
        rejected_date=''
    )
    
    db.session.add(new_user)
    db.session.flush()
    
    new_member = Member(
        name=name,
        email=email,
        role=role,
        municipality=municipality,
        joined=str(date.today())
    )
    db.session.add(new_member)
    
    try:
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        
        AuditLogger.log_action(
            user_id=new_user.id,
            user_name=new_user.name,
            user_email=new_user.email,
            action='CREATE',
            category='Auth',
            entity_type='user',
            entity_id=new_user.id,
            details={'ip': get_client_ip(), 'role': role, 'municipality': municipality},
            municipality=municipality
        )
        
        AuditLogger.log_system_activity(
            user_id=new_user.id,
            user_name=new_user.name,
            activity_type='user_registered',
            description=f'New user {new_user.name} registered',
            entity_type='user',
            entity_id=new_user.id,
            municipality=municipality
        )
        
        return jsonify(new_user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed. Please try again.'}), 500


@app.route('/api/reset-password/<int:user_id>', methods=['POST'])
def reset_password(user_id):
    from models import User
    from werkzeug.security import generate_password_hash
    
    data = request.json
    new_password = data.get('password', 'member123')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.password = generate_password_hash(new_password)
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    
    AuditLogger.log_action(
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        action='UPDATE',
        category='Auth',
        entity_type='user',
        entity_id=user.id,
        details={'action': 'password_reset', 'ip': get_client_ip()},
        municipality=user.municipality
    )
    
    return jsonify({
        'success': True,
        'email': user.email,
        'message': 'Password reset successfully'
    })


# ============================================================
# SPECIFIC ROUTES - PROJECTS (BEFORE GENERIC ROUTES)
# ============================================================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    from models import Project
    
    municipality = request.args.get('municipality')
    status = request.args.get('status')
    
    query = Project.query
    if municipality:
        query = query.filter(Project.municipality == municipality)
    if status:
        query = query.filter(Project.status == status)
    
    projects = query.all()
    return jsonify([p.to_dict() for p in projects]), 200


@app.route('/api/projects', methods=['POST'])
def create_project():
    from models import Project
    
    data = request.json
    
    if not data.get('name') or not data.get('municipality'):
        return jsonify({'error': 'Name and municipality are required'}), 400
    
    files = data.get('files', [])
    if isinstance(files, list):
        data['files'] = json.dumps(files)
    
    project = Project(
        name=data.get('name'),
        description=data.get('description', ''),
        municipality=data.get('municipality'),
        status=data.get('status', 'planning'),
        priority=data.get('priority', 'medium'),
        category=data.get('category', ''),
        budget=data.get('budget', 0),
        spent=data.get('spent', 0),
        start_date=data.get('start_date', ''),
        end_date=data.get('end_date', ''),
        created_by=data.get('created_by', 'System'),
        created_date=datetime.utcnow().isoformat(),
        last_updated=datetime.utcnow().isoformat(),
        progress=data.get('progress', 0),
        files=data['files']
    )
    
    db.session.add(project)
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify(project.to_dict()), 201


@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    from models import Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project.to_dict()), 200


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    from models import Project
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.json
    
    for key, value in data.items():
        if key == 'files' and isinstance(value, list):
            value = json.dumps(value)
        if hasattr(project, key) and key != 'id':
            setattr(project, key, value)
    
    project.last_updated = datetime.utcnow().isoformat()
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify(project.to_dict()), 200


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    from models import Project, ProjectMilestone, ProjectUpdate
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    ProjectMilestone.query.filter_by(project_id=project_id).delete()
    ProjectUpdate.query.filter_by(project_id=project_id).delete()
    
    db.session.delete(project)
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify({'message': 'Project deleted successfully'}), 200


@app.route('/api/projects/<int:project_id>/milestones', methods=['GET'])
def get_project_milestones(project_id):
    from models import ProjectMilestone
    
    milestones = ProjectMilestone.query.filter_by(project_id=project_id).all()
    return jsonify([m.to_dict() for m in milestones]), 200


@app.route('/api/projects/<int:project_id>/milestones', methods=['POST'])
def create_project_milestone(project_id):
    from models import ProjectMilestone
    
    data = request.json
    
    milestone = ProjectMilestone(
        project_id=project_id,
        name=data.get('name'),
        description=data.get('description', ''),
        due_date=data.get('due_date', ''),
        completed_date=data.get('completed_date', ''),
        status=data.get('status', 'pending'),
        progress=data.get('progress', 0)
    )
    
    db.session.add(milestone)
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify(milestone.to_dict()), 201


@app.route('/api/projects/<int:project_id>/updates', methods=['GET'])
def get_project_updates(project_id):
    from models import ProjectUpdate
    
    updates = ProjectUpdate.query.filter_by(project_id=project_id).order_by(
        ProjectUpdate.timestamp.desc()
    ).all()
    return jsonify([u.to_dict() for u in updates]), 200


@app.route('/api/projects/<int:project_id>/updates', methods=['POST'])
def create_project_update(project_id):
    from models import ProjectUpdate, Project
    
    data = request.json
    
    files = data.get('files', [])
    if isinstance(files, list):
        files = json.dumps(files)
    
    update = ProjectUpdate(
        project_id=project_id,
        user_id=data.get('user_id', 1),
        user_name=data.get('user_name', 'System'),
        message=data.get('message', ''),
        progress=data.get('progress', 0),
        files=files
    )
    
    db.session.add(update)
    
    project = Project.query.get(project_id)
    if project and 'progress' in data:
        project.progress = data.get('progress', project.progress)
        project.last_updated = datetime.utcnow().isoformat()
    
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify(update.to_dict()), 201


@app.route('/api/projects/dashboard-stats', methods=['GET'])
def get_project_stats():
    from models import Project
    
    municipality = request.args.get('municipality')
    
    query = Project.query
    if municipality:
        query = query.filter(Project.municipality == municipality)
    
    projects = query.all()
    
    stats = {
        'total': len(projects),
        'planning': sum(1 for p in projects if p.status == 'planning'),
        'active': sum(1 for p in projects if p.status == 'active'),
        'on_hold': sum(1 for p in projects if p.status == 'on_hold'),
        'completed': sum(1 for p in projects if p.status == 'completed'),
        'cancelled': sum(1 for p in projects if p.status == 'cancelled'),
        'total_budget': sum(p.budget for p in projects),
        'total_spent': sum(p.spent for p in projects),
        'avg_progress': sum(p.progress for p in projects) / len(projects) if projects else 0
    }
    
    return jsonify(stats), 200


# ============================================================
# SPECIFIC ROUTES - MEETING ATTENDANCE
# ============================================================

@app.route('/api/meetings/<int:meeting_id>/attendance', methods=['GET'])
def get_meeting_attendance(meeting_id):
    from models import MeetingAttendance
    
    attendance = MeetingAttendance.query.filter_by(meeting_id=meeting_id).all()
    return jsonify([a.to_dict() for a in attendance]), 200


@app.route('/api/meetings/<int:meeting_id>/attendance', methods=['POST'])
def record_meeting_attendance(meeting_id):
    from models import MeetingAttendance, Meeting
    
    data = request.json
    user_id = data.get('user_id')
    user_name = data.get('user_name')
    user_email = data.get('user_email')
    check_in_method = data.get('check_in_method', 'manual')
    location_lat = data.get('location_lat')
    location_lng = data.get('location_lng')
    location_accuracy = data.get('location_accuracy')
    is_verified = data.get('is_verified', False)
    verified_by = data.get('verified_by')
    notes = data.get('notes')
    
    if not user_id or not user_name or not user_email:
        return jsonify({'error': 'User information required'}), 400
    
    existing = MeetingAttendance.query.filter_by(
        meeting_id=meeting_id, 
        user_id=user_id
    ).first()
    
    if existing:
        return jsonify({'error': 'User already checked in'}), 400
    
    attendance = MeetingAttendance(
        meeting_id=meeting_id,
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        check_in_method=check_in_method,
        location_lat=location_lat,
        location_lng=location_lng,
        location_accuracy=location_accuracy,
        is_verified=is_verified,
        verified_by=verified_by,
        notes=notes
    )
    
    db.session.add(attendance)
    
    # Also add to meeting attendees list
    meeting = Meeting.query.get(meeting_id)
    if meeting:
        attendees = json.loads(meeting.attendees) if meeting.attendees else []
        if user_email not in attendees:
            attendees.append(user_email)
            meeting.attendees = json.dumps(attendees)
    
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    
    return jsonify(attendance.to_dict()), 201


@app.route('/api/meetings/<int:meeting_id>/attendance/bulk', methods=['POST'])
def bulk_record_attendance(meeting_id):
    from models import MeetingAttendance, Meeting
    
    data = request.json
    attendees = data.get('attendees', [])
    verified_by = data.get('verified_by', 'System')
    
    if not attendees:
        return jsonify({'error': 'No attendees provided'}), 400
    
    recorded = []
    for attendee in attendees:
        user_id = attendee.get('user_id')
        user_name = attendee.get('user_name')
        user_email = attendee.get('user_email')
        
        if not user_id or not user_name or not user_email:
            continue
            
        existing = MeetingAttendance.query.filter_by(
            meeting_id=meeting_id,
            user_id=user_id
        ).first()
        
        if existing:
            continue
            
        attendance = MeetingAttendance(
            meeting_id=meeting_id,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            check_in_method='bulk',
            is_verified=True,
            verified_by=verified_by,
            notes='Bulk attendance entry'
        )
        db.session.add(attendance)
        recorded.append(attendance)
    
    # Update meeting attendees
    meeting = Meeting.query.get(meeting_id)
    if meeting:
        attendees_list = json.loads(meeting.attendees) if meeting.attendees else []
        for att in recorded:
            if att.user_email not in attendees_list:
                attendees_list.append(att.user_email)
        meeting.attendees = json.dumps(attendees_list)
    
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    
    return jsonify([a.to_dict() for a in recorded]), 201


# ============================================================
# GENERIC CRUD ROUTES - FOR ALL OTHER ENTITIES
# ============================================================

def get_model(entity_name):
    from models import User, Member, Meeting, Complaint, Minute, Document, Email, Broadcast
    return {
        'users': User, 
        'members': Member, 
        'meetings': Meeting,
        'complaints': Complaint, 
        'minutes': Minute, 
        'documents': Document,
        'emails': Email, 
        'broadcasts': Broadcast  
    }.get(entity_name)


def get_valid_model_fields(Model):
    """Get list of valid column names for a model"""
    return [c.name for c in Model.__table__.columns]


def filter_valid_fields(data, Model):
    """Filter data to only include fields that exist in the model"""
    valid_fields = get_valid_model_fields(Model)
    return {k: v for k, v in data.items() if k in valid_fields}


@app.route('/api/<entity>', methods=['GET'])
def get_entity(entity):
    # Skip if it's a project (already handled)
    if entity == 'projects':
        return get_projects()
    
    Model = get_model(entity)
    if not Model: 
        return jsonify([]), 404
    items = Model.query.all()
    return jsonify([item.to_dict() for item in items]), 200


@app.route('/api/<entity>', methods=['POST'])
def add_entity_item(entity):
    # Skip if it's a project (already handled)
    if entity == 'projects':
        return create_project()
    
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    data = request.json
    current_user_id = data.get('user_id') or data.get('created_by') or 1
    
    # --- Handle Email field mapping ---
    if entity == 'emails':
        # Map 'from' to 'from_email' for the Email model
        if 'from' in data:
            data['from_email'] = data.pop('from')
        # Map 'to' to 'to_email' if needed
        if 'to' in data:
            data['to_email'] = data.pop('to')
        # Filter to only valid fields
        data = filter_valid_fields(data, Model)
    
    if entity == 'users':
        if 'password' in data and data['password']:
            if not data['password'].startswith(('scrypt:', 'pbkdf2:')):
                data['password'] = generate_password_hash(data['password'])
        
        data['last_seen'] = ''
        if data.get('role') in ['super_admin', 'municipal_officer', 'social_officer', 'department_officer']:
            data['is_approved'] = True
            data['approved_by'] = 'System Auto-Approval'
            data['approved_date'] = datetime.utcnow().isoformat()
        else:
            data['is_approved'] = False
            data['approved_by'] = ''
            data['approved_date'] = ''
        data['is_rejected'] = False
        data['rejected_by'] = ''
        data['rejected_date'] = ''
        if 'registration_date' not in data:
            data['registration_date'] = datetime.utcnow().isoformat()
    
    if entity == 'meetings':
        attendees = data.get('attendees', [])
        if isinstance(attendees, list):
            data['attendees'] = json.dumps(attendees)
        elif isinstance(attendees, str):
            try:
                json.loads(attendees)
                data['attendees'] = attendees
            except:
                data['attendees'] = json.dumps([])
        else:
            data['attendees'] = json.dumps([])
        
        declined = data.get('declined', [])
        if isinstance(declined, list):
            data['declined'] = json.dumps(declined)
        elif isinstance(declined, str):
            try:
                json.loads(declined)
                data['declined'] = declined
            except:
                data['declined'] = json.dumps([])
        else:
            data['declined'] = json.dumps([])
        
        files = data.get('files', [])
        if isinstance(files, list):
            data['files'] = json.dumps(files)
        elif isinstance(files, str):
            try:
                json.loads(files)
                data['files'] = files
            except:
                data['files'] = json.dumps([])
        else:
            data['files'] = json.dumps([])
        
        if 'description' not in data:
            data['description'] = ''
    
    if entity == 'minutes':
        files = data.get('files', [])
        if isinstance(files, list):
            data['files'] = json.dumps(files)
        elif isinstance(files, str):
            try:
                json.loads(files)
                data['files'] = files
            except:
                data['files'] = json.dumps([])
        else:
            data['files'] = json.dumps([])
        
        if 'title' not in data:
            data['title'] = ''
        if 'summary' not in data:
            data['summary'] = ''

    if entity == 'complaints':
        if 'assignedToRole' not in data:
            data['assignedToRole'] = ''
        if 'submittedBy' not in data:
            data['submittedBy'] = data.get('submittedBy', 'Unknown User')
    
    if entity == 'broadcasts':
        files = data.get('files', [])
        if isinstance(files, list):
            data['files'] = json.dumps(files)
        elif isinstance(files, str):
            try:
                json.loads(files)
                data['files'] = files
            except:
                data['files'] = json.dumps([])
        else:
            data['files'] = json.dumps([])
    
    # Filter data to only valid fields for the model
    data = filter_valid_fields(data, Model)
    
    try:
        new_item = Model(**data)
        db.session.add(new_item)
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        return jsonify(new_item.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error creating item: {str(e)}'}), 500


@app.route('/api/<entity>/<int:item_id>', methods=['PUT'])
def update_entity_item(entity, item_id):
    # Skip if it's a project (already handled)
    if entity == 'projects':
        return update_project(item_id)
    
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    item = Model.query.get(item_id)
    if not item: 
        return jsonify({'error': 'Item not found'}), 404

    updated_data = request.json
    old_data = item.to_dict() if hasattr(item, 'to_dict') else {}

    # --- Handle Email field mapping ---
    if entity == 'emails':
        # Map 'from' to 'from_email' for the Email model
        if 'from' in updated_data:
            updated_data['from_email'] = updated_data.pop('from')
        # Map 'to' to 'to_email' if needed
        if 'to' in updated_data:
            updated_data['to_email'] = updated_data.pop('to')
        # Filter to only valid fields
        updated_data = filter_valid_fields(updated_data, Model)

    if entity == 'users' and 'password' in updated_data and updated_data['password']:
        password = updated_data['password']
        if not password.startswith(('scrypt:', 'pbkdf2:', 'argon2')):
            updated_data['password'] = generate_password_hash(password)

    if entity == 'meetings':
        if 'attendees' in updated_data:
            attendees = updated_data['attendees']
            if isinstance(attendees, list):
                updated_data['attendees'] = json.dumps(attendees)
            elif isinstance(attendees, str):
                try:
                    json.loads(attendees)
                    updated_data['attendees'] = attendees
                except:
                    updated_data['attendees'] = json.dumps([])
            else:
                updated_data['attendees'] = json.dumps([])
        
        if 'declined' in updated_data:
            declined = updated_data['declined']
            if isinstance(declined, list):
                updated_data['declined'] = json.dumps(declined)
            elif isinstance(declined, str):
                try:
                    json.loads(declined)
                    updated_data['declined'] = declined
                except:
                    updated_data['declined'] = json.dumps([])
            else:
                updated_data['declined'] = json.dumps([])
        
        if 'files' in updated_data:
            files = updated_data['files']
            if isinstance(files, list):
                updated_data['files'] = json.dumps(files)
            elif isinstance(files, str):
                try:
                    json.loads(files)
                    updated_data['files'] = files
                except:
                    updated_data['files'] = json.dumps([])
            else:
                updated_data['files'] = json.dumps([])
    
    if entity == 'minutes':
        if 'files' in updated_data:
            files = updated_data['files']
            if isinstance(files, list):
                updated_data['files'] = json.dumps(files)
            elif isinstance(files, str):
                try:
                    json.loads(files)
                    updated_data['files'] = files
                except:
                    updated_data['files'] = json.dumps([])
            else:
                updated_data['files'] = json.dumps([])
    
    if entity == 'broadcasts':
        if 'files' in updated_data:
            files = updated_data['files']
            if isinstance(files, list):
                updated_data['files'] = json.dumps(files)
            elif isinstance(files, str):
                try:
                    json.loads(files)
                    updated_data['files'] = files
                except:
                    updated_data['files'] = json.dumps([])
            else:
                updated_data['files'] = json.dumps([])

    # Filter to only valid fields for the model
    updated_data = filter_valid_fields(updated_data, Model)

    try:
        for key, value in updated_data.items():
            if hasattr(item, key) and key != 'id':
                setattr(item, key, value)
        
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        return jsonify(item.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating item: {str(e)}'}), 500


@app.route('/api/<entity>/<int:item_id>', methods=['DELETE'])
def delete_entity_item(entity, item_id):
    # Skip if it's a project (already handled)
    if entity == 'projects':
        return delete_project(item_id)
    
    Model = get_model(entity)
    if not Model:
        return jsonify({'error': 'Entity not found'}), 404
    
    item = Model.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    
    try:
        db.session.delete(item)
        success, error = safe_commit()
        if not success:
            return jsonify({'error': f'Database error: {error}'}), 500
        return jsonify({'message': 'Item deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting item: {str(e)}'}), 500


@app.route('/api/<entity>', methods=['PUT'])
def replace_entity_list(entity):
    # Skip if it's a project (already handled)
    if entity == 'projects':
        return jsonify({'error': 'Use specific project routes for updates'}), 405
    
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    new_list_data = request.json
    old_count = Model.query.count()
    
    Model.query.delete()
    db.session.commit()
    
    new_items = []
    for item_data in new_list_data:
        if entity == 'users':
            item_data['password'] = generate_password_hash(item_data.get('password', 'default123'))
            if 'last_seen' not in item_data:
                item_data['last_seen'] = ''
            if item_data.get('role') in ['super_admin', 'municipal_officer', 'social_officer', 'department_officer']:
                item_data['is_approved'] = True
                if 'approved_by' not in item_data or not item_data['approved_by']:
                    item_data['approved_by'] = 'System Auto-Approval'
                if 'approved_date' not in item_data or not item_data['approved_date']:
                    item_data['approved_date'] = datetime.utcnow().isoformat()
            else:
                item_data['is_approved'] = False
                item_data['approved_by'] = ''
                item_data['approved_date'] = ''
            if 'is_rejected' not in item_data:
                item_data['is_rejected'] = False
            if 'rejected_by' not in item_data:
                item_data['rejected_by'] = ''
            if 'rejected_date' not in item_data:
                item_data['rejected_date'] = ''
            if 'registration_date' not in item_data:
                item_data['registration_date'] = datetime.utcnow().isoformat()
        if entity == 'meetings':
            attendees = item_data.get('attendees', [])
            if isinstance(attendees, list):
                item_data['attendees'] = json.dumps(attendees)
            elif not isinstance(attendees, str):
                item_data['attendees'] = json.dumps([])
            
            declined = item_data.get('declined', [])
            if isinstance(declined, list):
                item_data['declined'] = json.dumps(declined)
            elif not isinstance(declined, str):
                item_data['declined'] = json.dumps([])
            
            files = item_data.get('files', [])
            if isinstance(files, list):
                item_data['files'] = json.dumps(files)
            elif not isinstance(files, str):
                item_data['files'] = json.dumps([])
            
            if 'description' not in item_data:
                item_data['description'] = ''
        
        if entity == 'minutes':
            files = item_data.get('files', [])
            if isinstance(files, list):
                item_data['files'] = json.dumps(files)
            elif not isinstance(files, str):
                item_data['files'] = json.dumps([])
            
            if 'title' not in item_data:
                item_data['title'] = ''
            if 'summary' not in item_data:
                item_data['summary'] = ''
        
        if entity == 'complaints':
            if 'assignedToRole' not in item_data:
                item_data['assignedToRole'] = ''
            if 'submittedBy' not in item_data:
                item_data['submittedBy'] = 'Unknown User'
        
        if entity == 'broadcasts':
            files = item_data.get('files', [])
            if isinstance(files, list):
                item_data['files'] = json.dumps(files)
            elif not isinstance(files, str):
                item_data['files'] = json.dumps([])
        
        # Filter to valid fields
        item_data = filter_valid_fields(item_data, Model)
        new_items.append(Model(**item_data))
        
    db.session.add_all(new_items)
    success, error = safe_commit()
    if not success:
        return jsonify({'error': f'Database error: {error}'}), 500
    return jsonify([item.to_dict() for item in new_items]), 200


# --- Catch-all Route for Static Files ---
@app.route('/<path:path>')
def serve_static_file(path):
    return send_from_directory('.', path)


if __name__ == '__main__':
    print(f"Server running at http://127.0.0.1:5000")
    print("Super Admin credentials: dev@muranga.go.ke / dev123")
    app.run(debug=True, port=5000)