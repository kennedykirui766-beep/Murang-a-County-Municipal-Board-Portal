# c:\Users\kamau\Murang-a-County-Municipal-Board-Portal\report_routes.py

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import json
from models import db, User, AuditLog, Report, Meeting, Minute, Complaint, Document, Broadcast, SystemActivity
from audit import AuditLogger
from report_service import ReportService

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@reports_bp.route('/summary', methods=['GET'])
def get_summary_report():
    user_id = request.args.get('user_id', 1)
    user = User.query.get(user_id)
    
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    municipality = request.args.get('municipality')
    
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
    if not end_date:
        end_date = datetime.utcnow().isoformat()
    
    try:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    
    report_data = ReportService.generate_summary_report(start_dt, end_dt, municipality)
    return jsonify(report_data), 200

@reports_bp.route('/audit', methods=['GET'])
def get_audit_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    action = request.args.get('action')
    municipality = request.args.get('municipality')
    
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
    if not end_date:
        end_date = datetime.utcnow().isoformat()
    
    try:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    
    report_data = ReportService.generate_audit_report(start_dt, end_dt, category, action, municipality)
    return jsonify(report_data), 200

@reports_bp.route('/user-activity', methods=['GET'])
def get_user_activity_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    municipality = request.args.get('municipality')
    
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
    if not end_date:
        end_date = datetime.utcnow().isoformat()
    
    try:
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400
    
    report_data = ReportService.generate_user_activity_report(start_dt, end_dt, municipality)
    return jsonify(report_data), 200

@reports_bp.route('/save', methods=['POST'])
def save_report():
    data = request.get_json()
    
    if not data.get('report_name'):
        return jsonify({'error': 'Report name is required'}), 400
    
    user_id = data.get('user_id', 1)
    user = User.query.get(user_id)
    
    report = Report(
        report_name=data['report_name'],
        report_type=data.get('report_type', 'custom'),
        generated_by=user_id,
        generated_by_name=user.name if user else 'System',
        filters=json.dumps(data.get('filters', {})),
        data=json.dumps(data.get('data', {})),
        format=data.get('format', 'json'),
        municipality=data.get('municipality')
    )
    
    if data.get('start_date'):
        try: report.start_date = datetime.fromisoformat(data['start_date'])
        except ValueError: pass
    if data.get('end_date'):
        try: report.end_date = datetime.fromisoformat(data['end_date'])
        except ValueError: pass
    
    db.session.add(report)
    db.session.commit()
    
    return jsonify(report.to_dict()), 201

@reports_bp.route('/saved', methods=['GET'])
def get_saved_reports():
    reports = Report.query.order_by(Report.generated_date.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200

@reports_bp.route('/saved/<int:report_id>', methods=['DELETE'])
def delete_saved_report(report_id):
    report = Report.query.get(report_id)
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    
    db.session.delete(report)
    db.session.commit()
    return jsonify({'message': 'Report deleted successfully'}), 200

@reports_bp.route('/audit/logs', methods=['GET'])
def get_audit_logs():
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 50)), 200)
    
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    action = request.args.get('action')
    
    query = AuditLog.query
    
    if start_date:
        try: query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(start_date))
        except ValueError: pass
    if end_date:
        try: query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(end_date))
        except ValueError: pass
    if category: query = query.filter_by(category=category)
    if action: query = query.filter_by(action=action)
    
    query = query.order_by(AuditLog.timestamp.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'logs': [log.to_dict() for log in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200

@reports_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    user_id = request.args.get('user_id', 1)
    user = User.query.get(user_id)
    
    municipality = user.municipality if user and user.role == 'municipal_officer' else None
    
    user_query = User.query
    meeting_query = Meeting.query
    complaint_query = Complaint.query
    minute_query = Minute.query
    broadcast_query = Broadcast.query
    document_query = Document.query
    
    if municipality:
        user_query = user_query.filter_by(municipality=municipality)
        meeting_query = meeting_query.filter_by(municipality=municipality)
        complaint_query = complaint_query.filter_by(municipality=municipality)
        minute_query = minute_query.filter_by(municipality=municipality)
        broadcast_query = broadcast_query.filter_by(municipality=municipality)
        document_query = document_query.filter_by(municipality=municipality)
    
    # Get recent activities
    recent_activities = SystemActivity.query
    if municipality:
        recent_activities = recent_activities.filter_by(municipality=municipality)
    recent_activities = recent_activities.order_by(SystemActivity.timestamp.desc()).limit(5).all()
    
    stats = {
        'users_count': user_query.count(),
        'meetings_count': meeting_query.count(),
        'complaints_count': complaint_query.count(),
        'pending_complaints': complaint_query.filter_by(status='pending').count(),
        'resolved_complaints': complaint_query.filter_by(status='resolved').count(),
        'minutes_count': minute_query.count(),
        'broadcasts_count': broadcast_query.count(),
        'documents_count': document_query.count(),
        'recent_activities': [a.to_dict() for a in recent_activities]
    }
    return jsonify(stats), 200