# c:\Users\kamau\Murang-a-County-Municipal-Board-Portal\report_service.py

from datetime import datetime, timedelta
from models import db, User, Member, Meeting, Minute, Complaint, Document, Broadcast, AuditLog, SystemActivity

class ReportService:
    @staticmethod
    def generate_summary_report(start_date=None, end_date=None, municipality=None):
        start_date = start_date or datetime.utcnow() - timedelta(days=30)
        end_date = end_date or datetime.utcnow()
        
        user_query = User.query
        meeting_query = Meeting.query
        complaint_query = Complaint.query
        minute_query = Minute.query
        document_query = Document.query
        broadcast_query = Broadcast.query
        member_query = Member.query
        
        if municipality:
            user_query = user_query.filter_by(municipality=municipality)
            meeting_query = meeting_query.filter_by(municipality=municipality)
            complaint_query = complaint_query.filter_by(municipality=municipality)
            minute_query = minute_query.filter_by(municipality=municipality)
            document_query = document_query.filter_by(municipality=municipality)
            broadcast_query = broadcast_query.filter_by(municipality=municipality)
            member_query = member_query.filter_by(municipality=municipality)
        
        meeting_query = meeting_query.filter(Meeting.date >= start_date, Meeting.date <= end_date)
        complaint_query = complaint_query.filter(Complaint.date >= start_date, Complaint.date <= end_date)
        minute_query = minute_query.filter(Minute.uploadDate >= start_date, Minute.uploadDate <= end_date)
        document_query = document_query.filter(Document.uploadDate >= start_date, Document.uploadDate <= end_date)
        broadcast_query = broadcast_query.filter(Broadcast.timestamp >= start_date, Broadcast.timestamp <= end_date)
        
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'date_range': {'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
            'municipality': municipality,
            'summary': {
                'total_users': user_query.count(),
                'total_members': member_query.count(),
                'total_meetings': meeting_query.count(),
                'total_complaints': complaint_query.count(),
                'total_minutes': minute_query.count(),
                'total_documents': document_query.count(),
                'total_broadcasts': broadcast_query.count()
            },
            'breakdowns': {
                'pending_complaints': complaint_query.filter_by(status='pending').count(),
                'resolved_complaints': complaint_query.filter_by(status='resolved').count(),
                'in_progress_complaints': complaint_query.filter_by(status='in_progress').count()
            }
        }

    @staticmethod
    def generate_audit_report(start_date=None, end_date=None, category=None, action=None, municipality=None):
        start_date = start_date or datetime.utcnow() - timedelta(days=90)
        end_date = end_date or datetime.utcnow()
        
        query = AuditLog.query.filter(AuditLog.timestamp >= start_date, AuditLog.timestamp <= end_date)
        if category: query = query.filter_by(category=category)
        if action: query = query.filter_by(action=action)
        if municipality: query = query.filter_by(municipality=municipality)
        
        query = query.order_by(AuditLog.timestamp.desc())
        logs = query.all()
        
        category_summary, action_summary, user_activity = {}, {}, {}
        for log in logs:
            category_summary[log.category] = category_summary.get(log.category, 0) + 1
            action_summary[log.action] = action_summary.get(log.action, 0) + 1
            key = f"{log.user_name} ({log.user_email})"
            user_activity[key] = user_activity.get(key, 0) + 1
        
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'date_range': {'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
            'filters': {'category': category, 'action': action, 'municipality': municipality},
            'total_entries': len(logs),
            'summary': {'category_breakdown': category_summary, 'action_breakdown': action_summary, 'user_activity': user_activity},
            'logs': [log.to_dict() for log in logs[:500]]
        }

    @staticmethod
    def generate_user_activity_report(start_date=None, end_date=None, municipality=None):
        start_date = start_date or datetime.utcnow() - timedelta(days=30)
        end_date = end_date or datetime.utcnow()
        
        query = SystemActivity.query.filter(SystemActivity.timestamp >= start_date, SystemActivity.timestamp <= end_date)
        if municipality: query = query.filter_by(municipality=municipality)
        query = query.order_by(SystemActivity.timestamp.desc())
        activities = query.all()
        
        activity_breakdown, user_breakdown = {}, {}
        for activity in activities:
            activity_breakdown[activity.activity_type] = activity_breakdown.get(activity.activity_type, 0) + 1
            user_name = activity.user_name or 'System'
            user_breakdown[user_name] = user_breakdown.get(user_name, 0) + 1
        
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'date_range': {'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
            'municipality': municipality,
            'total_activities': len(activities),
            'activity_breakdown': activity_breakdown,
            'user_breakdown': user_breakdown,
            'recent_activities': [a.to_dict() for a in activities[:100]]
        }