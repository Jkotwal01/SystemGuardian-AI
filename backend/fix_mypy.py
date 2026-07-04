import os
import re

# 1. builder.py
builder_file = "app/reports/builder.py"
with open(builder_file, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("def __init__(self, session: AsyncSession, ai_provider=None) -> None:", "def __init__(self, session: AsyncSession, ai_provider: Any = None) -> None:")
with open(builder_file, "w", encoding="utf-8") as f:
    f.write(text)

# 2. storage_collector.py
storage_file = "app/collectors/windows/storage_collector.py"
with open(storage_file, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("_last_io = {}", "_last_io: dict[str, Any] = {}")
with open(storage_file, "w", encoding="utf-8") as f:
    f.write(text)

# 3. network_collector.py
network_file = "app/collectors/windows/network_collector.py"
with open(network_file, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("_last_io = {}", "_last_io: dict[str, Any] = {}")
with open(network_file, "w", encoding="utf-8") as f:
    f.write(text)

# 4. reports.py
reports_file = "app/api/v1/reports.py"
with open(reports_file, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("builder = DailyReportBuilder", "builder: ReportBuilder = DailyReportBuilder")
text = text.replace("from app.reports.builder import DailyReportBuilder, WeeklyReportBuilder", "from app.reports.builder import DailyReportBuilder, WeeklyReportBuilder, ReportBuilder")
text = text.replace("from typing import Any\n", "") # prevent duplicate if run multiple times
text = "from typing import Any\n" + text

text = re.sub(r'async def get_reports\((.*?)\):', r'async def get_reports(\1) -> Any:', text)
text = re.sub(r'async def generate_report\(([\s\S]*?)\):', r'async def generate_report(\1) -> Any:', text)
text = re.sub(r'async def view_report_html\((.*?)\):', r'async def view_report_html(\1) -> Any:', text)
text = re.sub(r'async def export_report\(([\s\S]*?)\):', r'async def export_report(\1) -> Any:', text)
text = re.sub(r'async def get_report\((.*?)\):', r'async def get_report(\1) -> Any:', text)
text = re.sub(r'async def delete_report\((.*?)\):', r'async def delete_report(\1) -> Any:', text)
with open(reports_file, "w", encoding="utf-8") as f:
    f.write(text)

# 5. predictions.py
predictions_file = "app/api/v1/predictions.py"
with open(predictions_file, "r", encoding="utf-8") as f:
    text = f.read()
text = "from typing import Any\n" + text
text = re.sub(r'async def get_active_predictions\((.*?)\):', r'async def get_active_predictions(\1) -> Any:', text)
text = re.sub(r'async def run_predictions\((.*?)\):', r'async def run_predictions(\1) -> Any:', text)
with open(predictions_file, "w", encoding="utf-8") as f:
    f.write(text)

# 6. notifications.py
notifications_file = "app/api/v1/notifications.py"
with open(notifications_file, "r", encoding="utf-8") as f:
    text = f.read()
text = "from typing import Any\n" + text
text = re.sub(r'async def get_notifications\((.*?)\):', r'async def get_notifications(\1) -> Any:', text)
text = re.sub(r'async def get_unread_count\((.*?)\):', r'async def get_unread_count(\1) -> Any:', text)
text = re.sub(r'async def mark_read\((.*?)\):', r'async def mark_read(\1) -> Any:', text)
text = re.sub(r'async def mark_all_read\((.*?)\):', r'async def mark_all_read(\1) -> Any:', text)
with open(notifications_file, "w", encoding="utf-8") as f:
    f.write(text)

# 7. chat.py
chat_file = "app/api/v1/chat.py"
with open(chat_file, "r", encoding="utf-8") as f:
    text = f.read()
text = text.replace("def get_ai_assistant(request: Request) -> AIAssistant:", "def get_ai_assistant(request: Request) -> Any:")
text = text.replace("async def event_generator():", "async def event_generator() -> Any:")
text = text.replace("async def get_chat_history(session_id: str, limit: int = 50, db: AsyncSession = Depends(get_session)):", "async def get_chat_history(session_id: str, limit: int = 50, db: AsyncSession = Depends(get_session)) -> Any:")
with open(chat_file, "w", encoding="utf-8") as f:
    f.write(text)

print("Done")
