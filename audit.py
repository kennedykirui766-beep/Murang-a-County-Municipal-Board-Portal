import json
from datetime import datetime
from flask import request, current_app
from models import db, AuditLog, SystemActivity

class AuditLogger:
    @staticmethod
    def log_action(user_id, user_name, user_email, action, category, 
                   entity_type=None, entity_id=None, details=None, 
                   municipality=None):
        try:
            audit_log = AuditLog(
                user_id=user_id,
                user_name=user_name,
                user_email=user_email,
                action=action,
                category=category,
                entity_type=entity_type,
                entity_id=entity_id,
                details=json.dumps(details) if details else None,
                ip_address=request.remote_addr if request else None,
                user_agent=request.headers.get('User-Agent') if request else None,
                municipality=municipality
            )
            db.session.add(audit_log)
            db.session.commit()
            return audit_log
        except Exception as e:
            current_app.logger.error(f"Failed to log audit: {str(e)}")
            db.session.rollback()
            return None

    @staticmethod
    def log_system_activity(user_id, user_name, activity_type, description,
                           entity_type=None, entity_id=None, municipality=None):
        try:
            activity = SystemActivity(
                user_id=user_id,
                user_name=user_name,
                activity_type=activity_type,
                description=description,
                entity_type=entity_type,
                entity_id=entity_id,
                municipality=municipality
            )
            db.session.add(activity)
            db.session.commit()
            return activity
        except Exception as e:
            current_app.logger.error(f"Failed to log system activity: {str(e)}")
            db.session.rollback()
            return None


def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    return request.remote_addr