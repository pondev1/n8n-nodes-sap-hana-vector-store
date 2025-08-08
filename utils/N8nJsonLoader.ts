import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { Document } from '@langchain/core/documents';

/**
 * N8nJsonLoader - Converts n8n workflow data to LangChain documents
 * This loader processes JSON data from n8n workflow items into Document format
 */
export class N8nJsonLoader {
	private context: IExecuteFunctions;

	constructor(context: IExecuteFunctions) {
		this.context = context;
	}

	/**
	 * Process a single workflow item into documents
	 */
	async processItem(
		itemData: INodeExecutionData,
		itemIndex: number,
	): Promise<Document[]> {
		try {
			const documents: Document[] = [];
			
			// Extract content from the item's JSON data
			const jsonData = itemData.json;
			
			// Try to find content in common fields
			const content = this.extractContent(jsonData);
			const metadata = this.extractMetadata(jsonData, itemIndex);

			if (content) {
				documents.push(
					new Document({
						pageContent: content,
						metadata,
					}),
				);
			}

			return documents;
		} catch (error) {
			console.warn(`Failed to process item ${itemIndex}:`, error);
			return [];
		}
	}

	/**
	 * Process all workflow items into documents
	 */
	async processAll(items: INodeExecutionData[]): Promise<Document[]> {
		const allDocuments: Document[] = [];

		for (let i = 0; i < items.length; i++) {
			const documents = await this.processItem(items[i], i);
			allDocuments.push(...documents);
		}

		return allDocuments;
	}

	/**
	 * Extract text content from JSON data
	 * Looks for common content fields and concatenates them
	 */
	private extractContent(jsonData: any): string {
		if (!jsonData || typeof jsonData !== 'object') {
			return String(jsonData || '');
		}

		// Common content field names to look for
		const contentFields = [
			'content',
			'text',
			'body',
			'description',
			'message',
			'pageContent',
			'data',
			'value',
		];

		// Try to find content in priority order
		for (const field of contentFields) {
			if (jsonData[field] && typeof jsonData[field] === 'string') {
				return jsonData[field];
			}
		}

		// If no specific content field found, try to extract all string values
		const stringValues: string[] = [];
		this.extractStringValues(jsonData, stringValues);

		return stringValues.join(' ').trim();
	}

	/**
	 * Recursively extract string values from an object
	 */
	private extractStringValues(obj: any, values: string[], depth: number = 0): void {
		// Prevent infinite recursion
		if (depth > 3) return;

		if (typeof obj === 'string' && obj.trim().length > 0) {
			values.push(obj.trim());
		} else if (typeof obj === 'object' && obj !== null) {
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					this.extractStringValues(obj[key], values, depth + 1);
				}
			}
		}
	}

	/**
	 * Extract metadata from JSON data
	 * Excludes content fields and includes other useful information
	 */
	private extractMetadata(jsonData: any, itemIndex: number): Record<string, any> {
		const metadata: Record<string, any> = {
			source: 'n8n-workflow',
			itemIndex,
		};

		if (!jsonData || typeof jsonData !== 'object') {
			return metadata;
		}

		// Fields to exclude from metadata (these are considered content)
		const excludeFields = new Set([
			'content',
			'text',
			'body',
			'description',
			'message',
			'pageContent',
		]);

		// Include other fields as metadata
		for (const [key, value] of Object.entries(jsonData)) {
			if (!excludeFields.has(key)) {
				// Only include simple values in metadata
				if (
					typeof value === 'string' ||
					typeof value === 'number' ||
					typeof value === 'boolean' ||
					value === null
				) {
					metadata[key] = value;
				} else if (typeof value === 'object') {
					// For objects, stringify them but limit size
					const stringified = JSON.stringify(value);
					if (stringified.length < 1000) {
						metadata[key] = stringified;
					}
				}
			}
		}

		return metadata;
	}

	/**
	 * Load documents from current workflow execution data
	 */
	async load(): Promise<Document[]> {
		const items = this.context.getInputData();
		return await this.processAll(items);
	}

	/**
	 * Static method to quickly create documents from n8n data
	 */
	static async fromWorkflowData(
		context: IExecuteFunctions,
		items?: INodeExecutionData[],
	): Promise<Document[]> {
		const loader = new N8nJsonLoader(context);
		
		if (items) {
			return await loader.processAll(items);
		}
		
		return await loader.load();
	}
}