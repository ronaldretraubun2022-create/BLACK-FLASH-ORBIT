import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Layers3,
  Play,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  TimerReset,
  Workflow,
} from "lucide-react";
import { api } from "../services/api";

const workflowTemplates = [
  {
    action: "Publish release manifest",
    description: "Validasi manifest, build status, dan export package sebelum publish.",
    id: "security-sweep",
    name: "Release Gate",
    trigger: "On build PASS",
  },
  {
    action: "Refresh telemetry snapshot",
    description: "Tarik status automation, health, dan history untuk dashboard.",
    id: "telemetry-sync",
    name: "Telemetry Sync",
    trigger: "Every 15 minutes",
  },
  {
    action: "Run security checklist",
    description: "Mock audit terhadap env, route, dan readiness checklist.",
    id: "security-sweep",
    name: "Security Sweep",
    trigger: "Manual /security",
  },
];

const pipelineSteps = [
  { name: "Trigger", status: "Ready", detail: "Event listener menunggu pemicu." },
  { name: "Validate", status: "Healthy", detail: "Rules dan prerequisites diverifikasi." },
  { name: "Execute", status: "Idle", detail: "Run engine aman, mock output only." },
  { name: "Report", status: "Synced", detail: "History dan ringkasan hasil disimpan." },
];

const schedulerOptions = [
  { label: "Manual", value: "Manual" },
  { label: "Every 15m", value: "Every 15m" },
  { label: "Hourly", value: "Hourly" },
  { label: "Daily", value: "Daily" },
];

const fallbackHistory = [
  {
    detail: "Workflow readiness snapshot cached from dashboard telemetry.",
    result: "Ready",
    time: "Live",
    title: "Telemetry Sync",
  },
  {
    detail: "Security checklist validated against current dashboard state.",
    result: "Passed",
    time: "Ready",
    title: "Security Sweep",
  },
];

const fallbackTriggers = [
  { label: "Build PASS", detail: "Start release gate", icon: Rocket },
  { label: "Security Alert", detail: "Run audit checklist", icon: ShieldCheck },
  { label: "Timer Tick", detail: "Refresh telemetry snapshot", icon: TimerReset },
];

const fallbackActions = [
  { label: "Publish package", detail: "Export and release artifact", icon: Play },
  { label: "Refresh data", detail: "Reload automation state", icon: RefreshCcw },
  { label: "Sync report", detail: "Store execution summary", icon: Layers3 },
];

export function WorkflowAutomation() {
  const [automation, setAutomation] = useState({});
  const [automationStatus, setAutomationStatus] = useState(null);
  const [automationJobs, setAutomationJobs] = useState([]);
  const [automationHistory, setAutomationHistory] = useState(fallbackHistory);
  const [workflowDefinitions, setWorkflowDefinitions] = useState(workflowTemplates);
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(workflowTemplates[0]);
  const [selectedScheduler, setSelectedScheduler] = useState("Hourly");
  const [mockRunOutput, setMockRunOutput] = useState(
    "Safe workflow run output will appear here.",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("-");

  const automationEntries = useMemo(() => Object.entries(automation), [automation]);
  const selectedRun = useMemo(
    () => workflowRuns.find((run) => run.workflowId === selectedTemplate.id),
    [selectedTemplate.id, workflowRuns],
  );
  const nextRunLabel = useMemo(() => {
    if (selectedScheduler === "Manual") return "Manual trigger only";
    if (selectedScheduler === "Every 15m") return "Next run in 15m";
    if (selectedScheduler === "Hourly") return "Next run in 1h";
    return "Next run tomorrow";
  }, [selectedScheduler]);

  async function loadWorkflowData() {
    setIsLoading(true);
    setError("");

    try {
      const [
        automationResult,
        statusResult,
        jobsResult,
        historyResult,
        definitionsResult,
        runsResult,
      ] =
        await Promise.allSettled([
          api.getAutomation(),
          api.getAutomationStatus(),
          api.getAutomationJobs(),
          api.getAutomationHistory(),
          api.getAutomationDefinitions(),
          api.getAutomationRuns(),
        ]);

      if (automationResult.status === "fulfilled") {
        setAutomation(automationResult.value || {});
      }

      if (statusResult.status === "fulfilled") {
        setAutomationStatus(statusResult.value?.data || statusResult.value || null);
      }

      if (jobsResult.status === "fulfilled") {
        setAutomationJobs(Array.isArray(jobsResult.value?.data) ? jobsResult.value.data : []);
      }

      if (historyResult.status === "fulfilled") {
        const records = Array.isArray(historyResult.value?.data)
          ? historyResult.value.data
          : [];
        setAutomationHistory(
          records.length
            ? records.map((item, index) => ({
                detail: item?.detail || item?.message || "Automation history event.",
                result: item?.result || item?.status || "Recorded",
                time: item?.time || item?.createdAt || `Event ${index + 1}`,
                title: item?.title || item?.name || "Automation Event",
              }))
            : fallbackHistory,
        );
      }

      if (definitionsResult.status === "fulfilled") {
        const definitions = Array.isArray(definitionsResult.value?.data)
          ? definitionsResult.value.data
          : [];
        const mappedDefinitions = definitions.map((definition) => ({
          action: definition.requiresApproval ? "Requires approval" : "Safe execution",
          description: definition.description,
          id: definition.id,
          name: definition.name,
          trigger: "Manual",
        }));

        if (mappedDefinitions.length) {
          setWorkflowDefinitions(mappedDefinitions);
          setSelectedTemplate((current) =>
            mappedDefinitions.find((item) => item.id === current.id) ||
            mappedDefinitions[0],
          );
        }
      }

      if (runsResult.status === "fulfilled") {
        setWorkflowRuns(Array.isArray(runsResult.value?.data) ? runsResult.value.data : []);
      }

      setLastSync(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setAutomation({});
      setAutomationStatus(null);
      setAutomationJobs([]);
      setAutomationHistory(fallbackHistory);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkflowData();
  }, []);

  async function handleRunTemplate(template) {
    setIsRunning(true);
    setError("");

    try {
      const result = await api.createAutomationRun({
        input: template.id === "ai-operations-brief" ? { topic: template.name } : {},
        workflowId: template.id,
      });
      const run = result?.data;
      const timestamp = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setSelectedTemplate(template);
      setMockRunOutput(
        `[${timestamp}] Run ${run?.state || "created"} for ${template.name}. ${run?.completedSteps || 0}/${run?.totalSteps || 0} steps completed.`,
      );
      setWorkflowRuns((current) => [run, ...current.filter((item) => item?.id !== run?.id)].filter(Boolean));
      setAutomationHistory((current) => [
        {
          detail: template.description,
          result: run?.state || "Created",
          time: timestamp,
          title: template.name,
        },
        ...current,
      ]);
      await loadWorkflowData();
    } catch (runError) {
      setError(getErrorMessage(runError));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApproveRun(run) {
    if (!run?.id) return;
    setIsRunning(true);
    setError("");

    try {
      const result = await api.approveAutomationRun(run.id);
      setMockRunOutput(`Run ${result?.data?.state || "approved"} after human approval.`);
      await loadWorkflowData();
    } catch (approvalError) {
      setError(getErrorMessage(approvalError));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCancelRun(run) {
    if (!run?.id) return;
    setIsRunning(true);
    setError("");

    try {
      const result = await api.cancelAutomationRun(run.id);
      setMockRunOutput(`Run ${result?.data?.state || "cancelled"}.`);
      await loadWorkflowData();
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsRunning(false);
    }
  }

  const automationScore = automationStatus?.automationScore || automationStatus?.score || 0;

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
              WORKFLOW AUTOMATION
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Workflow Automation v1.0
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
              Dashboard automation visual untuk template workflow, trigger/action,
              pipeline step, scheduler, execution history, dan safe run output.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              onClick={loadWorkflowData}
              type="button">
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning}
              onClick={() => handleRunTemplate(selectedTemplate)}
              type="button">
              <Play size={16} />
              {isRunning ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1">
            {lastSync === "-" ? "Live sync pending" : `Last sync ${lastSync}`}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            {automationEntries.length} automation nodes
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
            Score {automationScore || "n/a"}
          </span>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm font-bold text-rose-200">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Templates" value={workflowDefinitions.length} icon={Workflow} />
        <MetricCard label="Triggers" value={fallbackTriggers.length} icon={TimerReset} />
        <MetricCard label="Actions" value={fallbackActions.length} icon={Play} />
        <MetricCard label="Jobs" value={automationJobs.length || automationHistory.length} icon={Layers3} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(280px,0.88fr)_minmax(0,1fr)_minmax(320px,0.92fr)]">
        <aside className="grid gap-4">
          <Panel title="Workflow Templates" kicker="Templates Library" icon={Workflow}>
            <div className="grid gap-3">
              {workflowDefinitions.map((template) => {
                const isActive = template.name === selectedTemplate.name;

                return (
                  <button
                    key={template.name}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                    type="button">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{template.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                          {template.trigger}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {isActive ? "Selected" : "Use"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {template.description}
                    </p>
                    <p className="mt-3 text-xs font-bold text-slate-300">
                      Action: {template.action}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Trigger / Action" kicker="Automation Control" icon={Rocket}>
            <div className="grid gap-3">
              <CardList title="Triggers" items={fallbackTriggers} />
              <CardList title="Actions" items={fallbackActions} />
            </div>
          </Panel>
        </aside>

        <section className="grid gap-4">
          <Panel title="Pipeline Steps" kicker="Execution Pipeline" icon={Layers3}>
            <div className="grid gap-3 md:grid-cols-2">
              {pipelineSteps.map((step, index) => (
                <div
                  key={step.name}
                  className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{step.name}</p>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                      Step {index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
                    {step.status}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Run Output" kicker="Safe Execution Result" icon={CheckCircle2}>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                {selectedTemplate.name}
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-white">
                {mockRunOutput}
              </p>
            </div>

            {selectedRun?.state === "waiting_approval" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/15 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRunning}
                  onClick={() => handleApproveRun(selectedRun)}
                  type="button">
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100 hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRunning}
                  onClick={() => handleCancelRun(selectedRun)}
                  type="button">
                  Cancel
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Trigger
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {selectedTemplate.trigger}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Action
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {selectedTemplate.action}
                </p>
              </div>
            </div>
          </Panel>
        </section>

        <aside className="grid gap-4">
          <Panel title="Scheduler Panel" kicker="Run Cadence" icon={Clock3}>
            <div className="grid gap-2">
              {schedulerOptions.map((item) => {
                const isActive = item.value === selectedScheduler;

                return (
                  <button
                    key={item.value}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-black/15 hover:border-cyan-300/20"
                    }`}
                    onClick={() => setSelectedScheduler(item.value)}
                    type="button">
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {isActive ? "Active" : "Set"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                Next Run
              </p>
              <p className="mt-2 text-sm font-bold text-white">{nextRunLabel}</p>
            </div>
          </Panel>

          <Panel title="Execution History" kicker="Pipeline Log" icon={TimerReset}>
            <div className="grid gap-3">
              {(automationHistory.length ? automationHistory : fallbackHistory).map((item) => (
                <div
                  key={`${item.title}-${item.time}`}
                  className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                      {item.result}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {item.time}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="text-cyan-300" size={18} />
      <p className="mt-4 text-[10px] font-black tracking-[0.18em] text-slate-500">
        {label.toUpperCase()}
      </p>
      <h3 className="mt-2 text-lg font-black text-white">{value}</h3>
    </article>
  );
}

function Panel({ title, kicker, icon: Icon, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
            {kicker}
          </p>
          <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300">
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CardList({ title, items }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const Icon = item.icon || Workflow;

          return (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memuat workflow automation.";
  }
}
