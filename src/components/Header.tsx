import { Link } from "@tanstack/react-router";
import { FlameKindling, MoveUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
	return (
		<header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
			<div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
				<div className="flex items-center gap-3">
					<div className="rounded-lg border p-2">
						<FlameKindling className="h-5 w-5" />
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide text-muted-foreground">
							Admin
						</p>
						<Link
							to="/"
							className="text-lg font-semibold transition hover:text-primary"
						>
							Feature Flags Console
						</Link>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
					<Button size="sm" asChild>
						<Link to="/create">
							<Plus className="h-4 w-4" />
							Создать новый флаг
						</Link>
					</Button>
					<a
						href="http://localhost:3000/docs"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition hover:border-primary hover:text-primary"
					>
						API docs
						<MoveUpRight className="h-4 w-4" />
					</a>
				</div>
			</div>
		</header>
	);
}
