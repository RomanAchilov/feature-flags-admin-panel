import { useSyncExternalStore } from "react";

export function create(createState) {
        const listeners = new Set();

        const store = {
                state: undefined,
        };

        const setState = (partial, replace) => {
                const nextState =
                        typeof partial === "function" ? partial(store.state) : partial;

                if (nextState === null || nextState === undefined) {
                        return;
                }

                store.state = replace ? nextState : { ...store.state, ...nextState };
                listeners.forEach((listener) => listener());
        };

        const getState = () => store.state;

        const subscribe = (listener) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
        };

        const api = { setState, getState, subscribe };
        store.state = createState(setState, getState, api);

        const useBoundStore = (selector = (state) => state) =>
                useSyncExternalStore(subscribe, () => selector(store.state));

        return Object.assign(useBoundStore, api);
}
