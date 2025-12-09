import { useEffect, useState } from "react";
import {
	type AuthState,
	getAuthState,
	getToken,
	hasRole,
	isFeatureFlagsAdmin,
	login,
	logout,
	subscribeToAuth,
} from "../lib/keycloak";

/**
 * Hook для работы с аутентификацией Keycloak
 */
export function useAuth() {
	const [state, setState] = useState<AuthState>(getAuthState);

	useEffect(() => {
		return subscribeToAuth(setState);
	}, []);

	return {
		...state,
		login,
		logout,
		getToken,
		hasRole,
		isFeatureFlagsAdmin,
	};
}
