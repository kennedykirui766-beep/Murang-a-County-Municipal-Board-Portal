from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize the database object, but without binding it to an app yet.
# The app will be bound in app.py.
db = SQLAlchemy()

# --- Database Models ---

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email,
            'role': self.role, 'municipality': self.municipality
        }

class Member(db.Model):
    __tablename__ = 'members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    joined = db.Column(db.String, nullable=False) # Stored as 'YYYY-MM-DD'

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email,
            'role': self.role, 'municipality': self.municipality, 'joined': self.joined
        }

class Meeting(db.Model):
    __tablename__ = 'meetings'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String, nullable=False) # Stored as 'YYYY-MM-DD'
    time = db.Column(db.String, nullable=False)
    location = db.Column(db.String(200), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    # Attendees is a list of emails. We'll store it as a JSON string in the DB.
    attendees = db.Column(db.Text, default='[]') 

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'date': self.date, 'time': self.time,
            'location': self.location, 'municipality': self.municipality,
            'status': self.status, 'attendees': eval(self.attendees) if self.attendees else []
        }

class Complaint(db.Model):
    __tablename__ = 'complaints'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    assignedTo = db.Column(db.String(100), default='')
    date = db.Column(db.String, nullable=False) # Stored as 'YYYY-MM-DD'

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'description': self.description,
            'municipality': self.municipality, 'status': self.status,
            'assignedTo': self.assignedTo, 'date': self.date
        }

class Minute(db.Model):
    __tablename__ = 'minutes'
    id = db.Column(db.Integer, primary_key=True)
    meetingId = db.Column(db.Integer, nullable=True)
    content = db.Column(db.Text, nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False) # Stored as 'YYYY-MM-DD'

    def to_dict(self):
        return {
            'id': self.id, 'meetingId': self.meetingId, 'content': self.content,
            'uploadedBy': self.uploadedBy, 'municipality': self.municipality, 'uploadDate': self.uploadDate
        }

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    uploadedBy = db.Column(db.String(100), nullable=False)
    municipality = db.Column(db.String(50), nullable=False)
    uploadDate = db.Column(db.String, nullable=False) # Stored as 'YYYY-MM-DD'
    fileName = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'type': self.type,
            'uploadedBy': self.uploadedBy, 'municipality': self.municipality,
            'uploadDate': self.uploadDate, 'fileName': self.fileName
        }