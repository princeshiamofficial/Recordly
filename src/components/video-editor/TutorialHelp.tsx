import {
	ArrowRight,
	ArrowSquareOut as ExternalLink,
	FacebookLogo,
	Question as HelpCircle,
	Keyboard,
	ChatDots as MessageSquareMore,
	Scissors,
	GearSix as Settings2,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { formatBinding, SHORTCUT_ACTIONS, SHORTCUT_LABELS } from "@/lib/shortcuts";
import { formatShortcut } from "@/utils/platformUtils";
import { toast } from "sonner";

export const RECORDLY_ISSUES_URL = "https://github.com/princeshiamofficial/Recordly/issues";
const RECORDLY_TELEGRAM_URL = "https://t.me/MehanBro";
const RECORDLY_FACEBOOK_URL = "https://www.facebook.com/mehanahmed.me";
const CONTACT_EMAIL = "mehan.ahmed.official@gmail.com";
export const APP_HEADER_ACTION_BUTTON_CLASS =
	"h-7 px-2 text-xs text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all gap-1.5";
export const APP_HEADER_ICON_BUTTON_CLASS =
	"h-7 w-7 p-0 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all";

interface KeyboardShortcutsDialogProps {
	triggerLabel?: string;
	triggerClassName?: string;
}

function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.66-2.89 8.01-3.46 3.81-1.61 4.6-1.89 5.12-1.9.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.24-.04.38z" />
		</svg>
	);
}

export async function openExternalLink(url: string, errorMessage: string) {
	try {
		const result = await window.electronAPI.openExternalUrl(url);
		if (!result.success) {
			toast.error(result.error || errorMessage);
		}
	} catch (error) {
		toast.error(`${errorMessage} ${String(error)}`);
	}
}

export function TelegramLinkButton() {
	const t = useScopedT("editor");

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={() =>
				void openExternalLink(
					RECORDLY_TELEGRAM_URL,
					t("feedback.openFailed", "Failed to open link."),
				)
			}
			className={APP_HEADER_ICON_BUTTON_CLASS}
			title={t("common.app.telegram", "Join Telegram")}
			aria-label={t("common.app.telegram", "Join Telegram")}
		>
			<TelegramIcon className="h-3.5 w-3.5" />
		</Button>
	);
}

export function FeedbackDialog() {
	const t = useScopedT("editor");

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={APP_HEADER_ICON_BUTTON_CLASS}
					title={t("feedback.trigger", "Feedback")}
					aria-label={t("feedback.trigger", "Feedback")}
				>
					<MessageSquareMore className="h-3.5 w-3.5" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg bg-editor-dialog border-foreground/10 [&>button]:text-muted-foreground [&>button:hover]:text-foreground">
				<DialogHeader>
					<DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
						<MessageSquareMore className="h-5 w-5 text-[#2563EB]" />{" "}
						{t("feedback.title", "Feedback & contact")}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"feedback.description",
							"Reach out directly or open an issue if something is broken or missing.",
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-4">
					<div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-3">
						<div className="flex items-center justify-between gap-3 rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-3">
							<div>
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
									{t("feedback.emailLabel", "Email")}
								</p>
								<p className="mt-1 text-sm font-medium text-foreground">
									{CONTACT_EMAIL}
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									void openExternalLink(
										`mailto:${CONTACT_EMAIL}`,
										t("feedback.openFailed", "Failed to open link."),
									)
								}
								className="border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</Button>
						</div>
						<div className="flex items-center justify-between gap-3 rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-3">
							<div>
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
									{t("feedback.facebookLabel", "Facebook")}
								</p>
								<p className="mt-1 text-sm font-medium text-foreground">
									mehanahmed.me
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									void openExternalLink(
										RECORDLY_FACEBOOK_URL,
										t("feedback.openFailed", "Failed to open link."),
									)
								}
								className="border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								<FacebookLogo className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							void openExternalLink(
								RECORDLY_ISSUES_URL,
								t("feedback.openFailed", "Failed to open link."),
							)
						}
						className="h-10 w-full justify-between border-foreground/10 bg-foreground/5 px-4 text-foreground hover:bg-foreground/10 hover:text-foreground"
					>
						<span className="flex items-center gap-2 text-sm font-medium">
							<MessageSquareMore className="h-4 w-4" />
							{t("feedback.reportIssue", "Report issue / send feedback")}
						</span>
						<ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70" />
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function KeyboardShortcutsDialog({
	triggerLabel,
	triggerClassName,
}: KeyboardShortcutsDialogProps) {
	const { shortcuts, isMac, openConfig } = useShortcuts();
	const t = useScopedT("editor");
	const [scrollLabels, setScrollLabels] = useState({
		pan: "Shift + Scroll",
		zoom: "Ctrl + Scroll",
	});

	useEffect(() => {
		Promise.all([formatShortcut(["shift", "Scroll"]), formatShortcut(["mod", "Scroll"])]).then(
			([pan, zoom]) => setScrollLabels({ pan, zoom }),
		);
	}, []);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={triggerClassName ?? APP_HEADER_ICON_BUTTON_CLASS}
					title={t("keyboardShortcuts.trigger", "Shortcuts")}
					aria-label={t("keyboardShortcuts.trigger", "Shortcuts")}
				>
					<Keyboard className="h-3.5 w-3.5" />
					{triggerLabel ? <span className="font-medium">{triggerLabel}</span> : null}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg bg-editor-dialog border-foreground/10 [&>button]:text-muted-foreground [&>button:hover]:text-foreground">
				<DialogHeader>
					<DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
						<Keyboard className="h-5 w-5 text-[#2563EB]" />{" "}
						{t("keyboardShortcuts.title")}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"keyboardShortcuts.description",
							"Quick reference for the timeline and editor controls.",
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-4">
					<div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-2 text-xs">
						{SHORTCUT_ACTIONS.map((action) => (
							<div
								key={action}
								className="flex items-center justify-between gap-3 rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-2.5"
							>
								<span className="text-muted-foreground">
									{SHORTCUT_LABELS[action]}
								</span>
								<kbd className="rounded border border-foreground/10 bg-foreground/10 px-2 py-1 font-mono text-[#2563EB]">
									{formatBinding(shortcuts[action], isMac)}
								</kbd>
							</div>
						))}
						<div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
							<div className="rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-2.5">
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
									{t("keyboardShortcuts.panTimeline")}
								</p>
								<kbd className="mt-2 inline-flex rounded border border-foreground/10 bg-foreground/10 px-2 py-1 font-mono text-[#2563EB]">
									{scrollLabels.pan}
								</kbd>
							</div>
							<div className="rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-2.5">
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
									{t("keyboardShortcuts.zoomTimeline")}
								</p>
								<kbd className="mt-2 inline-flex rounded border border-foreground/10 bg-foreground/10 px-2 py-1 font-mono text-[#2563EB]">
									{scrollLabels.zoom}
								</kbd>
							</div>
							<div className="rounded-lg border border-foreground/5 bg-foreground/5 px-3 py-2.5">
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
									{t("keyboardShortcuts.cycleAnnotations")}
								</p>
								<kbd className="mt-2 inline-flex rounded border border-foreground/10 bg-foreground/10 px-2 py-1 font-mono text-[#2563EB]">
									{t("keyboardShortcuts.tab")}
								</kbd>
							</div>
						</div>
					</div>
					<div className="flex justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={openConfig}
							className="border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:text-foreground"
						>
							<Settings2 className="h-4 w-4" />
							{t("keyboardShortcuts.customize")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function TutorialHelp() {
	const t = useScopedT("editor");

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm" className={APP_HEADER_ACTION_BUTTON_CLASS}>
					<HelpCircle className="w-3.5 h-3.5" />
					<span className="font-medium">{t("tutorial.howTrimmingWorks")}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl bg-editor-dialog border-foreground/10 [&>button]:text-muted-foreground [&>button:hover]:text-foreground">
				<DialogHeader>
					<DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
						<Scissors className="w-5 h-5 text-[#ef4444]" /> {t("tutorial.title")}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t("tutorial.understanding")}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-8">
					{/* Explanation */}
					<div className="bg-foreground/5 rounded-lg p-4 border border-foreground/5">
						<p className="text-muted-foreground leading-relaxed">
							{t("tutorial.descriptionP1")}
							<span className="text-[#ef4444] font-bold">
								{" "}
								{t("tutorial.descriptionRemove")}
							</span>
							. {t("tutorial.descriptionP3")}
						</p>
					</div>
					{/* Visual Illustration */}
					<div className="space-y-2">
						<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
							{t("tutorial.visualExample")}
						</h3>
						<div className="relative h-24 bg-[#000] rounded-lg border border-foreground/10 flex items-center px-4 overflow-hidden select-none">
							{/* Background track (Kept parts) */}
							<div className="absolute inset-x-4 h-2 bg-slate-600 rounded-full overflow-hidden">
								{/* Solid line representing video */}
							</div>
							{/* Removed Segment 1 */}
							<div
								className="absolute left-[20%] h-8 bg-[#ef4444]/20 border border-[#ef4444] rounded flex flex-col items-center justify-center z-10"
								style={{ width: "20%" }}
							>
								<span className="text-[10px] font-bold text-[#ef4444] bg-black/50 px-1 rounded">
									{t("tutorial.removed")}
								</span>
							</div>
							{/* Removed Segment 2 */}
							<div
								className="absolute left-[65%] h-8 bg-[#ef4444]/20 border border-[#ef4444] rounded flex flex-col items-center justify-center z-10"
								style={{ width: "15%" }}
							>
								<span className="text-[10px] font-bold text-[#ef4444] bg-black/50 px-1 rounded">
									{t("tutorial.removed")}
								</span>
							</div>
							{/* Labels for kept parts */}
							<div className="absolute left-[5%] text-[10px] text-muted-foreground font-medium">
								{t("tutorial.kept")}
							</div>
							<div className="absolute left-[50%] text-[10px] text-muted-foreground font-medium">
								{t("tutorial.kept")}
							</div>
							<div className="absolute left-[90%] text-[10px] text-muted-foreground font-medium">
								{t("tutorial.kept")}
							</div>
						</div>
						<div className="flex justify-center mt-2">
							<ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
						</div>
						{/* Result */}
						<div className="relative h-12 bg-[#000] rounded-lg border border-foreground/10 flex items-center justify-center gap-1 px-4 select-none">
							<div
								className="h-8 bg-slate-700 rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-[10px] text-white font-medium">
									{t("tutorial.part", undefined, { number: "1" })}
								</span>
							</div>
							<div
								className="h-8 bg-slate-700 rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-[10px] text-white font-medium">
									{t("tutorial.part", undefined, { number: "2" })}
								</span>
							</div>
							<div
								className="h-8 bg-slate-700 rounded flex items-center justify-center opacity-80"
								style={{ width: "30%" }}
							>
								<span className="text-[10px] text-white font-medium">
									{t("tutorial.part", undefined, { number: "3" })}
								</span>
							</div>
							<span className="absolute right-4 text-xs text-muted-foreground">
								{t("tutorial.finalVideo")}
							</span>
						</div>
					</div>
					{/* Steps */}
					<div className="grid grid-cols-2 gap-4">
						<div className="p-3 rounded bg-foreground/5 border border-foreground/5">
							<div className="text-[#ef4444] font-bold mb-1">
								{t("tutorial.addTrimStep")}
							</div>
							<p className="text-xs text-muted-foreground">
								{t("tutorial.addTrimDesc")}
							</p>
						</div>
						<div className="p-3 rounded bg-foreground/5 border border-foreground/5">
							<div className="text-[#ef4444] font-bold mb-1">
								{t("tutorial.adjustStep")}
							</div>
							<p className="text-xs text-muted-foreground">
								{t("tutorial.adjustDesc")}
							</p>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
