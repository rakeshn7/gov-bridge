"""
GIL Core — notifications/dispatcher.py
SIH26129 Component: Event-Driven Citizen Notification Dispatcher
"""

import logging
from datetime import datetime
from typing import Any

log = logging.getLogger(__name__)


class NotificationDispatcher:
    """
    Dispatches simulated multi-channel citizen notifications (SMS, Email, DigiLocker)
    in response to workflow pipeline state transitions.
    """

    @staticmethod
    def dispatch_event(
        request_id: str,
        citizen_id: str,
        event_type: str,
        status: str,
        phone: str | None = None,
        email: str | None = None,
        details: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """
        Generates multi-channel notification records for the citizen.
        """
        notifications: list[dict[str, Any]] = []
        now = datetime.utcnow().isoformat() + "Z"
        ref_id = request_id[:8]

        # 1. SMS Dispatch via simulated MahaSMS Gateway
        target_phone = phone if (phone and phone != "<redacted>") else "98XXXXXX10"
        if event_type == "initiated":
            sms_msg = f"MahaGov: Interoperability verification initiated (Ref: {ref_id}). Querying state registries. Do not share OTP."
        elif status == "completed":
            sms_msg = f"MahaGov: Cross-department verification complete for Ref: {ref_id}. Consolidated record verified."
        else:
            sms_msg = f"MahaGov: Interoperability update for Ref: {ref_id}. Status: {status}."

        notifications.append({
            "channel": "SMS (MahaSMS Gateway)",
            "recipient": target_phone,
            "status": "DELIVERED",
            "message": sms_msg,
            "timestamp": now,
        })

        # 2. Email Dispatch via State NIC Gateway
        target_email = email if (email and email != "<redacted>") else "citizen@maharashtra.gov.in"
        notifications.append({
            "channel": "Email (Govt Portal Gateway)",
            "recipient": target_email,
            "status": "SENT",
            "message": f"[Government of Maharashtra GIL] Request #{ref_id} status updated to {status.upper()}.",
            "timestamp": now,
        })

        # 3. DigiLocker Sync Notice
        if status == "completed":
            notifications.append({
                "channel": "DigiLocker Integration",
                "recipient": f"DigiLocker ID linked to {citizen_id}",
                "status": "SYNCED",
                "message": "Unified citizen credential signed & synced to DigiLocker wallet.",
                "timestamp": now,
            })

        log.info(f"[Notification] Dispatched {len(notifications)} notifications for request_id={request_id}")
        return notifications
