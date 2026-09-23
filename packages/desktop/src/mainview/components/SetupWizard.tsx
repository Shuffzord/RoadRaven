import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import type { McpHost, McpInstallStep } from "../../../../../shared/types";
import { electroview } from "../rpc";
import { useSetupStore } from "../store/setupStore";

interface SetupStatus {
	firstRun: boolean;
	claudeDetected: boolean;
	mcpServerAvailable: boolean;
	mcpInstalled: boolean;
	appVersion: string;
	openCodeDetected: boolean;
	openCodeInstalled: boolean;
	pluginInstalled: boolean;
}

const HOST_LABEL: Record<McpHost, string> = {
	claude: "Claude Code",
	opencode: "OpenCode",
};

interface InstallResult {
	ok: boolean;
	steps: McpInstallStep[];
	serverPath?: string;
	configPath?: string;
}

const TOTAL_STEPS = 3;

const STEP_SYMBOL: Record<McpInstallStep["status"], string> = {
	ok: "✓",
	error: "✕",
	skipped: "–",
};
const STEP_COLOR: Record<McpInstallStep["status"], string> = {
	ok: "var(--rv-accent)",
	error: "var(--rv-status-blocked)",
	skipped: "var(--rv-text-tertiary)",
};

/** Hosts to default-select when the setup status first arrives, per host detection state. */
function computeDefaultHosts(status: SetupStatus): Set<McpHost> {
	const defaults = new Set<McpHost>();
	if (status.claudeDetected && !status.pluginInstalled) defaults.add("claude");
	if (status.openCodeDetected) defaults.add("opencode");
	return defaults;
}

/**
 * SetupWizard — first-run onboarding (v0.6). Walks the user through RoadRaven
 * setup and can install the Claude Code MCP integration (register the
 * `roadraven` server) without hand-editing ~/.claude.json. Auto-opens on first
 * launch; re-openable from the TopBar. Closing at any point marks setup done.
 */
export function SetupWizard() {
	const open = useSetupStore((s) => s.open);
	const openWizard = useSetupStore((s) => s.openWizard);
	const closeWizard = useSetupStore((s) => s.closeWizard);

	const [step, setStep] = useState(0);
	const [status, setStatus] = useState<SetupStatus | null>(null);
	const [installing, setInstalling] = useState(false);
	const [result, setResult] = useState<InstallResult | null>(null);
	const [selectedHosts, setSelectedHosts] = useState<Set<McpHost>>(new Set());
	const autoChecked = useRef(false);
	const hostsInitialized = useRef(false);

	// Pull setup status on mount; auto-open the wizard on first run.
	useEffect(() => {
		if (autoChecked.current) return;
		autoChecked.current = true;
		electroview?.rpc?.request
			.getSetupStatus({})
			.then((s) => {
				setStatus(s);
				if (s.firstRun) openWizard();
			})
			.catch(() => {
				// Bun may still be starting; wizard stays available via TopBar.
			});
	}, [openWizard]);

	// Seed the host checkboxes once status first arrives: every detected host
	// defaults on, except Claude Code when the plugin already covers it.
	useEffect(() => {
		if (!status || hostsInitialized.current) return;
		hostsInitialized.current = true;
		setSelectedHosts(computeDefaultHosts(status));
	}, [status]);

	const toggleHost = useCallback((host: McpHost) => {
		setSelectedHosts((prev) => {
			const next = new Set(prev);
			if (next.has(host)) next.delete(host);
			else next.add(host);
			return next;
		});
	}, []);

	const finish = useCallback(() => {
		electroview?.rpc?.request.completeSetup({}).catch(() => {
			// Best-effort: if persisting the flag fails the wizard re-opens next
			// launch, which is a harmless fallback.
		});
		closeWizard();
		setStep(0);
	}, [closeWizard]);

	const runInstall = useCallback(async () => {
		setInstalling(true);
		setResult(null);
		try {
			const res = await electroview?.rpc?.request.installMcpIntegration({
				hosts: Array.from(selectedHosts),
			});
			if (res) setResult(res);
			const s = await electroview?.rpc?.request.getSetupStatus({});
			if (s) setStatus(s);
		} catch (e) {
			setResult({
				ok: false,
				steps: [
					{
						id: "rpc",
						label: "Install MCP integration",
						status: "error",
						detail: String(e),
					},
				],
			});
		} finally {
			setInstalling(false);
		}
	}, [selectedHosts]);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) finish();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				<Dialog.Content aria-modal="true" style={contentStyle}>
					<StepDots current={step} />
					<StepBody
						step={step}
						status={status}
						installing={installing}
						result={result}
						selectedHosts={selectedHosts}
						onToggleHost={toggleHost}
						onInstall={runInstall}
					/>
					<Footer
						step={step}
						installing={installing}
						onBack={() => setStep((s) => Math.max(0, s - 1))}
						onNext={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
						onSkip={finish}
						onFinish={finish}
					/>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/* ---- Step dispatch ---- */

function StepBody({
	step,
	status,
	installing,
	result,
	selectedHosts,
	onToggleHost,
	onInstall,
}: {
	step: number;
	status: SetupStatus | null;
	installing: boolean;
	result: InstallResult | null;
	selectedHosts: Set<McpHost>;
	onToggleHost: (host: McpHost) => void;
	onInstall: () => void;
}) {
	if (step === 0) return <WelcomeStep status={status} />;
	if (step === 1) {
		return (
			<McpStep
				status={status}
				installing={installing}
				result={result}
				selectedHosts={selectedHosts}
				onToggleHost={onToggleHost}
				onInstall={onInstall}
			/>
		);
	}
	return <DoneStep status={status} />;
}

function WelcomeStep({ status }: { status: SetupStatus | null }) {
	const version = status?.appVersion;
	return (
		<>
			<Title>Welcome to RoadRaven{version ? ` ${version}` : ""}</Title>
			<Body>
				Your plan, watching itself. This quick setup gets you ready to author
				and live-monitor roadmap trees. The next step can connect RoadRaven to
				Claude Code so an AI agent can edit your roadmap and push live status.
			</Body>
		</>
	);
}

function McpStep({
	status,
	installing,
	result,
	selectedHosts,
	onToggleHost,
	onInstall,
}: {
	status: SetupStatus | null;
	installing: boolean;
	result: InstallResult | null;
	selectedHosts: Set<McpHost>;
	onToggleHost: (host: McpHost) => void;
	onInstall: () => void;
}) {
	if (!status) return <Body>Checking setup…</Body>;
	return (
		<>
			<Title>MCP integration</Title>
			<Body>
				Register the <code style={codeStyle}>roadraven</code> MCP server with
				your detected agent hosts so they can create, edit, and push live status
				to your roadmap. Close the host app before installing (it writes this
				config too), then restart it afterwards. RoadRaven must be running for
				the tools to work.
			</Body>
			<HostList
				status={status}
				selectedHosts={selectedHosts}
				onToggleHost={onToggleHost}
			/>
			<InstallLog result={result} />
			<InstallButton
				installing={installing}
				serverAvailable={status.mcpServerAvailable}
				hasSelection={selectedHosts.size > 0}
				alreadyInstalled={status.mcpInstalled || status.openCodeInstalled}
				onInstall={onInstall}
			/>
		</>
	);
}

function DoneStep({ status }: { status: SetupStatus | null }) {
	const installed = status?.mcpInstalled === true;
	return (
		<>
			<Title>You're all set</Title>
			<Body>
				{installed
					? "The roadraven MCP server is registered. Restart Claude Code, keep RoadRaven running, and open a roadmap — Claude can now edit it and push live status."
					: "Setup is complete. You can install the Claude Code MCP integration any time from the settings button in the top bar."}
			</Body>
		</>
	);
}

/* ---- MCP step pieces ---- */

const ALL_HOSTS = ["claude", "opencode"] as const;

/** Whether a host's row should appear at all — detected, or (Claude) covered by the plugin. */
function isHostRowVisible(host: McpHost, status: SetupStatus): boolean {
	if (host === "claude") return status.pluginInstalled || status.claudeDetected;
	return status.openCodeDetected;
}

function HostList({
	status,
	selectedHosts,
	onToggleHost,
}: {
	status: SetupStatus;
	selectedHosts: Set<McpHost>;
	onToggleHost: (host: McpHost) => void;
}) {
	const visibleHosts = ALL_HOSTS.filter((host) =>
		isHostRowVisible(host, status),
	);
	return (
		<div style={detectedListStyle}>
			{visibleHosts.length === 0 ? (
				<Detected
					key="none"
					ok={false}
					label=""
					fallback="No Claude Code or OpenCode installation detected"
				/>
			) : (
				visibleHosts.map((host) => (
					<HostRow
						key={host}
						host={host}
						status={status}
						selectedHosts={selectedHosts}
						onToggleHost={onToggleHost}
					/>
				))
			)}
			<Detected
				ok={status.mcpServerAvailable}
				label="MCP server bundle available"
				fallback="Bundle missing — build the plugin first"
			/>
			{(status.mcpInstalled || status.openCodeInstalled) && (
				<Detected
					ok
					label="Already registered — reinstall to refresh"
					fallback=""
				/>
			)}
		</div>
	);
}

/** A single host's row: the plugin-installed notice (Claude only) or its selection checkbox. */
function HostRow({
	host,
	status,
	selectedHosts,
	onToggleHost,
}: {
	host: McpHost;
	status: SetupStatus;
	selectedHosts: Set<McpHost>;
	onToggleHost: (host: McpHost) => void;
}) {
	if (host === "claude" && status.pluginInstalled) {
		return (
			<Detected
				ok
				label="Claude Code — already installed via the RoadRaven plugin"
				fallback=""
			/>
		);
	}
	return (
		<HostCheckbox
			host={host}
			checked={selectedHosts.has(host)}
			onToggle={onToggleHost}
		/>
	);
}

function HostCheckbox({
	host,
	checked,
	onToggle,
}: {
	host: McpHost;
	checked: boolean;
	onToggle: (host: McpHost) => void;
}) {
	return (
		<label
			style={{
				fontSize: 12,
				color: "var(--rv-text-secondary)",
				display: "flex",
				alignItems: "center",
				gap: 8,
				cursor: "pointer",
			}}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={() => onToggle(host)}
			/>
			{HOST_LABEL[host]}
		</label>
	);
}

function InstallLog({ result }: { result: InstallResult | null }) {
	if (!result) return null;
	const shared = result.steps.filter((s) => !s.host);
	const byHost = groupStepsByHost(result.steps);
	return (
		<div style={logStyle}>
			{shared.map((s) => (
				<StepLine key={s.id} step={s} />
			))}
			{byHost.map(([host, steps]) => (
				<div key={host}>
					<div style={hostGroupLabelStyle}>{HOST_LABEL[host]}</div>
					{steps.map((s) => (
						<StepLine key={s.id} step={s} />
					))}
				</div>
			))}
		</div>
	);
}

function groupStepsByHost(
	steps: McpInstallStep[],
): Array<[McpHost, McpInstallStep[]]> {
	const byHost = new Map<McpHost, McpInstallStep[]>();
	for (const s of steps) {
		if (!s.host) continue;
		const list = byHost.get(s.host) ?? [];
		list.push(s);
		byHost.set(s.host, list);
	}
	return Array.from(byHost.entries());
}

function installLabel(installing: boolean, alreadyInstalled: boolean): string {
	if (installing) return "Installing…";
	return alreadyInstalled ? "Reinstall integration" : "Install integration";
}

function InstallButton({
	installing,
	serverAvailable,
	hasSelection,
	alreadyInstalled,
	onInstall,
}: {
	installing: boolean;
	serverAvailable: boolean;
	hasSelection: boolean;
	alreadyInstalled: boolean;
	onInstall: () => void;
}) {
	const disabled = installing || !serverAvailable || !hasSelection;
	const tone = disabled
		? { opacity: 0.5, cursor: "not-allowed" as const }
		: { opacity: 1, cursor: "pointer" as const };
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onInstall}
			style={{ ...primaryButton, ...tone }}
		>
			{installLabel(installing, alreadyInstalled)}
		</button>
	);
}

/* ---- Footer ---- */

function Footer({
	step,
	installing,
	onBack,
	onNext,
	onSkip,
	onFinish,
}: {
	step: number;
	installing: boolean;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
	onFinish: () => void;
}) {
	const isLast = step === TOTAL_STEPS - 1;
	return (
		<div style={footerStyle}>
			<button type="button" onClick={onSkip} style={ghostButton}>
				{isLast ? "" : "Skip setup"}
			</button>
			<div style={{ display: "flex", gap: 8 }}>
				{step > 0 && (
					<button
						type="button"
						onClick={onBack}
						disabled={installing}
						style={secondaryButton}
					>
						Back
					</button>
				)}
				<PrimaryAction
					isLast={isLast}
					step={step}
					installing={installing}
					onNext={onNext}
					onFinish={onFinish}
				/>
			</div>
		</div>
	);
}

function PrimaryAction({
	isLast,
	step,
	installing,
	onNext,
	onFinish,
}: {
	isLast: boolean;
	step: number;
	installing: boolean;
	onNext: () => void;
	onFinish: () => void;
}) {
	if (isLast) {
		return (
			<button type="button" onClick={onFinish} style={primaryButton}>
				Finish
			</button>
		);
	}
	return (
		<button
			type="button"
			onClick={onNext}
			disabled={installing}
			style={primaryButton}
		>
			{step === 0 ? "Get started" : "Continue"}
		</button>
	);
}

/* ---- Small building blocks ---- */

function StepDots({ current }: { current: number }) {
	return (
		<div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
			{Array.from({ length: TOTAL_STEPS }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static list
					key={i}
					style={{
						height: 4,
						flex: 1,
						borderRadius: 2,
						background:
							i <= current ? "var(--rv-accent)" : "var(--rv-bg-hover)",
					}}
				/>
			))}
		</div>
	);
}

function StepLine({ step }: { step: McpInstallStep }) {
	return (
		<div style={{ fontSize: 12, color: "var(--rv-text-secondary)" }}>
			<span
				style={{
					color: STEP_COLOR[step.status],
					fontWeight: 700,
					marginRight: 8,
				}}
			>
				{STEP_SYMBOL[step.status]}
			</span>
			{step.label}
			{step.detail && <div style={stepDetailStyle}>{step.detail}</div>}
		</div>
	);
}

function Detected({
	ok,
	label,
	fallback,
}: {
	ok: boolean;
	label: string;
	fallback: string;
}) {
	return (
		<div style={{ fontSize: 12, color: "var(--rv-text-secondary)" }}>
			<span
				style={{
					color: ok ? "var(--rv-accent)" : "var(--rv-text-tertiary)",
					fontWeight: 700,
					marginRight: 8,
				}}
			>
				{ok ? "✓" : "○"}
			</span>
			{ok ? label : fallback}
		</div>
	);
}

function Title({ children }: { children: React.ReactNode }) {
	return (
		<Dialog.Title
			style={{ fontSize: 16, fontWeight: 600, color: "var(--rv-text-primary)" }}
		>
			{children}
		</Dialog.Title>
	);
}

function Body({ children }: { children: React.ReactNode }) {
	return (
		<Dialog.Description
			style={{
				fontSize: 13,
				color: "var(--rv-text-secondary)",
				lineHeight: 1.55,
				marginTop: 8,
			}}
		>
			{children}
		</Dialog.Description>
	);
}

/* ---- Styles ---- */

const contentStyle: React.CSSProperties = {
	position: "fixed",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	width: 520,
	maxWidth: "calc(100vw - 48px)",
	background: "var(--rv-bg-elevated)",
	border: "1px solid var(--rv-border)",
	borderRadius: 12,
	boxShadow: "var(--rv-shadow-config)",
	padding: 24,
	zIndex: 10000,
};

const footerStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginTop: 20,
};

const detectedListStyle: React.CSSProperties = {
	margin: "14px 0",
	display: "grid",
	gap: 6,
};

const logStyle: React.CSSProperties = {
	margin: "12px 0",
	padding: 12,
	borderRadius: 8,
	background: "var(--rv-bg-surface)",
	border: "1px solid var(--rv-border)",
	display: "grid",
	gap: 6,
};

const hostGroupLabelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	color: "var(--rv-text-tertiary)",
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	marginTop: 4,
};

const stepDetailStyle: React.CSSProperties = {
	fontSize: 11,
	color: "var(--rv-text-tertiary)",
	marginLeft: 20,
	marginTop: 2,
	wordBreak: "break-all",
};

const codeStyle: React.CSSProperties = {
	background: "var(--rv-bg-hover)",
	borderRadius: 4,
	padding: "1px 5px",
	fontSize: 12,
};

const primaryButton: React.CSSProperties = {
	background: "var(--rv-accent)",
	border: "1px solid var(--rv-accent)",
	borderRadius: 6,
	padding: "8px 16px",
	fontSize: 13,
	fontWeight: 600,
	color: "var(--rv-text-on-accent)",
};

const secondaryButton: React.CSSProperties = {
	background: "var(--rv-bg-hover)",
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	padding: "8px 16px",
	fontSize: 13,
	color: "var(--rv-text-primary)",
};

const ghostButton: React.CSSProperties = {
	background: "transparent",
	border: "none",
	fontSize: 12,
	color: "var(--rv-text-tertiary)",
	cursor: "pointer",
};
