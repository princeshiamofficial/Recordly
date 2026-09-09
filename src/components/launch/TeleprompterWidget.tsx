import {
	ArrowCounterClockwiseIcon,
	ArticleIcon,
	CheckIcon,
	CopyIcon,
	GearIcon,
	PauseIcon,
	PencilSimpleIcon,
	PlayIcon,
	PlusIcon,
	SparkleIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";
import { HudInteractionContext } from "./contexts/HudInteractionContext";
import styles from "./TeleprompterWidget.module.css";

const STORAGE_KEY_SCRIPTS = "recordly_teleprompter_scripts";
const STORAGE_KEY_ACTIVE_ID = "recordly_teleprompter_active_id";
const STORAGE_KEY_CONFIG = "recordly_teleprompter_config";
const LEGACY_STORAGE_KEY_TEXT = "recordly_teleprompter_text";

const DEFAULT_SAMPLE_SCRIPT =
	"Welcome to CamVerse!\n\nThis is your built-in teleprompter overlay.\n\n1. Type or paste your video script in Edit mode.\n2. Adjust font size, scroll speed, and opacity in Settings.\n3. Hit Play to auto-scroll while recording!\n\nYour teleprompter stays on screen for you, but is automatically hidden from your final screen recording!";

interface TeleprompterScript {
	id: string;
	name: string;
	text: string;
	createdAt: number;
}

interface TeleprompterConfig {
	fontSize: number;
	scrollSpeed: number;
	opacity: number;
	isMirrored: boolean;
	autoScrollOnRecord: boolean;
}

const DEFAULT_CONFIG: TeleprompterConfig = {
	fontSize: 22,
	scrollSpeed: 3,
	opacity: 85,
	isMirrored: false,
	autoScrollOnRecord: true,
};

interface TeleprompterWidgetProps {
	onClose: () => void;
	recordingActive?: boolean;
}

export function TeleprompterWidget({ onClose, recordingActive }: TeleprompterWidgetProps) {
	const t = useScopedT("launch");
	const hudContext = useContext(HudInteractionContext);

	// Migrate legacy single-script storage to multi-script
	const loadScripts = (): TeleprompterScript[] => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_SCRIPTS);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed) && parsed.length > 0) {
					return parsed;
				}
			}
		} catch {
			// Ignore parse errors
		}
		// Migrate from legacy single-script key
		const legacyText = localStorage.getItem(LEGACY_STORAGE_KEY_TEXT);
		const initial: TeleprompterScript[] = [
			{
				id: crypto.randomUUID(),
				name: "My Script",
				text: legacyText ?? DEFAULT_SAMPLE_SCRIPT,
				createdAt: Date.now(),
			},
		];
		try {
			localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(initial));
		} catch {
			// Ignore storage write errors
		}
		return initial;
	};

	const [scripts, setScripts] = useState<TeleprompterScript[]>(loadScripts);
	const [activeScriptId, setActiveScriptId] = useState<string>(() => {
		const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
		const loaded = loadScripts();
		if (savedId && loaded.some((s) => s.id === savedId)) {
			return savedId;
		}
		return loaded[0]?.id ?? "";
	});

	// Always guarantee activeScript resolves to a valid script
	const activeScript: TeleprompterScript =
		scripts.find((s) => s.id === activeScriptId) ??
		scripts[0] ?? {
			id: "default",
			name: "My Script",
			text: DEFAULT_SAMPLE_SCRIPT,
			createdAt: Date.now(),
		};

	const activeScriptIdResolved = activeScript.id;
	const scriptText = activeScript.text;
	const scriptName = activeScript.name;

	// Keep activeScriptId valid if the current ID is no longer in scripts
	useEffect(() => {
		if (scripts.length > 0 && !scripts.some((s) => s.id === activeScriptId)) {
			setActiveScriptId(scripts[0].id);
		}
	}, [scripts, activeScriptId]);

	const setScriptText = useCallback(
		(text: string | ((prev: string) => string)) => {
			const targetId = activeScriptIdResolved;
			setScripts((prev) => {
				const current = prev.find((s) => s.id === targetId);
				const currentText = current?.text ?? "";
				const resolved = typeof text === "function" ? text(currentText) : text;
				return prev.map((s) => (s.id === targetId ? { ...s, text: resolved } : s));
			});
		},
		[activeScriptIdResolved],
	);

	const setScriptName = useCallback(
		(name: string) => {
			const targetId = activeScriptIdResolved;
			setScripts((prev) =>
				prev.map((s) => (s.id === targetId ? { ...s, name } : s)),
			);
		},
		[activeScriptIdResolved],
	);

	// Persist scripts to localStorage
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(scripts));
		} catch {
			// Ignore storage write errors
		}
	}, [scripts]);

	// Persist active script ID
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeScriptId);
		} catch {
			// Ignore storage write errors
		}
	}, [activeScriptId]);

	const addNewScript = useCallback(() => {
		const newScript: TeleprompterScript = {
			id: crypto.randomUUID(),
			name: `Script ${scripts.length + 1}`,
			text: "",
			createdAt: Date.now(),
		};
		setScripts((prev) => [...prev, newScript]);
		setActiveScriptId(newScript.id);
		setMode("edit");
	}, [scripts.length]);

	const duplicateScript = useCallback(() => {
		const newScript: TeleprompterScript = {
			id: crypto.randomUUID(),
			name: `${scriptName} (copy)`,
			text: scriptText,
			createdAt: Date.now(),
		};
		setScripts((prev) => [...prev, newScript]);
		setActiveScriptId(newScript.id);
		setMode("edit");
	}, [scriptName, scriptText]);

	const deleteScript = useCallback(
		(id: string) => {
			if (scripts.length <= 1) return;
			const next = scripts.filter((s) => s.id !== id);
			setScripts(next);
			if (activeScriptId === id) {
				setActiveScriptId(next[0]?.id ?? "");
			}
		},
		[scripts, activeScriptId],
	);

	const [config, setConfig] = useState<TeleprompterConfig>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
			if (saved) {
				return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
			}
		} catch {
			// Ignore parse errors
		}
		return DEFAULT_CONFIG;
	});

	// UI States
	const [mode, setMode] = useState<"read" | "edit">("read");
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [showSettings, setShowSettings] = useState<boolean>(false);

	// Dragging State
	const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const isDraggingRef = useRef(false);
	const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const offsetRef = useRef(offset);
	offsetRef.current = offset;

	// Scroll References
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const animFrameRef = useRef<number | null>(null);

	// Save config to localStorage
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
	}, [config]);

	// Auto-scroll when recording starts if configured
	useEffect(() => {
		if (recordingActive && config.autoScrollOnRecord && mode === "read") {
			setIsPlaying(true);
		}
	}, [recordingActive, config.autoScrollOnRecord, mode]);

	// Continuous smooth scrolling loop
	useEffect(() => {
		if (!isPlaying || mode !== "read") {
			if (animFrameRef.current) {
				cancelAnimationFrame(animFrameRef.current);
				animFrameRef.current = null;
			}
			return;
		}

		let lastTime = performance.now();

		const scrollStep = (now: number) => {
			const delta = (now - lastTime) / 1000;
			lastTime = now;

			if (scrollAreaRef.current) {
				// Speed factor: 1 speed unit = ~20px per sec
				const scrollPx = config.scrollSpeed * 20 * delta;
				scrollAreaRef.current.scrollTop += scrollPx;

				// Pause if reached end
				const isAtBottom =
					scrollAreaRef.current.scrollHeight - scrollAreaRef.current.scrollTop <=
					scrollAreaRef.current.clientHeight + 2;

				if (isAtBottom) {
					setIsPlaying(false);
					return;
				}
			}

			animFrameRef.current = requestAnimationFrame(scrollStep);
		};

		animFrameRef.current = requestAnimationFrame(scrollStep);

		return () => {
			if (animFrameRef.current) {
				cancelAnimationFrame(animFrameRef.current);
				animFrameRef.current = null;
			}
		};
	}, [isPlaying, mode, config.scrollSpeed]);

	// Reset scroll to top and pause playback whenever active script changes
	useEffect(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = 0;
		}
		setIsPlaying(false);
	}, [activeScriptIdResolved]);

	// Handle Dragging
	const handlePointerDown = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("button, input, textarea, select")) return;
		isDraggingRef.current = true;
		dragStartRef.current = {
			x: e.clientX - offsetRef.current.x,
			y: e.clientY - offsetRef.current.y,
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDraggingRef.current) return;
		setOffset({
			x: e.clientX - dragStartRef.current.x,
			y: e.clientY - dragStartRef.current.y,
		});
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		try {
			(e.target as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// Handle pointer release safely
		}
	};

	const handleResetScroll = useCallback(() => {
		if (scrollAreaRef.current) {
			scrollAreaRef.current.scrollTop = 0;
		}
	}, []);

	const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;

	return (
		<div
			className={`${styles.teleprompterContainer} pointer-events-auto launch-theme`}
			data-hud-interactive
			style={{
				transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
				backgroundColor: `rgba(18, 18, 22, ${config.opacity / 100})`,
			}}
			onMouseEnter={hudContext?.onMouseEnter}
			onMouseLeave={hudContext?.onMouseLeave}
		>
			{/* Header Drag Handle & Controls */}
			<div
				className={styles.teleprompterHeader}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				<div className={styles.headerTitleGroup}>
					<RxDragHandleDots2 size={16} className="text-white/40 cursor-grab shrink-0" />
					<ArticleIcon size={18} className="text-rose-500 shrink-0" />
					<select
						value={activeScriptIdResolved}
						onChange={(e) => setActiveScriptId(e.target.value)}
						className="bg-transparent text-white/90 text-[13px] font-semibold border-none outline-none cursor-pointer max-w-[140px] truncate"
						style={{ userSelect: "text", WebkitUserSelect: "text" }}
						title={scriptName}
					>
						{scripts.map((s) => (
							<option key={s.id} value={s.id} className="bg-gray-900 text-white">
								{s.name || t("recording.teleprompterUntitledScript", "Untitled Script")}
							</option>
						))}
					</select>
					<Button
						variant="ghost"
						size="icon"
						iconSize="sm"
						onClick={addNewScript}
						title={t("recording.teleprompterNewScript", "New Script")}
						className="h-6 w-6 text-white/60 hover:text-white"
					>
						<PlusIcon size={12} />
					</Button>
				</div>

				<div className={styles.headerActions}>
					{mode === "read" && (
						<>
							<Button
								variant="ghost"
								size="icon"
								iconSize="sm"
								onClick={() => setIsPlaying(!isPlaying)}
								title={
									isPlaying
										? t("recording.teleprompterPause", "Pause auto-scroll")
										: t("recording.teleprompterPlay", "Start auto-scroll")
								}
								className={
									isPlaying
										? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
										: ""
								}
							>
								{isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
							</Button>

							<Button
								variant="ghost"
								size="icon"
								iconSize="sm"
								onClick={handleResetScroll}
								title={t("recording.teleprompterReset", "Reset to top")}
							>
								<ArrowCounterClockwiseIcon size={14} />
							</Button>
						</>
					)}

					<Button
						variant="ghost"
						size="icon"
						iconSize="sm"
						onClick={() => setMode(mode === "read" ? "edit" : "read")}
						title={
							mode === "read"
								? t("recording.teleprompterEdit", "Edit script")
								: t("recording.teleprompterRead", "Read script")
						}
						className={mode === "edit" ? "bg-white/15 text-white" : ""}
					>
						{mode === "read" ? <PencilSimpleIcon size={14} /> : <CheckIcon size={14} />}
					</Button>

					<Button
						variant="ghost"
						size="icon"
						iconSize="sm"
						onClick={() => setShowSettings(!showSettings)}
						title={t("recording.teleprompterSettings", "Settings")}
						className={showSettings ? "bg-white/15 text-white" : ""}
					>
						<GearIcon size={14} />
					</Button>

					<Button
						variant="ghost"
						size="icon"
						iconSize="sm"
						onClick={onClose}
						title={t("recording.closeApp", "Close")}
					>
						<XIcon size={14} />
					</Button>
				</div>
			</div>

			{/* Main Content Area */}
			<div className={styles.contentArea}>
				{mode === "read" ? (
					<>
						<div
							ref={scrollAreaRef}
							className={`${styles.scrollArea} ${config.isMirrored ? styles.mirrored : ""}`}
						>
							<p
								className={styles.scriptText}
								style={{
									fontSize: `${config.fontSize}px`,
								}}
							>
								{scriptText}
							</p>
						</div>
						<div className={styles.focusLine} />
					</>
				) : (
					<div className={styles.editContainer}>
						<div className={styles.editTitleRow}>
							<input
								type="text"
								value={scriptName}
								onChange={(e) => setScriptName(e.target.value)}
								onMouseMove={() => {
									window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
								}}
								onFocus={() => {
									window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
								}}
								placeholder={t(
									"recording.teleprompterScriptTitlePlaceholder",
									"Script Title",
								)}
								className={styles.scriptTitleInput}
							/>
						</div>
						<textarea
							autoFocus
							className={styles.editTextarea}
							value={scriptText}
							onChange={(e) => setScriptText(e.target.value)}
							onMouseMove={() => {
								window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
							}}
							onFocus={() => {
								window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
							}}
							placeholder={t(
								"recording.teleprompterPlaceholder",
								"Type or paste your script here...",
							)}
						/>
						<div className={styles.editFooter}>
							<span>
								{t("recording.teleprompterWords", "{{count}} words", {
									count: wordCount,
								})}
							</span>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									iconSize="sm"
									onClick={addNewScript}
									title={t("recording.teleprompterNewScript", "New Script")}
									className="h-6 w-6 text-white/60 hover:text-white"
								>
									<PlusIcon size={12} />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									iconSize="sm"
									onClick={duplicateScript}
									title={t("recording.teleprompterDuplicateScript", "Duplicate Script")}
									className="h-6 w-6 text-white/60 hover:text-white"
								>
									<CopyIcon size={12} />
								</Button>
								{scripts.length > 1 && (
									<Button
										variant="ghost"
										size="icon"
										iconSize="sm"
										onClick={() => deleteScript(activeScriptIdResolved)}
										title={t("recording.teleprompterDeleteScript", "Delete Script")}
										className="h-6 w-6 text-rose-400/60 hover:text-rose-400"
									>
										<TrashIcon size={12} />
									</Button>
								)}
								<div className="w-px h-3 bg-white/10 mx-0.5" />
								<Button
									variant="outline"
									size="sm"
									className="h-6 text-[11px] px-2 border-white/10 bg-white/5 hover:bg-white/10"
									onClick={() => setScriptText(DEFAULT_SAMPLE_SCRIPT)}
								>
									<SparkleIcon size={12} className="mr-1 text-amber-400" />
									{t("recording.teleprompterSampleScript", "Sample")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 text-[11px] px-2 text-rose-400 hover:bg-rose-500/10"
									onClick={() => setScriptText("")}
								>
									<TrashIcon size={12} className="mr-1" />
									{t("recording.teleprompterClear", "Clear")}
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Settings Drawer */}
				{showSettings && (
					<div className={styles.settingsPanel}>
						<div className={styles.settingRow}>
							<span className={styles.settingLabel}>
								{t("recording.teleprompterFontSize", "Font Size")}
							</span>
							<div className={styles.settingControl}>
								<input
									type="range"
									min="16"
									max="48"
									value={config.fontSize}
									onChange={(e) =>
										setConfig({
											...config,
											fontSize: Number.parseInt(e.target.value, 10),
										})
									}
									className={styles.rangeSlider}
								/>
								<span className={styles.sliderValue}>{config.fontSize}px</span>
							</div>
						</div>

						<div className={styles.settingRow}>
							<span className={styles.settingLabel}>
								{t("recording.teleprompterScrollSpeed", "Scroll Speed")}
							</span>
							<div className={styles.settingControl}>
								<input
									type="range"
									min="1"
									max="10"
									value={config.scrollSpeed}
									onChange={(e) =>
										setConfig({
											...config,
											scrollSpeed: Number.parseInt(e.target.value, 10),
										})
									}
									className={styles.rangeSlider}
								/>
								<span className={styles.sliderValue}>{config.scrollSpeed}</span>
							</div>
						</div>

						<div className={styles.settingRow}>
							<span className={styles.settingLabel}>
								{t("recording.teleprompterOpacity", "Background Opacity")}
							</span>
							<div className={styles.settingControl}>
								<input
									type="range"
									min="20"
									max="100"
									value={config.opacity}
									onChange={(e) =>
										setConfig({
											...config,
											opacity: Number.parseInt(e.target.value, 10),
										})
									}
									className={styles.rangeSlider}
								/>
								<span className={styles.sliderValue}>{config.opacity}%</span>
							</div>
						</div>

						<div className={styles.settingRow}>
							<span className={styles.settingLabel}>
								{t("recording.teleprompterMirror", "Mirror Text")}
							</span>
							<Button
								variant={config.isMirrored ? "default" : "outline"}
								size="sm"
								className="h-6 text-[11px] px-2 border-white/10"
								onClick={() =>
									setConfig({ ...config, isMirrored: !config.isMirrored })
								}
							>
								{config.isMirrored ? "ON" : "OFF"}
							</Button>
						</div>

						<div className={styles.settingRow}>
							<span className={styles.settingLabel}>
								{t(
									"recording.teleprompterAutoScrollOnRecord",
									"Auto-scroll on record",
								)}
							</span>
							<Button
								variant={config.autoScrollOnRecord ? "default" : "outline"}
								size="sm"
								className="h-6 text-[11px] px-2 border-white/10"
								onClick={() =>
									setConfig({
										...config,
										autoScrollOnRecord: !config.autoScrollOnRecord,
									})
								}
							>
								{config.autoScrollOnRecord ? "ON" : "OFF"}
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
