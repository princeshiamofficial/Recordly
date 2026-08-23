import {
	MicrophoneIcon,
	MicrophoneSlashIcon,
	SlidersIcon,
	SpeakerHighIcon,
	SpeakerXIcon,
} from "@phosphor-icons/react";
import { useScopedT } from "@/contexts/I18nContext";
import type { AudioRecordingMode } from "@/hooks/useScreenRecorder";
import { DropdownItem, HudPopover, MicDeviceRow } from "./PopoverScaffold";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import type { DeviceOption } from "./launchPopoverTypes";
import type { ReactElement } from "react";
import styles from "../LaunchWindow.module.css";

const POPOVER_ID = "mic";

export function MicPopover({
	trigger,
	disabled,
	systemAudioEnabled,
	onToggleSystemAudio,
	microphoneEnabled,
	onDisableMicrophone,
	audioMode,
	onSelectAudioMode,
	devices,
	microphoneDeviceId,
	selectedDeviceId,
	onSelectDevice,
}: {
	trigger: ReactElement;
	disabled?: boolean;
	systemAudioEnabled: boolean;
	onToggleSystemAudio: () => void;
	microphoneEnabled: boolean;
	onDisableMicrophone: () => void;
	audioMode?: AudioRecordingMode;
	onSelectAudioMode?: (mode: AudioRecordingMode) => void;
	devices: DeviceOption[];
	microphoneDeviceId?: string;
	selectedDeviceId?: string;
	onSelectDevice: (deviceId: string) => void;
}) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);

	const currentMode =
		audioMode ??
		(systemAudioEnabled && microphoneEnabled
			? "both"
			: systemAudioEnabled
				? "internal"
				: microphoneEnabled
					? "external"
					: "none");

	return (
		<HudPopover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
					return;
				}
				if (disabled) {
					return;
				}
				requestOpen(POPOVER_ID);
			}}
			trigger={trigger}
			align="start"
		>
			<div className="px-3 pt-2 pb-1">
				<div className={styles.ddLabel}>
					{t("recording.audioMode", "Audio Recording Mode")}
				</div>
				<div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/10 mt-1 mb-2">
					<button
						type="button"
						className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-all ${
							currentMode === "internal"
								? "bg-rose-500 text-white font-semibold shadow-sm"
								: "text-white/70 hover:text-white hover:bg-white/10"
						}`}
						onClick={() => onSelectAudioMode?.("internal")}
						title={t("recording.audioModeInternal", "Internal (System Audio Only)")}
					>
						<SpeakerHighIcon size={13} />
						<span>{t("recording.audioModeInternal", "Internal")}</span>
					</button>

					<button
						type="button"
						className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-all ${
							currentMode === "external"
								? "bg-rose-500 text-white font-semibold shadow-sm"
								: "text-white/70 hover:text-white hover:bg-white/10"
						}`}
						onClick={() => onSelectAudioMode?.("external")}
						title={t("recording.audioModeExternal", "External (Microphone Only)")}
					>
						<MicrophoneIcon size={13} />
						<span>{t("recording.audioModeExternal", "Mic")}</span>
					</button>

					<button
						type="button"
						className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-all ${
							currentMode === "both"
								? "bg-rose-500 text-white font-semibold shadow-sm"
								: "text-white/70 hover:text-white hover:bg-white/10"
						}`}
						onClick={() => onSelectAudioMode?.("both")}
						title={t("recording.audioModeBoth", "Both (Internal + Mic)")}
					>
						<SlidersIcon size={13} />
						<span>{t("recording.audioModeBoth", "Both")}</span>
					</button>
				</div>
			</div>

			<div className={styles.ddLabel}>{t("recording.microphone")}</div>
			<DropdownItem
				icon={
					systemAudioEnabled ? <SpeakerHighIcon size={16} /> : <SpeakerXIcon size={16} />
				}
				selected={systemAudioEnabled}
				onClick={onToggleSystemAudio}
			>
				{systemAudioEnabled
					? t("recording.disableSystemAudio")
					: t("recording.enableSystemAudio")}
			</DropdownItem>
			{microphoneEnabled && (
				<DropdownItem
					icon={<MicrophoneSlashIcon size={16} />}
					onClick={() => {
						onDisableMicrophone();
						requestClose(POPOVER_ID);
					}}
				>
					{t("recording.turnOffMicrophone")}
				</DropdownItem>
			)}
			{!microphoneEnabled && (
				<div className="px-3 py-2 text-xs text-[var(--launch-text-muted)]">
					{t("recording.selectMicToEnable")}
				</div>
			)}
			{devices.map((device) => (
				<MicDeviceRow
					key={device.deviceId}
					device={device}
					selected={
						microphoneEnabled &&
						(microphoneDeviceId === device.deviceId ||
							selectedDeviceId === device.deviceId)
					}
					onSelect={() => onSelectDevice(device.deviceId)}
				/>
			))}
			{devices.length === 0 && (
				<div className="text-center text-xs text-[var(--launch-text-muted)] py-4">
					{t("recording.noMicrophonesFound")}
				</div>
			)}
		</HudPopover>
	);
}
