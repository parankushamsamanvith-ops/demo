import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Document, DocumentStatus, AuditLog, User
# Assumes an async session factory is defined in app.db.session
from app.db.session import async_session_factory

logger = logging.getLogger("scheduler")

# Threshold windows for proactive bureaucratic renewal notices (in days)
ALERT_INTERVALS = [90, 30, 7]


# ==============================================================================
# Notification Dispatcher (Mock / Integration Hook)
# ==============================================================================

async def dispatch_expiration_notification(
    user_email: str,
    doc_title: str,
    doc_type: str,
    days_left: int,
    expiry_date: date,
) -> None:
    """
    Sends email, push, or in-app alert to the user.
    Integrates with SendGrid, SES, or WebSocket notification streams.
    """
    if days_left <= 0:
        subject = f"ACTION REQUIRED: Your {doc_title} ({doc_type}) has expired!"
        message = (
            f"Your document '{doc_title}' expired on {expiry_date.isoformat()}. "
            "Please upload your renewed document or consult the assistant for renewal procedures."
        )
    else:
        subject = f"EXPIRATION WARNING: Your {doc_title} expires in {days_left} days"
        message = (
            f"Your document '{doc_title}' ({doc_type}) is due to expire on {expiry_date.isoformat()}. "
            "Bureaucratic processing times can take several weeks. Start renewal preparations now."
        )

    # In production, dispatch via your mailer or push notification provider
    logger.info("[ALERT SENT] To: %s | Subject: %s | Body: %s", user_email, subject, message)


# ==============================================================================
# Core Expiration Audit Task
# ==============================================================================

async def check_expiring_documents() -> None:
    """
    Evaluates all active documents against today's date:
    1. Identifies documents matching alert intervals (90, 30, 7 days remaining).
    2. Flags documents that have passed their expiration date as EXPIRED.
    3. Flags documents within 90 days as EXPIRING_SOON.
    4. Records an audit entry and updates last_reminder_sent.
    """
    today = date.today()
    now_utc = datetime.now(timezone.utc)
    logger.info("Executing daily document expiration scan for date: %s", today.isoformat())

    async with async_session_factory() as session:
        async with session.begin():
            # Query active or soon-expiring documents that have an expiry_date set
            stmt = (
                select(Document, User.email)
                .join(User, Document.user_id == User.id)
                .where(
                    and_(
                        Document.expiry_date.isnot(None),
                        Document.status.in_([DocumentStatus.ACTIVE, DocumentStatus.EXPIRING_SOON]),
                    )
                )
            )
            results = await session.execute(stmt)
            records = results.all()

            for doc, user_email in records:
                expiry = doc.expiry_date
                days_until_expiry = (expiry - today).days

                # 1. Document has already expired
                if days_until_expiry <= 0:
                    doc.status = DocumentStatus.EXPIRED
                    doc.updated_at = now_utc

                    await dispatch_expiration_notification(
                        user_email=user_email,
                        doc_title=doc.title,
                        doc_type=doc.doc_type,
                        days_left=days_until_expiry,
                        expiry_date=expiry,
                    )

                    # Create Audit Log
                    audit = AuditLog(
                        user_id=doc.user_id,
                        action="DOCUMENT_EXPIRED",
                        resource_type="DOCUMENT",
                        resource_id=str(doc.id),
                        timestamp=now_utc,
                    )
                    session.add(audit)
                    continue

                # 2. Document is expiring soon (Within 90-day horizon)
                if days_until_expiry <= 90:
                    doc.status = DocumentStatus.EXPIRING_SOON
                    doc.updated_at = now_utc

                    # Send notification if matching one of the critical interval markers
                    # or if no reminder has been sent in the past 7 days
                    last_reminder = doc.last_reminder_sent
                    reminder_stale = (
                        last_reminder is None
                        or (now_utc - last_reminder).days >= 7
                    )

                    if days_until_expiry in ALERT_INTERVALS or reminder_stale:
                        await dispatch_expiration_notification(
                            user_email=user_email,
                            doc_title=doc.title,
                            doc_type=doc.doc_type,
                            days_left=days_until_expiry,
                            expiry_date=expiry,
                        )
                        doc.last_reminder_sent = now_utc

                        audit = AuditLog(
                            user_id=doc.user_id,
                            action="EXPIRATION_ALERT_SENT",
                            resource_type="DOCUMENT",
                            resource_id=str(doc.id),
                            timestamp=now_utc,
                        )
                        session.add(audit)

    logger.info("Expiration check completed successfully.")


# ==============================================================================
# Scheduler Lifecycle Management
# ==============================================================================

class ExpirationSchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self) -> None:
        """Starts the async cron scheduler, configured to run daily at 00:05 UTC."""
        self.scheduler.add_job(
            check_expiring_documents,
            trigger=CronTrigger(hour=0, minute=5, timezone="UTC"),
            id="daily_document_expiry_audit",
            name="Daily Document Expiration Audit",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("Expiration scheduler started. Daily audit set for 00:05 UTC.")

    def shutdown(self) -> None:
        """Gracefully halts scheduler threads and async executors."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Expiration scheduler stopped.")


scheduler_service = ExpirationSchedulerService()