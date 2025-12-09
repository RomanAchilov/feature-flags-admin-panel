import Keycloak from "keycloak-js";

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация Keycloak
// ─────────────────────────────────────────────────────────────────────────────

const KEYCLOAK_URL =
	import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080";
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || "FeatureFlags";
const KEYCLOAK_CLIENT_ID =
	import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "feature-flags-api";

// ─────────────────────────────────────────────────────────────────────────────
// Keycloak Instance
// ─────────────────────────────────────────────────────────────────────────────

export const keycloak = new Keycloak({
	url: KEYCLOAK_URL,
	realm: KEYCLOAK_REALM,
	clientId: KEYCLOAK_CLIENT_ID,
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth State
// ─────────────────────────────────────────────────────────────────────────────

export type AuthState = {
	initialized: boolean;
	authenticated: boolean;
	token: string | null;
	user: {
		id: string;
		username: string;
		email?: string;
		name?: string;
		roles: string[];
	} | null;
};

let authState: AuthState = {
	initialized: false,
	authenticated: false,
	token: null,
	user: null,
};

const listeners = new Set<(state: AuthState) => void>();

const notifyListeners = () => {
	for (const listener of listeners) {
		listener(authState);
	}
};

export const subscribeToAuth = (
	listener: (state: AuthState) => void,
): (() => void) => {
	listeners.add(listener);
	listener(authState);
	return () => {
		listeners.delete(listener);
	};
};

export const getAuthState = () => authState;

// ─────────────────────────────────────────────────────────────────────────────
// Инициализация
// ─────────────────────────────────────────────────────────────────────────────

const updateAuthState = () => {
	const tokenParsed = keycloak.tokenParsed as
		| {
				sub?: string;
				preferred_username?: string;
				email?: string;
				name?: string;
				realm_access?: { roles?: string[] };
		  }
		| undefined;

	authState = {
		initialized: true,
		authenticated: keycloak.authenticated ?? false,
		token: keycloak.token ?? null,
		user:
			keycloak.authenticated && tokenParsed
				? {
						id: tokenParsed.sub ?? "",
						username: tokenParsed.preferred_username ?? "",
						email: tokenParsed.email,
						name: tokenParsed.name,
						roles: tokenParsed.realm_access?.roles ?? [],
					}
				: null,
	};
	notifyListeners();
};

export const initKeycloak = async (): Promise<boolean> => {
	try {
		const authenticated = await keycloak.init({
			onLoad: "login-required",
			checkLoginIframe: false,
			pkceMethod: "S256",
		});

		updateAuthState();

		// Автоматическое обновление токена
		keycloak.onTokenExpired = () => {
			keycloak
				.updateToken(30)
				.then((refreshed) => {
					if (refreshed) {
						updateAuthState();
					}
				})
				.catch(() => {
					console.error("Не удалось обновить токен");
					logout();
				});
		};

		keycloak.onAuthRefreshSuccess = updateAuthState;
		keycloak.onAuthRefreshError = () => {
			console.error("Ошибка обновления токена");
			logout();
		};

		return authenticated;
	} catch (error) {
		console.error("Keycloak init failed:", error);
		authState = { ...authState, initialized: true };
		notifyListeners();
		return false;
	}
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth Actions
// ─────────────────────────────────────────────────────────────────────────────

export const login = () => keycloak.login();

export const logout = () =>
	keycloak.logout({ redirectUri: window.location.origin });

export const getToken = async (): Promise<string | null> => {
	if (!keycloak.authenticated) return null;

	// Обновляем токен если он истекает в течение 30 секунд
	try {
		await keycloak.updateToken(30);
		return keycloak.token ?? null;
	} catch {
		return keycloak.token ?? null;
	}
};

// ─────────────────────────────────────────────────────────────────────────────
// Проверка роли
// ─────────────────────────────────────────────────────────────────────────────

export const hasRole = (role: string): boolean => {
	return authState.user?.roles.includes(role) ?? false;
};

export const isFeatureFlagsAdmin = (): boolean => {
	return hasRole("feature-flags-admin");
};
