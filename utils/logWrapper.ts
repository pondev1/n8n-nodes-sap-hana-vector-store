import { IExecuteFunctions, NodeConnectionTypes } from 'n8n-workflow';
import { logAiEvent } from './helpers';

/**
 * Wrap an object with logging capabilities for monitoring and debugging
 */
export function logWrapper<T extends object>(
	target: T,
	context: IExecuteFunctions,
	options?: {
		logMethodCalls?: boolean;
		logErrors?: boolean;
		prefix?: string;
	},
): T {
	const {
		logMethodCalls = false,
		logErrors = true,
		prefix = '[Vector Store]',
	} = options || {};

	// Get node name for better logging context
	const nodeName = context.getNode().name;
	const logPrefix = `${prefix} ${nodeName}`;

	// Check if it's a DynamicTool for special handling
	const isDynamicTool = target.constructor?.name === 'DynamicTool' || 
		(target as any)._call !== undefined;
	

	// Create a proxy to intercept method calls and property access
	return new Proxy(target, {
		get(targetObj: any, prop: string | symbol) {
			const originalValue = targetObj[prop];

			// If it's not a function, return as-is
			if (typeof originalValue !== 'function') {
				return originalValue;
			}

			// Special handling for DynamicTool's invoke method
			if (isDynamicTool && prop === 'invoke') {
				return async function (input: string) {
					const { index } = context.addInputData(NodeConnectionTypes.AiTool, [
						[{ json: { query: input } }]
					]);

					try {
						// Call the original method
						const response = await originalValue.apply(targetObj, [input]);

						// Log AI event
						logAiEvent(context, 'ai-tool-called', { 
							tool: targetObj.name,
							query: input,
							response 
						});

						// Add output data for visual feedback
						context.addOutputData(NodeConnectionTypes.AiTool, index, [[{ json: { response } }]]);

						return response;
					} catch (error) {
						// Add error output data
						const errorMessage = error instanceof Error ? error.message : String(error);
						context.addOutputData(NodeConnectionTypes.AiTool, index, [[{ 
							json: { 
								error: errorMessage,
								tool: targetObj.name
							} 
						}]]);
						throw error;
					}
				};
			}

			// Default function wrapping with logging
			return function (...args: any[]) {
				const methodName = String(prop);
				
				try {
					if (logMethodCalls) {
						console.log(`${logPrefix} Calling method: ${methodName}`);
					}

					// Call the original method
					const result = originalValue.apply(targetObj, args);

					// Handle promises
					if (result && typeof result.then === 'function') {
						return result.catch((error: any) => {
							if (logErrors) {
								console.error(`${logPrefix} Error in ${methodName}:`, error);
							}
							throw error;
						});
					}

					return result;
				} catch (error) {
					if (logErrors) {
						console.error(`${logPrefix} Error in ${methodName}:`, error);
					}
					throw error;
				}
			};
		},
	});
}

/**
 * Create a logging wrapper specifically for vector stores
 */
export function createVectorStoreLogger<T extends object>(
	vectorStore: T,
	context: IExecuteFunctions,
): T {
	return logWrapper(vectorStore, context, {
		logMethodCalls: process.env.NODE_ENV === 'development',
		logErrors: true,
		prefix: '[Vector Store]',
	});
}

/**
 * Create a logging wrapper specifically for AI tools
 */
export function createToolLogger<T extends object>(
	tool: T,
	context: IExecuteFunctions,
): T {
	return logWrapper(tool, context, {
		logMethodCalls: process.env.NODE_ENV === 'development',
		logErrors: true,
		prefix: '[AI Tool]',
	});
}

/**
 * Simple performance logging utility
 */
export function withPerformanceLogging<T extends (...args: any[]) => any>(
	fn: T,
	context: IExecuteFunctions,
	operationName: string,
): T {
	return ((...args: any[]) => {
		const startTime = Date.now();
		const nodeName = context.getNode().name;
		
		try {
			const result = fn(...args);
			
			// Handle promises
			if (result && typeof result.then === 'function') {
				return result.finally(() => {
					const duration = Date.now() - startTime;
					console.log(`[Performance] ${nodeName} - ${operationName}: ${duration}ms`);
				});
			}
			
			const duration = Date.now() - startTime;
			console.log(`[Performance] ${nodeName} - ${operationName}: ${duration}ms`);
			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.log(`[Performance] ${nodeName} - ${operationName} (failed): ${duration}ms`);
			throw error;
		}
	}) as T;
}