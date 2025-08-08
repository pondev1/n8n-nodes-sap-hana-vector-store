import { IExecuteFunctions, NodeConnectionTypes } from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';

import { getMetadataFiltersValues } from '../../../utils/helpers';
import { logWrapper } from '../../../utils/logWrapper';

interface VectorStore {
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
	[key: string]: any;
}

interface RetrieveResponse {
	response: VectorStore | { reranker: Reranker; vectorStore: VectorStore };
	closeFunction?: () => Promise<void>;
}

export async function handleRetrieveOperation(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs,
	embeddings: Embeddings,
	itemIndex: number,
): Promise<RetrieveResponse> {
	const filter = getMetadataFiltersValues(context, itemIndex);
	const useReranker = context.getNodeParameter("useReranker", itemIndex, false) as boolean;

	const vectorStore = await args.getVectorStoreClient(context, filter, embeddings, itemIndex);

	let response: VectorStore | { reranker: Reranker; vectorStore: VectorStore };

	if (useReranker) {
		const reranker = await context.getInputConnectionData(
			NodeConnectionTypes.AiReranker,
			0,
		) as Reranker;
		response = {
			reranker,
			vectorStore: logWrapper(vectorStore, context),
		};
	} else {
		response = logWrapper(vectorStore, context);
	}

	return {
		response,
		closeFunction: async () => {
			args.releaseVectorStoreClient?.(vectorStore);
		},
	};
}