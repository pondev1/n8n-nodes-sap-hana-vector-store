import { IExecuteFunctions, INodeExecutionData, NodeConnectionTypes } from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';

import { logAiEvent } from '../../../utils/helpers';
import { processDocument } from '../../processDocuments';

interface VectorStoreNodeArgs {
	populateVectorStore(
		context: IExecuteFunctions,
		embeddings: Embeddings,
		documents: Document[],
		itemIndex: number,
	): Promise<void>;
	[key: string]: any;
}

export async function handleInsertOperation(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs,
	embeddings: Embeddings,
): Promise<INodeExecutionData[]> {
	const nodeVersion = context.getNode().typeVersion;
	const items = context.getInputData();
	
	// Use NodeConnectionTypes.AiDocument as confirmed by the compiled JS
	const documentInput = await context.getInputConnectionData(NodeConnectionTypes.AiDocument, 0);

	const resultData: INodeExecutionData[] = [];
	const documentsForEmbedding: Document[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		if (context.getExecutionCancelSignal()?.aborted) {
			break;
		}

		const itemData = items[itemIndex];
		const processedDocuments = await processDocument(documentInput as any, itemData, itemIndex);

		resultData.push(...processedDocuments.serializedDocuments);
		documentsForEmbedding.push(...processedDocuments.processedDocuments);

		if (nodeVersion === 1) {
			await args.populateVectorStore(
				context,
				embeddings,
				processedDocuments.processedDocuments,
				itemIndex,
			);
		}

		logAiEvent(context, "ai-vector-store-populated");
	}

	if (nodeVersion >= 1.1) {
		const embeddingBatchSize = (context.getNodeParameter("embeddingBatchSize", 0, 200) as number) ?? 200;
		for (let i = 0; i < documentsForEmbedding.length; i += embeddingBatchSize) {
			const nextBatch = documentsForEmbedding.slice(i, i + embeddingBatchSize);
			await args.populateVectorStore(context, embeddings, nextBatch, 0);
		}
	}

	return resultData;
}