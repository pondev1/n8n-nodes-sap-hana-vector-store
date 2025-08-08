import { INodeExecutionData } from 'n8n-workflow';
import { Document } from '@langchain/core/documents';
import { N8nJsonLoader } from '../utils/N8nJsonLoader';

/**
 * Interface for document processing results
 */
interface ProcessDocumentResult {
	processedDocuments: Document[];
	serializedDocuments: INodeExecutionData[];
}

/**
 * Interface for document loaders
 */
interface DocumentLoader {
	processItem?(itemData: INodeExecutionData, itemIndex: number): Promise<Document[]>;
	processAll?(items: INodeExecutionData[]): Promise<Document[]>;
}

/**
 * Process multiple documents from workflow items
 */
export async function processDocuments(
	documentInput: DocumentLoader | Document[],
	inputItems: INodeExecutionData[],
): Promise<ProcessDocumentResult> {
	let processedDocuments: Document[];

	// Handle different input types
	if (Array.isArray(documentInput)) {
		// If it's already an array of documents, use as-is
		processedDocuments = documentInput;
	} else if (documentInput instanceof N8nJsonLoader) {
		// Use N8nJsonLoader to process items
		processedDocuments = await documentInput.processAll(inputItems);
	} else if (documentInput && typeof documentInput.processAll === 'function') {
		// Use any loader with processAll method
		processedDocuments = await documentInput.processAll(inputItems);
	} else {
		// Fallback: treat as documents array
		processedDocuments = Array.isArray(documentInput) ? documentInput : [];
	}

	// Serialize documents for n8n workflow
	const serializedDocuments: INodeExecutionData[] = processedDocuments.map(
		({ metadata, pageContent }) => ({
			json: { 
				metadata: metadata || {}, 
				pageContent: pageContent || '' 
			},
		}),
	);

	return {
		processedDocuments,
		serializedDocuments,
	};
}

/**
 * Process a single document from a workflow item
 */
export async function processDocument(
	documentInput: DocumentLoader | Document[],
	inputItem: INodeExecutionData,
	itemIndex: number,
): Promise<ProcessDocumentResult> {
	let processedDocuments: Document[];

	// Handle different input types
	if (Array.isArray(documentInput)) {
		// If it's already an array of documents, use as-is
		processedDocuments = documentInput;
	} else if (documentInput instanceof N8nJsonLoader) {
		// Use N8nJsonLoader to process single item
		processedDocuments = await documentInput.processItem(inputItem, itemIndex);
	} else if (documentInput && typeof documentInput.processItem === 'function') {
		// Use any loader with processItem method
		processedDocuments = await documentInput.processItem(inputItem, itemIndex);
	} else {
		// Fallback: treat as documents array
		processedDocuments = Array.isArray(documentInput) ? documentInput : [];
	}

	// Serialize documents for n8n workflow with pairedItem reference
	const serializedDocuments: INodeExecutionData[] = processedDocuments.map(
		({ metadata, pageContent }) => ({
			json: { 
				metadata: metadata || {}, 
				pageContent: pageContent || '' 
			},
			pairedItem: {
				item: itemIndex,
			},
		}),
	);

	return {
		processedDocuments,
		serializedDocuments,
	};
}

/**
 * Validate document structure
 */
export function validateDocument(doc: any): doc is Document {
	return (
		doc &&
		typeof doc === 'object' &&
		typeof doc.pageContent === 'string' &&
		(doc.metadata === undefined || typeof doc.metadata === 'object')
	);
}

/**
 * Clean and normalize document content
 */
export function normalizeDocument(doc: Document): Document {
	return new Document({
		pageContent: doc.pageContent?.trim() || '',
		metadata: {
			...doc.metadata,
			// Add processing timestamp
			processedAt: new Date().toISOString(),
		},
	});
}

/**
 * Batch process documents with size limits
 */
export async function batchProcessDocuments(
	documents: Document[],
	batchSize: number = 100,
	processor: (batch: Document[]) => Promise<void>,
): Promise<void> {
	for (let i = 0; i < documents.length; i += batchSize) {
		const batch = documents.slice(i, i + batchSize);
		await processor(batch);
	}
}

/**
 * Filter documents by content length or other criteria
 */
export function filterDocuments(
	documents: Document[],
	filters: {
		minLength?: number;
		maxLength?: number;
		requiredFields?: string[];
	} = {},
): Document[] {
	const { minLength = 0, maxLength = Infinity, requiredFields = [] } = filters;

	return documents.filter((doc) => {
		// Check content length
		const contentLength = doc.pageContent.length;
		if (contentLength < minLength || contentLength > maxLength) {
			return false;
		}

		// Check required metadata fields
		for (const field of requiredFields) {
			if (!doc.metadata || !(field in doc.metadata)) {
				return false;
			}
		}

		return true;
	});
}