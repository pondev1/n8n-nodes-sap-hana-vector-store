import { IExecuteFunctions } from 'n8n-workflow';

/**
 * Log AI events for tracking and analytics
 */
export function logAiEvent(
	context: IExecuteFunctions,
	eventName: string,
	payload?: Record<string, any>,
): void {
	try {
		// In a real implementation, this would send telemetry data
		// For now, we'll just log to console in development
		if (process.env.NODE_ENV === 'development') {
			console.log(`[AI Event] ${eventName}`, payload || {});
		}

		// Could extend this to send to n8n's telemetry system
		// or external analytics services in the future
	} catch (error) {
		// Don't throw errors for logging failures
		console.warn('Failed to log AI event:', error);
	}
}

/**
 * Extract and process metadata filter values from node parameters
 */
export function getMetadataFiltersValues(
	context: IExecuteFunctions,
	itemIndex: number,
): Record<string, any> {
	try {
		const metadata = context.getNodeParameter('options.metadata', itemIndex, {}) as any;
		
		if (!metadata || !metadata.metadataValues) {
			return {};
		}

		const filters: Record<string, any> = {};
		
		// Process metadata values array into a filter object
		if (Array.isArray(metadata.metadataValues)) {
			for (const item of metadata.metadataValues) {
				if (item.name && item.value !== undefined) {
					filters[item.name] = item.value;
				}
			}
		}

		return filters;
	} catch (error) {
		// Return empty object if there's an error processing metadata
		console.warn('Failed to process metadata filters:', error);
		return {};
	}
}

/**
 * Safely extract value from node parameter with fallback
 */
export function getNodeParameterSafe<T>(
	context: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
	defaultValue: T,
): T {
	try {
		return context.getNodeParameter(parameterName, itemIndex, defaultValue) as T;
	} catch (error) {
		console.warn(`Failed to get parameter ${parameterName}:`, error);
		return defaultValue;
	}
}

/**
 * Validate required parameters are present
 */
export function validateRequiredParameters(
	context: IExecuteFunctions,
	itemIndex: number,
	requiredParams: string[],
): void {
	const missing: string[] = [];
	
	for (const param of requiredParams) {
		try {
			const value = context.getNodeParameter(param, itemIndex);
			if (value === undefined || value === null || value === '') {
				missing.push(param);
			}
		} catch (error) {
			missing.push(param);
		}
	}
	
	if (missing.length > 0) {
		throw new Error(`Missing required parameters: ${missing.join(', ')}`);
	}
}

/**
 * Format error messages consistently
 */
export function formatErrorMessage(error: unknown, context?: string): string {
	const baseMessage = context ? `${context}: ` : '';
	
	if (error instanceof Error) {
		return `${baseMessage}${error.message}`;
	}
	
	if (typeof error === 'string') {
		return `${baseMessage}${error}`;
	}
	
	return `${baseMessage}Unknown error occurred`;
}