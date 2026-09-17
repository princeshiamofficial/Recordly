import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type {
	ActivationResult,
	CamVerseEntitlements,
	CamVerseTier,
	LicenseStatusPayload,
} from "../lib/licensing/types";
import {
	FREE_ENTITLEMENTS,
	PRO_ENTITLEMENTS,
} from "../lib/licensing/types";

interface LicenseContextValue {
	tier: CamVerseTier;
	isPro: boolean;
	entitlements: CamVerseEntitlements;
	licenseState: LicenseStatusPayload | null;
	isLoading: boolean;
	isUpgradeModalOpen: boolean;
	upgradeFeatureHint: string | null;
	openUpgradeModal: (featureHint?: string) => void;
	closeUpgradeModal: () => void;
	activate: (key: string) => Promise<ActivationResult>;
	deactivate: () => Promise<boolean>;
	refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
	const [licenseState, setLicenseState] = useState<LicenseStatusPayload | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
	const [upgradeFeatureHint, setUpgradeFeatureHint] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (typeof window === "undefined" || !window.electronAPI?.getLicenseStatus) {
			setLicenseState({
				tier: "free",
				status: "free",
				entitlements: FREE_ENTITLEMENTS,
				isOffline: false,
			});
			setIsLoading(false);
			return;
		}

		try {
			const status = await window.electronAPI.getLicenseStatus();
			setLicenseState(status);
		} catch (error) {
			console.error("[LicenseContext] Failed to fetch license status:", error);
			setLicenseState({
				tier: "free",
				status: "free",
				entitlements: FREE_ENTITLEMENTS,
				isOffline: false,
			});
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const activate = useCallback(
		async (key: string): Promise<ActivationResult> => {
			if (!window.electronAPI?.activateLicense) {
				return { success: false, error: "Electron API not available." };
			}

			try {
				const result = await window.electronAPI.activateLicense(key);
				if (result.success && result.payload) {
					setLicenseState(result.payload);
					setIsUpgradeModalOpen(false);
				}
				return result;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Activation failed";
				return { success: false, error: msg };
			}
		},
		[],
	);

	const deactivate = useCallback(async (): Promise<boolean> => {
		if (!window.electronAPI?.deactivateLicense) {
			return false;
		}

		try {
			const result = await window.electronAPI.deactivateLicense();
			await refresh();
			return result.success;
		} catch {
			return false;
		}
	}, [refresh]);

	const openUpgradeModal = useCallback((featureHint?: string) => {
		setUpgradeFeatureHint(featureHint || null);
		setIsUpgradeModalOpen(true);
	}, []);

	const closeUpgradeModal = useCallback(() => {
		setIsUpgradeModalOpen(false);
		setUpgradeFeatureHint(null);
	}, []);

	const tier: CamVerseTier = licenseState?.tier ?? "free";
	const isPro = tier === "pro";
	const entitlements = isPro ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;

	const value = useMemo(
		() => ({
			tier,
			isPro,
			entitlements,
			licenseState,
			isLoading,
			isUpgradeModalOpen,
			upgradeFeatureHint,
			openUpgradeModal,
			closeUpgradeModal,
			activate,
			deactivate,
			refresh,
		}),
		[
			tier,
			isPro,
			entitlements,
			licenseState,
			isLoading,
			isUpgradeModalOpen,
			upgradeFeatureHint,
			openUpgradeModal,
			closeUpgradeModal,
			activate,
			deactivate,
			refresh,
		],
	);

	return (
		<LicenseContext.Provider value={value}>
			{children}
		</LicenseContext.Provider>
	);
}

export function useLicense(): LicenseContextValue {
	const context = useContext(LicenseContext);
	if (!context) {
		// Safe fallback for environments where LicenseProvider is not mounted
		return {
			tier: "free",
			isPro: false,
			entitlements: FREE_ENTITLEMENTS,
			licenseState: null,
			isLoading: false,
			isUpgradeModalOpen: false,
			upgradeFeatureHint: null,
			openUpgradeModal: () => {},
			closeUpgradeModal: () => {},
			activate: async () => ({ success: false, error: "No license context" }),
			deactivate: async () => false,
			refresh: async () => {},
		};
	}
	return context;
}
