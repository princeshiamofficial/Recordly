import { useEffect, useState } from "react";
import { CountdownOverlay } from "./components/countdown/CountdownOverlay";
import Dashboard from "./components/dashboard/Dashboard";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import { UpdateToastWindow } from "./components/launch/UpdateToastWindow";
import { Toaster } from "./components/ui/sonner";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { UpgradeProModal } from "./components/licensing/UpgradeProModal";
import { useI18n } from "./contexts/I18nContext";
import { LicenseProvider } from "./contexts/LicenseContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

export default function App() {
	const [windowType, setWindowType] = useState("");
	const { t } = useI18n();
	const isMacOS = /mac/i.test(navigator.platform);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const type = params.get("windowType") || "";
		setWindowType(type);
		document.documentElement.dataset.windowType = type;

		if (
			type === "hud-overlay" ||
			type === "source-selector" ||
			type === "countdown" ||
			(type === "update-toast" && isMacOS)
		) {
			document.body.style.background = "transparent";
			document.documentElement.style.background = "transparent";
			document.getElementById("root")?.style.setProperty("background", "transparent");
		}

		if (type === "hud-overlay") {
			document.documentElement.classList.add("hud-overlay-window");
			document.body.classList.add("hud-overlay-window");
			document.getElementById("root")?.classList.add("hud-overlay-window");
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
		} else if (type === "update-toast") {
			document.documentElement.style.overflow = "visible";
			document.body.style.overflow = "visible";
			document.getElementById("root")?.style.setProperty("overflow", "visible");
		}

		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, []);

	useEffect(() => {
		document.title =
			windowType === "editor"
				? t("app.editorTitle", "CamVerse Editor")
				: t("app.name", "CamVerse");
	}, [windowType, t]);

	switch (windowType) {
		case "hud-overlay":
			return (
				<LicenseProvider>
					<LaunchWindow />
					<Toaster className="pointer-events-auto" />
					<UpgradeProModal />
				</LicenseProvider>
			);
		case "source-selector":
			return <SourceSelector />;
		case "countdown":
			return <CountdownOverlay />;
		case "update-toast":
			return <UpdateToastWindow />;
		case "editor":
			return (
				<LicenseProvider>
					<ShortcutsProvider>
						<VideoEditor />
						<ShortcutsConfigDialog />
						<UpgradeProModal />
					</ShortcutsProvider>
				</LicenseProvider>
			);
		default:
			return (
				<LicenseProvider>
					<Dashboard />
					<UpgradeProModal />
				</LicenseProvider>
			);
	}
}
