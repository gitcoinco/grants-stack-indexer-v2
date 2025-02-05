// Define a type for objects
type ObjectType = Record<string, unknown>;

// Helper type to create a deep partial type
export type DeepPartial<T> = T extends ObjectType ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * Deeply merges a partial source object into a target object.
 * @param target The target object to merge into
 * @param source The source object to merge from (can be partial)
 * @returns A new object with the merged properties
 */
export function mergeDeep<T extends ObjectType>(target: T, source: DeepPartial<T>): T {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((key) => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key as keyof T] = mergeDeep(
                        target[key as keyof T] as ObjectType,
                        source[key] as DeepPartial<ObjectType>,
                    ) as T[keyof T];
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Determines whether the provided value is a non-null object that is not an array.
 *
 * This type guard checks that the value is of type "object", is not null, and explicitly excludes arrays.
 * It is useful for ensuring a value conforms to an object shape before performing object-specific operations.
 *
 * @param item - The value to check.
 * @returns True if `item` is a non-null object and not an array; otherwise, false.
 *
 * @example
 * ```typescript
 * const value: unknown = { key: 'value' };
 * if (isObject(value)) {
 *   // Within this block, TypeScript treats `value` as an object.
 * }
 * ```
 */
function isObject(item: unknown): item is ObjectType {
    return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Determines whether the provided value can be parsed as a valid JSON string.
 *
 * This function attempts to parse the input as a JSON string. If parsing is successful,
 * it returns `true` (indicating that the input conforms to JSON structure and is thus considered a valid JSON object).
 * If parsing fails, it logs the error to the console and returns `false`.
 *
 * @param item - The value to test for valid JSON structure.
 * @returns `true` if the input can be successfully parsed as JSON; otherwise, `false`.
 *
 * @example
 * const jsonString = '{"name": "Alice", "age": 30}';
 * if (isJSON(jsonString)) {
 *   // jsonString is a valid JSON and now inferred to be of ObjectType
 * }
 */
export function isJSON(item: unknown): item is ObjectType {
    try {
        JSON.parse(item as string);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}
