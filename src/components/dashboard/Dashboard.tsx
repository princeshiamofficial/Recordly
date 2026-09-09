import {
	ExportIcon,
	FilmStripIcon,
	FolderOpenIcon,
	GearIcon,
	MonitorPlayIcon,
	PlusIcon,
	VideoCameraIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";

const appIconSrc = "/app-icons/recordly-128.png";

type Tab = "all" | "drafts" | "recordings";

export default function Dashboard() {
	const { t } = useI18n();
	const [projects, setProjects] = useState<ProjectLibraryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<Tab>("all");
	const [hoveredProject, setHoveredProject] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void window.electronAPI
			.listProjectFiles()
			.then((result) => {
				if (mounted && result.success) {
					setProjects(result.entries);
				}
			})
			.catch(() => {
				// ignore - projects will remain empty
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	const drafts = useMemo(
		() => projects.filter((p) => p.isInProjectsDirectory && !p.isCurrent),
		[projects],
	);

	const recordings = useMemo(
		() => projects.filter((p) => !p.isInProjectsDirectory),
		[projects],
	);

	const visibleProjects = useMemo(() => {
		if (activeTab === "drafts") return drafts;
		if (activeTab === "recordings") return recordings;
		return projects;
	}, [activeTab, projects, drafts, recordings]);

	const handleNewRecording = useCallback(async () => {
		window.electronAPI?.hudOverlayShow?.();
	}, []);

	const handleOpenFile = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker({ includeProjects: true });
		if (result.canceled) return;
		if (result.success && result.kind === "project") {
			await window.electronAPI.switchToEditor();
			return;
		}
		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	}, []);

	const handleOpenProject = useCallback(async (projectPath: string) => {
		try {
			const result = await window.electronAPI.openProjectFileAtPath(projectPath);
			if (result.canceled || !result.success) return;
			await window.electronAPI.switchToEditor();
		} catch (error) {
			console.error("Failed to open project:", error);
		}
	}, []);

	const handleOpenProjectsDir = useCallback(async () => {
		await window.electronAPI.openProjectsDirectory();
	}, []);

	const handleOpenRecordingsDir = useCallback(async () => {
		await window.electronAPI.openRecordingsFolder();
	}, []);

	const formatDate = (ts: number) => {
		const d = new Date(ts);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString();
	};

	const formatTime = (ts: number) => {
		return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	const tabs: { id: Tab; label: string; count: number }[] = [
		{ id: "all", label: "All Projects", count: projects.length },
		{ id: "drafts", label: "Drafts", count: drafts.length },
		{ id: "recordings", label: "Recordings", count: recordings.length },
	];

	return (
		<div className="flex h-full w-full flex-col bg-editor-bg text-foreground overflow-y-auto custom-scrollbar">
			<div className="relative">
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
					<div className="absolute -top-16 -left-16 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
				</div>

				<div className="relative mx-auto w-full max-w-4xl px-8 pt-10 pb-6">
					<div className="flex items-center justify-between mb-8">
						<div className="flex items-center gap-4">
							<div className="relative">
								<img
									src={appIconSrc}
									alt="CamVerse"
									className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/10 ring-1 ring-white/10"
								/>
								<div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-editor-bg" />
							</div>
							<div>
								<h1 className="text-2xl font-bold tracking-tight">
									{t("app.name", "CamVerse")}
								</h1>
								<p className="text-sm text-muted-foreground">
									{t("app.subtitle", "Screen recording and editing")}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								iconSize="lg"
								onClick={handleOpenProjectsDir}
								className="text-muted-foreground hover:text-foreground"
								title="Open Projects Folder"
							>
								<FolderOpenIcon size={18} />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								iconSize="lg"
								className="text-muted-foreground hover:text-foreground"
								title="Settings"
							>
								<GearIcon size={18} />
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-3 gap-3 mb-8">
						<button
							type="button"
							onClick={handleNewRecording}
							className="group relative flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 p-6 text-center transition-all hover:border-primary/40 hover:from-primary/15 hover:to-primary/8 hover:shadow-xl hover:shadow-primary/10 active:scale-[0.98]"
						>
							<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-110">
								<PlusIcon size={28} weight="bold" />
							</div>
							<div>
								<div className="font-semibold text-sm">
									{t("dashboard.newRecording", "New Recording")}
								</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Capture your screen
								</div>
							</div>
						</button>

						<button
							type="button"
							onClick={handleOpenFile}
							className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-accent-foreground/20 hover:bg-accent hover:shadow-xl hover:shadow-black/5 active:scale-[0.98]"
						>
							<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-foreground/70 transition-transform group-hover:scale-110">
								<FilmStripIcon size={28} />
							</div>
							<div>
								<div className="font-semibold text-sm">
									{t("dashboard.openFile", "Open File")}
								</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Import video or project
								</div>
							</div>
						</button>

						<div className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/50 p-6 text-center opacity-60 cursor-not-allowed">
							<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
								<ExportIcon size={28} />
							</div>
							<div>
								<div className="font-semibold text-sm">Quick Export</div>
								<div className="text-xs text-muted-foreground mt-0.5">Coming soon</div>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
							{tabs.map((tab) => (
								<button
									key={tab.id}
									type="button"
									onClick={() => setActiveTab(tab.id)}
									className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
										activeTab === tab.id
											? "bg-card text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									{tab.label}
									<span
										className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
											activeTab === tab.id
												? "bg-primary text-primary-foreground"
												: "bg-muted-foreground/20 text-muted-foreground"
										}`}
									>
										{tab.count}
									</span>
								</button>
							))}
						</div>
						{visibleProjects.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={activeTab === "recordings" ? handleOpenRecordingsDir : handleOpenProjectsDir}
								className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
							>
								<FolderOpenIcon size={14} />
								Open Folder
							</Button>
						)}
					</div>

					<AnimatePresence mode="wait">
						{loading ? (
							<motion.div
								key="skeleton"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="grid grid-cols-3 gap-3"
							>
								{Array.from({ length: 6 }).map((_, i) => (
									<div
										key={`skeleton-${i.toString()}`}
										className="rounded-2xl border border-border bg-card p-4 animate-pulse"
									>
										<div className="aspect-video rounded-xl bg-muted mb-3" />
										<div className="h-3.5 w-3/4 rounded bg-muted mb-2" />
										<div className="h-2.5 w-1/2 rounded bg-muted" />
									</div>
								))}
							</motion.div>
						) : visibleProjects.length === 0 ? (
							<motion.div
								key="empty"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center"
							>
								<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
									<MonitorPlayIcon size={32} className="text-muted-foreground/40" />
								</div>
								<p className="text-sm font-medium text-foreground mb-1">
									{activeTab === "drafts"
										? "No drafts yet"
										: activeTab === "recordings"
											? "No recordings yet"
											: "No projects yet"}
								</p>
								<p className="text-xs text-muted-foreground max-w-[240px]">
									{activeTab === "all"
										? "Start a recording or open a file to create your first project."
										: "Your work will appear here."}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={handleNewRecording}
									className="mt-4 gap-1.5"
								>
									<PlusIcon size={14} />
									New Recording
								</Button>
							</motion.div>
						) : (
							<motion.div
								key={activeTab}
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.15 }}
								className="grid grid-cols-3 gap-3"
							>
								{visibleProjects.map((project, index) => (
									<motion.button
										key={project.path}
										type="button"
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: index * 0.03, duration: 0.2 }}
										onClick={() => handleOpenProject(project.path)}
										onMouseEnter={() => setHoveredProject(project.path)}
										onMouseLeave={() => setHoveredProject(null)}
										className="group relative flex flex-col rounded-2xl border border-border bg-card text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.99] overflow-hidden"
									>
										<div className="relative aspect-video bg-muted overflow-hidden">
											{project.thumbnailPath ? (
												<img
													src={project.thumbnailPath}
													alt={project.name}
													className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
													<VideoCameraIcon
														size={32}
														className="text-muted-foreground/30"
													/>
												</div>
											)}
											<AnimatePresence>
												{hoveredProject === project.path && (
													<motion.div
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														exit={{ opacity: 0 }}
														className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]"
													>
														<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
															<MonitorPlayIcon size={20} weight="fill" />
														</div>
													</motion.div>
												)}
											</AnimatePresence>
											{project.isCurrent && (
												<div className="absolute top-2 right-2">
													<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
														Current
													</span>
												</div>
											)}
											{!project.isInProjectsDirectory && (
												<div className="absolute top-2 left-2">
													<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
														Imported
													</span>
												</div>
											)}
										</div>
										<div className="p-3">
											<div className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
												{project.name}
											</div>
											<div className="flex items-center justify-between mt-1.5">
												<span className="text-[11px] text-muted-foreground">
													{formatDate(project.updatedAt)}
												</span>
												<span className="text-[10px] text-muted-foreground/60">
													{formatTime(project.updatedAt)}
												</span>
											</div>
										</div>
									</motion.button>
								))}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
