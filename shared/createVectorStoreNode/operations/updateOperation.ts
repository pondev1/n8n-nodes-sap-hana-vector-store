import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';

import { logAiEvent } from '../../../utils/helpers';
import { N8nJsonLoader } from '../../../utils/N8nJsonLoader';
import { processDocument } from '../../processDocuments';
import { isUpdateSupported } from '../utils';

interface VectorStore {
	addDocuments(documents: Document[], options?: { ids: string[] }): Promise<void>;
	[key: string]: any;
}

interface VectorStoreNodeMeta {
	displayName: string;
	name: string;
	description: string;
	icon: string;
	iconColor?: string;
	docsUrl: string;
	credentials: Array<{
		name: string;
		required: boolean;
		testedBy?: string;
	}>;
	operationModes: string[];
	categories?: string[];
	subcategories?: Record<string, string[]>;
}

interface VectorStoreNodeArgs {
	meta: VectorStoreNodeMeta;
	sharedFields: any[];
	insertFields?: any[];
	loadFields?: any[];
	retrieveFields?: any[];
	updateFields?: any[];
	methods?: any;
	getVectorStoreClient(
		context: IExecuteFunctions,
		filter: any,
		embeddings: Embeddings,
		itemIndex: number,
	): Promise<VectorStore>;
	populateVectorStore(
		context: IExecuteFunctions,
		embeddings: Embeddings,
		documents: Document[],
		itemIndex: number,
	): Promise<void>;
	releaseVectorStoreClient?(vectorStore: VectorStore): void;
	[key: string]: any;
}

export async function handleUpdateOperation(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs,
	embeddings: Embeddings,
): Promise<INodeExecutionData[]> {
	if (!isUpdateSupported(args)) {
		throw new NodeOperationError(
			context.getNode(),
			"Update operation is not implemented for this Vector Store",
		);
	}

	const items = context.getInputData();
	const loader = new N8nJsonLoader(context);
	const resultData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		const itemData = items[itemIndex];
		const documentId = context.getNodeParameter("id", itemIndex, "", {
			extractValue: true,
		}) as string;

		const vectorStore = await args.getVectorStoreClient(context, undefined, embeddings, itemIndex);

		try {
			const { processedDocuments, serializedDocuments } = await processDocument(
				loader,
				itemData,
				itemIndex,
			);

			if (processedDocuments?.length !== 1) {
				throw new NodeOperationError(context.getNode(), "Single document per item expected");
			}

			resultData.push(...serializedDocuments);

			await vectorStore.addDocuments(processedDocuments, {
				ids: [documentId],
			});

			logAiEvent(context, "ai-vector-store-updated");
		} finally {
			args.releaseVectorStoreClient?.(vectorStore);
		}
	}

	return resultData;
}