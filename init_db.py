# c:\projo\init_db.py
from app import app, db
from models import Broadcast, Email, User, Member, Meeting, Complaint, Minute, Document
from datetime import date, datetime, timedelta
from werkzeug.security import generate_password_hash
import json

def seed_database():
    with app.app_context():
        print("Creating database tables if they don't exist...")
        db.create_all()

        # --- SAFE CHECK: Only seed if the User table is completely empty. ---
        if User.query.first():
            print("Database already contains users. Skipping seeding to protect your data.")
            print("If you want to reset the database, you must delete the 'municipal_board.db' file first.")
            return

        print("Database is empty. Seeding initial data...")
        today = str(date.today())

        # --- 1. The Super Admin (Developer) ---
        super_admin = User(
            name='Super Developer', 
            email='dev@muranga.go.ke', 
            password=generate_password_hash('dev123'), 
            role='super_admin', 
            municipality='all',
            last_seen=''
        )

        # --- 2. The Three Municipal Officers ---
        officers_data = [
            User(
                name='Kenol Municipal Officer', 
                email='officer.kenol@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kenol',
                last_seen=''
            ),
            User(
                name='Kangare Municipal Officer', 
                email='officer.kangare@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kangare',
                last_seen=''
            ),
            User(
                name="Murang'a Town Municipal Officer", 
                email='officer.muranga@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='muranga_town',
                last_seen=''
            )
        ]

        # --- 3. A sample member ---
        sample_member = User(
            name='Jane Citizen', 
            email='jane@citizen.go.ke', 
            password=generate_password_hash('member123'), 
            role='member', 
            municipality='kenol',
            last_seen=''
        )

        db.session.add(super_admin)
        db.session.add_all(officers_data)
        db.session.add(sample_member)

        # --- Other Seeded Data ---
        members_data = [
            Member(name='Jane Citizen', email='jane@citizen.go.ke', role='member', municipality='kenol', joined=today),
            Member(name='John Doe', email='john@doe.go.ke', role='member', municipality='kangare', joined=today)
        ]
        db.session.add_all(members_data)

        # --- Meetings with proper JSON for attendees and declined ---
        meetings_data = [
            Meeting(
                title='Kenol Budget Meeting', 
                date='2026-06-20', 
                time='10:00', 
                location='Kenol Hall', 
                municipality='kenol', 
                status='scheduled', 
                attendees=json.dumps([]), 
                declined=json.dumps([])
            ),
            Meeting(
                title='Kangare Development Forum', 
                date='2026-06-22', 
                time='14:00', 
                location='Kangare Centre', 
                municipality='kangare', 
                status='scheduled', 
                attendees=json.dumps([]), 
                declined=json.dumps([])
            ),
            Meeting(
                title="Murang'a Town Council", 
                date='2026-06-25', 
                time='09:30', 
                location='Town Hall', 
                municipality='muranga_town', 
                status='scheduled', 
                attendees=json.dumps([]), 
                declined=json.dumps([])
            )
        ]
        db.session.add_all(meetings_data)

        complaints_data = [
            Complaint(
                title='Road damage in Kenol', 
                description='Potholes on main road near Kenol market.', 
                municipality='kenol', 
                status='pending', 
                assignedTo='', 
                date=today
            ),
            Complaint(
                title='Water shortage Kangare', 
                description='Irregular water supply in Kangare estate.', 
                municipality='kangare', 
                status='in_progress', 
                assignedTo='Kenol Municipal Officer', 
                date=today
            )
        ]
        db.session.add_all(complaints_data)

        # --- Emails ---
        emails_data = [
            Email(
                from_email='system@muranga.go.ke',
                to_email='admin@muranga.go.ke',
                subject='Welcome to the Municipal Board Portal',
                body='Welcome to the Murang\'a County Municipal Board Portal. This system helps manage board activities, meetings, complaints, and communications.',
                timestamp=(datetime.utcnow() - timedelta(days=1)).isoformat(),
                read=False,
                municipality='all'
            ),
            Email(
                from_email='kenol@muranga.go.ke',
                to_email='admin@muranga.go.ke',
                subject='Kenol Budget Meeting Update',
                body='The Kenol budget meeting scheduled for June 20th has been confirmed. All board members are requested to attend.',
                timestamp=(datetime.utcnow() - timedelta(hours=12)).isoformat(),
                read=False,
                municipality='kenol'
            ),
            Email(
                from_email='social@muranga.go.ke',
                to_email='all',
                subject='Community Outreach Program',
                body='The social department is organizing a community outreach program next month. We request all municipalities to participate.',
                timestamp=(datetime.utcnow() - timedelta(hours=6)).isoformat(),
                read=False,
                municipality='all'
            )
        ]
        db.session.add_all(emails_data)

        # --- Broadcasts ---
        broadcasts_data = [
            Broadcast(
                message='Welcome to the Murang\'a County Municipal Board Portal! Please familiarize yourself with the system.',
                sender='System Admin',
                timestamp=(datetime.utcnow() - timedelta(days=2)).isoformat(),
                municipality='all'
            ),
            Broadcast(
                message='Important: The upcoming budget review meeting for all municipalities has been rescheduled to July 5th.',
                sender='System Admin',
                timestamp=(datetime.utcnow() - timedelta(days=1)).isoformat(),
                municipality='all'
            )
        ]
        db.session.add_all(broadcasts_data)

        db.session.commit()
        print("Database seeded successfully!")
        print("--- CREDENTIALS ---")
        print(f"Super Admin: dev@muranga.go.ke / dev123")
        print("Municipal Officers: officer.[municipality]@muranga.go.ke / officer123")
        print("Sample Member: jane@citizen.go.ke / member123")
        print("-------------------")

if __name__ == '__main__':
    seed_database()