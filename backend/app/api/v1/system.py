from fastapi import APIRouter
from pydantic import BaseModel
import platform
import psutil
import time

router = APIRouter(prefix="/system", tags=["system"])

class SystemInfoResponse(BaseModel):
    hostname: str
    os_version: str
    uptime_seconds: float

@router.get("/info", response_model=SystemInfoResponse)
async def get_system_info() -> SystemInfoResponse:
    """Return basic static system info like hostname, OS, and uptime."""
    
    # OS Name and Version (e.g., Windows 10, macOS 14.2)
    os_name = platform.system()
    os_release = platform.release()
    if os_name == "Windows":
        os_version = f"{os_name} {os_release}"
    elif os_name == "Darwin":
        os_version = f"macOS {os_release}"
    else:
        os_version = f"{os_name} {os_release}"

    hostname = platform.node()
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time

    return SystemInfoResponse(
        hostname=hostname,
        os_version=os_version,
        uptime_seconds=uptime_seconds
    )
