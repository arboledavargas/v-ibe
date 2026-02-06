export type Constructor<T = {}> = new (...args: any[]) => T;

export interface OnBootstrap {
    onBootstrap(): Promise<void>;
}