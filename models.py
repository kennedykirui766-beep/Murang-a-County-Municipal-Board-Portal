# c:\projo\models.py
import json

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

# Initialize the database object. The app will be bound in app.py.
db = SQLAlchemy()

# --- Database Models ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(200))
    role = db.Column(db.String(50))
    municipality = db.Column(db.String(50))
    last_seen = db.Column(db.String(50), default='')
    is_approved = db.Column(db.Boolean, default=False)
    approved_by = db.Column(db.String(100), default='')
    approved_date = db.Column(db.String(50), default='')
    registration_date = db.Column(db.String(50), default='')
    is_rejected = db.Column(db.Boolean, default=False)
    rejected_by = db.Column(db.String(100), default='')
    rejected_date = db.Column(db.String(50), default='')
    
    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Member(db.Model):
    __tablename__ = 'members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    joined = db.Column(db.String, nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 
            'name': self.name, 
            'email': self.email,
            'role': self.role, 
            'municipality': self.municipality, 
            'joined': self.joined
        }


class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    description = db.Column(db.Text, default='')
    date = db.Column(db.String(20))
    time = db.Column(db.String(20))
    location = db.Column(db.String(200))
    municipality = db.Column(db.String(50))
    status = db.Column(db.String(50))
    attendees = db.Column(db.Text, default='[]')
    declined = db.Column(db.Text, default='[]')
    files = db.Column(db.Text, default='[]')
    
    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        try:
            d['attendees'] = json.loads(d['attendees']) if d['attendees'] else []
        except:
            d['attendees'] = []
        try:
            d['declined'] = json.loads(d['declined']) if d['declined'] else []
        except:
            d['declined'] = []
        try:
            d['files'] = json.loads(d['files']) if d['files'] else []
        except:
            d['files'] = []
        return d


class Complaint(db.Model):
    __tablename__ = 'complaints'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    assignedTo = db.Column(db.String(100), default='')
    assignedToRole = db.Column(db.String(50), default='')
    submittedBy = db.Column(db.String(100), nullable=False)
    date = db.Column(db.String, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'municipality': self.municipality,
            'status': self.status,
            'assignedTo': self.assignedTo,
            'assignedToRole': self.assignedToRole,
            'submittedBy': self.submittedBy,
            'date': self.date
        }


class Minute(db.Model):
    __tablename__ = 'minutes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), default='')
    summary = db.Column(db.Text, default='')
    meetingId = db.Column(db.Integer, nullable=True)
    content = db.Column(db.Text, nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False)
    files = db.Column(db.Text, default='[]')

    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        try:
            d['files'] = json.loads(d['files']) if d['files'] else []
        except:
            d['files'] = []
        return d


class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False)
    fileName = db.Column(db.String(255), nullable=False)
    fileData = db.Column(db.Text, nullable=True)  # Store base64 file data
    fileSize = db.Column(db.Integer, nullable=True)  # Store file size in bytes
    fileType = db.Column(db.String(100), nullable=True)  # Store MIME type

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'uploadedBy': self.uploadedBy,
            'municipality': self.municipality,
            'uploadDate': self.uploadDate,
            'fileName': self.fileName,
            'fileData': self.fileData,
            'fileSize': self.fileSize,
            'fileType': self.fileType
        }


class Email(db.Model):
    __tablename__ = 'emails'
    id = db.Column(db.Integer, primary_key=True)
    from_email = db.Column(db.String(120), nullable=False)
    to_email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.String, nullable=False)
    read = db.Column(db.Boolean, default=False, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    # Add new fields for better email tracking
    cc = db.Column(db.String(500), nullable=True)  # CC recipients
    bcc = db.Column(db.String(500), nullable=True)  # BCC recipients
    attachments = db.Column(db.Text, default='[]')  # JSON array of attachments
    is_draft = db.Column(db.Boolean, default=False)
    is_sent = db.Column(db.Boolean, default=True)
    reply_to_id = db.Column(db.Integer, nullable=True)  # For email threading
    in_reply_to = db.Column(db.String(200), nullable=True)  # Message ID for threading

    def to_dict(self):
        return {
            'id': self.id,
            'from': self.from_email,
            'to': self.to_email,
            'cc': self.cc,
            'bcc': self.bcc,
            'subject': self.subject,
            'body': self.body,
            'timestamp': self.timestamp,
            'read': self.read,
            'municipality': self.municipality,
            'attachments': json.loads(self.attachments) if self.attachments else [],
            'is_draft': self.is_draft,
            'is_sent': self.is_sent,
            'reply_to_id': self.reply_to_id,
            'in_reply_to': self.in_reply_to
        }


class Broadcast(db.Model):
    __tablename__ = 'broadcasts'
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    sender = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.String, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    files = db.Column(db.Text, default='[]')

    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        try:
            d['files'] = json.loads(d['files']) if d['files'] else []
        except:
            d['files'] = []
        return d


# ============================================================
# NEW MODELS FOR REPORTS & AUDIT (FOREIGN KEYS REMOVED)
# ============================================================

class AuditLog(db.Model):
    """Model for storing audit logs of user actions"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)  # REMOVED: db.ForeignKey('users.id')
    user_name = db.Column(db.String(100), nullable=False)
    user_email = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE, VIEW, LOGIN, LOGOUT
    category = db.Column(db.String(50), nullable=False)  # User, Member, Meeting, Minutes, Complaint, Document, Broadcast, Email, System, Reports, Auth
    entity_type = db.Column(db.String(50), nullable=True)  # The type of entity affected
    entity_id = db.Column(db.Integer, nullable=True)  # The ID of the entity affected
    details = db.Column(db.Text, nullable=True)  # JSON string with additional details
    ip_address = db.Column(db.String(45), nullable=True)  # Client IP address
    user_agent = db.Column(db.String(255), nullable=True)  # Browser user agent
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    municipality = db.Column(db.String(50), nullable=True)  # Municipality context
    
    # REMOVED: user = db.relationship('User', backref='audit_logs', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'user_email': self.user_email,
            'action': self.action,
            'category': self.category,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'details': self.details,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'municipality': self.municipality
        }


class Report(db.Model):
    """Model for storing generated reports"""
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_name = db.Column(db.String(100), nullable=False)
    report_type = db.Column(db.String(50), nullable=False)  # audit, summary, custom, complaint, meeting, user_activity
    generated_by = db.Column(db.Integer, nullable=False)  # REMOVED: db.ForeignKey('users.id')
    generated_by_name = db.Column(db.String(100), nullable=False)
    generated_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    filters = db.Column(db.Text, nullable=True)  # JSON string of applied filters
    data = db.Column(db.Text, nullable=True)  # JSON string of report data
    format = db.Column(db.String(20), default='json')  # json, csv, pdf
    municipality = db.Column(db.String(50), nullable=True)
    file_path = db.Column(db.String(255), nullable=True)  # Path to stored file if any
    
    # REMOVED: user = db.relationship('User', backref='generated_reports', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_name': self.report_name,
            'report_type': self.report_type,
            'generated_by': self.generated_by,
            'generated_by_name': self.generated_by_name,
            'generated_date': self.generated_date.isoformat() if self.generated_date else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'filters': self.filters,
            'data': self.data,
            'format': self.format,
            'municipality': self.municipality,
            'file_path': self.file_path
        }


class SystemActivity(db.Model):
    """Model for tracking system-wide activities for the activity feed"""
    __tablename__ = 'system_activities'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=True)  # REMOVED: db.ForeignKey('users.id')
    user_name = db.Column(db.String(100), nullable=True)
    activity_type = db.Column(db.String(50), nullable=False)  # login, logout, meeting_created, complaint_submitted, etc.
    description = db.Column(db.Text, nullable=False)
    entity_type = db.Column(db.String(50), nullable=True)  # meeting, complaint, user, etc.
    entity_id = db.Column(db.Integer, nullable=True)
    municipality = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # REMOVED: user = db.relationship('User', backref='activities', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'activity_type': self.activity_type,
            'description': self.description,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'municipality': self.municipality,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
    

class MeetingAttendance(db.Model):
    """Model for tracking physical attendance at meetings"""
    __tablename__ = 'meeting_attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, nullable=False)  # Foreign key to meetings
    user_id = db.Column(db.Integer, nullable=False)  # User who attended
    user_name = db.Column(db.String(100), nullable=False)
    user_email = db.Column(db.String(100), nullable=False)
    check_in_time = db.Column(db.DateTime, default=datetime.utcnow)
    check_in_method = db.Column(db.String(50), default='manual')  # manual, qr, face
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    location_accuracy = db.Column(db.Float, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    verified_by = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'user_email': self.user_email,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_in_method': self.check_in_method,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'location_accuracy': self.location_accuracy,
            'is_verified': self.is_verified,
            'verified_by': self.verified_by,
            'notes': self.notes
        }


class Project(db.Model):
    """Model for municipal project tracking"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    municipality = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default='planning')  # planning, active, on_hold, completed, cancelled
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, critical
    category = db.Column(db.String(50), nullable=True)  # infrastructure, health, education, water, roads, etc.
    budget = db.Column(db.Float, default=0)
    spent = db.Column(db.Float, default=0)
    start_date = db.Column(db.String(20), nullable=True)
    end_date = db.Column(db.String(20), nullable=True)
    created_by = db.Column(db.String(100), nullable=False)
    created_date = db.Column(db.String(20), nullable=False)
    last_updated = db.Column(db.String(20), nullable=True)
    progress = db.Column(db.Integer, default=0)  # 0-100
    files = db.Column(db.Text, default='[]')  # JSON array of file attachments
    
    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        try:
            d['files'] = json.loads(d['files']) if d['files'] else []
        except:
            d['files'] = []
        return d


class ProjectMilestone(db.Model):
    """Model for project milestones"""
    __tablename__ = 'project_milestones'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.String(20), nullable=True)
    completed_date = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(50), default='pending')  # pending, in_progress, completed
    progress = db.Column(db.Integer, default=0)  # 0-100
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'description': self.description,
            'due_date': self.due_date,
            'completed_date': self.completed_date,
            'status': self.status,
            'progress': self.progress
        }


class ProjectUpdate(db.Model):
    """Model for project progress updates"""
    __tablename__ = 'project_updates'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    progress = db.Column(db.Integer, default=0)  # 0-100
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    files = db.Column(db.Text, default='[]')
    
    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        try:
            d['files'] = json.loads(d['files']) if d['files'] else []
        except:
            d['files'] = []
        d['timestamp'] = self.timestamp.isoformat() if self.timestamp else None
        return d