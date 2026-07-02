# create_db_direct.py
import sqlite3
import os

# Delete existing database if it exists
if os.path.exists('municipal_board.db'):
    os.remove('municipal_board.db')
    print("Deleted existing database")

# Create connection
conn = sqlite3.connect('municipal_board.db')
cursor = conn.cursor()

# Create all tables
cursor.executescript('''
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(200),
    role VARCHAR(50),
    municipality VARCHAR(50),
    last_seen VARCHAR(50) DEFAULT '',
    is_approved BOOLEAN DEFAULT 0,
    approved_by VARCHAR(100) DEFAULT '',
    approved_date VARCHAR(50) DEFAULT '',
    registration_date VARCHAR(50) DEFAULT '',
    is_rejected BOOLEAN DEFAULT 0,
    rejected_by VARCHAR(100) DEFAULT '',
    rejected_date VARCHAR(50) DEFAULT ''
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    role VARCHAR(50) NOT NULL,
    municipality VARCHAR(50) NOT NULL,
    joined VARCHAR NOT NULL
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200),
    description TEXT DEFAULT '',
    date VARCHAR(20),
    time VARCHAR(20),
    location VARCHAR(200),
    municipality VARCHAR(50),
    status VARCHAR(50),
    attendees TEXT DEFAULT '[]',
    declined TEXT DEFAULT '[]',
    files TEXT DEFAULT '[]'
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    municipality VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    assignedTo VARCHAR(100) DEFAULT '',
    assignedToRole VARCHAR(50) DEFAULT '',
    submittedBy VARCHAR(100) NOT NULL,
    date VARCHAR NOT NULL
);

-- Minutes table
CREATE TABLE IF NOT EXISTS minutes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) DEFAULT '',
    summary TEXT DEFAULT '',
    meetingId INTEGER,
    content TEXT NOT NULL,
    uploadedBy VARCHAR(100) NOT NULL,
    municipality VARCHAR(50) NOT NULL,
    uploadDate VARCHAR NOT NULL,
    files TEXT DEFAULT '[]'
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    uploadedBy VARCHAR(100) NOT NULL,
    municipality VARCHAR(50) NOT NULL,
    uploadDate VARCHAR NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    fileData TEXT,
    fileSize INTEGER,
    fileType VARCHAR(100)
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_email VARCHAR(120) NOT NULL,
    to_email VARCHAR(120) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    timestamp VARCHAR NOT NULL,
    read BOOLEAN DEFAULT 0 NOT NULL,
    municipality VARCHAR(50) NOT NULL
);

-- Broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    sender VARCHAR(100) NOT NULL,
    timestamp VARCHAR NOT NULL,
    municipality VARCHAR(50) NOT NULL,
    files TEXT DEFAULT '[]'
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    municipality VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    generated_by INTEGER NOT NULL,
    generated_by_name VARCHAR(100) NOT NULL,
    generated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_date DATETIME,
    end_date DATETIME,
    filters TEXT,
    data TEXT,
    format VARCHAR(20) DEFAULT 'json',
    municipality VARCHAR(50),
    file_path VARCHAR(255),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- System Activities table
CREATE TABLE IF NOT EXISTS system_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name VARCHAR(100),
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    municipality VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
''')

conn.commit()
conn.close()

print("Database created successfully!")
print("Tables: users, members, meetings, complaints, minutes, documents, emails, broadcasts, audit_logs, reports, system_activities")