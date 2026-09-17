import {
	Crown,
	DownloadSimple as Download,
	FilmSlate as Film,
	Image,
	Lightning,
	Sparkle,
} from "@phosphor-icons/react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useScopedT } from "@/contexts/I18nContext";
import { useLicense } from "@/contexts/LicenseContext";
import type {
	CinematicLookPreset,
	ExportEncodingMode,
	ExportFormat,
	ExportMp4FrameRate,
	ExportPipelineModel,
	ExportQuality,
	GifFrameRate,
	GifSizePreset,
} from "@/lib/exporter";
import {
	CINEMATIC_LOOK_PRESETS,
	GIF_FRAME_RATES,
	GIF_SIZE_PRESETS,
	MP4_FRAME_RATES,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";

interface ExportSettingsMenuProps {
	exportFormat: ExportFormat;
	onExportFormatChange?: (format: ExportFormat) => void;
	exportQuality: ExportQuality;
	onExportQualityChange?: (quality: ExportQuality) => void;
	exportEncodingMode: ExportEncodingMode;
	onExportEncodingModeChange?: (encodingMode: ExportEncodingMode) => void;
	mp4FrameRate: ExportMp4FrameRate;
	onMp4FrameRateChange?: (frameRate: ExportMp4FrameRate) => void;
	exportPipelineModel?: ExportPipelineModel;
	onExportPipelineModelChange?: (pipelineModel: ExportPipelineModel) => void;
	experimentalNvidiaCudaExport?: boolean;
	onExperimentalNvidiaCudaExportChange?: (enabled: boolean) => void;
	nvidiaCudaExportAvailable?: boolean;
	cinematicLook?: CinematicLookPreset;
	onCinematicLookChange?: (look: CinematicLookPreset) => void;
	cinematicLetterbox?: boolean;
	onCinematicLetterboxChange?: (enabled: boolean) => void;
	showCaptionSidecarOption?: boolean;
	includeCaptionSidecar?: boolean;
	onIncludeCaptionSidecarChange?: (enabled: boolean) => void;
	mp4OutputDimensions?: Record<ExportQuality, { width: number; height: number }>;
	gifFrameRate: GifFrameRate;
	onGifFrameRateChange?: (rate: GifFrameRate) => void;
	gifLoop: boolean;
	onGifLoopChange?: (loop: boolean) => void;
	gifSizePreset: GifSizePreset;
	onGifSizePresetChange?: (preset: GifSizePreset) => void;
	gifOutputDimensions: { width: number; height: number };
	onExport?: () => void;
	onInstantExport?: () => void;
	className?: string;
}

export function ExportSettingsMenu({
	exportFormat,
	onExportFormatChange,
	exportQuality,
	onExportQualityChange,
	exportEncodingMode,
	onExportEncodingModeChange,
	mp4FrameRate,
	onMp4FrameRateChange,
	exportPipelineModel = "modern",
	onExportPipelineModelChange,
	experimentalNvidiaCudaExport = false,
	onExperimentalNvidiaCudaExportChange,
	nvidiaCudaExportAvailable = false,
	cinematicLook = "none",
	onCinematicLookChange,
	cinematicLetterbox = false,
	onCinematicLetterboxChange,
	showCaptionSidecarOption = false,
	includeCaptionSidecar = false,
	onIncludeCaptionSidecarChange,
	mp4OutputDimensions,
	gifFrameRate,
	onGifFrameRateChange,
	gifLoop,
	onGifLoopChange,
	gifSizePreset,
	onGifSizePresetChange,
	gifOutputDimensions,
	onExport,
	onInstantExport,
	className,
}: ExportSettingsMenuProps) {
	const tSettings = useScopedT("settings");
	const { isPro, entitlements, openUpgradeModal } = useLicense();
	const isLegacyModel = exportPipelineModel === "legacy";
	const [detectedEncoder, setDetectedEncoder] = useState<{
		encoderName: string;
		isHardware: boolean;
		displayName: string;
		gpuModel?: string;
	} | null>(null);

	useEffect(() => {
		let isMounted = true;
		if (typeof window !== "undefined" && window.electronAPI?.getDetectedEncoderInfo) {
			window.electronAPI
				.getDetectedEncoderInfo()
				.then((res) => {
					if (isMounted && res.success && res.info) {
						setDetectedEncoder(res.info);
					}
				})
				.catch(() => {
					// Non-critical: ignore encoder detection failure in UI
				});
		}
		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div
			className={cn(
				"w-full rounded-2xl border border-foreground/10 bg-editor-surface p-3 text-foreground",
				className,
			)}
		>
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						{tSettings("export.title", "Export")}
					</span>
					{isPro ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-black uppercase tracking-wider">
							<Crown weight="fill" className="h-2.5 w-2.5" />
							PRO
						</span>
					) : null}
				</div>
				{detectedEncoder ? (
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
							detectedEncoder.isHardware
								? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
								: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
						)}
						title={
							detectedEncoder.isHardware
								? detectedEncoder.gpuModel
									? `${detectedEncoder.displayName} (${detectedEncoder.gpuModel})`
									: detectedEncoder.displayName
								: "Multi-threaded in-browser WebCodecs export engine"
						}
					>
						<Lightning weight="fill" className="h-3 w-3" />
						{detectedEncoder.isHardware
							? detectedEncoder.displayName
							: "WebCodecs (CPU Engine)"}
					</span>
				) : null}
			</div>

			<div className="mb-3 flex items-center gap-2">
				<LayoutGroup id="header-export-format-toggle">
					{(
						[
							{ value: "mp4", label: tSettings("export.mp4"), icon: Film },
							{ value: "gif", label: tSettings("export.gif"), icon: Image },
						] as const
					).map((option) => {
						const Icon = option.icon;
						const isActive = exportFormat === option.value;
						return (
							<button
								key={option.value}
								type="button"
								onClick={() => onExportFormatChange?.(option.value)}
								aria-pressed={isActive}
								className={cn(
									"relative flex-1 overflow-hidden rounded-xl border py-2 text-xs font-medium transition-colors",
									isActive
										? "border-[#2563EB]/50 text-[#2563EB] dark:text-white"
										: "border-foreground/10 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
								)}
							>
								{isActive ? (
									<motion.span
										layoutId="header-export-format-pill"
										className="absolute inset-0 rounded-xl bg-[#2563EB]/10"
										transition={{ type: "spring", stiffness: 380, damping: 32 }}
									/>
								) : null}
								<span className="relative z-10 flex items-center justify-center gap-1.5">
									<Icon className="h-3.5 w-3.5" />
									{option.label}
								</span>
							</button>
						);
					})}
				</LayoutGroup>
			</div>

			{exportFormat === "mp4" ? (
				<LayoutGroup id="header-export-quality-toggle">
					<div className="mb-3 grid min-h-12 w-full grid-cols-3 gap-1 rounded-xl border border-foreground/5 bg-foreground/5 p-1">
						{(
							[
								{ value: "8k", label: "8K UHD" },
								{ value: "4k", label: "4K UHD" },
								{ value: "2k", label: "2K QHD" },
								{ value: "high", label: "1080p FHD" },
								{ value: "good", label: "720p HD" },
								{
									value: "source",
									label: tSettings("export.quality.original", "Original"),
								},
							] as const
						).map((option) => {
							const isGated =
								!isPro &&
								(option.value === "8k" ||
									option.value === "4k" ||
									option.value === "2k");
							const isActive = exportQuality === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => {
										if (isGated) {
											openUpgradeModal("4k_export");
											return;
										}
										onExportQualityChange?.(option.value);
									}}
									aria-pressed={isActive}
									className="relative rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="header-export-quality-pill"
											className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span className="relative z-10 flex h-full flex-col items-center justify-center leading-tight">
										<span
											className={cn(
												"inline-flex items-center gap-1",
												isActive
													? "text-white dark:text-black font-semibold"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											{option.label}
											{isGated ? (
												<span className="rounded bg-amber-500/20 px-1 py-0.2 text-[8px] font-bold text-amber-500">
													PRO
												</span>
											) : null}
										</span>
										{mp4OutputDimensions &&
										mp4OutputDimensions[option.value] ? (
											<span
												className={cn(
													"mt-0.5 text-[9px]",
													isActive
														? "text-white/75 dark:text-black/75"
														: "text-muted-foreground/70",
												)}
											>
												{mp4OutputDimensions[option.value].width} ×{" "}
												{mp4OutputDimensions[option.value].height}
											</span>
										) : null}
									</span>
								</button>
							);
						})}
					</div>
					<div className="mb-1 flex items-center justify-between px-1">
						<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
							{tSettings("export.encodingTitle", "Encoding")}
						</span>
					</div>
					<div className="mb-3 grid min-h-10 w-full grid-cols-3 rounded-xl border border-foreground/5 bg-foreground/5 p-0.5">
						{(
							[
								{ value: "fast", label: tSettings("export.encoding.fast", "Fast") },
								{
									value: "balanced",
									label: tSettings("export.encoding.balanced", "Balanced"),
								},
								{
									value: "quality",
									label: tSettings("export.encoding.quality", "Quality"),
								},
							] as const
						).map((option) => {
							const isActive = exportEncodingMode === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => onExportEncodingModeChange?.(option.value)}
									aria-pressed={isActive}
									className="relative rounded-lg px-1 py-1 text-[11px] font-medium transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="header-export-encoding-pill"
											className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-white dark:text-black"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{option.label}
									</span>
								</button>
							);
						})}
					</div>
					<div className="mb-1 flex items-center justify-between px-1">
						<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
							{tSettings("export.fpsTitle", "FPS")}
						</span>
					</div>
					<div className="mb-3 grid min-h-10 w-full grid-cols-3 rounded-xl border border-foreground/5 bg-foreground/5 p-0.5">
						{MP4_FRAME_RATES.map((rate) => {
							const isActive = mp4FrameRate === rate;
							return (
								<button
									key={rate}
									type="button"
									onClick={() => onMp4FrameRateChange?.(rate)}
									aria-pressed={isActive}
									className="relative rounded-lg px-1 py-1 text-[11px] font-medium transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="header-export-fps-pill"
											className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-white dark:text-black"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{rate}
									</span>
								</button>
							);
						})}
					</div>
					<div className="mb-1 flex items-center justify-between px-1">
						<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
							{tSettings("export.cinematicLookTitle", "Cinematic Look")}
						</span>
					</div>
					<LayoutGroup id="header-export-cinematic-look">
						<div className="mb-1.5 grid min-h-12 w-full grid-cols-3 gap-1 rounded-xl border border-foreground/5 bg-foreground/5 p-1">
							{CINEMATIC_LOOK_PRESETS.map((preset) => {
								const isActive = cinematicLook === preset.value;
								return (
									<button
										key={preset.value}
										type="button"
										onClick={() => onCinematicLookChange?.(preset.value)}
										aria-pressed={isActive}
										className="relative rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors"
									>
										{isActive ? (
											<motion.span
												layoutId="header-export-cinematic-look-pill"
												className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
												transition={{
													type: "spring",
													stiffness: 420,
													damping: 34,
												}}
											/>
										) : null}
										<span
											className={cn(
												"relative z-10 flex h-full items-center justify-center text-center",
												isActive
													? "font-semibold text-white dark:text-black"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											{preset.label}
										</span>
									</button>
								);
							})}
						</div>
					</LayoutGroup>
					<p className="mb-3 px-1 text-[10px] text-muted-foreground/70">
						{CINEMATIC_LOOK_PRESETS.find((p) => p.value === cinematicLook)?.description}
					</p>
					<div className="mb-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
						<div className="min-w-0">
							<p className="text-[11px] font-semibold text-foreground">
								{tSettings("export.cinematicLetterbox.title", "Cinematic Letterbox (21:9)")}
							</p>
							<p className="mt-0.5 truncate text-[10px] text-muted-foreground/75">
								{tSettings(
									"export.cinematicLetterbox.hint",
									"Adds 21:9 widescreen black bars on top & bottom.",
								)}
							</p>
						</div>
						<Switch
							checked={cinematicLetterbox}
							onCheckedChange={onCinematicLetterboxChange}
							aria-label="Toggle cinematic letterbox"
							className="shrink-0 scale-75"
						/>
					</div>
					<div className="mb-1 flex items-center justify-between px-1">
						<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
							{tSettings("export.pipelineTitle", "Pipeline")}
						</span>
					</div>
					<div className="mb-3 grid min-h-10 w-full grid-cols-2 rounded-xl border border-foreground/5 bg-foreground/5 p-0.5">
						{(
							[
								{
									value: "legacy",
									label: tSettings("export.pipeline.legacy", "Legacy"),
								},
								{
									value: "modern",
									label: tSettings("export.pipeline.modern", "Lightning (Beta)"),
								},
							] as const
						).map((option) => {
							const isActive = exportPipelineModel === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => onExportPipelineModelChange?.(option.value)}
									aria-pressed={isActive}
									className="relative rounded-lg px-1 py-1 text-[11px] font-medium transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="header-export-pipeline-pill"
											className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-white dark:text-black"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{option.label}
									</span>
								</button>
							);
						})}
					</div>
					<p className="mb-3 px-1 text-[10px] text-muted-foreground/70">
						{isLegacyModel
							? tSettings(
									"export.pipeline.legacyHint",
									"Legacy uses the current stable WebCodecs export path.",
								)
							: tSettings(
									"export.pipeline.lightningHint",
									"Lightning (Beta) automatically uses the fastest compatible backend and falls back when needed.",
								)}
					</p>
					{!isLegacyModel && nvidiaCudaExportAvailable ? (
						<div className="mb-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/5 px-3 py-2">
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="text-[11px] font-semibold text-foreground">
										{tSettings("export.nvidiaCuda.title", "NVIDIA CUDA")}
									</span>
									<span className="rounded bg-[#2563EB]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#2563EB]">
										{tSettings("export.nvidiaCuda.badge", "GPU")}
									</span>
								</div>
								<p className="mt-0.5 truncate text-[10px] text-muted-foreground/75">
									{tSettings(
										"export.nvidiaCuda.hint",
										"Use NVIDIA GPU for faster exports.",
									)}
								</p>
							</div>
							<Switch
								checked={experimentalNvidiaCudaExport}
								onCheckedChange={onExperimentalNvidiaCudaExportChange}
								aria-label={tSettings(
									"export.nvidiaCuda.toggle",
									"Enable NVIDIA GPU export",
								)}
								className="shrink-0 scale-75 data-[state=checked]:bg-[#2563EB]"
							/>
						</div>
					) : null}
					{showCaptionSidecarOption ? (
						<div className="mb-3 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
							<div className="min-w-0">
								<p className="text-[11px] font-semibold text-foreground">
									{tSettings(
										"export.captionSidecar.title",
										"Export captions file",
									)}
								</p>
								<p className="mt-0.5 truncate text-[10px] text-muted-foreground/75">
									{tSettings(
										"export.captionSidecar.hint",
										"Save .srt and .vtt files next to your exported video.",
									)}
								</p>
							</div>
							<Switch
								checked={includeCaptionSidecar}
								onCheckedChange={onIncludeCaptionSidecarChange}
								aria-label={tSettings(
									"export.captionSidecar.toggle",
									"Export captions sidecar files",
								)}
								className="shrink-0 scale-75 data-[state=checked]:bg-[#2563EB]"
							/>
						</div>
					) : null}
				</LayoutGroup>
			) : (
				<div className="mb-3 space-y-2">
					<div className="flex items-center gap-2">
						<LayoutGroup id="header-gif-frame-rate-toggle">
							<div className="grid h-8 flex-1 grid-cols-4 rounded-xl border border-foreground/5 bg-foreground/5 p-0.5">
								{GIF_FRAME_RATES.map((rate) => {
									const isActive = gifFrameRate === rate.value;
									return (
										<button
											key={rate.value}
											type="button"
											onClick={() => onGifFrameRateChange?.(rate.value)}
											aria-pressed={isActive}
											className="relative rounded-lg text-[11px] font-medium transition-colors"
										>
											{isActive ? (
												<motion.span
													layoutId="header-gif-frame-rate-pill"
													className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
													transition={{
														type: "spring",
														stiffness: 420,
														damping: 34,
													}}
												/>
											) : null}
											<span
												className={cn(
													"relative z-10",
													isActive
														? "text-white dark:text-black"
														: "text-muted-foreground hover:text-foreground",
												)}
											>
												{rate.value}
											</span>
										</button>
									);
								})}
							</div>
						</LayoutGroup>
						<LayoutGroup id="header-gif-size-toggle">
							<div className="grid h-8 flex-1 grid-cols-3 rounded-xl border border-foreground/5 bg-foreground/5 p-0.5">
								{Object.entries(GIF_SIZE_PRESETS).map(([key]) => {
									const isActive = gifSizePreset === key;
									return (
										<button
											key={key}
											type="button"
											onClick={() =>
												onGifSizePresetChange?.(key as GifSizePreset)
											}
											aria-pressed={isActive}
											className="relative rounded-lg text-[11px] font-medium transition-colors"
										>
											{isActive ? (
												<motion.span
													layoutId="header-gif-size-pill"
													className="absolute inset-0 rounded-lg bg-neutral-800 dark:bg-white"
													transition={{
														type: "spring",
														stiffness: 420,
														damping: 34,
													}}
												/>
											) : null}
											<span
												className={cn(
													"relative z-10",
													isActive
														? "text-white dark:text-black"
														: "text-muted-foreground hover:text-foreground",
												)}
											>
												{key === "original"
													? tSettings(
															"export.sizePresetOriginalShort",
															"Orig",
														)
													: key === "medium"
														? tSettings(
																"export.sizePresetMediumShort",
																"Med",
															)
														: tSettings(
																"export.sizePresetLargeShort",
																"Lar",
															)}
											</span>
										</button>
									);
								})}
							</div>
						</LayoutGroup>
					</div>
					<div className="flex items-center justify-between px-1">
						<span className="text-[10px] text-muted-foreground/70">
							{gifOutputDimensions.width} × {gifOutputDimensions.height}px
						</span>
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-muted-foreground">
								{tSettings("export.loop")}
							</span>
							<Switch
								checked={gifLoop}
								onCheckedChange={onGifLoopChange}
								className="scale-75 data-[state=checked]:bg-[#2563EB]"
							/>
						</div>
					</div>
				</div>
			)}

			{!entitlements.watermarkFree ? (
				<div className="mb-2.5 flex items-center justify-between rounded-xl border border-foreground/5 bg-foreground/5 p-2 px-2.5 text-[11px]">
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<Sparkle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
						<span>Includes subtle CamVerse watermark</span>
					</div>
					<button
						type="button"
						onClick={() => openUpgradeModal("watermark")}
						className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
					>
						Remove
					</button>
				</div>
			) : (
				<div className="mb-2.5 flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-1.5 px-2.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
					<Crown weight="fill" className="h-3 w-3 shrink-0" />
					<span>Pro Active: Watermark-Free & Full Quality</span>
				</div>
			)}

			<div className="space-y-2">
				<button
					type="button"
					onClick={onInstantExport || onExport}
					className="uiverse-btn uiverse-btn-instant uiverse-btn-full"
				>
					<span className="uiverse-btn-lg !py-2.5">
						<span className="uiverse-btn-sl" />
						<span className="uiverse-btn-text text-xs">
							<Lightning className="h-4 w-4 fill-current text-yellow-300" />
							<span>Instant Export (No Delay)</span>
						</span>
					</span>
				</button>
				<button
					type="button"
					onClick={onExport}
					className="uiverse-btn uiverse-btn-export uiverse-btn-full"
				>
					<span className="uiverse-btn-lg !py-2">
						<span className="uiverse-btn-sl" />
						<span className="uiverse-btn-text text-xs">
							<Download className="h-3.5 w-3.5" />
							<span>
								{tSettings("export.exportVideo", undefined, {
									format: exportFormat === "gif" ? "GIF" : "Video",
								})}
							</span>
						</span>
					</span>
				</button>
			</div>
		</div>
	);
}
