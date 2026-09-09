import { StarIcon } from "@phosphor-icons/react";
import type { ReactElement } from "react";
import styles from "../LaunchWindow.module.css";
import { DropdownItem, HudPopover } from "./PopoverScaffold";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";

const POPOVER_ID = "quality";
const QUALITY_OPTIONS = [
	{ value: 1, label: "Low", description: "50% bitrate, faster encoding" },
	{ value: 2, label: "Medium", description: "Default balanced quality" },
	{ value: 3, label: "High", description: "150% bitrate, better quality" },
	{ value: 4, label: "Ultra", description: "300% bitrate, best quality" },
	{
		value: 5,
		label: "Pixel Perfect",
		description: "Near-lossless, full color depth",
	},
];

export function QualityPopover({
	trigger,
	recordingQuality,
	onSelectQuality,
}: {
	trigger: ReactElement;
	recordingQuality: number;
	onSelectQuality: (quality: number) => void;
}) {
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);

	return (
		<HudPopover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
					return;
				}
				requestOpen(POPOVER_ID);
			}}
			trigger={trigger}
			align="center"
		>
			<div className={styles.ddLabel}>Recording Quality</div>
			{QUALITY_OPTIONS.map((option) => (
				<DropdownItem
					key={option.value}
					icon={<StarIcon size={16} />}
					selected={recordingQuality === option.value}
					onClick={() => {
						onSelectQuality(option.value);
						requestClose(POPOVER_ID);
					}}
				>
					<div className="flex flex-col">
						<span>{option.label}</span>
						<span className="text-[10px] opacity-60">
							{option.description}
						</span>
					</div>
				</DropdownItem>
			))}
		</HudPopover>
	);
}
