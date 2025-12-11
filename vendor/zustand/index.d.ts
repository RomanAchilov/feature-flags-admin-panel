export type StateCreator<T> = (
        set: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void,
        get: () => T,
        api: StoreApi<T>,
) => T;

export type StoreApi<T> = {
        getState: () => T;
        setState: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
        subscribe: (listener: () => void) => () => void;
};

export type UseBoundStore<T> = StoreApi<T> & {
        <U = T>(selector?: (state: T) => U): U;
};

export function create<T>(initializer: StateCreator<T>): UseBoundStore<T>;
