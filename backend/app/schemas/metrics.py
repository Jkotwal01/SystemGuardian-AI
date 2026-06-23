from datetime import datetime
from pydantic import BaseModel, ConfigDict

class HardwareMetricBase(BaseModel):
    cpu_usage_percent: float
    memory_usage_percent: float
    memory_total_bytes: float
    memory_available_bytes: float
    cpu_temperature_celsius: float | None = None
    battery_percent: float | None = None
    is_plugged_in: bool | None = None

class HardwareMetricCreate(HardwareMetricBase):
    pass

class HardwareMetricRead(HardwareMetricBase):
    id: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DiskMetricBase(BaseModel):
    device: str
    mountpoint: str
    total_bytes: float
    used_bytes: float
    free_bytes: float
    usage_percent: float
    read_bytes_per_sec: float
    write_bytes_per_sec: float

class DiskMetricCreate(DiskMetricBase):
    pass

class DiskMetricRead(DiskMetricBase):
    id: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class NetworkMetricBase(BaseModel):
    interface: str
    bytes_sent_per_sec: float
    bytes_recv_per_sec: float
    packets_sent_per_sec: float
    packets_recv_per_sec: float
    errors_in: float
    errors_out: float

class NetworkMetricCreate(NetworkMetricBase):
    pass

class NetworkMetricRead(NetworkMetricBase):
    id: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)
