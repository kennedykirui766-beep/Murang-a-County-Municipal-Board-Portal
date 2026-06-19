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

        if User.query.first():
            print("Database already contains users. Skipping seeding to protect your data.")
            print("If you want to reset the database, you must delete the 'municipal_board.db' file first.")
            return

        print("Database is empty. Seeding initial data...")
        today = str(date.today())
        now = datetime.utcnow().isoformat()

        # --- Super Admin (Auto-approved) ---
        super_admin = User(
            name='Super Developer', 
            email='dev@muranga.go.ke', 
            password=generate_password_hash('dev123'), 
            role='super_admin', 
            municipality='all',
            last_seen='',
            is_approved=True,
            approved_by='System',
            approved_date=now,
            registration_date=now,
            is_rejected=False,
            rejected_by='',
            rejected_date=''
        )

        # --- Municipal Officers (Auto-approved) ---
        officers_data = [
            User(
                name='Kenol Municipal Officer', 
                email='officer.kenol@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kenol',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name='Kangare Municipal Officer', 
                email='officer.kangare@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kangare',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name="Murang'a Town Municipal Officer", 
                email='officer.muranga@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='muranga_town',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            )
        ]

        # --- Social Officers (Auto-approved) ---
        social_officers_data = [
            User(
                name='Kenol Social Officer',
                email='social.kenol@muranga.go.ke',
                password=generate_password_hash('social123'),
                role='social_officer',
                municipality='kenol',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name='Kangare Social Officer',
                email='social.kangare@muranga.go.ke',
                password=generate_password_hash('social123'),
                role='social_officer',
                municipality='kangare',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name="Murang'a Town Social Officer",
                email='social.muranga@muranga.go.ke',
                password=generate_password_hash('social123'),
                role='social_officer',
                municipality='muranga_town',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            )
        ]

        # --- Department Officers (Auto-approved) ---
        department_officers_data = [
            User(
                name='Kenol Department Officer',
                email='dept.kenol@muranga.go.ke',
                password=generate_password_hash('dept123'),
                role='department_officer',
                municipality='kenol',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name='Kangare Department Officer',
                email='dept.kangare@muranga.go.ke',
                password=generate_password_hash('dept123'),
                role='department_officer',
                municipality='kangare',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            ),
            User(
                name="Murang'a Town Department Officer",
                email='dept.muranga@muranga.go.ke',
                password=generate_password_hash('dept123'),
                role='department_officer',
                municipality='muranga_town',
                last_seen='',
                is_approved=True,
                approved_by='System',
                approved_date=now,
                registration_date=now,
                is_rejected=False,
                rejected_by='',
                rejected_date=''
            )
        ]

        # --- Sample Member (Requires Approval - Pending) ---
        sample_member = User(
            name='Jane Citizen', 
            email='jane@citizen.go.ke', 
            password=generate_password_hash('member123'), 
            role='member', 
            municipality='kenol',
            last_seen='',
            is_approved=False,  # Needs approval
            approved_by='',
            approved_date='',
            registration_date=now,
            is_rejected=False,
            rejected_by='',
            rejected_date=''
        )

        # --- Another Sample Member (Approved) ---
        approved_member = User(
            name='John Doe', 
            email='john@doe.go.ke', 
            password=generate_password_hash('member456'), 
            role='member', 
            municipality='kangare',
            last_seen='',
            is_approved=True,  # Already approved
            approved_by='Super Developer',
            approved_date=now,
            registration_date=now,
            is_rejected=False,
            rejected_by='',
            rejected_date=''
        )

        db.session.add(super_admin)
        db.session.add_all(officers_data)
        db.session.add_all(social_officers_data)
        db.session.add_all(department_officers_data)
        db.session.add(sample_member)
        db.session.add(approved_member)

        # --- Members ---
        members_data = [
            Member(name='Jane Citizen', email='jane@citizen.go.ke', role='member', municipality='kenol', joined=today),
            Member(name='John Doe', email='john@doe.go.ke', role='member', municipality='kangare', joined=today),
            Member(name='Kenol Social Officer', email='social.kenol@muranga.go.ke', role='social_officer', municipality='kenol', joined=today),
            Member(name='Kenol Department Officer', email='dept.kenol@muranga.go.ke', role='department_officer', municipality='kenol', joined=today)
        ]
        db.session.add_all(members_data)

        # --- Meetings ---
        meetings_data = [
            Meeting(
                title='Kenol Budget Meeting',
                description='Annual budget review and planning for Kenol municipality.',
                date='2026-06-20',
                time='10:00',
                location='Kenol Hall',
                municipality='kenol',
                status='scheduled',
                attendees=json.dumps([]),
                declined=json.dumps([]),
                files=json.dumps([])
            ),
            Meeting(
                title='Kangare Development Forum',
                description='Discussion on community development projects in Kangare area.',
                date='2026-06-22',
                time='14:00',
                location='Kangare Centre',
                municipality='kangare',
                status='scheduled',
                attendees=json.dumps([]),
                declined=json.dumps([]),
                files=json.dumps([])
            ),
            Meeting(
                title="Murang'a Town Council",
                description='Town council meeting to discuss urban planning and waste management.',
                date='2026-06-25',
                time='09:30',
                location='Town Hall',
                municipality='muranga_town',
                status='scheduled',
                attendees=json.dumps([]),
                declined=json.dumps([]),
                files=json.dumps([])
            )
        ]
        db.session.add_all(meetings_data)

        # --- Minutes ---
        minutes_data = [
            Minute(
                title='Kenol Budget Meeting Minutes',
                summary='Key decisions: Approved budget allocation for infrastructure projects.',
                meetingId=1,
                content='The Kenol Budget Meeting was held on June 20, 2026. All members were present.',
                uploadedBy='Super Developer',
                municipality='kenol',
                uploadDate=today,
                files=json.dumps([])
            ),
            Minute(
                title='Kangare Development Forum Minutes',
                summary='Discussion on water supply improvements and road maintenance projects.',
                meetingId=2,
                content='The Kangare Development Forum meeting discussed community development projects.',
                uploadedBy='Super Developer',
                municipality='kangare',
                uploadDate=today,
                files=json.dumps([])
            )
        ]
        db.session.add_all(minutes_data)

        # --- Complaints ---
        complaints_data = [
            Complaint(
                title='Road damage in Kenol',
                description='Potholes on main road near Kenol market causing traffic congestion and vehicle damage.',
                municipality='kenol',
                status='pending',
                assignedTo='',
                assignedToRole='',
                submittedBy='Jane Citizen',
                date=today
            ),
            Complaint(
                title='Water shortage Kangare',
                description='Irregular water supply in Kangare estate for the past two weeks.',
                municipality='kangare',
                status='in_progress',
                assignedTo='Kenol Municipal Officer',
                assignedToRole='municipal_officer',
                submittedBy='John Doe',
                date=today
            ),
            Complaint(
                title="Murang'a Town Waste Management",
                description='Poor waste collection services in Murang\'a Town.',
                municipality='muranga_town',
                status='pending',
                assignedTo='',
                assignedToRole='',
                submittedBy='Jane Citizen',
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
                body='Welcome to the Murang\'a County Municipal Board Portal.',
                timestamp=(datetime.utcnow() - timedelta(days=1)).isoformat(),
                read=False,
                municipality='all'
            ),
            Email(
                from_email='kenol@muranga.go.ke',
                to_email='admin@muranga.go.ke',
                subject='Kenol Budget Meeting Update',
                body='The Kenol budget meeting scheduled for June 20th has been confirmed.',
                timestamp=(datetime.utcnow() - timedelta(hours=12)).isoformat(),
                read=False,
                municipality='kenol'
            ),
            Email(
                from_email='social@muranga.go.ke',
                to_email='all',
                subject='Community Outreach Program',
                body='The social department is organizing a community outreach program next month.',
                timestamp=(datetime.utcnow() - timedelta(hours=6)).isoformat(),
                read=False,
                municipality='all'
            )
        ]
        db.session.add_all(emails_data)

        # --- Broadcasts with files field ---
        broadcasts_data = [
            Broadcast(
                message='Welcome to the Murang\'a County Municipal Board Portal! Please familiarize yourself with the system.',
                sender='System Admin',
                timestamp=(datetime.utcnow() - timedelta(days=2)).isoformat(),
                municipality='all',
                files=json.dumps([])
            ),
            Broadcast(
                message='Important: The upcoming budget review meeting for all municipalities has been rescheduled to July 5th.',
                sender='System Admin',
                timestamp=(datetime.utcnow() - timedelta(days=1)).isoformat(),
                municipality='all',
                files=json.dumps([])
            )
        ]
        db.session.add_all(broadcasts_data)

        # --- Documents ---
        documents_data = [
            Document(
                name='Annual Report 2025',
                type='PDF',
                uploadedBy='Super Developer',
                municipality='all',
                uploadDate=today,
                fileName='Annual_Report_2025.pdf'
            ),
            Document(
                name='Kenol Budget 2026',
                type='Excel',
                uploadedBy='Kenol Municipal Officer',
                municipality='kenol',
                uploadDate=today,
                fileName='Kenol_Budget_2026.xlsx'
            )
        ]
        db.session.add_all(documents_data)

        db.session.commit()
        print("Database seeded successfully!")
        print("--- CREDENTIALS ---")
        print(f"Super Admin: dev@muranga.go.ke / dev123")
        print("Municipal Officers: officer.[municipality]@muranga.go.ke / officer123")
        print("Social Officers: social.[municipality]@muranga.go.ke / social123")
        print("Department Officers: dept.[municipality]@muranga.go.ke / dept123")
        print("Sample Member (PENDING): jane@citizen.go.ke / member123")
        print("Sample Member (APPROVED): john@doe.go.ke / member456")
        print("-------------------")
        print("NOTE: Members require admin approval before they can login.")
        print("Admins (Super Admin, Municipal Officers, Social Officers, Department Officers) can login immediately.")

if __name__ == '__main__':
    seed_database()