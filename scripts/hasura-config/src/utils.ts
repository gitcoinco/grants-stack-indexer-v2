/**
 * Converts snake_case to camelCase.
 * @param str - The string to convert to camel case.
 * @returns The camel case string.
 */
export const snakeToCamelCase = (str: string): string => {
    return str.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
};

/**
 * Converts camelCase to snake_case.
 * @param str - The string to convert to snake case.
 * @returns The snake case string.
 */
export const camelToSnakeCase = (str: string): string => {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
};

/**
 * Singularizes a word.
 * @param word - The word to singularize.
 * @returns The singularized word.
 */
export const singularize = (word: string): string => {
    return word.endsWith("s") ? word.slice(0, -1) : word;
};
