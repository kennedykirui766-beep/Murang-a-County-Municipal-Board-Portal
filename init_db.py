# c:\projo\init_db.py
from app import app, db
from models import User, Member, Meeting, Complaint, Minute, Document
from datetime import date
from werkzeug.security import generate_password_hash

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
            municipality='all'
        )

        # --- 2. The Three Municipal Officers ---
        officers_data = [
            User(
                name='Kenol Municipal Officer', 
                email='officer.kenol@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kenol'
            ),
            User(
                name='Kangare Municipal Officer', 
                email='officer.kangare@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='kangare'
            ),
            User(
                name="Murang'a Town Municipal Officer", 
                email='officer.muranga@muranga.go.ke', 
                password=generate_password_hash('officer123'), 
                role='municipal_officer', 
                municipality='muranga_town'
            )
        ]

        # --- 3. A sample member ---
        sample_member = User(
            name='Jane Citizen', 
            email='jane@citizen.go.ke', 
            password=generate_password_hash('member123'), 
            role='member', 
            municipality='kenol'
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

        meetings_data = [
            Meeting(title='Kenol Budget Meeting', date='2026-06-20', time='10:00', location='Kenol Hall', municipality='kenol', status='scheduled', attendees='[]'),
            Meeting(title='Kangare Development Forum', date='2026-06-22', time='14:00', location='Kangare Centre', municipality='kangare', status='scheduled', attendees='[]'),
            Meeting(title="Murang'a Town Council", date='2026-06-25', time='09:30', location='Town Hall', municipality='muranga_town', status='scheduled', attendees='[]')
        ]
        db.session.add_all(meetings_data)

        complaints_data = [
            Complaint(title='Road damage in Kenol', description='Potholes on main road near Kenol market.', municipality='kenol', status='pending', assignedTo='', date=today),
            Complaint(title='Water shortage Kangare', description='Irregular water supply in Kangare estate.', municipality='kangare', status='in_progress', assignedTo='Kenol Municipal Officer', date=today)
        ]
        db.session.add_all(complaints_data)

        db.session.commit()
        print("Database seeded successfully!")
        print("--- CREDENTIALS ---")
        print(f"Super Admin: dev@muranga.go.ke / dev123")
        print("Municipal Officers: officer.[municipality]@muranga.go.ke / officer123")
        print("Sample Member: jane@citizen.go.ke / member123")
        print("-------------------")


if __name__ == '__main__':
    seed_database()