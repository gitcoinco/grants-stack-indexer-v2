export class ServiceNotStarted extends Error {
    constructor(serviceName: string) {
        super(`${serviceName} is not started`);
    }
}
