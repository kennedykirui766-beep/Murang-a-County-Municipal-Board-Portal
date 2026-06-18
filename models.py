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
    last_seen = db.Column(db.String(50), default='')  # Tracks activity
    
    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Member(db.Model):
    __tablename__ = 'members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    joined = db.Column(db.String, nullable=False)  # Stored as 'YYYY-MM-DD'

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
    date = db.Column(db.String(20))
    time = db.Column(db.String(20))
    location = db.Column(db.String(200))
    municipality = db.Column(db.String(50))
    status = db.Column(db.String(50))
    attendees = db.Column(db.Text, default='[]')  # Stored as JSON string
    declined = db.Column(db.Text, default='[]')   # Stored as JSON string with reason
    
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
        return d


class Complaint(db.Model):
    __tablename__ = 'complaints'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    assignedTo = db.Column(db.String(100), default='')
    date = db.Column(db.String, nullable=False)  # Stored as 'YYYY-MM-DD'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'municipality': self.municipality,
            'status': self.status,
            'assignedTo': self.assignedTo,
            'date': self.date
        }


class Minute(db.Model):
    __tablename__ = 'minutes'
    id = db.Column(db.Integer, primary_key=True)
    meetingId = db.Column(db.Integer, nullable=True)
    content = db.Column(db.Text, nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False)  # Stored as 'YYYY-MM-DD'

    def to_dict(self):
        return {
            'id': self.id,
            'meetingId': self.meetingId,
            'content': self.content,
            'uploadedBy': self.uploadedBy,
            'municipality': self.municipality,
            'uploadDate': self.uploadDate
        }


class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False)  # Stored as 'YYYY-MM-DD'
    fileName = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'uploadedBy': self.uploadedBy,
            'municipality': self.municipality,
            'uploadDate': self.uploadDate,
            'fileName': self.fileName
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

    def to_dict(self):
        return {
            'id': self.id,
            'from': self.from_email,
            'to': self.to_email,
            'subject': self.subject,
            'body': self.body,
            'timestamp': self.timestamp,
            'read': self.read,
            'municipality': self.municipality
        }


class Broadcast(db.Model):
    __tablename__ = 'broadcasts'
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    sender = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.String, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'sender': self.sender,
            'timestamp': self.timestamp,
            'municipality': self.municipality
        }