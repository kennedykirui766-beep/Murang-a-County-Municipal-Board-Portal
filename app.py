# c:\projo\app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import os
import json

# --- App Configuration ---
app = Flask(__name__, static_folder='.')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///municipal_board.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file upload

CORS(app)

from models import db
db.init_app(app)

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

# --- API Endpoints ---

@app.route('/api/login', methods=['POST'])
def login():
    from models import User
    
    credentials = request.json
    email = credentials.get('email')
    password = credentials.get('password')
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Check password
    try:
        is_valid = check_password_hash(user.password, password)
    except Exception as e:
        return jsonify({'error': 'Login error. Please try again.'}), 500
    
    if not is_valid:
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Only check approval for members
    if user.role == 'member' and not user.is_approved:
        return jsonify({'error': 'Account pending approval. Please wait for admin approval.'}), 403
    
    if user.role == 'member' and user.is_rejected:
        return jsonify({'error': 'Account has been rejected. Please contact administrator.'}), 403
    
    user.last_seen = datetime.utcnow().isoformat()
    db.session.commit()
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
        db.session.commit()
    else:
        if user.role == 'member' and not user.is_approved:
            return jsonify({'error': 'Account pending approval. Please wait for admin approval.'}), 403
        if user.role == 'member' and user.is_rejected:
            return jsonify({'error': 'Account has been rejected. Please contact administrator.'}), 403
        user.last_seen = datetime.utcnow().isoformat()
        db.session.commit()
        
    return jsonify(user.to_dict()), 200    
    
@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    from models import User
    
    data = request.json
    user_id = data.get('user_id')
    
    user = User.query.get(user_id)
    if user:
        user.last_seen = datetime.utcnow().isoformat()
        db.session.commit()
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
    
    # Check if user already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Email already exists'}), 400
        
    # Hash the password
    hashed_password = generate_password_hash(password)
    
    # Create user with the hashed password
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
    
    # Add to members table
    new_member = Member(
        name=name,
        email=email,
        role=role,
        municipality=municipality,
        joined=str(date.today())
    )
    db.session.add(new_member)
    
    try:
        db.session.commit()
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
    db.session.commit()
    
    return jsonify({
        'success': True,
        'email': user.email,
        'message': 'Password reset successfully'
    })

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

@app.route('/api/<entity>', methods=['GET'])
def get_entity(entity):
    Model = get_model(entity)
    if not Model: 
        return jsonify([]), 404
    items = Model.query.all()
    return jsonify([item.to_dict() for item in items]), 200

@app.route('/api/<entity>', methods=['POST'])
def add_entity_item(entity):
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    data = request.json
    
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

    new_item = Model(**data)
    db.session.add(new_item)
    db.session.commit()
    
    return jsonify(new_item.to_dict()), 201

@app.route('/api/<entity>/<int:item_id>', methods=['PUT'])
def update_entity_item(entity, item_id):
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    item = Model.query.get(item_id)
    if not item: 
        return jsonify({'error': 'Item not found'}), 404

    updated_data = request.json

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

    for key, value in updated_data.items():
        if hasattr(item, key) and key != 'id':
            setattr(item, key, value)
            
    db.session.commit()
    
    return jsonify(item.to_dict()), 200

@app.route('/api/<entity>/<int:item_id>', methods=['DELETE'])
def delete_entity_item(entity, item_id):
    Model = get_model(entity)
    if not Model:
        return jsonify({'error': 'Entity not found'}), 404
    
    item = Model.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'message': 'Item deleted successfully'}), 200

@app.route('/api/<entity>', methods=['PUT'])
def replace_entity_list(entity):
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    new_list_data = request.json
    
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
                
        new_items.append(Model(**item_data))
        
    db.session.add_all(new_items)
    db.session.commit()
    
    return jsonify([item.to_dict() for item in new_items]), 200

# --- Catch-all Route for Static Files ---
@app.route('/<path:path>')
def serve_static_file(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    print(f"Server running at http://127.0.0.1:5000")
    print("Super Admin credentials: dev@muranga.go.ke / dev123")
    app.run(debug=True, port=5000)