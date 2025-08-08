import { IExecuteFunctions, NodeConnectionTypes, nodeNameToToolName } from 'n8n-workflow';
import { DynamicTool } from 'langchain/tools';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';

import { getMetadataFiltersValues } from '../../../utils/helpers';
import { logWrapper } from '../../../utils/logWrapper';

interface VectorStore {
	similaritySearchVectorWithScore(
		query: number[],
		k: number,
		filter?: any,
	): Promise<[Document, number][]>;
	[key: string]: any;
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

interface ToolResponse {
	response: DynamicTool;
}

export async function handleRetrieveAsToolOperation(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs,
	embeddings: Embeddings,
	itemIndex: number,
): Promise<ToolResponse> {
	const toolDescription = context.getNodeParameter("toolDescription", itemIndex) as string;
	const node = context.getNode();
	const { typeVersion } = node;

	const toolName = typeVersion < 1.3 
		? context.getNodeParameter("toolName", itemIndex) as string
		: nodeNameToToolName(node);

	const topK = context.getNodeParameter("topK", itemIndex, 4) as number;
	const useReranker = context.getNodeParameter("useReranker", itemIndex, false) as boolean;
	const includeDocumentMetadata = context.getNodeParameter(
		"includeDocumentMetadata",
		itemIndex,
		true,
	) as boolean;

	const filter = getMetadataFiltersValues(context, itemIndex);

	const vectorStoreTool = new DynamicTool({
		name: toolName,
		description: toolDescription,
		func: async (input: string) => {
			const vectorStore = await args.getVectorStoreClient(
				context,
				filter,
				embeddings,
				itemIndex,
			);

			try {
				const embeddedPrompt = await embeddings.embedQuery(input);
				let documents = await vectorStore.similaritySearchVectorWithScore(
					embeddedPrompt,
					topK,
					filter,
				);

				if (useReranker && documents.length > 0) {
					const reranker = await context.getInputConnectionData(
						NodeConnectionTypes.AiReranker,
						0,
					) as Reranker;
					const docs = documents.map(([doc]) => doc);
					const rerankedDocuments = await reranker.compressDocuments(docs, input);
					documents = rerankedDocuments.map((doc) => {
						const { relevanceScore, ...metadata } = doc.metadata;
						return [{ ...doc, metadata }, relevanceScore as number];
					});
				}

				return documents
					.map((document) => {
						if (includeDocumentMetadata) {
							return { type: "text", text: JSON.stringify(document[0]) };
						}
						return {
							type: "text",
							text: JSON.stringify({ pageContent: document[0].pageContent }),
						};
					})
					.filter((document) => !!document);
			} finally {
				args.releaseVectorStoreClient?.(vectorStore);
			}
		},
	});

	return {
		response: logWrapper(vectorStoreTool, context),
	};
}