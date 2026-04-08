/**
 * Helper to check if a value is nullish or not.
 */
export function isNullish<T>(value: T | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Pick a property from a type, and either return an empty object, or an object with a single, non-null and non-undefined member for that property.
 */
export function pickIfPresent<Type extends object, Property extends keyof Type, Return extends Type[Property]>(
  value: Type,
  property: Property,
): Return extends null | undefined ? object : { [key in Property]: Return };
export function pickIfPresent<Type extends object, Property extends keyof Type, Return extends Type[Property]>(
  value: Type,
  property: Property,
): object | { [key in Property]: Return } {
  const propertyValue = value[property];
  if (isNullish(propertyValue)) return {};
  return { [property]: propertyValue };
}

/**
 * Update the property on an existing object from an updated object, skipping the update if the value is undefined, and deleting the member if the value is null.
 */
export function updateNullish<
  ExistingType extends object,
  Property extends keyof ExistingType,
  UpdatedType extends { [key in Property]?: ExistingType[Property] | null | undefined },
>(existingObject: ExistingType, property: Property, newObject: UpdatedType) {
  const updatedValue = newObject[property];
  if (updatedValue !== undefined) {
    if (updatedValue === null) {
      delete existingObject[property];
    } else {
      existingObject[property] = updatedValue;
    }
  }
}

/**
 * Update the property on an existing object from an updated object, skipping the update if the value is undefined.
 */
export function updateOptional<
  ExistingType extends object,
  Property extends keyof ExistingType,
  UpdatedType extends { [key in Property]?: ExistingType[Property] | undefined },
>(existingObject: ExistingType, property: Property, newObject: UpdatedType) {
  const updatedValue = newObject[property];
  if (updatedValue !== undefined) {
    existingObject[property] = updatedValue;
  }
}
