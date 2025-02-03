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
 * Type guard to check if a value is an object
 * @param item The value to check
 * @returns True if the value is an object, false otherwise
 */
function isObject(item: unknown): item is ObjectType {
    return item !== null && typeof item === "object" && !Array.isArray(item);
}

export function isJSON(item: unknown): item is ObjectType {
    try {
        JSON.parse(item as string);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}
