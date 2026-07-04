import json
from abc import ABC, abstractmethod
from typing import Any


class BaseExporter(ABC):
    @abstractmethod
    def export(self, data: dict[str, Any]) -> str | bytes:
        pass

    @abstractmethod
    def get_content_type(self) -> str:
        pass

    @abstractmethod
    def get_extension(self) -> str:
        pass


class JSONExporter(BaseExporter):
    def export(self, data: dict[str, Any]) -> str:
        return json.dumps(data, indent=2)

    def get_content_type(self) -> str:
        return "application/json"

    def get_extension(self) -> str:
        return "json"


class HTMLExporter(BaseExporter):
    """Generates a professional, beautifully-styled standalone HTML report."""

    def export(self, data: dict[str, Any]) -> str:
        title = data.get("title", "System Report")
        period_start = data.get("period_start", "")
        period_end = data.get("period_end", "")
        generated_at = data.get("generated_at", "")
        report_type = data.get("report_type", "").upper()
        content = data.get("content", {})

        health = content.get("health_scores", {})
        hardware = content.get("hardware", {})
        storage = content.get("storage", [])
        network = content.get("network", [])
        incidents = content.get("incidents", {})
        events = content.get("events", {})
        predictions = content.get("predictions", [])
        ai_analysis = content.get("ai_analysis", {})

        # ── Health Score Color ────────────────────────────────────────────────
        score = health.get("average_score", 0)
        score_color = "#4ade80" if score >= 80 else "#fbbf24" if score >= 50 else "#f87171"

        # ── AI Analysis HTML ──────────────────────────────────────────────────
        ai_text = ai_analysis.get("summary", "No AI analysis available.")
        ai_provider = ai_analysis.get("provider", "")
        ai_model = ai_analysis.get("model", "")
        ai_html = self._markdown_to_html(ai_text)

        # ── Storage Table Rows ────────────────────────────────────────────────
        storage_rows = ""
        for d in storage:
            usage = d.get("usage_percent", 0)
            bar_color = "#4ade80" if usage < 70 else "#fbbf24" if usage < 85 else "#f87171"
            storage_rows += f"""
            <tr>
                <td>{d.get('device', '')}</td>
                <td>{d.get('mountpoint', '')}</td>
                <td>{d.get('total_gb', 0):.1f} GB</td>
                <td>{d.get('used_gb', 0):.1f} GB</td>
                <td>{d.get('free_gb', 0):.1f} GB</td>
                <td>
                    <div class="bar-wrap">
                        <div class="bar" style="width:{min(usage,100):.1f}%;background:{bar_color}"></div>
                    </div>
                    <span class="pct">{usage:.1f}%</span>
                </td>
            </tr>"""

        # ── Predictions HTML ──────────────────────────────────────────────────
        pred_html = ""
        if predictions:
            for p in predictions:
                risk = round((p.get("failure_probability", 0) or 0) * 100)
                sev = p.get("severity", "low")
                sev_color = "#f87171" if sev == "critical" else "#fbbf24" if sev == "high" else "#94a3b8"
                ttf = p.get("predicted_ttf_hours")
                ttf_str = f" &bull; ~{ttf:.0f}h until failure" if ttf else ""
                pred_html += f"""
                <div class="pred-card">
                    <div class="pred-left">
                        <div class="pred-title">
                            {p.get("component", "Unknown").capitalize()}
                            <span class="severity-badge" style="background:{sev_color}20;color:{sev_color};border:1px solid {sev_color}40">{sev.upper()}</span>
                        </div>
                        <div class="pred-reason">{p.get("reason", "")}{ttf_str}</div>
                    </div>
                    <div class="pred-risk" style="color:{sev_color}">{risk}%<br><small>Risk</small></div>
                </div>"""
        else:
            pred_html = '<div class="empty-card">✅ No active predictions or threats detected during this period.</div>'

        # ── Incident Badges ───────────────────────────────────────────────────
        recent_incidents_html = ""
        for i in (incidents.get("recent_titles") or []):
            sev = i.get("severity", "low")
            sev_color = "#f87171" if sev == "critical" else "#fbbf24" if sev == "high" else "#94a3b8"
            recent_incidents_html += f"""
            <div class="incident-row">
                <span class="dot" style="background:{sev_color}"></span>
                <span class="incident-title">{i.get('title', '')}</span>
                <span class="severity-badge" style="background:{sev_color}20;color:{sev_color};border:1px solid {sev_color}40">{sev.upper()}</span>
            </div>"""

        # ── Event Severity Badges ─────────────────────────────────────────────
        event_badges = ""
        for sev, count in (events.get("by_severity") or {}).items():
            event_badges += f'<span class="event-badge">{sev} <strong>{count}</strong></span>'

        # ── Network Table ─────────────────────────────────────────────────────
        network_rows = ""
        for n in network:
            network_rows += f"""
            <tr>
                <td>{n.get('interface', '')}</td>
                <td>{n.get('recv_mb_s', 0):.3f} MB/s</td>
                <td>{n.get('sent_mb_s', 0):.3f} MB/s</td>
            </tr>"""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 24px; }}
  .container {{ max-width: 1100px; margin: 0 auto; }}

  /* Header */
  .header {{ background: #1e2330; border: 1px solid #2d3448; border-radius: 12px;
             padding: 28px 32px; margin-bottom: 24px; display: flex;
             justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }}
  .header-left h1 {{ font-size: 1.8rem; font-weight: 700; color: #f1f5f9; }}
  .header-left p {{ color: #94a3b8; margin-top: 6px; font-size: 0.875rem; }}
  .badge {{ display: inline-block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
            text-transform: uppercase; padding: 3px 10px; border-radius: 20px;
            background: #4f6bef20; color: #818cf8; border: 1px solid #4f6bef40; margin-left: 8px; }}
  .generated {{ color: #64748b; font-size: 0.8rem; text-align: right; }}

  /* Section */
  .section {{ background: #1e2330; border: 1px solid #2d3448; border-radius: 12px;
              padding: 24px; margin-bottom: 20px; }}
  .section-title {{ font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 20px;
                    display: flex; align-items: center; gap: 8px; }}
  .section-title::before {{ content: ''; display: inline-block; width: 3px; height: 14px;
                              background: #818cf8; border-radius: 2px; }}

  /* Grid */
  .grid-2 {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}

  /* Health Score */
  .health-score {{ text-align: center; padding: 16px; }}
  .score-number {{ font-size: 5rem; font-weight: 900; line-height: 1; color: {score_color}; }}
  .score-label {{ color: #64748b; font-size: 0.875rem; margin-top: 8px; }}
  .score-meta {{ margin-top: 12px; display: inline-block; background: #0f1117; 
                 padding: 4px 12px; border-radius: 20px; color: #64748b; font-size: 0.75rem; }}

  /* Metric bars */
  .metric-row {{ margin-bottom: 18px; }}
  .metric-header {{ display: flex; justify-content: space-between; font-size: 0.85rem;
                    margin-bottom: 6px; color: #cbd5e1; }}
  .bar-track {{ background: #0f1117; border-radius: 999px; height: 10px; overflow: hidden; }}
  .bar-fill {{ height: 100%; border-radius: 999px; transition: width 1s ease; }}
  .cpu-bar {{ background: #818cf8; }}
  .ram-bar {{ background: #a78bfa; }}

  /* Stat boxes */
  .stat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }}
  .stat-box {{ background: #0f1117; border-radius: 10px; padding: 16px; text-align: center;
               border: 1px solid #2d3448; }}
  .stat-value {{ font-size: 2rem; font-weight: 800; color: #f1f5f9; }}
  .stat-label {{ font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
                 color: #64748b; margin-top: 4px; }}
  .stat-critical .stat-value {{ color: #f87171; }}
  .stat-critical {{ border-color: #f8717140; }}

  /* Table */
  table {{ width: 100%; border-collapse: collapse; font-size: 0.875rem; }}
  th {{ text-align: left; color: #64748b; font-size: 0.7rem; text-transform: uppercase;
        letter-spacing: 0.05em; padding: 8px 12px; border-bottom: 1px solid #2d3448; }}
  td {{ padding: 10px 12px; border-bottom: 1px solid #1a2035; color: #cbd5e1; }}
  tr:last-child td {{ border-bottom: none; }}
  .bar-wrap {{ background: #0f1117; border-radius: 4px; height: 6px; overflow: hidden;
               display: inline-block; width: 80px; vertical-align: middle; margin-right: 6px; }}
  .bar {{ height: 100%; border-radius: 4px; }}
  .pct {{ font-size: 0.75rem; color: #94a3b8; }}

  /* AI Analysis */
  .ai-section {{ background: #12182b; border: 1px solid #4f6bef30; border-radius: 12px;
                 padding: 28px; margin-bottom: 20px; }}
  .ai-badge {{ display: inline-block; font-size: 0.7rem; background: #4f6bef20; color: #818cf8;
               border: 1px solid #4f6bef40; border-radius: 20px; padding: 2px 10px;
               margin-left: 8px; font-weight: 600; }}
  .ai-content h1, .ai-content h2, .ai-content h3 {{ color: #e2e8f0; margin: 20px 0 10px; font-size: 1rem; }}
  .ai-content h2 {{ font-size: 1.1rem; color: #c7d2fe; border-bottom: 1px solid #2d3448; padding-bottom: 6px; }}
  .ai-content p {{ color: #94a3b8; line-height: 1.75; margin-bottom: 12px; }}
  .ai-content ul, .ai-content ol {{ color: #94a3b8; line-height: 1.75; padding-left: 20px; margin-bottom: 12px; }}
  .ai-content li {{ margin-bottom: 6px; }}
  .ai-content strong {{ color: #e2e8f0; }}
  .ai-content code {{ background: #1e2330; padding: 2px 6px; border-radius: 4px;
                       font-family: 'Courier New', monospace; font-size: 0.85em; }}

  /* Predictions */
  .pred-card {{ background: #0f1117; border: 1px solid #2d3448; border-radius: 10px;
                padding: 14px 18px; margin-bottom: 10px; display: flex;
                justify-content: space-between; align-items: center; gap: 16px; }}
  .pred-title {{ font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }}
  .pred-reason {{ color: #64748b; font-size: 0.85rem; margin-top: 4px; }}
  .pred-risk {{ text-align: right; font-size: 1.4rem; font-weight: 900; line-height: 1.2;
                min-width: 60px; }}
  .pred-risk small {{ font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }}

  /* Incidents */
  .incident-row {{ display: flex; align-items: center; gap: 10px; padding: 8px 0;
                   border-bottom: 1px solid #1a2035; }}
  .incident-row:last-child {{ border-bottom: none; }}
  .dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }}
  .incident-title {{ flex: 1; color: #cbd5e1; font-size: 0.875rem; }}
  .severity-badge {{ font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em;
                     text-transform: uppercase; padding: 2px 8px; border-radius: 20px;
                     white-space: nowrap; }}

  /* Events */
  .event-badge {{ background: #1e2330; border: 1px solid #2d3448; color: #94a3b8;
                  border-radius: 20px; padding: 4px 12px; font-size: 0.8rem; 
                  display: inline-block; margin: 4px; text-transform: capitalize; }}
  .event-badge strong {{ color: #e2e8f0; }}
  .event-total {{ font-size: 2.5rem; font-weight: 900; color: #f1f5f9; }}

  /* Empty state */
  .empty-card {{ background: #0f1117; border: 1px dashed #2d3448; border-radius: 10px;
                 padding: 28px; text-align: center; color: #64748b; }}

  /* Battery */
  .meta-row {{ display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }}
  .meta-item {{ background: #0f1117; border: 1px solid #2d3448; border-radius: 8px;
                padding: 10px 16px; font-size: 0.85rem; color: #94a3b8; }}
  .meta-item strong {{ color: #e2e8f0; }}

  footer {{ text-align: center; color: #334155; font-size: 0.75rem; padding: 24px 0; }}
</style>
</head>
<body>
<div class="container">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>⚡ {title} <span class="badge">{report_type}</span></h1>
      <p>Period: {period_start} → {period_end}</p>
    </div>
    <div class="generated">
      Generated: {generated_at}<br>
      SystemGuardian AI v0.3
    </div>
  </div>

  <!-- AI ANALYSIS -->
  <div class="ai-section">
    <div class="section-title">🤖 AI Diagnostic Analysis <span class="ai-badge">{ai_provider} / {ai_model}</span></div>
    <div class="ai-content">{ai_html}</div>
  </div>

  <!-- HEALTH SCORE + HARDWARE -->
  <div class="grid-2">
    <div class="section">
      <div class="section-title">📊 System Health Score</div>
      <div class="health-score">
        <div class="score-number">{score}</div>
        <div class="score-label">/ 100 Average Health Score</div>
        <span class="score-meta">Latest: {health.get('latest_score', score)} &nbsp;|&nbsp; {health.get('data_points', 0)} data points</span>
      </div>
    </div>
    <div class="section">
      <div class="section-title">💻 Hardware Performance</div>
      <div class="metric-row">
        <div class="metric-header"><span>CPU Usage (Avg)</span><span>{hardware.get('cpu_avg', 0):.1f}% &nbsp; Peak: {hardware.get('cpu_max', 0):.1f}%</span></div>
        <div class="bar-track"><div class="bar-fill cpu-bar" style="width:{min(hardware.get('cpu_avg',0),100):.1f}%"></div></div>
      </div>
      <div class="metric-row">
        <div class="metric-header"><span>RAM Usage (Avg)</span><span>{hardware.get('ram_avg', 0):.1f}% &nbsp; Peak: {hardware.get('ram_max', 0):.1f}%</span></div>
        <div class="bar-track"><div class="bar-fill ram-bar" style="width:{min(hardware.get('ram_avg',0),100):.1f}%"></div></div>
      </div>
      <div class="meta-row">
        {f'<div class="meta-item">🧠 Total RAM: <strong>{hardware.get("memory_total_gb", 0):.1f} GB</strong></div>' if hardware.get('memory_total_gb') else ''}
        {f'<div class="meta-item">📋 Used RAM: <strong>{hardware.get("memory_used_gb", 0):.1f} GB</strong></div>' if hardware.get('memory_used_gb') else ''}
        {f'<div class="meta-item">🌡️ CPU Temp: <strong>{hardware.get("latest", {}).get("temp")}°C</strong></div>' if hardware.get('latest', {}).get('temp') else ''}
        {f'<div class="meta-item">🔋 Battery: <strong>{hardware.get("battery_percent")}%</strong> {"🔌 Plugged In" if hardware.get("is_plugged_in") else "🔋 On Battery"}</div>' if hardware.get('battery_percent') is not None else ''}
      </div>
    </div>
  </div>

  <!-- INCIDENTS + EVENTS -->
  <div class="grid-2">
    <div class="section">
      <div class="section-title">🚨 Incidents Summary</div>
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-box"><div class="stat-value">{incidents.get('total', 0)}</div><div class="stat-label">Total</div></div>
        <div class="stat-box stat-critical"><div class="stat-value">{incidents.get('critical', 0)}</div><div class="stat-label">Critical</div></div>
        <div class="stat-box"><div class="stat-value" style="color:#fbbf24">{incidents.get('high', 0)}</div><div class="stat-label">High</div></div>
        <div class="stat-box"><div class="stat-value" style="color:#94a3b8">{incidents.get('medium', 0)}</div><div class="stat-label">Medium</div></div>
      </div>
      {f'<div class="section-title" style="margin-top:8px">Recent Incidents</div>{recent_incidents_html}' if recent_incidents_html else ''}
    </div>
    <div class="section">
      <div class="section-title">📈 Event Analytics</div>
      <div class="event-total">{events.get('total_today', 0)}</div>
      <div style="color:#64748b;font-size:0.85rem;margin-bottom:16px">Total events logged</div>
      <div>{event_badges}</div>
    </div>
  </div>

  <!-- STORAGE -->
  {f'''<div class="section">
    <div class="section-title">💾 Storage — Drive Analysis</div>
    <table>
      <thead><tr><th>Device</th><th>Mount</th><th>Total</th><th>Used</th><th>Free</th><th>Usage</th></tr></thead>
      <tbody>{storage_rows}</tbody>
    </table>
  </div>''' if storage else ''}

  <!-- NETWORK -->
  {f'''<div class="section">
    <div class="section-title">🌐 Network Interfaces</div>
    <table>
      <thead><tr><th>Interface</th><th>Download</th><th>Upload</th></tr></thead>
      <tbody>{network_rows}</tbody>
    </table>
  </div>''' if network else ''}

  <!-- AI PREDICTIONS -->
  <div class="section">
    <div class="section-title">🔮 Active AI Risk Predictions</div>
    {pred_html}
  </div>

  <footer>SystemGuardian AI &bull; Generated {generated_at} &bull; Do not share this report publicly</footer>
</div>
</body>
</html>"""
        return html

    def _markdown_to_html(self, text: str) -> str:
        """Minimal markdown → HTML converter for the AI analysis text."""
        import re
        lines = text.split("\n")
        result = []
        in_ul = False
        for line in lines:
            # Headers
            if line.startswith("### "):
                if in_ul: result.append("</ul>"); in_ul = False
                result.append(f"<h3>{line[4:].strip()}</h3>")
            elif line.startswith("## "):
                if in_ul: result.append("</ul>"); in_ul = False
                result.append(f"<h2>{line[3:].strip()}</h2>")
            elif line.startswith("# "):
                if in_ul: result.append("</ul>"); in_ul = False
                result.append(f"<h1>{line[2:].strip()}</h1>")
            # Bullet list items
            elif line.startswith("- ") or line.startswith("* "):
                if not in_ul: result.append("<ul>"); in_ul = True
                item = line[2:].strip()
                item = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", item)
                result.append(f"<li>{item}</li>")
            elif line.strip() == "":
                if in_ul: result.append("</ul>"); in_ul = False
                result.append("")
            else:
                if in_ul: result.append("</ul>"); in_ul = False
                p = line.strip()
                p = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", p)
                p = re.sub(r"`(.+?)`", r"<code>\1</code>", p)
                result.append(f"<p>{p}</p>")
        if in_ul:
            result.append("</ul>")
        return "\n".join(result)

    def get_content_type(self) -> str:
        return "text/html"

    def get_extension(self) -> str:
        return "html"


class ExporterFactory:
    _exporters: dict[str, type[BaseExporter]] = {
        "json": JSONExporter,
        "html": HTMLExporter,
    }

    @classmethod
    def create(cls, format_type: str) -> BaseExporter:
        if format_type not in cls._exporters:
            raise ValueError(f"Unsupported format: {format_type}. Supported: {list(cls._exporters.keys())}")
        return cls._exporters[format_type]()
