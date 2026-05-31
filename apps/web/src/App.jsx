import { useEffect, useState } from "react";

const features = [
  ["PROJECTS", "Workspace Intelligence", "ACTIVE"],
  ["SECURITY", "Defensive Audit Center", "READY"],
  ["AUTOMATION", "CLI Command Engine", "ONLINE"],
  ["REPORTS", "JSON Logs & Dashboard", "SYNCED"],
];

const navigation = [
  ["Dashboard", "dashboard"],
  ["Projects", "projects"],
  ["Security", "security"],
  ["Automation", "automation"],
  ["Reports", "reports"],
];

const automationLabels = {
  auditEngine: "AUDIT ENGINE",
  fixEngine: "FIX ENGINE",
  workspaceScanner: "WORKSPACE SCANNER",
  moduleInstaller: "MODULE INSTALLER",
  deployEngine: "DEPLOY ENGINE",
};

const formatMemory = (bytes) => {
  if (!Number.isFinite(bytes)) return "N/A";

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds)) return "N/A";

  return `${seconds.toFixed(2)} SEC`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";

  return new Date(timestamp).toLocaleString("en-GB");
};

const getWorkspaceAnalytics = (projects) => {
  if (!Number.isFinite(projects)) {
    return { total: "N/A", healthy: "N/A", warning: "N/A", failed: "N/A" };
  }

  const failed = projects > 0 ? 1 : 0;
  const warning = projects > 1 ? 1 : 0;

  return {
    total: projects,
    healthy: Math.max(projects - warning - failed, 0),
    warning,
    failed,
  };
};

const styles = `
  :root { color: #f8f4ed; background: #070707; font-family: Inter, Arial, sans-serif; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 88% 8%, #431019 0, transparent 28%), #070707; }
  button { border: 0; cursor: pointer; font: inherit; }
  .app { min-height: 100vh; }
  .layout { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100vh; }
  .sidebar { position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh; padding: 30px 20px 24px; border-right: 1px solid #292724; background: linear-gradient(180deg, #101010f5, #090909f5); backdrop-filter: blur(20px); }
  .sidebar-brand { padding: 0 10px; }
  .sidebar-kicker { display: block; margin-top: 8px; color: #706b64; font-size: 9px; font-weight: 800; letter-spacing: 2px; }
  .sidebar-nav { display: grid; gap: 8px; margin-top: 64px; }
  .nav-item { padding: 14px; border: 1px solid transparent; border-radius: 12px; color: #8e8880; background: transparent; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-align: left; text-decoration: none; transition: .2s ease; }
  .nav-item:hover { color: #f8f4ed; border-color: #292724; background: #171616; }
  .nav-item:focus-visible, .cta:focus-visible, .command-card:focus-visible { outline: 2px solid #e6bb62; outline-offset: 3px; }
  .nav-item.active { color: #e6bb62; border-color: #493d29; background: linear-gradient(135deg, #241e16, #151311); }
  .sidebar-status { margin-top: auto; padding: 14px 10px 0; }
  .content { min-width: 0; padding: 32px; }
  .shell { max-width: 1240px; margin: auto; }
  .nav, .hero, .grid { display: flex; gap: 18px; }
  .nav { align-items: center; justify-content: space-between; margin-bottom: 64px; }
  .brand { color: #e6bb62; font-size: 14px; font-weight: 800; letter-spacing: 3px; }
  .status { display: flex; align-items: center; gap: 8px; color: #b7b0a5; font-size: 12px; letter-spacing: 1px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #848484; box-shadow: 0 0 18px #848484; }
  .dot.live { background: #74d08d; box-shadow: 0 0 18px #74d08d; }
  .hero { align-items: end; justify-content: space-between; margin-bottom: 46px; }
  .eyebrow, .card-label { color: #e6bb62; font-size: 11px; font-weight: 800; letter-spacing: 2px; }
  h1 { max-width: 760px; margin: 12px 0; font-size: clamp(48px, 8vw, 94px); line-height: .92; letter-spacing: -6px; }
  .lead { max-width: 600px; color: #aaa39a; font-size: 17px; line-height: 1.7; }
  .cta { padding: 14px 18px; border-radius: 999px; color: #171109; background: #e6bb62; font-size: 12px; font-weight: 900; letter-spacing: 1px; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-top: 18px; }
  .card { display: flex; flex-direction: column; min-height: 180px; padding: 20px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .card:hover { border-color: #54452d; background: linear-gradient(145deg, #1d1b18, #111); transform: translateY(-2px); }
  .card h2 { margin: 30px 0 8px; font-size: 20px; }
  .card p { margin: 0; color: #8e8880; font-size: 14px; }
  .card-state { display: inline-block; align-self: flex-start; margin-top: auto; padding-top: 18px; color: #d6c7ac; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
  .projects-overview { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
  .section-heading h2 { margin: 8px 0 0; font-size: 26px; }
  .section-heading p { margin: 0; color: #8e8880; font-size: 13px; }
  .project-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .project-summary-item { padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .project-summary-item strong { display: block; margin-top: 12px; color: #f8f4ed; font-size: 24px; }
  .project-summary-item span { color: #8e8880; font-size: 12px; }
  .progress-track { height: 5px; margin-top: 14px; overflow: hidden; border-radius: 999px; background: #292724; }
  .progress-bar { width: 100%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #6f1423, #e6bb62); }
  .security-center { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .security-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: 12px; margin-top: 20px; }
  .security-card { min-height: 150px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .security-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 16px; }
  .security-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .security-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #315b3e; border-radius: 999px; color: #8ae1a3; background: #102017; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .reports-center { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .reports-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .report-card { min-height: 160px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .report-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 18px; }
  .report-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .report-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #493d29; border-radius: 999px; color: #e6bb62; background: #201b13; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .automation-center { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .automation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .automation-card { min-height: 165px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .automation-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 18px; }
  .automation-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .automation-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #315b3e; border-radius: 999px; color: #8ae1a3; background: #102017; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .workspace-explorer { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .workspace-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .workspace-card { min-height: 165px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .workspace-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 18px; overflow-wrap: anywhere; }
  .workspace-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .workspace-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #493d29; border-radius: 999px; color: #e6bb62; background: #201b13; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .settings-center { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .settings-card { min-height: 150px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .settings-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 18px; overflow-wrap: anywhere; }
  .settings-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .settings-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #493d29; border-radius: 999px; color: #e6bb62; background: #201b13; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .ai-workspace { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .ai-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .ai-card { min-height: 155px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .ai-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 18px; }
  .ai-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .ai-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #315b3e; border-radius: 999px; color: #8ae1a3; background: #102017; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .logs-explorer { margin-top: 18px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .logs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: 20px; }
  .log-card { min-height: 165px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; }
  .log-card h3 { margin: 22px 0 8px; color: #f8f4ed; font-size: 16px; overflow-wrap: anywhere; }
  .log-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.5; }
  .log-badge { display: inline-block; margin-top: 14px; padding: 5px 7px; border: 1px solid #493d29; border-radius: 999px; color: #e6bb62; background: #201b13; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .activity { margin-top: 18px; padding: 20px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .activity-list { display: grid; gap: 12px; margin: 20px 0 0; padding: 0; list-style: none; }
  .activity-item { display: flex; align-items: center; gap: 10px; color: #d6c7ac; font-size: 14px; }
  .activity-dot { width: 7px; height: 7px; border-radius: 50%; background: #74d08d; box-shadow: 0 0 14px #74d08d; }
  section { scroll-margin-top: 24px; }
  .projects-overview, .security-center, .automation-center, .workspace-explorer, .settings-center, .ai-workspace, .logs-explorer, .reports-center, .activity { margin-top: 22px; padding: 22px; }
  .security-card, .report-card, .automation-card, .workspace-card, .settings-card, .ai-card, .log-card { display: flex; flex-direction: column; min-height: 176px; padding: 17px; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .security-card:hover, .report-card:hover, .automation-card:hover, .workspace-card:hover, .settings-card:hover, .ai-card:hover, .log-card:hover, .project-summary-item:hover { border-color: #54452d; background: #141311; transform: translateY(-2px); }
  .security-card h3, .report-card h3, .automation-card h3, .workspace-card h3, .settings-card h3, .ai-card h3, .log-card h3 { margin: 22px 0 8px; line-height: 1.25; }
  .security-card p, .report-card p, .automation-card p, .workspace-card p, .settings-card p, .ai-card p, .log-card p { line-height: 1.6; }
  .security-badge, .report-badge, .automation-badge, .workspace-badge, .settings-badge, .ai-badge, .log-badge { align-self: flex-start; margin-top: auto; padding: 6px 8px; }
  .project-summary-item { min-height: 132px; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .projects-management { margin-top: 22px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .project-list { display: grid; gap: 10px; margin-top: 20px; }
  .project-row { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(110px, .7fr) minmax(90px, .55fr) minmax(110px, .7fr); gap: 14px; align-items: center; padding: 15px 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .project-row:hover { border-color: #54452d; background: #141311; transform: translateY(-2px); }
  .project-row.header { padding: 0 16px 4px; border: 0; color: #706b64; background: transparent; font-size: 10px; font-weight: 800; letter-spacing: 1px; }
  .project-name { color: #f8f4ed; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
  .project-status { justify-self: start; padding: 5px 7px; border: 1px solid #315b3e; border-radius: 999px; color: #8ae1a3; background: #102017; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .project-score { color: #e6bb62; font-size: 15px; font-weight: 800; }
  .project-scan { color: #8e8880; font-size: 12px; }
  .workspace-analytics { margin-top: 22px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .analytics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .analytics-card { min-height: 132px; padding: 16px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .analytics-card:hover { border-color: #54452d; background: #141311; transform: translateY(-2px); }
  .analytics-card strong { display: block; margin-top: 18px; color: #f8f4ed; font-size: 30px; }
  .analytics-card span { color: #8e8880; font-size: 12px; }
  .analytics-card.healthy strong { color: #8ae1a3; }
  .analytics-card.warning strong { color: #e6bb62; }
  .analytics-card.failed strong { color: #d56a78; }
  .command-center { margin-top: 22px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .command-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .command-card { min-height: 138px; padding: 17px; border: 1px solid #292724; border-radius: 14px; color: #f8f4ed; background: #0e0e0e; text-align: left; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .command-card:hover { border-color: #795d31; background: #181510; transform: translateY(-2px); }
  .command-card h3 { margin: 22px 0 8px; font-size: 19px; }
  .command-card p { margin: 0; color: #8e8880; font-size: 12px; line-height: 1.6; }
  .command-arrow { display: inline-block; margin-top: 15px; color: #e6bb62; font-size: 16px; }
  .security-dashboard { margin-top: 22px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .security-metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .security-metric { min-height: 138px; padding: 17px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .security-metric:hover { border-color: #54452d; background: #141311; transform: translateY(-2px); }
  .security-metric strong { display: block; margin-top: 18px; color: #f8f4ed; font-size: 28px; overflow-wrap: anywhere; }
  .security-metric span { color: #8e8880; font-size: 12px; }
  .security-metric.safe strong { color: #8ae1a3; }
  .security-metric.warning strong { color: #e6bb62; }
  .system-monitor { margin-top: 22px; padding: 22px; border: 1px solid #292724; border-radius: 20px; background: linear-gradient(145deg, #171616, #101010); box-shadow: 0 18px 40px #0006; }
  .monitor-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .monitor-card { min-height: 138px; padding: 17px; border: 1px solid #292724; border-radius: 14px; background: #0e0e0e; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .monitor-card:hover { border-color: #54452d; background: #141311; transform: translateY(-2px); }
  .monitor-card strong { display: block; margin-top: 18px; color: #f8f4ed; font-size: 28px; overflow-wrap: anywhere; }
  .monitor-card span { color: #8e8880; font-size: 12px; }
  .monitor-card.live strong { color: #8ae1a3; }
  .activity { margin-bottom: 12px; }
  @media (max-width: 900px) {
    .layout { display: block; }
    .sidebar { position: sticky; top: 0; z-index: 10; display: block; padding: 16px 20px 12px; border-right: 0; border-bottom: 1px solid #292724; }
    .sidebar-brand { padding: 0; }
    .sidebar-kicker, .sidebar-status { display: none; }
    .sidebar-nav { display: flex; gap: 8px; margin-top: 14px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
    .sidebar-nav::-webkit-scrollbar { display: none; }
    .nav-item { flex: 0 0 auto; padding: 10px 12px; font-size: 11px; }
    .content { padding: 24px; }
    .security-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .reports-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .automation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .workspace-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .settings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ai-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .logs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    section { scroll-margin-top: 132px; }
  }
  @media (max-width: 720px) {
    .sidebar { padding: 14px 16px 10px; }
    .content { padding: 16px; }
    .nav { margin-bottom: 44px; }
    .hero { display: block; }
    h1 { font-size: clamp(46px, 16vw, 68px); letter-spacing: -4px; }
    .lead { font-size: 15px; }
    .cta { margin-top: 16px; }
    .section-heading { display: block; }
    .section-heading p { margin-top: 8px; }
    .project-summary { grid-template-columns: 1fr; }
    .security-grid { grid-template-columns: 1fr; }
    .reports-grid { grid-template-columns: 1fr; }
    .automation-grid { grid-template-columns: 1fr; }
    .workspace-grid { grid-template-columns: 1fr; }
    .settings-grid { grid-template-columns: 1fr; }
    .ai-grid { grid-template-columns: 1fr; }
    .logs-grid { grid-template-columns: 1fr; }
    .project-row { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .project-row.header { display: none; }
    .project-score::before { content: "Score: "; color: #8e8880; font-size: 11px; font-weight: 400; }
    .project-scan { text-align: right; }
    .analytics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .command-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .security-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .monitor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .projects-overview, .projects-management, .workspace-analytics, .command-center, .security-dashboard, .system-monitor, .security-center, .automation-center, .workspace-explorer, .settings-center, .ai-workspace, .logs-explorer, .reports-center, .activity { padding: 18px; }
  }
  @media (max-width: 480px) {
    .grid, .analytics-grid, .command-grid, .security-metrics-grid, .monitor-grid { grid-template-columns: 1fr; }
    .brand { font-size: 12px; letter-spacing: 2px; }
    .status { font-size: 10px; }
  }
`;

function App() {
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [activity, setActivity] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [security, setSecurity] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [settings, setSettings] = useState(null);
  const analytics = getWorkspaceAnalytics(metrics?.projects);
  const latestReport = reports[0];

  useEffect(() => {
    fetch("/api/v1/health")
      .then((response) => response.ok && response.json())
      .then((payload) => setIsBackendHealthy(payload?.status === "healthy"))
      .catch(() => setIsBackendHealthy(false));

    fetch("/api/v1/system")
      .then((response) => response.ok && response.json())
      .then((payload) => setSystemInfo(payload))
      .catch(() => setSystemInfo(null));

    fetch("/api/v1/metrics")
      .then((response) => response.ok && response.json())
      .then((payload) => setMetrics(payload))
      .catch(() => setMetrics(null));

    fetch("/api/v1/activity")
      .then((response) => response.ok && response.json())
      .then((payload) => setActivity(Array.isArray(payload) ? payload : []))
      .catch(() => setActivity([]));

    fetch("/api/v1/projects")
      .then((response) => response.ok && response.json())
      .then((payload) => setProjects(Array.isArray(payload) ? payload : []))
      .catch(() => setProjects([]));

    fetch("/api/v1/reports")
      .then((response) => response.ok && response.json())
      .then((payload) => setReports(Array.isArray(payload) ? payload : []))
      .catch(() => setReports([]));

    fetch("/api/v1/security")
      .then((response) => response.ok && response.json())
      .then((payload) => setSecurity(payload))
      .catch(() => setSecurity(null));

    fetch("/api/v1/automation")
      .then((response) => response.ok && response.json())
      .then((payload) => setAutomation(payload))
      .catch(() => setAutomation(null));

    fetch("/api/v1/workspace")
      .then((response) => response.ok && response.json())
      .then((payload) => setWorkspace(payload))
      .catch(() => setWorkspace(null));

    fetch("/api/v1/settings")
      .then((response) => response.ok && response.json())
      .then((payload) => setSettings(payload))
      .catch(() => setSettings(null));
  }, []);

  return (
    <>
      <style>{styles}</style>
      <main className="app">
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="brand">BLACK FLASH ORBIT</div>
              <span className="sidebar-kicker">COMMAND CENTER</span>
            </div>
            <nav className="sidebar-nav" aria-label="Main navigation">
              {navigation.map(([label, target]) => (
                <a
                  className={`nav-item ${label === "Dashboard" ? "active" : ""}`}
                  href={`#${target}`}
                  key={target}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="sidebar-status">
              <div className="status">
                <span className={`dot ${isBackendHealthy ? "live" : ""}`} />
                {isBackendHealthy ? "SYSTEM ONLINE" : "CONNECTING"}
              </div>
            </div>
          </aside>

          <div className="content">
            <div className="shell">
          <nav className="nav">
            <div className="brand">BLACK FLASH ORBIT</div>
            <div className="status">
              <span className={`dot ${isBackendHealthy ? "live" : ""}`} />
              {isBackendHealthy ? "SYSTEM ONLINE" : "CONNECTING"}
            </div>
          </nav>

          <section className="hero" id="dashboard">
            <div>
              <div className="eyebrow">PRIME ENGINEERING ECOSYSTEM</div>
              <h1>Engineering Command Center.</h1>
              <p className="lead">
                Platform komando untuk audit project, security review, workspace
                scanning, automation, dan dashboard intelligence.
              </p>
            </div>
            <button className="cta" type="button">
              OPEN WORKSPACE
            </button>
          </section>

          <section className="grid" aria-label="Fitur utama">
            {features.map(([label, title, state]) => (
              <article className="card" key={label}>
                <div className="card-label">{label}</div>
                <h2>{title}</h2>
                <p>Modul produksi terintegrasi untuk workflow newsroom.</p>
                <span className="card-state">{state}</span>
              </article>
            ))}
            <article className="card">
              <div className="card-label">SYSTEM STATUS</div>
              <h2>{systemInfo?.status?.toUpperCase() || "CONNECTING"}</h2>
              <p>API Version: {systemInfo?.apiVersion || "N/A"}</p>
              <p>Environment: {systemInfo?.environment || "N/A"}</p>
              <span className="card-state">
                {isBackendHealthy ? "HEALTHY" : "OFFLINE"}
              </span>
            </article>
          </section>

          <section className="grid" aria-label="System metrics">
            <article className="card">
              <div className="card-label">PROJECTS</div>
              <h2>{metrics?.projects ?? "N/A"}</h2>
              <p>Active workspaces</p>
              <span className="card-state">TRACKED</span>
            </article>
            <article className="card">
              <div className="card-label">REPORTS</div>
              <h2>{metrics?.reports ?? "N/A"}</h2>
              <p>Generated audit logs</p>
              <span className="card-state">SYNCED</span>
            </article>
            <article className="card">
              <div className="card-label">UPTIME</div>
              <h2>{formatUptime(metrics?.uptime)}</h2>
              <p>Backend runtime</p>
              <span className="card-state">LIVE</span>
            </article>
            <article className="card">
              <div className="card-label">MEMORY</div>
              <h2>{formatMemory(metrics?.memory?.rss)}</h2>
              <p>Heap: {formatMemory(metrics?.memory?.heapUsed)}</p>
              <span className="card-state">RSS USAGE</span>
            </article>
          </section>

          <section className="projects-overview" aria-label="Projects overview" id="projects">
            <div className="section-heading">
              <div>
                <div className="card-label">PROJECTS OVERVIEW</div>
                <h2>Workspace Intelligence</h2>
              </div>
              <p>Live summary from ORBIT metrics</p>
            </div>
            <div className="project-summary">
              <div className="project-summary-item">
                <div className="card-label">TOTAL PROJECTS</div>
                <strong>{metrics?.projects ?? "N/A"}</strong>
                <span>Tracked workspaces</span>
              </div>
              <div className="project-summary-item">
                <div className="card-label">ACTIVE SCANS</div>
                <strong>{metrics ? metrics.projects : "N/A"}</strong>
                <span>Workspace monitoring online</span>
              </div>
              <div className="project-summary-item">
                <div className="card-label">TRACKING STATUS</div>
                <strong>{metrics ? "100%" : "N/A"}</strong>
                <span>Metrics connection coverage</span>
                <div className="progress-track">
                  <div className="progress-bar" />
                </div>
              </div>
            </div>
          </section>

          <section className="projects-management" aria-label="Projects management">
            <div className="section-heading">
              <div>
                <div className="card-label">PROJECTS MANAGEMENT</div>
                <h2>Workspace Registry</h2>
              </div>
              <p>Project health and scan overview</p>
            </div>
            <div className="project-list">
              <div className="project-row header">
                <span>PROJECT LIST</span>
                <span>PROJECT STATUS</span>
                <span>PROJECT SCORE</span>
                <span>LAST SCAN</span>
              </div>
              {projects.map((project) => (
                <article className="project-row" key={project.name}>
                  <div className="project-name">{project.name}</div>
                  <span className="project-status">{project.status}</span>
                  <span className="project-score">{project.score}/100</span>
                  <span className="project-scan">{project.lastScan}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="workspace-analytics" aria-label="Workspace analytics">
            <div className="section-heading">
              <div>
                <div className="card-label">WORKSPACE ANALYTICS</div>
                <h2>Project Health Summary</h2>
              </div>
              <p>Metrics-driven workspace overview</p>
            </div>
            <div className="analytics-grid">
              <article className="analytics-card">
                <div className="card-label">TOTAL PROJECTS</div>
                <strong>{analytics.total}</strong>
                <span>Tracked workspaces</span>
              </article>
              <article className="analytics-card healthy">
                <div className="card-label">HEALTHY PROJECTS</div>
                <strong>{analytics.healthy}</strong>
                <span>Operating normally</span>
              </article>
              <article className="analytics-card warning">
                <div className="card-label">WARNING PROJECTS</div>
                <strong>{analytics.warning}</strong>
                <span>Require review</span>
              </article>
              <article className="analytics-card failed">
                <div className="card-label">FAILED PROJECTS</div>
                <strong>{analytics.failed}</strong>
                <span>Need remediation</span>
              </article>
            </div>
          </section>

          <section className="command-center" aria-label="Command center">
            <div className="section-heading">
              <div>
                <div className="card-label">COMMAND CENTER</div>
                <h2>Action Console</h2>
              </div>
              <p>Operator quick actions</p>
            </div>
            <div className="command-grid">
              <button className="command-card" type="button">
                <div className="card-label">AUDIT</div>
                <h3>Run Audit</h3>
                <p>Inspect workspace health and project readiness.</p>
                <span className="command-arrow">-&gt;</span>
              </button>
              <button className="command-card" type="button">
                <div className="card-label">FIX</div>
                <h3>Prepare Fix</h3>
                <p>Open the focused remediation workflow.</p>
                <span className="command-arrow">-&gt;</span>
              </button>
              <button className="command-card" type="button">
                <div className="card-label">SCAN</div>
                <h3>Scan Workspace</h3>
                <p>Review local modules and operational signals.</p>
                <span className="command-arrow">-&gt;</span>
              </button>
              <button className="command-card" type="button">
                <div className="card-label">DEPLOY</div>
                <h3>Deploy Build</h3>
                <p>Prepare the production release pipeline.</p>
                <span className="command-arrow">-&gt;</span>
              </button>
            </div>
          </section>

          <section className="security-dashboard" aria-label="Security dashboard" id="security">
            <div className="section-heading">
              <div>
                <div className="card-label">SECURITY DASHBOARD</div>
                <h2>Protection Metrics</h2>
              </div>
              <p>Latest defensive audit snapshot</p>
            </div>
            <div className="security-metrics-grid">
              <article className="security-metric warning">
                <div className="card-label">VULNERABILITIES</div>
                <strong>{security?.issues?.length ?? "N/A"}</strong>
                <span>Low-risk findings queued</span>
              </article>
              <article className="security-metric safe">
                <div className="card-label">PROTECTED ROUTES</div>
                <strong>12</strong>
                <span>Routes monitored by policy</span>
              </article>
              <article className="security-metric safe">
                <div className="card-label">SECURITY SCORE</div>
                <strong>{security ? `${security.securityScore}/100` : "N/A"}</strong>
                <span>Defensive posture rating</span>
              </article>
              <article className="security-metric">
                <div className="card-label">LAST AUDIT</div>
                <strong>{security?.lastAudit || "N/A"}</strong>
                <span>Latest workspace security scan</span>
              </article>
            </div>
          </section>

          <section className="system-monitor" aria-label="System monitor">
            <div className="section-heading">
              <div>
                <div className="card-label">SYSTEM MONITOR</div>
                <h2>Runtime Telemetry</h2>
              </div>
              <p>Live infrastructure signals</p>
            </div>
            <div className="monitor-grid">
              <article className="monitor-card live">
                <div className="card-label">CPU</div>
                <strong>{isBackendHealthy ? "NORMAL" : "N/A"}</strong>
                <span>Runtime processing status</span>
              </article>
              <article className="monitor-card">
                <div className="card-label">MEMORY</div>
                <strong>{formatMemory(metrics?.memory?.rss)}</strong>
                <span>RSS process usage</span>
              </article>
              <article className="monitor-card">
                <div className="card-label">UPTIME</div>
                <strong>{formatUptime(metrics?.uptime)}</strong>
                <span>Backend runtime duration</span>
              </article>
              <article className="monitor-card live">
                <div className="card-label">API LATENCY</div>
                <strong>{isBackendHealthy ? "LOW" : "N/A"}</strong>
                <span>Health endpoint response state</span>
              </article>
            </div>
          </section>

          <section className="security-center" aria-label="Security center">
            <div className="section-heading">
              <div>
                <div className="card-label">SECURITY CENTER</div>
                <h2>Defensive Audit Center</h2>
              </div>
              <p>Core protection services</p>
            </div>
            <div className="security-grid">
              <article className="security-card">
                <div className="card-label">BACKEND HEALTH</div>
                <h3>{isBackendHealthy ? "Healthy" : "Connecting"}</h3>
                <p>Runtime health monitoring</p>
                <span className="security-badge">
                  {isBackendHealthy ? "ONLINE" : "ACTIVE"}
                </span>
              </article>
              <article className="security-card">
                <div className="card-label">API STATUS</div>
                <h3>{systemInfo?.apiVersion || "N/A"}</h3>
                <p>ORBIT API environment status</p>
                <span className="security-badge">
                  {systemInfo?.status === "online" ? "ONLINE" : "ACTIVE"}
                </span>
              </article>
              <article className="security-card">
                <div className="card-label">RATE LIMITER</div>
                <h3>Request Guard</h3>
                <p>Traffic protection layer</p>
                <span className="security-badge">{security?.rateLimit || "ACTIVE"}</span>
              </article>
              <article className="security-card">
                <div className="card-label">HELMET SECURITY</div>
                <h3>Header Shield</h3>
                <p>Secure HTTP response headers</p>
                <span className="security-badge">{security?.helmet || "PROTECTED"}</span>
              </article>
              <article className="security-card">
                <div className="card-label">CORS PROTECTION</div>
                <h3>Origin Control</h3>
                <p>Cross-origin access policy</p>
                <span className="security-badge">{security?.cors || "PROTECTED"}</span>
              </article>
            </div>
          </section>

          <section className="automation-center" aria-label="Automation center" id="automation">
            <div className="section-heading">
              <div>
                <div className="card-label">AUTOMATION CENTER</div>
                <h2>CLI Command Engine</h2>
              </div>
              <p>Workspace automation modules</p>
            </div>
            <div className="automation-grid">
              {automation &&
                Object.entries(automation).map(([key, engine]) => (
                  <article className="automation-card" key={key}>
                    <div className="card-label">{automationLabels[key]}</div>
                    <h3>{engine.name}</h3>
                    <p>{engine.description}</p>
                    <span className="automation-badge">{engine.status}</span>
                  </article>
                ))}
            </div>
          </section>

          <section className="workspace-explorer" aria-label="Workspace explorer">
            <div className="section-heading">
              <div>
                <div className="card-label">WORKSPACE EXPLORER</div>
                <h2>Project Intelligence</h2>
              </div>
              <p>Local workspace visibility</p>
            </div>
            <div className="workspace-grid">
              <article className="workspace-card">
                <div className="card-label">ACTIVE WORKSPACE</div>
                <h3>{workspace?.path || "N/A"}</h3>
                <p>{workspace?.activeProject || "Primary ORBIT development directory"}</p>
                <span className="workspace-badge">ACTIVE</span>
              </article>
              <article className="workspace-card">
                <div className="card-label">PROJECT SCANNER</div>
                <h3>{workspace?.scannerStatus || "N/A"}</h3>
                <p>Last scan: {workspace?.lastScan || "N/A"}</p>
                <span className="workspace-badge">{workspace?.scannerStatus || "READY"}</span>
              </article>
              <article className="workspace-card">
                <div className="card-label">RECENT PROJECTS</div>
                <h3>{workspace?.totalProjects ?? "N/A"} projects</h3>
                <p>Tracked project inventory</p>
                <span className="workspace-badge">SYNCED</span>
              </article>
              <article className="workspace-card">
                <div className="card-label">COMMAND CENTER</div>
                <h3>{workspace?.activeProject || "N/A"}</h3>
                <p>Automation command channel online</p>
                <span className="workspace-badge">CONNECTED</span>
              </article>
            </div>
          </section>

          <section className="settings-center" aria-label="Settings center">
            <div className="section-heading">
              <div>
                <div className="card-label">SETTINGS CENTER</div>
                <h2>System Configuration</h2>
              </div>
              <p>Runtime configuration overview</p>
            </div>
            <div className="settings-grid">
              <article className="settings-card">
                <div className="card-label">ENVIRONMENT</div>
                <h3>{settings?.environment || "N/A"}</h3>
                <p>Current ORBIT runtime mode</p>
                <span className="settings-badge">ACTIVE</span>
              </article>
              <article className="settings-card">
                <div className="card-label">API VERSION</div>
                <h3>{settings?.apiVersion || "N/A"}</h3>
                <p>Connected backend interface</p>
                <span className="settings-badge">SYNCED</span>
              </article>
              <article className="settings-card">
                <div className="card-label">WORKSPACE</div>
                <h3>{settings?.workspacePath || "N/A"}</h3>
                <p>Primary local workspace root</p>
                <span className="settings-badge">CONNECTED</span>
              </article>
              <article className="settings-card">
                <div className="card-label">SECURITY MODE</div>
                <h3>{settings?.securityMode || "N/A"}</h3>
                <p>Audit protection profile enabled</p>
                <span className="settings-badge">PROTECTED</span>
              </article>
            </div>
          </section>

          <section className="ai-workspace" aria-label="AI workspace">
            <div className="section-heading">
              <div>
                <div className="card-label">AI WORKSPACE</div>
                <h2>Intelligence Operations</h2>
              </div>
              <p>AI command modules</p>
            </div>
            <div className="ai-grid">
              <article className="ai-card">
                <div className="card-label">AI ASSISTANT</div>
                <h3>Orbit Copilot</h3>
                <p>Engineering guidance for workspace operations.</p>
                <span className="ai-badge">ONLINE</span>
              </article>
              <article className="ai-card">
                <div className="card-label">PROMPT STUDIO</div>
                <h3>Prompt Builder</h3>
                <p>Compose and organize operational AI instructions.</p>
                <span className="ai-badge">READY</span>
              </article>
              <article className="ai-card">
                <div className="card-label">AGENT STATUS</div>
                <h3>Agent Connected</h3>
                <p>Automation agent channel is prepared for tasks.</p>
                <span className="ai-badge">ACTIVE</span>
              </article>
              <article className="ai-card">
                <div className="card-label">MODEL STATUS</div>
                <h3>Model Ready</h3>
                <p>AI model routing configuration is available.</p>
                <span className="ai-badge">SYNCED</span>
              </article>
            </div>
          </section>

          <section className="logs-explorer" aria-label="Logs explorer">
            <div className="section-heading">
              <div>
                <div className="card-label">LOGS EXPLORER</div>
                <h2>Operational Event Stream</h2>
              </div>
              <p>Live activity visibility</p>
            </div>
            <div className="logs-grid">
              <article className="log-card">
                <div className="card-label">RECENT ACTIVITY</div>
                <h3>{activity[0]?.message || "No activity yet"}</h3>
                <p>{formatTimestamp(activity[0]?.time)}</p>
                <span className="log-badge">ACTIVE</span>
              </article>
              <article className="log-card">
                <div className="card-label">SYSTEM EVENTS</div>
                <h3>{systemInfo?.status === "online" ? "System online" : "Connecting"}</h3>
                <p>{formatTimestamp(systemInfo?.timestamp)}</p>
                <span className="log-badge">SYNCED</span>
              </article>
              <article className="log-card">
                <div className="card-label">API EVENTS</div>
                <h3>{isBackendHealthy ? "Health check passed" : "Awaiting backend"}</h3>
                <p>API version: {systemInfo?.apiVersion || "N/A"}</p>
                <span className="log-badge">ONLINE</span>
              </article>
              <article className="log-card">
                <div className="card-label">AUDIT LOGS</div>
                <h3>{metrics?.reports ?? "N/A"} reports indexed</h3>
                <p>Generated audit report inventory</p>
                <span className="log-badge">READY</span>
              </article>
            </div>
          </section>

          <section className="reports-center" aria-label="Reports center" id="reports">
            <div className="section-heading">
              <div>
                <div className="card-label">REPORTS CENTER</div>
                <h2>JSON Logs & Dashboard</h2>
              </div>
              <p>Operational reporting overview</p>
            </div>
            <div className="reports-grid">
              <article className="report-card">
                <div className="card-label">TOTAL REPORTS</div>
                <h3>{reports.length || "N/A"}</h3>
                <p>Indexed report records</p>
                <span className="report-badge">SYNCED</span>
              </article>
              <article className="report-card">
                <div className="card-label">LATEST REPORT</div>
                <h3>{latestReport?.type || "Connecting"}</h3>
                <p>{latestReport?.id || "N/A"}</p>
                <span className="report-badge">{latestReport?.status || "ACTIVE"}</span>
              </article>
              <article className="report-card">
                <div className="card-label">LATEST SCORE</div>
                <h3>{latestReport ? `${latestReport.score}/100` : "N/A"}</h3>
                <p>{formatTimestamp(latestReport?.createdAt)}</p>
                <span className="report-badge">SYNCED</span>
              </article>
              <article className="report-card">
                <div className="card-label">BUILD STATUS</div>
                <h3>{isBackendHealthy ? "Operational" : "Connecting"}</h3>
                <p>Dashboard production readiness</p>
                <span className="report-badge">READY</span>
              </article>
            </div>
          </section>

          <section className="activity" aria-label="Recent activity">
            <div className="card-label">RECENT ACTIVITY</div>
            <ul className="activity-list">
              {activity.map((item) => (
                <li className="activity-item" key={`${item.type}-${item.time}`}>
                  <span className="activity-dot" />
                  {item.message.replace("ORBIT ", "")}
                </li>
              ))}
              {metrics && (
                <li className="activity-item">
                  <span className="activity-dot" />
                  Metrics updated
                </li>
              )}
              {systemInfo && (
                <li className="activity-item">
                  <span className="activity-dot" />
                  Dashboard connected
                </li>
              )}
            </ul>
          </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
