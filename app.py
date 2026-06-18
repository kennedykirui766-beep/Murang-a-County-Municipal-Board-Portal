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
    
    if user and check_password_hash(user.password, password):
        user.last_seen = datetime.utcnow().isoformat()
        db.session.commit()
        return jsonify(user.to_dict()), 200
    else:
        return jsonify({'error': 'Invalid email or password'}), 401
    
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
        # Create user if they don't exist
        random_pass = secrets.token_urlsafe(16)
        user = User(
            name=name,
            email=email,
            password=generate_password_hash(random_pass),
            role='member',
            municipality='all',
            last_seen=datetime.utcnow().isoformat()
        )
        db.session.add(user)
        
        # Also add to members table
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
    """
    Public registration endpoint.
    Allows anyone to create an account, but the role is forced to 'member'
    and they cannot gain admin privileges.
    """
    from models import User
    
    data = request.json
    email = data.get('email')
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
        
    hashed_password = generate_password_hash(data.get('password'))
    
    new_user = User(
        name=data.get('name'),
        email=email,
        password=hashed_password,
        role='member', # Force 'member' role for public registration
        municipality=data.get('municipality'),
        last_seen=''
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify(new_user.to_dict()), 201

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
    """
    Generic add endpoint. 
    NOTE: For 'users', this is for the Super Admin to create accounts.
    Public registration uses /api/register.
    """
    Model = get_model(entity)
    if not Model: 
        return jsonify({'error': 'Entity not found'}), 404
    
    data = request.json
    
    # Hash password if creating a user
    if entity == 'users':
        data['password'] = generate_password_hash(data.get('password'))
        data['last_seen'] = ''
    
    # Handle meeting attendees and declined as JSON
    if entity == 'meetings':
        # Ensure attendees is a list and convert to JSON string
        attendees = data.get('attendees', [])
        if isinstance(attendees, str):
            try:
                attendees = json.loads(attendees)
            except:
                attendees = []
        data['attendees'] = json.dumps(attendees)
        
        # Ensure declined is a list and convert to JSON string
        declined = data.get('declined', [])
        if isinstance(declined, str):
            try:
                declined = json.loads(declined)
            except:
                declined = []
        data['declined'] = json.dumps(declined)

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

    # If updating a user's password, hash it. 
    if entity == 'users' and 'password' in updated_data and updated_data['password']:
        updated_data['password'] = generate_password_hash(updated_data['password'])

    # Handle meeting attendees and declined as JSON
    if entity == 'meetings':
        # Process attendees
        if 'attendees' in updated_data:
            attendees = updated_data['attendees']
            if isinstance(attendees, list):
                updated_data['attendees'] = json.dumps(attendees)
            elif isinstance(attendees, str):
                try:
                    # Validate it's proper JSON
                    json.loads(attendees)
                    updated_data['attendees'] = attendees
                except:
                    updated_data['attendees'] = json.dumps([])
            else:
                updated_data['attendees'] = json.dumps([])
        
        # Process declined
        if 'declined' in updated_data:
            declined = updated_data['declined']
            if isinstance(declined, list):
                updated_data['declined'] = json.dumps(declined)
            elif isinstance(declined, str):
                try:
                    # Validate it's proper JSON
                    json.loads(declined)
                    updated_data['declined'] = declined
                except:
                    updated_data['declined'] = json.dumps([])
            else:
                updated_data['declined'] = json.dumps([])

    # Update only the fields that were provided
    for key, value in updated_data.items():
        if hasattr(item, key) and key != 'id':
            setattr(item, key, value)
            
    db.session.commit()
    
    # Return the updated item
    return jsonify(item.to_dict()), 200

@app.route('/api/<entity>/<int:item_id>', methods=['DELETE'])
def delete_entity_item(entity, item_id):
    """
    Deletes a single item from the database.
    """
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
    
    # Delete all existing records
    Model.query.delete()
    db.session.commit()
    
    new_items = []
    for item_data in new_list_data:
        if entity == 'users':
            item_data['password'] = generate_password_hash(item_data.get('password', 'default123'))
            if 'last_seen' not in item_data:
                item_data['last_seen'] = ''
        if entity == 'meetings':
            # Ensure attendees is JSON string
            attendees = item_data.get('attendees', [])
            if isinstance(attendees, list):
                item_data['attendees'] = json.dumps(attendees)
            elif not isinstance(attendees, str):
                item_data['attendees'] = json.dumps([])
            
            # Ensure declined is JSON string
            declined = item_data.get('declined', [])
            if isinstance(declined, list):
                item_data['declined'] = json.dumps(declined)
            elif not isinstance(declined, str):
                item_data['declined'] = json.dumps([])
                
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