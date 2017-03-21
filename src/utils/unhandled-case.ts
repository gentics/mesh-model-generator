/**
 * Helper function to find uncaught cases at compile-time.
 *
 * @example
 * declare var myVar: 'first' | 'second' | 'unhandled';
 * switch (myVar) {
 *     case 'first': handleFirstCase(); break;
 *     case 'second': handleSecondCase(); break;
 *     // TypeScript will emit an error if not all cases are handled
 *     default: unhandledCase(myVar);
 * }
 */
export function unhandledCase(unhandled: never, propertyToShow?: string): any {
    const context = (propertyToShow && unhandled)
        ? propertyToShow + ' = ' + (unhandled as any)[propertyToShow]
        : unhandled;
    throw new Error('unhandled case (' + context + ').'
        + '\n  typeof input: ' + typeof unhandled
        + '\n  input: ' + unhandled);
}