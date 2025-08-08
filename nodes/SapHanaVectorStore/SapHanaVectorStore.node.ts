import { HanaDB, HanaDBArgs } from '@langchain/community/vectorstores/hanavector';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createVectorStoreNode } from '../../shared/createVectorStoreNode/createVectorStoreNode';

// Define metadataFilterField locally
const metadataFilterField = {
	displayName: 'Metadata Filter',
	name: 'metadata',
	type: 'fixedCollection' as const,
	description: 'Metadata to filter the document by',
	typeOptions: {
		multipleValues: true,
	},
	default: {},
	placeholder: 'Add filter field',
	options: [
		{
			name: 'metadataValues',
			displayName: 'Fields to Set',
			values: [
				{
					displayName: 'Name',
					name: 'name',
					type: 'string' as const,
					default: '',
					required: true,
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string' as const,
					default: '',
				},
			],
		},
	],
};

// SAP HANA specific field definitions
const sharedFields = [
	{
		displayName: 'Table Name',
		name: 'tableName',
		type: 'string' as const,
		default: 'n8n_vectors',
		description: 'The table name to store the vectors in. If table does not exist, it will be created.',
		required: true,
	},
];

const columnNamesField = {
	displayName: 'Column Names',
	name: 'columnNames',
	type: 'fixedCollection' as const,
	description: 'The names of the columns in the SAP HANA table',
	default: {
		values: {
			contentColumnName: 'VEC_TEXT',
			metadataColumnName: 'VEC_META',
			vectorColumnName: 'VEC_VECTOR',
		},
	},
	typeOptions: {},
	placeholder: 'Set Column Names',
	options: [
		{
			name: 'values',
			displayName: 'Column Name Settings',
			values: [
				{
					displayName: 'Content Column Name',
					name: 'contentColumnName',
					type: 'string' as const,
					default: 'VEC_TEXT',
					required: true,
					description: 'Column name for storing document content',
				},
				{
					displayName: 'Metadata Column Name',
					name: 'metadataColumnName',
					type: 'string' as const,
					default: 'VEC_META',
					required: true,
					description: 'Column name for storing document metadata (JSON)',
				},
				{
					displayName: 'Vector Column Name',
					name: 'vectorColumnName',
					type: 'string' as const,
					default: 'VEC_VECTOR',
					required: true,
					description: 'Column name for storing vector embeddings',
				},
			],
		},
	],
};

const distanceStrategyField = {
	displayName: 'Distance Strategy',
	name: 'distanceStrategy',
	type: 'options' as const,
	default: 'cosine',
	description: 'The method to calculate the distance between two vectors',
	options: [
		{
			name: 'Cosine Similarity',
			value: 'cosine',
		},
		{
			name: 'Euclidean Distance',
			value: 'euclidean',
		},
	],
};

const schemaField = {
	displayName: 'Schema Name',
	name: 'schemaName',
	type: 'string' as const,
	default: '',
	description: 'Database schema name (optional, uses default schema if not specified)',
	placeholder: 'e.g. VECTOR_SCHEMA',
};

const insertFields = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection' as const,
		placeholder: 'Add Option',
		default: {},
		options: [
			columnNamesField,
			schemaField,
			{
				displayName: 'Clear Table',
				name: 'clearTable',
				type: 'boolean' as const,
				default: false,
				description: 'Whether to clear the table before inserting new data',
			},
		],
	},
];

const retrieveFields = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection' as const,
		placeholder: 'Add Option',
		default: {},
		options: [distanceStrategyField, columnNamesField, schemaField, metadataFilterField],
	},
];

// Interface definitions for SAP HANA Cloud - Updated to match credential file
interface HanaCredentials {
	host: string;
	port: number;
	username: string;
	password: string;
	database?: string;
	schema?: string;
	options?: {
		encrypt?: boolean;
		sslValidateCertificate?: boolean;
		connectTimeout?: number;
		autocommit?: boolean;
		useCesu8?: boolean;
	};
}

function getFullTableName(schema?: string, tableName?: string): string {
	if (!tableName) throw new Error('Table name is required');

	const cleanTable = tableName.trim();
	if (schema && schema.trim()) {
		const cleanSchema = schema.trim();

		// If schema ends with _RT (runtime schema), do not prefix schema
		if (cleanSchema.endsWith('_RT')) {
			// Use just the table name without schema prefix for HDI runtime
			return `"${cleanTable}"`;
		} else {
			return `"${cleanSchema}"."${cleanTable}"`;
		}
	} else {
		return `"${cleanTable}"`;
	}
}


// Extended HanaDB class for n8n integration using hdb client (LangChain JS approach)
class ExtendedHanaDB extends HanaDB {
	private _connection: any;

	static async initialize(embeddings: Embeddings, credentials: HanaCredentials, tableName: string, options: any): Promise<ExtendedHanaDB> {
		let hanaClient: any;
		try {
			// Use hdb package as per LangChain JavaScript documentation
			hanaClient = require('hdb');
		} catch (requireError) {
			throw new Error('hdb package is required for SAP HANA integration. Install it with: npm install hdb');
		}

		// Connection parameters based on official SAP hdb client documentation
		const connectionParams = {
			host: credentials.host,        // Standard hdb parameter
			port: credentials.port,        // Standard hdb parameter  
			user: credentials.username,    // Official hdb parameter (NOT uid)
			password: credentials.password, // Official hdb parameter (NOT pwd)
		};

		console.log('Attempting HANA Cloud connection with official hdb client pattern:', {
			host: connectionParams.host,
			port: connectionParams.port,
			user: connectionParams.user ? '[PRESENT]' : '[MISSING]',
			password: connectionParams.password ? '[PRESENT]' : '[MISSING]'
		});

		const client = hanaClient.createClient(connectionParams);

		// Connect to HANA DB - following LangChain documentation pattern
		await new Promise<void>((resolve, reject) => {
			client.connect((err: any) => {
				if (err) {
					reject(new Error(`SAP HANA connection failed: ${err.message}`));
				} else {
					console.log("Connected to SAP HANA successfully.");
					resolve();
				}
			});
		});


		if (credentials.schema) {
			await new Promise<void>((resolve) => {
				client.exec(`SET SCHEMA "${credentials.schema}"`, (err: any) => {
					if (err) console.warn('Schema set warning:', err.message);
					resolve();
				console.log('Success setting schema:', credentials.schema);
				});
			});
		}
		// Create HanaDB instance using the official LangChain approach
		const hanaArgs: HanaDBArgs = {
			connection: client,
			tableName: tableName,
			distanceStrategy: options.distanceStrategy === 'euclidean' ? 'euclidean' : 'cosine',
		};

		// Add custom column names if specified
		const columnNames = options.columnNames?.values || {};
		if (columnNames.contentColumnName && columnNames.contentColumnName !== 'VEC_TEXT') {
			hanaArgs.contentColumn = columnNames.contentColumnName;
		}
		if (columnNames.metadataColumnName && columnNames.metadataColumnName !== 'VEC_META') {
			hanaArgs.metadataColumn = columnNames.metadataColumnName;
		}
		if (columnNames.vectorColumnName && columnNames.vectorColumnName !== 'VEC_VECTOR') {
			hanaArgs.vectorColumn = columnNames.vectorColumnName;
		}

		const hanaVectorStore = new ExtendedHanaDB(embeddings, hanaArgs);
		hanaVectorStore._connection = client;

		return hanaVectorStore;
	}

	async similaritySearchVectorWithScore(
		query: number[],
		k: number,
		filter?: any,
	): Promise<[Document, number][]> {
		const mergedFilter = { ...filter };
		return await super.similaritySearchVectorWithScore(query, k, mergedFilter);
	}

	// Add similaritySearch method for better n8n integration
	async similaritySearch(
		query: string,
		k = 4,
		filter?: any,
		_callbacks?: any,
	): Promise<Document[]> {
		// This method ensures compatibility with n8n's logWrapper
		const results = await super.similaritySearch(query, k, filter);
		return results;
	}

	close(): void {
		if (this._connection && this._connection.disconnect) {
			this._connection.disconnect();
			this._connection = null;
		}
	}
}

export class SapHanaVectorStore extends createVectorStoreNode({
	meta: {
		description: 'Work with your data in SAP HANA Vector Store using LangChain',
		icon: 'file:sap-hana.svg',
		displayName: 'SAP HANA Vector Store',
		docsUrl: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresaphana/',
		name: 'vectorStoreSAPHana',
		credentials: [
			{
				name: 'sapHanaApi',
				required: true,
			},
		],
		operationModes: ['load', 'insert', 'retrieve', 'retrieve-as-tool'],
		categories: ['AI', 'Database'],                    
		subcategories: {                                   
			AI: ['Vector Stores', 'Tools'],
			Database: ['Vector Database'],
			'Vector Stores': ['Database Vector Stores', 'Enterprise Vector Stores'],
			Tools: ['Database Tools', 'AI Tools'],
		},
	},
	sharedFields,
	insertFields,
	loadFields: retrieveFields,
	retrieveFields,

	async getVectorStoreClient(
		context: IExecuteFunctions,
		filter: any,
		embeddings: Embeddings,
		itemIndex: number,
	): Promise<ExtendedHanaDB> {
		try {
			const tableName = context.getNodeParameter('tableName', itemIndex, 'n8n_vectors', {
				extractValue: true,
			}) as string;
			
			const options = context.getNodeParameter('options', itemIndex, {}) as any;
			const credentials = (await context.getCredentials('sapHanaApi')) as HanaCredentials;

			// Validate required parameters
			if (!tableName) {
				throw new Error('Table name is required');
			}
			if (!credentials) {
				throw new Error('SAP HANA credentials are required');
			}

			const vectorStore = await ExtendedHanaDB.initialize(embeddings, credentials, tableName, options);




			return vectorStore;
		} catch (initError) {
			const errorMessage = initError instanceof Error ? initError.message : String(initError);
			throw new NodeOperationError(
				context.getNode(), 
				`Failed to initialize SAP HANA vector store: ${errorMessage}`, 
				{ itemIndex }
			);
		}
	},

	async populateVectorStore(
		context: IExecuteFunctions,
		embeddings: Embeddings,
		documents: Document[],
		itemIndex: number,
	): Promise<void> {
		let client: any = null;

		try {
			const tableName = context.getNodeParameter('tableName', itemIndex, 'n8n_vectors', {
				extractValue: true,
			}) as string;
			
			const options = context.getNodeParameter('options', itemIndex, {}) as any;
			const credentials = (await context.getCredentials('sapHanaApi')) as HanaCredentials;

			// Validate required parameters
			if (!tableName) {
				throw new Error('Table name is required');
			}
			if (!credentials) {
				throw new Error('SAP HANA credentials are required');
			}

			let hanaClient: any;
			try {
				// Use hdb package as per LangChain JavaScript documentation
				hanaClient = require('hdb');
			} catch (requireError) {
				throw new Error('hdb package is required for SAP HANA integration. Install it with: npm install hdb');
			}

			// Connection parameters based on official SAP hdb client documentation
			const connectionParams = {
				host: credentials.host,        // Standard hdb parameter
				port: credentials.port,        // Standard hdb parameter  
				user: credentials.username,    // Official hdb parameter (NOT uid)
				password: credentials.password, // Official hdb parameter (NOT pwd)
			};

			client = hanaClient.createClient(connectionParams);

			// Connect to HANA DB - following LangChain documentation pattern
			await new Promise<void>((resolve, reject) => {
				client.connect((err: any) => {
					if (err) {
						reject(new Error(`SAP HANA connection failed: ${err.message}`));
					} else {
						resolve();
					}
				});
			});

			if (credentials.schema) {
				await new Promise<void>((resolve) => {
					client.exec(`SET SCHEMA "${credentials.schema}"`, (err: any) => {
						if (err) console.warn('Schema set warning:', err.message);
						resolve();
					});
				});
			}
			// Clear table if requested
			if (options.clearTable) {
				try {
					await new Promise<void>((resolve) => {
						client.exec(`DELETE FROM ${tableName}`, (err: any) => {
							if (err && !err.message.includes('table not found')) {
								context.logger.warn(`Could not clear table ${tableName}: ${err.message}`);
							}
							resolve();
						});
					});
				} catch (clearError) {
					const errorMessage = clearError instanceof Error ? clearError.message : String(clearError);
					context.logger.warn(`Table clear failed: ${errorMessage}`);
				}
			}
			
			if (credentials.schema) {
				await new Promise<void>((resolve) => {
					client.exec(`SET SCHEMA "${credentials.schema}"`, (err: any) => {
						if (err) console.warn('Schema set warning:', err.message);
						resolve();
					});
				});
			}
			
			// Prepare HanaDB arguments
			const columnNames = options.columnNames?.values || {};
			const hanaArgs: HanaDBArgs = {
				connection: client,
				tableName: tableName,
			};

			// Add custom column names if specified
			if (columnNames.contentColumnName && columnNames.contentColumnName !== 'VEC_TEXT') {
				hanaArgs.contentColumn = columnNames.contentColumnName;
			}
			if (columnNames.metadataColumnName && columnNames.metadataColumnName !== 'VEC_META') {
				hanaArgs.metadataColumn = columnNames.metadataColumnName;
			}
			if (columnNames.vectorColumnName && columnNames.vectorColumnName !== 'VEC_VECTOR') {
				hanaArgs.vectorColumn = columnNames.vectorColumnName;
			}

			// Use the official LangChain fromDocuments method
			await HanaDB.fromDocuments(documents, embeddings, hanaArgs);

		} catch (populateError) {
			const errorMessage = populateError instanceof Error ? populateError.message : String(populateError);
			throw new NodeOperationError(
				context.getNode(),
				`SAP HANA vector store population failed: ${errorMessage}`,
				{ itemIndex },
			);
		} finally {
			if (client && client.disconnect) {
				try {
					client.disconnect();
				} catch (disconnectError) {
					context.logger.warn('Failed to disconnect SAP HANA client');
				}
			}
		}
	},

	releaseVectorStoreClient(vectorStore: ExtendedHanaDB): void {
		if (vectorStore && typeof vectorStore.close === 'function') {
			vectorStore.close();
		}
	},
}) {}