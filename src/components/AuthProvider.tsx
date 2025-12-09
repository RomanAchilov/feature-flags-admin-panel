import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { initKeycloak, isFeatureFlagsAdmin } from "../lib/keycloak";

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "dev";

type AuthProviderProps = {
	children: ReactNode;
};

function LoadingScreen() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-zinc-950">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4" />
				<p className="text-zinc-400">Загрузка...</p>
			</div>
		</div>
	);
}

function AccessDenied() {
	const { logout, user } = useAuth();

	return (
		<div className="min-h-screen flex items-center justify-center bg-zinc-950">
			<div className="text-center max-w-md p-8 bg-zinc-900 rounded-lg border border-zinc-800">
				<div className="text-red-500 text-5xl mb-4">🚫</div>
				<h1 className="text-xl font-bold text-zinc-100 mb-2">Доступ запрещён</h1>
				<p className="text-zinc-400 mb-4">
					У вас нет роли <code className="text-emerald-400">feature-flags-admin</code> для доступа к админ-панели.
				</p>
				{user && (
					<p className="text-zinc-500 text-sm mb-4">
						Вы вошли как: <span className="text-zinc-300">{user.username}</span>
						<br />
						Ваши роли: <span className="text-zinc-300">{user.roles.join(", ") || "нет"}</span>
					</p>
				)}
				<button
					type="button"
					onClick={logout}
					className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-md transition-colors"
				>
					Выйти и войти другим пользователем
				</button>
			</div>
		</div>
	);
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [loading, setLoading] = useState(AUTH_MODE === "keycloak");
	const { initialized, authenticated } = useAuth();

	useEffect(() => {
		if (AUTH_MODE === "keycloak") {
			initKeycloak().finally(() => setLoading(false));
		}
	}, []);

	// Dev mode: пропускаем аутентификацию
	if (AUTH_MODE !== "keycloak") {
		return <>{children}</>;
	}

	// Keycloak mode
	if (loading || !initialized) {
		return <LoadingScreen />;
	}

	if (!authenticated) {
		return <LoadingScreen />;
	}

	// Проверяем роль
	if (!isFeatureFlagsAdmin()) {
		return <AccessDenied />;
	}

	return <>{children}</>;
}

