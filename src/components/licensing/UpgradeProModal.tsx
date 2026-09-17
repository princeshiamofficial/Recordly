import {
	ArrowSquareOut,
	CheckCircle,
	CircleNotch,
	Crown,
	Key,
	ShieldCheck,
	Sparkle,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLicense } from "@/contexts/LicenseContext";

const CAMVERSE_PORTAL_URL = "https://camverse.pages.dev/#pricing";

export function UpgradeProModal() {
	const { isUpgradeModalOpen, closeUpgradeModal, upgradeFeatureHint, activate, isPro } =
		useLicense();

	const [licenseKeyInput, setLicenseKeyInput] = useState("");
	const [isActivating, setIsActivating] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [showKeyInput, setShowKeyInput] = useState(false);

	if (isPro) {
		return null;
	}

	const handleOpenCheckout = () => {
		if (typeof window !== "undefined") {
			window.open(CAMVERSE_PORTAL_URL, "_blank");
		}
	};

	const handleActivate = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedKey = licenseKeyInput.trim();
		if (!trimmedKey) {
			setErrorMessage("Please enter your license key.");
			return;
		}

		setIsActivating(true);
		setErrorMessage(null);
		setSuccessMessage(null);

		try {
			const res = await activate(trimmedKey);
			if (res.success) {
				setSuccessMessage("CamVerse Pro activated successfully!");
				setTimeout(() => {
					closeUpgradeModal();
					setLicenseKeyInput("");
					setSuccessMessage(null);
					setShowKeyInput(false);
				}, 1200);
			} else {
				setErrorMessage(res.error || "Activation failed. Please check your key.");
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Failed to activate license.");
		} finally {
			setIsActivating(false);
		}
	};

	// Determine feature headline based on user action
	let featureHeadline = "Unlock the Full Creative Power of CamVerse";
	let featureSubheadline =
		"Faster rendering, pristine high-resolution exports, and professional creator tools.";

	if (upgradeFeatureHint === "4k_export") {
		featureHeadline = "Export in Stunning 4K & 8K UHD";
		featureSubheadline =
			"Ultra-high definition rendering with razor-sharp text and pixel-perfect clarity.";
	} else if (upgradeFeatureHint === "watermark") {
		featureHeadline = "Export 100% Watermark-Free";
		featureSubheadline =
			"Deliver clean, professional videos for your clients, audience, and portfolio.";
	} else if (upgradeFeatureHint === "native_gpu") {
		featureHeadline = "Native GPU Hardware Compositor";
		featureSubheadline =
			"Harness dedicated NVIDIA NVENC, Direct3D11, and hardware acceleration.";
	}

	return (
		<Dialog
			open={isUpgradeModalOpen}
			onOpenChange={(open) => {
				if (!open) {
					closeUpgradeModal();
					setErrorMessage(null);
					setSuccessMessage(null);
				}
			}}
		>
			<DialogContent className="max-w-md border-foreground/10 bg-editor-surface p-6 text-foreground shadow-2xl backdrop-blur-xl sm:rounded-2xl">
				<DialogHeader className="flex flex-col items-center text-center">
					<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-black shadow-lg shadow-amber-500/20">
						<Crown weight="fill" className="h-6 w-6" />
					</div>
					<DialogTitle className="text-xl font-bold tracking-tight">
						{featureHeadline}
					</DialogTitle>
					<DialogDescription className="mt-1.5 text-xs text-muted-foreground">
						{featureSubheadline}
					</DialogDescription>
				</DialogHeader>

				<div className="my-2 space-y-2.5 rounded-xl border border-foreground/5 bg-foreground/5 p-3.5 text-xs">
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>Unlimited Recording Duration (No 5-Min Limit)</span>
					</div>
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>4K (2160p) & 8K (4320p) Ultra High Definition Export</span>
					</div>
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>100% Watermark-Free Clean Video Output</span>
					</div>
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>Dedicated Hardware Compositor (NVENC / D3D11 / QuickSync)</span>
					</div>
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>AI Auto-Subtitles & Word-by-Word Kinetic Captions</span>
					</div>
					<div className="flex items-center gap-2.5 font-medium">
						<CheckCircle weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />
						<span>Professional ProRes, VP9, AV1 & Bitrate Tuning</span>
					</div>
				</div>

				<div className="flex flex-col gap-2 pt-1">
					<Button
						type="button"
						onClick={handleOpenCheckout}
						className="h-10 w-full gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-black shadow-md hover:from-amber-400 hover:to-amber-500"
					>
						<Sparkle weight="fill" className="h-4 w-4" />
						Get CamVerse Pro
						<ArrowSquareOut weight="bold" className="h-3.5 w-3.5 opacity-75" />
					</Button>

					{!showKeyInput ? (
						<button
							type="button"
							onClick={() => setShowKeyInput(true)}
							className="mt-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							<Key className="h-3.5 w-3.5" />
							Already have a license key? Enter key
						</button>
					) : (
						<form onSubmit={handleActivate} className="mt-2 space-y-2">
							<div className="flex gap-2">
								<Input
									type="text"
									placeholder="Paste your license key (e.g. CAM-PRO-XXXX)"
									value={licenseKeyInput}
									onChange={(e) => setLicenseKeyInput(e.target.value)}
									className="h-9 text-xs rounded-lg border-foreground/10 bg-foreground/5 font-mono"
									disabled={isActivating}
									autoFocus
								/>
								<Button
									type="submit"
									disabled={isActivating || !licenseKeyInput.trim()}
									className="h-9 px-4 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
								>
									{isActivating ? (
										<CircleNotch className="h-4 w-4 animate-spin" />
									) : (
										"Activate"
									)}
								</Button>
							</div>

							{errorMessage ? (
								<p className="text-[11px] font-medium text-red-500">
									{errorMessage}
								</p>
							) : null}

							{successMessage ? (
								<p className="flex items-center gap-1 text-[11px] font-medium text-green-500">
									<ShieldCheck weight="fill" className="h-3.5 w-3.5" />
									{successMessage}
								</p>
							) : null}
						</form>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
