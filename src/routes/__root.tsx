import { createRootRoute, Outlet } from "@tanstack/react-router";

import Header from "../components/Header";
import { Toaster } from "../components/ui/sonner";

export const Route = createRootRoute({
	component: () => (
		<>
			<Header />
			<Outlet />
			<Toaster position="top-right" richColors closeButton />
		</>
	),
});
