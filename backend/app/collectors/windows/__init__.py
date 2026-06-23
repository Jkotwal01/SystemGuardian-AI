"""Windows collectors package. Importing this package registers all collectors."""

from app.collectors.windows import (
    application_collector,
    driver_collector,
    hardware_collector,
    network_collector,
    performance_collector,
    power_collector,
    security_collector,
    storage_collector,
)

__all__ = [
    "security_collector",
    "performance_collector",
    "hardware_collector",
    "network_collector",
    "application_collector",
    "storage_collector",
    "driver_collector",
    "power_collector",
]
