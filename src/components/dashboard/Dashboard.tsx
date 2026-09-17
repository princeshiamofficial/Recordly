import {
	Bell,
	CaretDown,
	CaretRight,
	Check,
	Desktop,
	DotsThreeVertical,
	Folder,
	FolderOpen,
	FolderSimple,
	List,
	MagnifyingGlass,
	Moon,
	Play,
	Plus,
	SquaresFour,
	Sun,
	Trash,
	UploadSimple,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { toFileUrl } from "@/components/video-editor/projectPersistence";
import { useTheme } from "@/contexts/ThemeContext";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "all" | "drafts" | "recordings" | "favorites";
type ViewMode = "grid" | "list";

interface DisplayProject extends ProjectLibraryEntry {
	isFavorite?: boolean;
	duration?: string;
	durationPosition?: "left" | "right";
}

export default function Dashboard() {
	const { theme, preference, setPreference, toggleTheme } = useTheme();
	const [projects, setProjects] = useState<ProjectLibraryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<Tab>("all");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [searchQuery, setSearchQuery] = useState("");
	const [favorites, setFavorites] = useState<Set<string>>(new Set());
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Load real projects from electron
	useEffect(() => {
		let mounted = true;
		if (!window.electronAPI?.listProjectFiles) {
			setLoading(false);
			return;
		}
		void window.electronAPI
			.listProjectFiles()
			.then((result) => {
				if (mounted && result?.success && Array.isArray(result.entries) && result.entries.length > 0) {
					setProjects(result.entries);
				}
			})
			.catch(() => {
				// fallback gracefully
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, []);

	// Hotkey for search (Ctrl + K / Cmd + K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Real projects mapped with favorite state
	const allProjects: DisplayProject[] = useMemo(() => {
		return projects.map((p) => ({
			...p,
			isFavorite: favorites.has(p.path),
		}));
	}, [projects, favorites]);

	const drafts = useMemo(
		() => allProjects.filter((p) => p.isInProjectsDirectory && !p.isCurrent),
		[allProjects],
	);

	const recordings = useMemo(
		() => allProjects.filter((p) => !p.isInProjectsDirectory),
		[allProjects],
	);

	const favoriteProjects = useMemo(
		() => allProjects.filter((p) => p.isFavorite),
		[allProjects],
	);

	// Filtered by active tab and search query
	const filteredProjects = useMemo(() => {
		let list = allProjects;
		if (activeTab === "drafts") list = drafts;
		else if (activeTab === "recordings") list = recordings;
		else if (activeTab === "favorites") list = favoriteProjects;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			return list.filter((p) => p.name.toLowerCase().includes(query));
		}
		return list;
	}, [activeTab, allProjects, drafts, recordings, favoriteProjects, searchQuery]);

	const handleNewRecording = useCallback(async () => {
		window.electronAPI?.hudOverlayShow?.();
	}, []);

	const handleOpenFile = useCallback(async () => {
		if (!window.electronAPI?.openVideoFilePicker) return;
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
			const result = await window.electronAPI?.openProjectFileAtPath?.(projectPath);
			if (result?.canceled || !result?.success) return;
			await window.electronAPI?.switchToEditor?.();
		} catch (error) {
			console.error("Failed to open project:", error);
		}
	}, []);

	const handleOpenProjectsDir = useCallback(async () => {
		await window.electronAPI?.openProjectsDirectory?.();
	}, []);

	const handleOpenRecordingsDir = useCallback(async () => {
		await window.electronAPI?.openRecordingsFolder?.();
	}, []);

	const toggleFavorite = useCallback((path: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setFavorites((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	// Formatting dates exactly like "Sep 07, 2025 • 11:26 PM"
	const formatDateTime = (ts: number) => {
		const d = new Date(ts);
		const months = [
			"Jan", "Feb", "Mar", "Apr", "May", "Jun",
			"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		];
		const month = months[d.getMonth()];
		const day = String(d.getDate()).padStart(2, "0");
		const year = d.getFullYear();
		const hoursRaw = d.getHours();
		const hours = hoursRaw % 12 || 12;
		const minutes = String(d.getMinutes()).padStart(2, "0");
		const ampm = hoursRaw >= 12 ? "PM" : "AM";
		return `${month} ${day}, ${year} • ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
	};

	const tabs: { id: Tab; label: string; count?: number }[] = [
		{ id: "all", label: "All Projects", count: allProjects.length },
		{ id: "drafts", label: "Drafts", count: drafts.length },
		{ id: "recordings", label: "Recordings", count: recordings.length },
		{ id: "favorites", label: "Favorites", count: favoriteProjects.length },
	];

	return (
		<div className="flex h-full w-full flex-col bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 overflow-y-auto select-none font-sans transition-colors duration-200">
			{/* Top Navigation Bar */}
			<header className="sticky top-0 z-30 flex items-center justify-between px-8 lg:px-12 py-4 bg-[#F8FAFC]/90 dark:bg-[#0B0F19]/90 border-b border-slate-200/70 dark:border-slate-800/80 backdrop-blur-md transition-colors duration-200">
				{/* Empty spacer on left for perfect optical balance */}
				<div className="w-12 hidden lg:block" />

				{/* Search bar */}
				<div className="relative w-full max-w-[440px] mx-auto">
					<div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
						<MagnifyingGlass size={17} weight="bold" />
					</div>
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search recordings, projects, templates..."
						className="w-full h-11 pl-10 pr-20 bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none focus:outline-none focus:border-[#1677FF] dark:focus:border-[#1677FF] focus:ring-2 focus:ring-[#1677FF]/15 transition-all"
					/>
					<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/80 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 pointer-events-none">
						Ctrl + K
					</div>
				</div>

				{/* Right user area */}
				<div className="flex items-center gap-2.5 shrink-0">
					{/* Theme Quick Toggle */}
					<button
						type="button"
						onClick={toggleTheme}
						className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
						title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
					>
						{theme === "dark" ? <Sun size={20} weight="bold" className="text-amber-400" /> : <Moon size={20} weight="bold" />}
					</button>

					{/* Notification Bell */}
					<button
						type="button"
						className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 rounded-xl transition-colors"
						title="Notifications"
					>
						<Bell size={21} weight="regular" />
						<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#EF4444] border-2 border-[#F8FAFC] dark:border-[#0B0F19] rounded-full" />
					</button>

					{/* Vertical separator */}
					<div className="h-6 w-[1px] bg-slate-200/80 dark:bg-slate-800 mx-0.5" />

					{/* Profile chip with Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<div className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 cursor-pointer select-none group transition-colors">
								<div className="w-9 h-9 rounded-full bg-[#3B82F6] text-white font-bold text-sm flex items-center justify-center shadow-sm">
									C
								</div>
								<div className="flex flex-col text-left">
									<span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal leading-tight">
										Hello,
									</span>
									<span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
										Creator
									</span>
								</div>
								<CaretDown
									size={13}
									weight="bold"
									className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors ml-0.5"
								/>
							</div>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl p-1.5 z-40 text-slate-700 dark:text-slate-200"
						>
							<div className="px-3 py-2">
								<div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Creator Account</div>
								<div className="text-[11px] text-slate-400 dark:text-slate-500">Recordly User</div>
							</div>
							<DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
							<div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
								Theme
							</div>
							<DropdownMenuItem
								onClick={() => setPreference("light")}
								className="cursor-pointer text-xs font-medium py-2 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<div className="flex items-center gap-2">
									<Sun size={15} className="text-amber-500" />
									<span>Light</span>
								</div>
								{preference === "light" && <Check size={14} weight="bold" className="text-[#1677FF]" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setPreference("dark")}
								className="cursor-pointer text-xs font-medium py-2 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<div className="flex items-center gap-2">
									<Moon size={15} className="text-indigo-400" />
									<span>Dark</span>
								</div>
								{preference === "dark" && <Check size={14} weight="bold" className="text-[#1677FF]" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setPreference("system")}
								className="cursor-pointer text-xs font-medium py-2 rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<div className="flex items-center gap-2">
									<Desktop size={15} className="text-slate-400" />
									<span>System</span>
								</div>
								{preference === "system" && <Check size={14} weight="bold" className="text-[#1677FF]" />}
							</DropdownMenuItem>
							<DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
							<DropdownMenuItem
								onClick={handleOpenProjectsDir}
								className="cursor-pointer text-xs font-medium py-2 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<Folder size={15} className="text-slate-500" />
								<span>Open Projects Directory</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={handleOpenRecordingsDir}
								className="cursor-pointer text-xs font-medium py-2 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<FolderOpen size={15} className="text-slate-500" />
								<span>Open Recordings Folder</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="mx-auto w-full max-w-[1800px] px-6 lg:px-12 pb-14 pt-4">
				{/* Hero Banner Section */}
				<section className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-4 pb-6 max-w-[1280px]">
					{/* Left Column: Heading & Description */}
					<div className="lg:col-span-6 z-10">
						{/* Sub-tag */}
						<div className="text-[10.5px] font-bold tracking-[0.2em] text-slate-400 dark:text-slate-500 uppercase mb-2">
							RECORD • EDIT • CREATE • SHARE
						</div>

						{/* Main Headline */}
						<h1 className="text-[34px] lg:text-[40px] font-extrabold text-slate-950 dark:text-white tracking-tight leading-[1.12] mb-3">
							Turn Your Ideas
							<br />
							into <span className="text-[#1677FF]">Amazing Videos</span>
						</h1>

						{/* Subtitle */}
						<p className="text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[390px]">
							Record your screen, edit with powerful tools, and create professional
							content in minutes.
						</p>
					</div>

					{/* Right Column: Angled Laptop Mockup & Visual */}
					<div className="lg:col-span-6 relative flex items-center justify-center">
						<div className="relative w-full max-w-[420px]">
							{/* Laptop Top Lid / Display */}
							<div className="relative rounded-t-[14px] bg-[#111317] p-[6px] pb-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)] border border-slate-800/80">
								{/* Screen bezel & top camera */}
								<div className="w-1.5 h-1.5 rounded-full bg-[#272b34] mx-auto mb-1 shadow-inner" />

								{/* Screen area displaying wallpaper */}
								<div className="relative aspect-[16/10] overflow-hidden rounded-[6px] bg-slate-950 border border-black/50">
									<img
										src="/wallpapers/tahoe-light.jpg"
										alt="MacBook Wallpaper"
										className="w-full h-full object-cover object-center pointer-events-none select-none"
									/>

									{/* Glossy screen reflection gradient overlay */}
									<div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />
								</div>
							</div>

							{/* Laptop Bottom Aluminum Base / Chin */}
							<div className="relative h-[9px] bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] dark:from-[#334155] dark:via-[#1e293b] dark:to-[#0f172a] rounded-b-[8px] shadow-[0_4px_8px_rgba(0,0,0,0.08)] flex items-center justify-center">
								{/* Center thumb notch indent */}
								<div className="w-14 h-[2.5px] bg-slate-400/70 dark:bg-slate-600 rounded-full" />
							</div>

							{/* Laptop base shadow projection */}
							<div className="w-[92%] h-[6px] mx-auto bg-black/20 blur-md rounded-full mt-0.5" />

							{/* Floating Recording HUD Pill Widget */}
							<div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-full border border-slate-100 dark:border-slate-800 shadow-[0_14px_32px_rgba(0,0,0,0.16),0_2px_6px_rgba(0,0,0,0.05)] pointer-events-auto transition-transform hover:scale-105 cursor-pointer">
								{/* Red Record Dot with soft halo */}
								<div className="relative flex items-center justify-center">
									<div className="w-4.5 h-4.5 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
										<div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-sm animate-pulse" />
									</div>
								</div>

								{/* Timer */}
								<span className="text-[12px] font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
									00:00
								</span>

								{/* Divider */}
								<div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700" />

								{/* Pause Icon */}
								<div className="flex items-center gap-[2.5px] px-0.5 text-slate-900 dark:text-slate-100 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
									<div className="w-[2.5px] h-3 bg-slate-900 dark:bg-slate-100 rounded-sm" />
									<div className="w-[2.5px] h-3 bg-slate-900 dark:bg-slate-100 rounded-sm" />
								</div>

								{/* Stop Icon */}
								<div className="w-3 h-3 bg-slate-900 dark:bg-slate-100 rounded-[2.5px] hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors" />
							</div>

							{/* Handwritten "Create Share Inspire" with swoosh */}
							<div className="absolute -right-4 lg:-right-12 top-10 lg:top-12 z-10 flex flex-col items-start select-none pointer-events-none">
								<div
									className="text-[#1677FF] font-bold text-[28px] lg:text-[33px] leading-[1.05] tracking-wide"
									style={{
										fontFamily: "var(--font-handwriting)",
										transform: "rotate(-6deg)",
									}}
								>
									<div>Create</div>
									<div>Share</div>
									<div>Inspire</div>
								</div>

								{/* Dynamic handwritten swoosh underline */}
								<svg
									width="100"
									height="22"
									viewBox="0 0 100 22"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									className="mt-0.5 text-[#1677FF] -rotate-6"
								>
									<path
										d="M5 13C25 21 65 22 96 8"
										stroke="#1677FF"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>
						</div>
					</div>
				</section>

				{/* 3 Quick Action Cards Row */}
				<section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
					{/* Card 1: New Recording (Vibrant Blue Card) */}
					<button
						type="button"
						onClick={handleNewRecording}
						className="group relative flex items-center justify-between p-4 rounded-[18px] bg-[#1677FF] text-white shadow-[0_6px_20px_rgba(22,119,255,0.26)] hover:shadow-[0_10px_28px_rgba(22,119,255,0.34)] hover:scale-[1.01] active:scale-[0.99] transition-all text-left"
					>
						<div className="flex items-center gap-3.5">
							<div className="w-12 h-12 rounded-[14px] bg-white flex items-center justify-center shadow-sm shrink-0">
								<Plus size={24} weight="bold" className="text-[#1677FF]" />
							</div>
							<div>
								<div className="text-[15px] font-bold text-white leading-tight">
									New Recording
								</div>
								<div className="text-[12px] text-white/80 mt-0.5 font-normal">
									Capture your screen
								</div>
							</div>
						</div>
						<div className="w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0">
							<CaretRight size={15} weight="bold" />
						</div>
					</button>

					{/* Card 2: Open File (White / Dark Slate Card) */}
					<button
						type="button"
						onClick={handleOpenFile}
						className="group relative flex items-center justify-between p-4 rounded-[18px] bg-white dark:bg-[#111625] border border-slate-100/90 dark:border-slate-800 shadow-[0_4px_18px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_8px_22px_rgba(0,0,0,0.05)] dark:hover:border-slate-700 hover:scale-[1.01] active:scale-[0.99] transition-all text-left"
					>
						<div className="flex items-center gap-3.5">
							<div className="w-12 h-12 rounded-[14px] bg-[#EFF6FF] dark:bg-blue-950/50 flex items-center justify-center shrink-0">
								<FolderSimple size={24} weight="bold" className="text-[#2563EB] dark:text-[#3B82F6]" />
							</div>
							<div>
								<div className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
									Open File
								</div>
								<div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">
									Import video or project
								</div>
							</div>
						</div>
						<div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/80 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0">
							<CaretRight size={15} weight="bold" />
						</div>
					</button>

					{/* Card 3: Quick Export (White / Dark Slate Card) */}
					<div className="group relative flex items-center justify-between p-4 rounded-[18px] bg-white dark:bg-[#111625] border border-slate-100/90 dark:border-slate-800 shadow-[0_4px_18px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition-all text-left cursor-default">
						<div className="flex items-center gap-3.5">
							<div className="w-12 h-12 rounded-[14px] bg-[#ECFDF5] dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
								<UploadSimple size={24} weight="bold" className="text-[#10B981] dark:text-emerald-400" />
							</div>
							<div>
								<div className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
									Quick Export
								</div>
								<div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">
									Coming soon
								</div>
							</div>
						</div>
						<div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-300 dark:text-slate-600 shrink-0">
							<CaretRight size={15} weight="bold" />
						</div>
					</div>
				</section>

				{/* Filter Tabs & Toolbar Row */}
				<section className="flex items-center justify-between mb-6 flex-wrap gap-4">
					{/* Left Filter Pills */}
					<div className="flex items-center gap-2">
						{tabs.map((tab) => {
							const isActive = activeTab === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									onClick={() => setActiveTab(tab.id)}
									className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] transition-all ${
										isActive
											? "bg-[#1677FF] text-white shadow-sm font-semibold px-5"
											: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 font-medium"
									}`}
								>
									<span>{tab.label}</span>
									{tab.count !== undefined && (
										<span
											className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
												isActive
													? "bg-white/20 text-white"
													: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
											}`}
										>
											{tab.count}
										</span>
									)}
								</button>
							);
						})}
					</div>

					{/* Right Controls: View Switcher & Open Folder */}
					<div className="flex items-center gap-4">
						{/* Grid vs List View toggle pill */}
						<div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/60">
							<button
								type="button"
								onClick={() => setViewMode("grid")}
								className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
									viewMode === "grid"
										? "bg-white dark:bg-slate-700 shadow-sm text-[#1677FF] dark:text-[#3B82F6]"
										: "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
								}`}
								title="Grid View"
							>
								<SquaresFour size={18} weight="bold" />
							</button>
							<button
								type="button"
								onClick={() => setViewMode("list")}
								className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
									viewMode === "list"
										? "bg-white dark:bg-slate-700 shadow-sm text-[#1677FF] dark:text-[#3B82F6]"
										: "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
								}`}
								title="List View"
							>
								<List size={18} weight="bold" />
							</button>
						</div>

						{/* Open Folder Button */}
						<button
							type="button"
							onClick={
								activeTab === "recordings"
									? handleOpenRecordingsDir
									: handleOpenProjectsDir
							}
							className="flex items-center gap-2 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-[13px] font-semibold px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
							title="Open Folder"
						>
							<Folder size={18} weight="regular" className="text-slate-800 dark:text-slate-200" />
							<span>Open Folder</span>
						</button>
					</div>
				</section>

				{/* Projects Grid / List Content */}
				<AnimatePresence mode="wait">
					{loading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={`skeleton-${i}`}
								className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111625] p-4 shadow-sm animate-pulse"
							>
								<div className="aspect-[16/10] rounded-xl bg-slate-100 dark:bg-slate-800 mb-3" />
								<div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800 mb-2" />
								<div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
							</div>
						))}
					</div>
				) : filteredProjects.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-16 text-center bg-white/50 dark:bg-[#111625]/50">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3 text-slate-400 dark:text-slate-500">
							<FolderOpen size={28} />
						</div>
						<p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
							{searchQuery
								? "No projects found"
								: activeTab === "drafts"
									? "No drafts yet"
									: activeTab === "recordings"
										? "No recordings yet"
										: activeTab === "favorites"
											? "No favorites yet"
											: "No projects yet"}
						</p>
						<p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px]">
							{searchQuery
								? "No recordings match your search query."
								: "Start a recording to create your first video."}
						</p>
						<button
							type="button"
							onClick={handleNewRecording}
							className="mt-4 flex items-center gap-1.5 bg-[#1677FF] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-sm hover:bg-[#156be6] transition-colors"
						>
							<Plus size={14} weight="bold" />
							<span>New Recording</span>
						</button>
					</div>
				) : viewMode === "grid" ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 lg:gap-5">
						{filteredProjects.map((project, index) => {
							const durationPos = project.durationPosition || (index % 2 === 0 ? "left" : "right");
							return (
								<motion.div
									key={project.path}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: index * 0.05, duration: 0.2 }}
									onClick={() => handleOpenProject(project.path)}
									className="group relative flex flex-col rounded-2xl border border-slate-100/90 dark:border-slate-800/90 bg-white dark:bg-[#111625] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_8px_26px_rgba(0,0,0,0.06)] dark:hover:border-slate-700 transition-all overflow-hidden cursor-pointer"
								>
									{/* Thumbnail Area */}
									<div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
										{project.thumbnailPath ? (
											<img
												src={toFileUrl(project.thumbnailPath)}
												alt={project.name}
												className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-850 text-slate-400 dark:text-slate-500">
												<FolderOpen size={36} />
											</div>
										)}

										{/* Duration Badge */}
										{project.duration && (
											<div
												className={`absolute bottom-3 ${
													durationPos === "left" ? "left-3" : "right-3"
												} bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 z-10`}
											>
												{project.duration}
											</div>
										)}
									</div>

									{/* Card Footer Info */}
									<div className="p-4 flex items-start justify-between">
										<div className="min-w-0 flex-1 pr-2">
											<div className="truncate text-[14px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1677FF] dark:group-hover:text-[#3B82F6] transition-colors">
												{project.name}
											</div>
											<div className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 font-normal">
												{formatDateTime(project.updatedAt)}
											</div>
										</div>

										{/* Three-dots menu */}
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													onClick={(e) => e.stopPropagation()}
													className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
												>
													<DotsThreeVertical size={18} weight="bold" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												className="w-44 bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 rounded-xl p-1 z-40 text-slate-700 dark:text-slate-200"
											>
												<DropdownMenuItem
													onClick={() => handleOpenProject(project.path)}
													className="cursor-pointer text-xs font-medium py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
												>
													<Play size={14} className="mr-2 text-[#1677FF]" />
													Open in Editor
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={(e) => {
														e.stopPropagation();
														toggleFavorite(project.path);
													}}
													className="cursor-pointer text-xs font-medium py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
												>
													{project.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleOpenProjectsDir()}
													className="cursor-pointer text-xs font-medium py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
												>
													<FolderOpen size={14} className="mr-2 text-slate-500" />
													Show in Folder
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={(e) => {
														e.stopPropagation();
														// Delete demo or trigger project deletion
													}}
													className="cursor-pointer text-xs font-medium py-2 rounded-lg text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 focus:text-red-700 focus:bg-red-50"
												>
													<Trash size={14} className="mr-2" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</motion.div>
							);
						})}
					</div>
				) : (
					/* List View */
					<div className="flex flex-col gap-3">
						{filteredProjects.map((project, index) => (
							<motion.div
								key={project.path}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: index * 0.03, duration: 0.15 }}
								onClick={() => handleOpenProject(project.path)}
								className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-100/90 dark:border-slate-800/90 bg-white dark:bg-[#111625] shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] dark:hover:border-slate-700 transition-all cursor-pointer"
							>
								<div className="flex items-center gap-3.5 min-w-0">
									<div className="relative w-20 h-13 aspect-[16/10] rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
										{project.thumbnailPath ? (
											<img
												src={toFileUrl(project.thumbnailPath)}
												alt={project.name}
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
												<FolderOpen size={18} />
											</div>
										)}
									</div>
									<div className="min-w-0">
										<div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1677FF] dark:group-hover:text-[#3B82F6] transition-colors">
											{project.name}
										</div>
										<div className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
											{formatDateTime(project.updatedAt)}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-4 shrink-0">
									{project.duration && (
										<span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
											{project.duration}
										</span>
									)}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleOpenProject(project.path);
										}}
										className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
									>
										<Play size={16} weight="bold" />
									</button>
								</div>
							</motion.div>
						))}
					</div>
				)}
				</AnimatePresence>
			</main>
		</div>
	);
}
