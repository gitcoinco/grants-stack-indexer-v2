export class NoClosePriceFound extends Error {
    constructor() {
        super(`No close price found`);
    }
}
