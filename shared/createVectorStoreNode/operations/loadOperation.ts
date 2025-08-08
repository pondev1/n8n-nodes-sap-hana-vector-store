import { IExecuteFunctions, INodeExecutionData, NodeConnectionTypes } from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';

import { getMetadataFiltersValues, logAiEvent } from '../../../utils/helpers';

interface VectorStore {
	similaritySearchVectorWithScore(
		query: number[],
		k: number,
		filter?: any,
	): Promise<[Document, number][]>;
}

interface VectorStoreNodeArgs {
	getVectorStoreClient(
		context: IExecuteFunctions,
		filter: any,
		embeddings: Embeddings,
		itemIndex: number,
	): Promise<VectorStore>;
	releaseVectorStoreClient?(vectorStore: VectorStore): void;
	[key: string]: any;
}

interface Reranker {
	compressDocuments(documents: Document[], query: string): Promise<Document[]>;
}

export async function handleLoadOperation(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs,
	embeddings: Embeddings,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const filter = getMetadataFiltersValues(context, itemIndex);
	const vectorStore = await args.getVectorStoreClient(
		context,
		// We'll pass filter to similaritySearchVectorWithScore instead of getVectorStoreClient
		undefined,
		embeddings,
		itemIndex,
	);

	try {
		const prompt = context.getNodeParameter("prompt", itemIndex) as string;
		const topK = context.getNodeParameter("topK", itemIndex, 4) as number;
		const useReranker = context.getNodeParameter("useReranker", itemIndex, false) as boolean;
		const includeDocumentMetadata = context.getNodeParameter(
			"includeDocumentMetadata",
			itemIndex,
			true,
		) as boolean;

		const embeddedPrompt = await embeddings.embedQuery(prompt);
		let docs = await vectorStore.similaritySearchVectorWithScore(embeddedPrompt, topK, filter);

		if (useReranker && docs.length > 0) {
			const reranker = await context.getInputConnectionData(
				NodeConnectionTypes.AiReranker,
				0,
			) as Reranker;
			const documents = docs.map(([doc]) => doc);
			const rerankedDocuments = await reranker.compressDocuments(documents, prompt);
			docs = rerankedDocuments.map((doc) => {
				const { relevanceScore, ...metadata } = doc.metadata || {};
				return [{ ...doc, metadata }, relevanceScore as number];
			});
		}

		const serializedDocs = docs.map(([doc, score]) => {
			const document = {
				pageContent: String(doc.pageContent),
				...(includeDocumentMetadata && doc.metadata ? { metadata: doc.metadata } : {}),
			};
			
			const executionData: INodeExecutionData = {
				json: { 
					document, 
					score: Number(score) 
				},
				pairedItem: {
					item: itemIndex,
				},
			};
			
			return executionData;
		});

		logAiEvent(context, "ai-vector-store-searched", { query: prompt });
		return serializedDocs;
	} finally {
		args.releaseVectorStoreClient?.(vectorStore);
	}
}