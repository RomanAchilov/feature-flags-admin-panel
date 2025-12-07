import type React from "react";

export function Select(props: React.ComponentProps<"select">) {
	return <select {...props} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
	return <textarea {...props} />;
}

export function TextField(props: React.ComponentProps<"input">) {
	return <input {...props} />;
}

export function SubscribeButton(props: React.ComponentProps<"button">) {
	return <button type="button" {...props} />;
}
